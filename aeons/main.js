import * as THREE from 'three';
import { mulberry32, mergeParts, tileModel, centerModel, buildingModel, roadGeo, laneGeo, lampGeos, carGeo, podGeo, boatGeos, birdGeo, sceneryGeos, wonderModel, starshipModel, WONDERS, personGeo, planeGeo, satelliteGeo, treeGeos, cloudGeo } from './models.js?v=2.9';
import { createScore } from './music.js?v=2.9';

// =====================================================================
// AEONS: shape a small planet and guide its people from the first fire
// to the stars. Raise and lower the land so settlements can grow, gather
// knowledge, build a wonder in each age, survive fires, plagues, storms,
// rising seas and meteors, and finally launch the Starship.
// =====================================================================

const APP_VERSION = '2.9';
const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = Math.random;
const fmt = (n) => Math.round(n).toLocaleString('en-US');

// ------------------------------------------------------------------ the ages
const ERAS = [
  { name: 'Stone Age', icon: '🔥', years: [-10000, -3000], need: 170, cost: 80, lvl: 2, desc: 'Your tribe gathers around the fire. Flatten the land so their camp can spread, and build hunting grounds and shrines from the Build tab.', color: '#d08a4a' },
  { name: 'Bronze Age', icon: '🏺', years: [-3000, -800], need: 750, cost: 150, lvl: 3, desc: 'Farms and metal tools. Build farms and workshops so towns spread wider. You can now plant forests and inspire your people.', color: '#d8a85a' },
  { name: 'Classical Age', icon: '🏛️', years: [-800, 500], need: 1800, cost: 220, lvl: 3, desc: 'Temples and philosophers, but also plague. Bless your people to heal them.', color: '#e9e2d2' },
  { name: 'Medieval Age', icon: '🏰', years: [500, 1750], need: 4300, cost: 300, lvl: 3, desc: 'Castles and cathedrals rise. Fires and plagues still roam the land.', color: '#a88ad8' },
  { name: 'Industrial Age', icon: '🏭', years: [1750, 1950], need: 11000, cost: 380, lvl: 4, desc: 'Factories boom. Pollution warms the planet: if its health falls, the seas will rise. Cleanse the skies, plant forests, raise the coasts.', color: '#c8704a' },
  { name: 'Modern Age', icon: '🏙️', years: [1950, 2060], need: 20000, cost: 480, lvl: 4, desc: 'Cities of glass and planes in the sky. Storms and meteors grow dangerous: you can now terraform and deflect.', color: '#5fa8ff' },
  { name: 'Space Age', icon: '🚀', years: [2060, 2200], need: 32000, cost: 650, lvl: 4, desc: 'The final age. Build the Starship and take your people to the stars.', color: '#5ff0ff' },
];
// every wonder you build leaves a lasting gift
const PERKS = ['+15% knowledge forever', 'Every town can spread 2 hexes further', '+1 ✦ per second forever', '+25% food in every town', 'Buildings cost 25% less', '+25% knowledge forever', 'Victory'];
const wCost = (era) => Math.round(ERAS[era].cost * (G.wonders.some((w) => w.tribe === 1 && w.era === era) ? 1.3 : 1));
const perk = (n, tribe = 0) => G.wonders.some((w) => (w.tribe || 0) === tribe && w.era === n);
const bCost = (b) => Math.round(b.cost * (perk(4) ? 0.75 : 1) * (G.relics?.includes('hammer') ? 0.8 : 1));
const WONDER_ICON = ['🪨', '🔺', '🏛️', '⛪', '🗼', '📡', '🚀'];
const WONDER_DESC = ['A ring of standing stones to read the sky.', 'A tomb for a god-king, built to last forever.', 'A temple of marble and reason.', 'Spires that reach for heaven.', 'An iron tower: the triumph of engineering.', 'A needle in the clouds, heart of a global network.', 'The ark that will carry your people to the stars.'];
const POWERS = [
  { id: 'level', name: 'Level', cost: 1, era: 0, r: 0, hint: 'Tap to level a 7-hex patch toward your nearest town. Tap a town centre to level all its arrows at once. Hold and drag to paint.' },
  { id: 'raise', name: 'Raise', cost: 1, era: 0, r: 0, hint: 'Tap a hex to raise it. Green ↑ arrows show where to raise so a town gets flat ground.' },
  { id: 'lower', name: 'Lower', cost: 1, era: 0, r: 0, hint: 'Tap a hex to lower it. Red ↓ arrows show where to lower. Below sea level it floods.' },
  { id: 'beacon', name: 'Beacon', cost: 20, era: 0, r: 0, hint: 'Plant a beacon: your next settlers head there to found a town. Tap again to move it.' },
  { id: 'war', name: 'Knight', cost: 80, era: 1, r: 0, hint: 'Tap a Crimson town: a knight leads half of your strongest town against it, and keeps conquering town after town.' },
  // the wrath of god: one new weapon against the Crimson in every age
  { id: 'bolt', name: 'Lightning', cost: 40, era: 0, r: 0, hint: 'Strike a Crimson town with lightning: it loses a third of its people and catches fire.' },
  { id: 'quake', name: 'Quake', cost: 120, era: 1, r: 2, hint: 'Shake the earth: the ground cracks into uneven steps, towns lose their land and buildings fall.' },
  { id: 'swamp', name: 'Swamp', cost: 110, era: 2, r: 1, hint: 'A deadly swamp for 90 seconds: any settler, raider or war band that walks into it sinks.' },
  { id: 'volcano', name: 'Volcano', cost: 240, era: 3, r: 2, hint: 'Raise a burning volcano: it buries everything around it.' },
  { id: 'plague', name: 'Pestilence', cost: 220, era: 4, r: 3, hint: 'Curse a Crimson town with plague: it spreads to their towns nearby. Hospitals resist it.' },
  { id: 'strike', name: 'Meteor', cost: 380, era: 5, r: 2, hint: 'Call down a meteor: a crater full of sea where a town stood.' },
  { id: 'orbital', name: 'Sun Lance', cost: 560, era: 6, r: 1, hint: 'A beam from orbit wipes a town off the map, and badly damages a Starship.' },
  { id: 'rain', name: 'Rain', cost: 30, era: 0, r: 3, hint: 'Rain makes the land fertile for a while and puts out fires.' },
  { id: 'forest', name: 'Forest', cost: 40, era: 1, r: 2, hint: 'Plant a forest: food, clean air and a healthier planet.' },
  { id: 'inspire', name: 'Inspire', cost: 90, era: 1, r: 5, hint: 'A spark of genius: settlements here make triple knowledge for a while.' },
  { id: 'bless', name: 'Bless', cost: 120, era: 2, r: 5, hint: 'Heals plague, calms storms, puts out fires and cheers people up.' },
  { id: 'cleanse', name: 'Cleanse', cost: 180, era: 4, r: 0, hint: 'Scrub the skies: the planet heals. Tap anywhere.' },
  { id: 'terraform', name: 'Terraform', cost: 150, era: 5, r: 2, hint: 'Flatten a whole area to the height of the spot you tap.' },
  { id: 'deflect', name: 'Shield', cost: 300, era: 5, r: 0, hint: 'Shoot down an incoming meteor, or shield your Starship from the Crimson god for 40 seconds. Tap anywhere.' },
];
const PW = Object.fromEntries(POWERS.map((p) => [p.id, p]));
// blessings: at every new age you choose one of three, and they stack for the rest of the run
const BOONS = [
  { id: 'harvest', icon: '🌾', name: 'Harvest Gods', fx: 'Towns grow 20% faster' },
  { id: 'scholars', icon: '📜', name: 'Scholars', fx: '+15% knowledge' },
  { id: 'devotion', icon: '✦', name: 'Devotion', fx: '+1 ✦ per second' },
  { id: 'walls', icon: '🛡️', name: 'Stone Walls', fx: 'Towns defend 40% better' },
  { id: 'gaia', icon: '🌳', name: 'Gaia', fx: 'The planet heals faster' },
  { id: 'sprawl', icon: '🏘️', name: 'Sprawl', fx: 'Towns spread over 1 more hex' },
  { id: 'warlords', icon: '⚔️', name: 'Warlords', fx: 'War bands fight 30% harder' },
  { id: 'oracles', icon: '⏳', name: 'Oracles', fx: 'Omens pay 50% more and last 15s longer' },
  { id: 'shapers', icon: '🪄', name: 'Earthshapers', fx: 'Every 10th stroke refunds 10 ✦' },
  { id: 'tide', icon: '🌊', name: 'Tide Callers', fx: 'Raiders drown for double ✦' },
];
const boon = (id) => (G.boons || []).filter((b) => b === id).length;
const RELICS = [
  { id: 'scroll', icon: '📜', name: 'Scroll of the Ancients', fx: '+20% knowledge forever' },
  { id: 'idol', icon: '🗿', name: 'Golden Idol', fx: '+1 ✦ per second forever' },
  { id: 'hammer', icon: '🔨', name: 'Builder\'s Hammer', fx: 'Buildings cost 20% less' },
  { id: 'seed', icon: '🌱', name: 'Seed of Eden', fx: 'Every town can spread 2 hexes further' },
  { id: 'spear', icon: '🗡️', name: 'Spear of Heroes', fx: 'Your warriors fight 40% harder' },
  { id: 'chalice', icon: '🏆', name: 'Healing Chalice', fx: 'The planet slowly heals, and plague cannot spread between your towns' },
  { id: 'compass', icon: '🧭', name: 'Star Compass', fx: 'Your towns grow 25% faster' },
];
const rel = (id) => G.relics?.includes(id);
const SHAPERS = new Set(['level', 'raise', 'lower', 'terraform']);
// treasures of the land: a town that covers or touches one gets its bonus
const RES = [null,
  { id: 'crystal', name: 'Crystals', icon: '💎', mana: 0.6, land: true, n: 10, desc: '+0.6 ✦/s' },
  { id: 'gold', name: 'Gold', icon: '🪙', mana: 0.3, know: 0.1, land: true, n: 9, desc: '+0.3 ✦/s, +10% knowledge' },
  { id: 'fish', name: 'Fish', icon: '🐟', food: 0.35, land: false, n: 16, desc: '+35% food' },
  { id: 'spring', name: 'Sacred Spring', icon: '⛲', know: 0.3, land: true, n: 8, desc: '+30% knowledge' },
  { id: 'ruins', name: 'Ancient Ruins', icon: '🏺', land: true, n: 5, desc: 'choose a relic' },
  { id: 'oil', name: 'Oil', icon: '🛢️', mana: 1, poll: 0.03, land: true, n: 10, era: 4, desc: '+1 ✦/s, but pollutes' },
];
// choices that come up as you play: each card offers two paths
const EVENTS = [
  { id: 'story', era: [0, 6], icon: '🔥', title: 'The Storyteller', text: 'A wanderer sits by your fire and tells of distant lands and older gods.',
    a: { label: 'Listen closely', fx: '+25% of the knowledge you need', run: () => gainKnow(0.25) }, b: { label: 'Ask for a blessing', fx: '+120 ✦', run: () => gainMana(120) } },
  { id: 'harvest', era: [0, 4], icon: '🌾', title: 'A Bountiful Harvest', text: 'The granaries overflow. What will your people do with the plenty?',
    a: { label: 'Hold a feast', fx: 'All your towns grow 25%', run: () => growTowns(0.25) }, b: { label: 'Trade it away', fx: '+100 ✦', run: () => gainMana(100) } },
  { id: 'lights', era: [0, 6], icon: '🌠', title: 'Lights in the Sky', text: 'Streaks of fire cross the night. Some call it an omen, some a puzzle.',
    a: { label: 'Study the stars', fx: '+30% of the knowledge you need', run: () => gainKnow(0.3) }, b: { label: 'Worship them', fx: '+150 ✦', run: () => gainMana(150) } },
  { id: 'envoy', era: [0, 6], cond: () => G.rival.alive && G.rival.status !== 'war', icon: '🔴', title: 'Crimson Envoys', text: 'Messengers of the Crimson arrive with painted faces, asking for food for a hard winter.',
    a: { label: 'Buy time', fx: '−60 ✦, war comes 90s later', run: () => { G.mana = Math.max(0, G.mana - 60); G.graceAdd = (G.graceAdd || 0) + 90; } }, b: { label: 'Turn them into spies', fx: '+15% knowledge', run: () => { gainKnow(0.15); } } },
  { id: 'drought', era: [0, 3], icon: '☀️', title: 'Drought', text: 'The rains have failed. The rivers are thin and the fields are cracking.',
    a: { label: 'Call the rain', fx: '−70 ✦, rain on every town', run: () => { G.mana = Math.max(0, G.mana - 70); for (const t of myTowns()) for (const [x] of bfs(t.v, 3)) rain[x] = 60; terrainDirty = true; } }, b: { label: 'Endure it', fx: 'All your towns shrink 20%', run: () => growTowns(-0.2) } },
  { id: 'ship', era: [2, 4], icon: '⛵', title: 'A Plague Ship', text: 'A ship with black sails drifts into your harbour. Its crew is coughing.',
    a: { label: 'Quarantine', fx: '−50 ✦', run: () => { G.mana = Math.max(0, G.mana - 50); } }, b: { label: 'Let them in', fx: '+12% knowledge, but plague may spread', run: () => { gainKnow(0.12); const t = myTowns()[0]; if (t && t.fx.health < 1) { t.sick = 30; toast('☠️ The plague came ashore!', t.v); } } } },
  { id: 'refugees', era: [1, 6], icon: '🧳', title: 'Refugees', text: 'Families fleeing a flood elsewhere ask to join your largest town.',
    a: { label: 'Welcome them', fx: 'Your biggest town fills up', run: () => { const t = bestSettlement(0); if (t) t.pop = capOf(t); } }, b: { label: 'Turn them away', fx: '+60 ✦', run: () => gainMana(60) } },
  { id: 'gold', era: [1, 6], cond: () => myTowns().some((t) => t.res?.includes(2)), icon: '🪙', title: 'Gold Rush', text: 'Your miners found a rich vein. Digging deeper would scar the land.',
    a: { label: 'Dig it out', fx: '+220 ✦, planet −6 health', run: () => { gainMana(220); G.health = Math.max(0, G.health - 6); } }, b: { label: 'Leave it', fx: 'Planet +6 health', run: () => { G.health = Math.min(100, G.health + 6); } } },
  { id: 'genius', era: [3, 6], icon: '🧠', title: 'A Young Genius', text: 'A child in one of your towns draws machines nobody has ever seen.',
    a: { label: 'Fund her workshop', fx: '−120 ✦, +40% of the knowledge you need', run: () => { G.mana = Math.max(0, G.mana - 120); gainKnow(0.4); } }, b: { label: 'Let her be', fx: '+10% knowledge', run: () => gainKnow(0.1) } },
  { id: 'smog', era: [4, 6], icon: '🏭', title: 'Black Skies', text: 'Factory smoke hangs over your cities. People demand cleaner air.',
    a: { label: 'Clean up', fx: '−100 ✦, planet +12 health', run: () => { G.mana = Math.max(0, G.mana - 100); G.health = Math.min(100, G.health + 12); } }, b: { label: 'Keep producing', fx: '+150 ✦, planet −8 health', run: () => { gainMana(150); G.health = Math.max(0, G.health - 8); } } },
  { id: 'ai', era: [5, 6], icon: '🤖', title: 'The Thinking Machine', text: 'Your engineers built a mind that can learn. It asks to be connected to everything.',
    a: { label: 'Connect it', fx: '+50% of the knowledge you need', run: () => gainKnow(0.5) }, b: { label: 'Keep it boxed', fx: '+100 ✦', run: () => gainMana(100) } },
  { id: 'comet', era: [2, 6], icon: '☄️', title: 'A Comet Returns', text: 'The great comet is back after a century. The whole world looks up.',
    a: { label: 'Festival of lights', fx: 'All your towns grow 15%, +60 ✦', run: () => { growTowns(0.15); gainMana(60); } }, b: { label: 'Read the omens in it', fx: '+20% knowledge', run: () => gainKnow(0.2) } },
];
// Buildings you place next to towns, SimCity style. Each one helps every town within RANGE hexes.
const BUILDINGS = [
  { id: 'hunt', name: 'Hunting Grounds', short: 'Hunting', icon: '🏹', era: 0, cost: 40, fx: { food: 0.3 }, desc: '+30% food: nearby towns grow faster and hold more people.' },
  { id: 'shrine', name: 'Shrine', short: 'Shrine', icon: '🗿', era: 0, cost: 50, fx: { know: 0.25 }, desc: '+25% knowledge for nearby towns. Elders keep the stories alive.' },
  { id: 'farm', name: 'Farm', short: 'Farm', icon: '🌾', era: 1, cost: 60, fx: { food: 0.4, size: 1 }, desc: '+40% food and room for 1 more hex in nearby towns.' },
  { id: 'workshop', name: 'Workshop', short: 'Workshop', icon: '🔨', era: 1, cost: 80, fx: { size: 2, know: 0.1 }, desc: 'Tools and trades: nearby towns can spread over 2 more hexes.' },
  { id: 'temple', name: 'Temple', short: 'Temple', icon: '🛕', era: 2, cost: 100, fx: { health: 1, mana: 0.4 }, desc: 'Nearby towns are safe from plague. +0.4 ✦ per second.' },
  { id: 'library', name: 'Library', short: 'Library', icon: '📜', era: 2, cost: 120, fx: { know: 0.4 }, desc: '+40% knowledge for nearby towns.' },
  { id: 'aqueduct', name: 'Aqueduct', short: 'Aqueduct', icon: '💧', era: 2, cost: 120, fx: { size: 3, food: 0.2 }, desc: 'Fresh water: room for 3 more hexes and +20% food.' },
  { id: 'market', name: 'Market', short: 'Market', icon: '⚖️', era: 3, cost: 140, fx: { mana: 1, food: 0.1 }, desc: 'Trade brings +1 ✦ per second and a little extra food.' },
  { id: 'castle', name: 'Castle', short: 'Castle', icon: '🏰', era: 3, cost: 130, fx: { defend: 1, size: 2, mana: 0.3 }, desc: 'Defends against raiders and war bands, halves fire and storm damage. +2 hexes, +✦.' },
  { id: 'university', name: 'University', short: 'University', icon: '🎓', era: 3, cost: 200, fx: { know: 0.6 }, desc: '+60% knowledge for nearby towns.' },
  { id: 'factory', name: 'Factory', short: 'Factory', icon: '🏭', era: 4, cost: 240, fx: { size: 5, food: 0.2, poll: 0.06 }, desc: 'Room for 5 more hexes and +20% food, but it pollutes.' },
  { id: 'railway', name: 'Railway', short: 'Railway', icon: '🚂', era: 4, cost: 220, fx: { size: 2, global: 0.1 }, desc: 'Room for 2 more hexes nearby, and +10% knowledge everywhere (up to 5 stations).' },
  { id: 'hospital', name: 'Hospital', short: 'Hospital', icon: '🏥', era: 5, cost: 200, fx: { health: 1, food: 0.3, size: 2 }, desc: 'No plague nearby, +30% growth, room for 2 more hexes.' },
  { id: 'power', name: 'Power Plant', short: 'Power', icon: '⚡', era: 5, cost: 300, fx: { size: 6, poll: 0.03 }, desc: 'Room for 6 more hexes in nearby towns. A little pollution.' },
  { id: 'airport', name: 'Airport', short: 'Airport', icon: '✈️', era: 5, cost: 320, fx: { global: 0.15, mana: 1 }, desc: '+15% knowledge everywhere and +1 ✦ per second (up to 3 airports).' },
  { id: 'lab', name: 'Research Lab', short: 'Lab', icon: '🔬', era: 6, cost: 350, fx: { know: 1 }, desc: '+100% knowledge for nearby towns.' },
  { id: 'fusion', name: 'Fusion Reactor', short: 'Fusion', icon: '☀️', era: 6, cost: 400, fx: { size: 8, clean: 0.12 }, desc: 'Room for 8 more hexes, and it heals the planet.' },
  { id: 'arcology', name: 'Arcology', short: 'Arcology', icon: '🏙️', era: 6, cost: 380, fx: { size: 10, food: 0.3 }, desc: 'A city in one tower: room for 10 more hexes and +30% food.' },
];
const BD = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));
const RANGE = 3;
// how far a town can spread (in hexes) in each age before buildings, people per hex, and the town size each wonder needs
const BASE_SIZE = [5, 7, 9, 12, 16, 22, 28];
const DENSITY = [5, 7, 9, 12, 16, 22, 30];
const REQ = [4, 6, 9, 12, 15, 20, 25];
const maxTowns = (era) => 8 + era * 3;
// weapons of each age: a modern army beats a bronze one many times its size
const TECH = [1, 1.4, 1.8, 2.3, 2.9, 3.6, 4.4];
const DIFF = [
  { name: 'Easy', rival: 0.75, disaster: 1.4, need: 0.85, war: -65 },
  { name: 'Normal', rival: 1.05, disaster: 1, need: 1, war: -40 },
  { name: 'Hard', rival: 1.25, disaster: 0.75, need: 1.15, war: -15 },
];
const DF = () => DIFF[G.diff ?? 1];
const needOf = (era) => Math.round(ERAS[era].need * DF().need);
const PEOPLE_COL = [0x9a6a3a, 0xc8a060, 0xf2ede2, 0x6a4a8a, 0x3a3a4a, 0x3b82f6, 0xe6eef6];
const POLLUTE = [0, 0, 0, 0, 0.008, 0.005, 0.0025];
// inspiration is capped by the age; what overflows turns into knowledge
const manaCap = (era = G.era) => 400 + era * 200;
function addMana(n) { G.mana += n; const c = manaCap(); if (G.mana > c) { G.know += (G.mana - c) * 0.5 * (1 + G.era); G.mana = c; } }

// ------------------------------------------------------------------ the planet: an icosphere of columns
const R = 5, STEP = 0.08, SEA0 = 3, MAXH = 11;
function icosphere(detail) {
  const t = (1 + Math.sqrt(5)) / 2;
  const verts = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map((v) => new THREE.Vector3(...v).normalize());
  let faces = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let d = 0; d < detail; d++) {
    const cache = new Map();
    const mid = (a, b) => {
      const key = a < b ? a * 100000 + b : b * 100000 + a;
      if (cache.has(key)) return cache.get(key);
      verts.push(verts[a].clone().add(verts[b]).normalize());
      cache.set(key, verts.length - 1);
      return verts.length - 1;
    };
    const nf = [];
    for (const [a, b, c] of faces) { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
    faces = nf;
  }
  return { verts, faces };
}
const { verts: DIRS, faces: FACES } = icosphere(4);
const NV = DIRS.length, NF = FACES.length;
// city sections: the planet is cut into fixed blocks of about 12 hexes; streets run only along their borders
const SECTION = new Int16Array(NV);
{
  const N = Math.round(NV / 12), ga = Math.PI * (3 - Math.sqrt(5)), seeds = [];
  for (let i = 0; i < N; i++) { const y = 1 - (2 * (i + 0.5)) / N, r = Math.sqrt(1 - y * y), a = i * ga; seeds.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)); }
  for (let v = 0; v < NV; v++) { let best = 0, bd = -2; for (let i = 0; i < N; i++) { const d = seeds[i].dot(DIRS[v]); if (d > bd) { bd = d; best = i; } } SECTION[v] = best; }
}
const NBR = (() => {
  const s = Array.from({ length: NV }, () => new Set());
  for (const [a, b, c] of FACES) { s[a].add(b).add(c); s[b].add(a).add(c); s[c].add(a).add(b); }
  return s.map((x) => [...x]);
})();
// Each vertex of the icosphere is the centre of a hex cell (12 of them are pentagons).
// A cell's corners are the centres of the triangles around it, in counter-clockwise order.
const CORN = FACES.map(([a, b, c]) => DIRS[a].clone().add(DIRS[b]).add(DIRS[c]).normalize());
const CELLS = (() => {
  const around = Array.from({ length: NV }, () => []);
  FACES.forEach((f, i) => { for (const v of f) around[v].push(i); });
  const Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0);
  return around.map((fs, v) => {
    const d = DIRS[v];
    const t1 = new THREE.Vector3().crossVectors(d, Math.abs(d.y) < 0.9 ? Y : X).normalize(), t2 = d.clone().cross(t1);
    const ang = (f) => Math.atan2(CORN[f].dot(t2), CORN[f].dot(t1));
    fs.sort((p, q) => ang(p) - ang(q));
    // the neighbour across the edge between corner i and corner i + 1
    const nb = fs.map((f, i) => { const g = fs[(i + 1) % fs.length]; return FACES[f].find((x) => x !== v && FACES[g].includes(x)); });
    return { fs, nb, t1, t2 };
  });
})();
function bfs(v, r, pass = null) {
  const out = [[v, 0]], seen = new Set([v]);
  for (let i = 0; i < out.length; i++) {
    const [x, d] = out[i];
    if (d >= r) continue;
    for (const n of NBR[x]) if (!seen.has(n) && (!pass || pass(n))) { seen.add(n); out.push([n, d + 1]); }
  }
  return out;
}

// ------------------------------------------------------------------ world state
const res = new Uint8Array(NV), lock = new Uint8Array(NV);
const swamp = new Float32Array(NV);
const h = new Int8Array(NV), tree = new Uint8Array(NV), rain = new Float32Array(NV), burn = new Float32Array(NV), crowd = new Uint8Array(NV);
// legacy: points earned by every world, spent on lasting gifts for the next ones
const LEGACY = [
  { id: 'hoard', icon: '💰', name: 'Hoard', cost: 20, fx: 'Start every world with +150 ✦' },
  { id: 'roots', icon: '🏘️', name: 'Deep Roots', cost: 40, fx: 'Your towns spread over 1 more hex' },
  { id: 'wisdom', icon: '📜', name: 'Ancestral Wisdom', cost: 60, fx: '+10% knowledge' },
  { id: 'council', icon: '🎴', name: 'Council of Elders', cost: 80, fx: 'Choose from 4 blessings each age, not 3' },
  { id: 'heirloom', icon: '🏺', name: 'Heirloom', cost: 100, fx: 'Begin every world with a random relic' },
  { id: 'firstborn', icon: '👶', name: 'Firstborn', cost: 130, fx: 'Start with a second town' },
];
const legacyData = Object.assign({ pts: 0, owned: [], best: 0, worlds: 0 }, store.get('aeons.legacy', {}));
const legacy = { has: (id) => legacyData.owned.includes(id) };
const saveLegacy = () => store.set('aeons.legacy', legacyData);
const G = {
  seed: 1, era: 0, know: 0, mana: 60, health: 100, sea: SEA0, seaVis: SEA0, elapsed: 0, mode: 'menu', started: false,
  diff: 1, q: 0, qc: { shape: 0, beacon: 0 }, relics: [], relicCells: [], golden: 0, goldenCD: 120, surge: 0, omen: null, omenT: 150, raidT: 150, firstWonders: [], settlements: [], walkers: [], wonders: [], buildings: [], rival: null, beacon: -1, eventT: 120, seenEvents: [], stats: { founded: 0, lost: 0, disasters: 0, peak: 0 },
};
let terrainDirty = true, setDirty = true;
const isLand = (v) => h[v] > G.sea;
const radiusOf = (v) => R + h[v] * STEP;
const posOf = (v, extra = 0) => DIRS[v].clone().multiplyScalar(radiusOf(v) + extra);
function sameNeighbours(v) { let n = 0; for (const x of NBR[v]) if (h[x] === h[v]) n++; return n; }
function flatScore(v, self) {
  let n = 0;
  for (const [x] of bfs(v, 2)) if (isLand(x) && h[x] === h[v] && (x === v || !G.settlements.some((s) => s !== self && s.v === x))) n++;
  return n;
}
const canSettle = (v) => isLand(v) && !crowd[v] && burn[v] <= 0 && !(swamp[v] > 0) && sameNeighbours(v) >= 4 && Math.abs(DIRS[v].y) < 0.93;
// Which cells each town covers: its centre, plus the hexes it has spread over. A hex stays
// part of the town while it is dry land at the centre's height and still connected to it.
const newRival = () => ({ era: 0, know: 0, mana: 60, rel: -100, status: 'war', alive: true, offer: null, warT: 0, buildT: 30, shapeT: 0, attackT: [260, 180, 120][store.get('aeons.diff', 1)], castT: 240, dipT: 1, asked: 0 });
const eraOfTribe = (t) => (t ? G.rival.era : G.era);
const eraOf = (s) => eraOfTribe(s.tribe);
const sizeOf = (s) => 1 + s.tiles.length;
const levelOf = (s) => { const n = sizeOf(s); return n >= 19 ? 4 : n >= 10 ? 3 : n >= 4 ? 2 : 1; };
const maxTiles = (s) => BASE_SIZE[eraOf(s)] + (s.fx ? s.fx.size : 0) - 1 + (perk(1, s.tribe) ? 2 : 0) + (!s.tribe && rel('seed') ? 2 : 0) + (!s.tribe ? boon('sprawl') + (legacy.has('roots') ? 1 : 0) : 0);
function assignTiles() {
  buildSpotsDirty = true;
  const before = tileKind.slice();
  owner.fill(-1); tileKind.fill(0);
  for (const w of G.wonders) tileKind[w.v] = 4;
  for (const b of G.buildings) { tileKind[b.v] = 5; bTribe[b.v] = b.tribe || 0; }
  G.settlements.forEach((s, i) => { owner[s.v] = i; tileKind[s.v] = 1; });
  G.settlements.forEach((s, i) => {
    const set = new Set(s.tiles), keep = [], q = [s.v], seen = new Set([s.v]);
    while (q.length) {
      const x = q.pop();
      for (const n of NBR[x]) if (set.has(n) && !seen.has(n) && !tileKind[n] && isLand(n) && h[n] === h[s.v]) { seen.add(n); keep.push(n); q.push(n); }
    }
    s.tiles = keep;
    for (const x of keep) {
      owner[x] = i;
      tileKind[x] = eraOf(s) >= 1 && eraOf(s) <= 3 && x % 4 === 0 && !NBR[s.v].includes(x) ? 3 : x % 7 === 3 && !NBR[s.v].includes(x) ? 6 : 2;
      tree[x] = 0;
    }
    s.level = levelOf(s);
    s.ring = new Map([[s.v, 0]]);
    const rq = [s.v], inTown = new Set(keep);
    for (let qi = 0; qi < rq.length; qi++) for (const n of NBR[rq[qi]]) if (inTown.has(n) && !s.ring.has(n)) { s.ring.set(n, s.ring.get(rq[qi]) + 1); rq.push(n); }
    // districts: a downtown core, then sectors around it separated by avenues
    const ct = CELLS[s.v];
    s.dist = new Map(); const best = new Map();
    for (const [x] of s.ring) {
      const id = SECTION[x] === SECTION[s.v] ? 0 : SECTION[x] + 1;
      s.dist.set(x, id);
      if (x !== s.v && (!best.has(id) || hash(x) < hash(best.get(id)))) best.set(id, x);
    }
    s.plazas = new Set([...best.entries()].filter(([id]) => id > 0 && [...s.dist.values()].filter((d) => d === id).length >= 4).map(([, x]) => x));
  });
  roadsDirty = true;
  for (let v = 0; v < NV; v++) if (before[v] !== tileKind[v]) { terrainDirty = true; break; }
  rebuildCrowd();
  ffDirty = true;
  lock.fill(0);
  for (let v = 0; v < NV; v++) {
    const red = (owner[v] >= 0 && G.settlements[owner[v]].tribe === 1) || (tileKind[v] === 5 && bTribe[v] === 1) || G.wonders.some((w) => w.tribe === 1 && w.v === v);
    if (red) for (const [x] of bfs(v, 2)) lock[x] = 1;
  }
  lockDirty = true;
}
let lockDirty = true, ffDirty = true;
// the next hex a town spreads to: flat, free land touching it, closest to the centre
function frontier(s) {
  let best = null, bd = 1e9;
  for (const c of [s.v, ...s.tiles]) for (const n of NBR[c]) {
    if (tileKind[n] || owner[n] >= 0 || !isLand(n) || h[n] !== h[s.v] || burn[n] > 0) continue;
    const d = DIRS[n].distanceToSquared(DIRS[s.v]) + rnd() * 0.0005;
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}
// building effects: each building helps the towns it reaches (two of a kind at most), some help the whole world
const WONDER_R = 4;
let worldFx = [{ mana: 0, clean: 0, poll: 0, global: 0 }, { mana: 0, clean: 0, poll: 0, global: 0 }];
function computeFx() {
  for (const s of G.settlements) { s.fx = { food: 0, know: 0, size: 0, health: 0, defend: 0 }; s.fxN = {}; }
  const W = [{ mana: 0, clean: 0, poll: 0, global: 0 }, { mana: 0, clean: 0, poll: 0, global: 0 }], count = [{}, {}];
  for (const b of G.buildings) {
    const tb = b.tribe || 0, g = W[tb];
    const fx = BD[b.id].fx, k = (count[tb][b.id] = (count[tb][b.id] || 0) + 1);
    g.mana += fx.mana || 0; g.clean += fx.clean || 0; g.poll += fx.poll || 0;
    if (fx.global && k <= (b.id === 'railway' ? 5 : 3)) g.global += fx.global;
    const towns = new Set();
    for (const [x] of bfs(b.v, RANGE)) if (owner[x] >= 0) towns.add(owner[x]);
    for (const i of towns) {
      const s = G.settlements[i];
      if (!s || s.tribe !== tb || (s.fxN[b.id] = (s.fxN[b.id] || 0) + 1) > 2) continue;
      for (const key of ['food', 'know', 'size', 'health', 'defend']) s.fx[key] += fx[key] || 0;
    }
  }
  for (const w of G.wonders) for (const [x] of bfs(w.v, WONDER_R)) if (tileKind[x] === 1 && owner[x] >= 0) { const s = G.settlements[owner[x]]; if (s.tribe === w.tribe && !s.fxN.wonder) { s.fxN.wonder = 1; s.fx.know += 0.2; } }
  for (const s of G.settlements) { if (perk(3, s.tribe)) s.fx.food += 0.25; if (!s.tribe && rel('compass')) s.fx.food += 0.25; if (!s.tribe) s.fx.food += boon('harvest') * 0.2; }
  // treasures: the first town that covers or touches one gets it
  const claimed = new Set();
  for (const s of G.settlements) {
    const found = [];
    for (const c of [s.v, ...s.tiles]) for (const x of [c, ...NBR[c]]) {
      const r = res[x];
      if (!r || claimed.has(x) || RES[r].land !== isLand(x) || (RES[r].era && eraOf(s) < RES[r].era)) continue;
      claimed.add(x); found.push(r);
      const R = RES[r];
      s.fx.food += R.food || 0; s.fx.know += R.know || 0;
      W[s.tribe].mana += R.mana || 0; W[s.tribe].poll += R.poll || 0;
      if (!s.tribe && RES[r].id === 'ruins' && !G.relicCells.includes(x)) { G.relicCells.push(x); { const sd = G.seed; setTimeout(() => G.seed === sd && offerRelic(x), 600); }; }
      if (!s.tribe && !s.seen?.has(x)) { (s.seen ||= new Set()).add(x); floatText(x, `${R.icon} ${R.name}!`, 'gold'); tip(`res${r}`, `${R.icon} Your town found ${R.name}: ${R.desc}.`, true); }
    }
    s.res = found;
  }
  worldFx = W;
}
function rebuildCrowd() {
  crowd.fill(0);
  for (const s of [...G.settlements, ...G.wonders]) for (const [x] of bfs(s.v, 2)) crowd[x] = 1;
  for (const s of G.settlements) for (const t of s.tiles) for (const [x] of bfs(t, 1)) crowd[x] = 1;
  for (const b of G.buildings) crowd[b.v] = 1;
}
function raiseV(v) {
  if (h[v] >= MAXH) return false;
  h[v]++;
  const q = [v];
  while (q.length) {
    const x = q.pop();
    for (const n of NBR[x]) if (h[n] < h[x] - 1) { h[n] = h[x] - 1; q.push(n); }
  }
  terrainDirty = true;
  return true;
}
function lowerV(v) {
  if (h[v] <= 0) return false;
  h[v]--;
  const q = [v];
  while (q.length) {
    const x = q.pop();
    for (const n of NBR[x]) if (h[n] > h[x] + 1) { h[n] = h[x] + 1; q.push(n); }
  }
  terrainDirty = true;
  return true;
}
function setHeight(v, target) { while (h[v] < target && raiseV(v)); while (h[v] > target && lowerV(v)); }

function generate(seed) {
  const r = mulberry32(seed * 7919 + 11);
  const waves = [];
  for (let k = 0; k < 12; k++) {
    const d = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).normalize();
    waves.push({ d, f: k < 4 ? 1.2 + r() * 1.6 : 3 + r() * 5, ph: r() * 6.28, a: k < 4 ? 1 : 0.35 });
  }
  const val = DIRS.map((p) => waves.reduce((s, w) => s + w.a * Math.sin(p.dot(w.d) * w.f + w.ph), 0));
  const sorted = [...val].sort((a, b) => a - b), thr = sorted[Math.floor(sorted.length * 0.56)];
  const spread = sorted[sorted.length - 1] - thr;
  for (let v = 0; v < NV; v++) h[v] = clamp(Math.round(SEA0 + 0.5 + ((val[v] - thr) / spread) * 7), 0, 9);
  for (let pass = 0; pass < 20; pass++) {
    let changed = false;
    for (let v = 0; v < NV; v++) for (const n of NBR[v]) if (h[n] > h[v] + 1) { h[n] = h[v] + 1; changed = true; }
    if (!changed) break;
  }
  tree.fill(0); rain.fill(0); burn.fill(0);
  for (let v = 0; v < NV; v++) if (h[v] > SEA0 + 1 && h[v] < SEA0 + 5 && Math.abs(DIRS[v].y) < 0.8 && r() < 0.16) for (const [x] of bfs(v, 1)) if (h[x] > SEA0 && r() < 0.7) tree[x] = 1;
  // the cradle: a level clearing on a big landmass, away from the poles
  let best = 0, bestScore = -1;
  for (let v = 0; v < NV; v += 3) {
    if (!(h[v] > SEA0) || Math.abs(DIRS[v].y) > 0.6) continue;
    const land = bfs(v, 4).filter(([x]) => h[x] > SEA0).length;
    if (land > bestScore) { bestScore = land; best = v; }
  }
  // a flat hearth with an uneven ring around it, so the first arrows show at once
  for (const [x, d] of bfs(best, 2)) { setHeight(x, d < 2 ? SEA0 + 2 : SEA0 + 2 + (x % 3 === 0 ? 1 : x % 3 === 1 ? -1 : 0)); tree[x] = 0; }
  return best;
}

function placeResources(seed) {
  const r = mulberry32(seed * 131 + 17);
  res.fill(0);
  for (let k = 1; k < RES.length; k++) {
    let placed = 0;
    for (let tries = 0; tries < 4000 && placed < RES[k].n; tries++) {
      const v = (r() * NV) | 0;
      if (Math.abs(DIRS[v].y) > 0.8 || bfs(v, 2).some(([x]) => res[x])) continue;
      if (RES[k].land ? h[v] <= SEA0 || h[v] > SEA0 + 5 : h[v] > SEA0 || h[v] < SEA0 - 1 || !NBR[v].some((x) => h[x] > SEA0)) continue;
      res[v] = k; placed++;
    }
  }
}

// ------------------------------------------------------------------ renderer, camera, lights
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x05070f, 1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
let hq = store.get('aeons.hq', true);
$('app').prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x24305e, 0.005);
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
const sunDir = new THREE.Vector3(1, 0.3, 0.6).normalize();
const sunU = { value: sunDir }, timeU = { value: 0 };
const sun = new THREE.DirectionalLight(0xfff2dc, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -6.6, right: 6.6, top: 6.6, bottom: -6.6, near: 20, far: 42 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun);
// a cool moonlight from the far side keeps the night readable
const moonLight = new THREE.DirectionalLight(0x8a7aff, 1.0);
scene.add(moonLight);
const hemi = new THREE.HemisphereLight(0x8aa8ff, 0x1a1a2a, 0.5);
scene.add(hemi);
scene.add(new THREE.AmbientLight(0x3a4a7a, 0.45));
const cam = { theta: 0, phi: 1.2, dist: 23, tTheta: 0, tPhi: 1.2, tDist: 23, vTheta: 0, vPhi: 0, shake: 0, fly: false };
const lookAtP = new THREE.Vector3();
function updateCamera(dt) {
  if (cam.fly) {
    let d = cam.tTheta - cam.theta;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    cam.theta += d * Math.min(1, dt * 3);
    cam.phi += (cam.tPhi - cam.phi) * Math.min(1, dt * 3);
    if (Math.abs(d) < 0.002 && Math.abs(cam.tPhi - cam.phi) < 0.002) cam.fly = false;
  } else {
    cam.theta += cam.vTheta; cam.phi += cam.vPhi;
    cam.vTheta *= 0.9; cam.vPhi *= 0.9;
  }
  cam.phi = clamp(cam.phi, 0.25, Math.PI - 0.25);
  cam.slow = Math.max(0, (cam.slow || 0) - dt);
  cam.dist += (cam.tDist - cam.dist) * Math.min(1, dt * (cam.slow > 0 ? 1.3 : 6));
  const s = cam.shake ? (rnd() - 0.5) * cam.shake * 0.15 : 0;
  // zoomed in, the camera tilts towards the horizon and looks at the ground instead of the core
  const f = clamp((21 - cam.dist) / 12, 0, 1);
  camera.position.setFromSphericalCoords(cam.dist, Math.min(Math.PI - 0.05, cam.phi + f * 0.42), cam.theta);
  camera.position.x += s; camera.position.y += s;
  lookAtP.setFromSphericalCoords(R * f * 0.95, cam.phi, cam.theta);
  camera.lookAt(lookAtP);
}
function flyTo(v, dist) {
  const sp = new THREE.Spherical().setFromVector3(DIRS[v]);
  cam.tTheta = sp.theta; cam.tPhi = sp.phi; cam.fly = true; cam.vTheta = cam.vPhi = 0;
  if (dist) cam.tDist = dist;
}
function resize() {
  const w = window.innerWidth, hh = window.innerHeight;
  renderer.setSize(w, hh);
  post.setSize(w, hh, renderer.getPixelRatio());
  camera.aspect = w / hh;
  camera.fov = w < hh ? 46 : 36;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

// the night sky: a faint nebula band and stars that twinkle
const nightU = { value: 0 };
{
  const dome = new THREE.Mesh(new THREE.SphereGeometry(220, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { uTime: timeU },
    vertexShader: 'varying vec3 vD; void main() { vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uTime; varying vec3 vD;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      float noise(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
                   mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
      float fbm(vec3 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
      void main() {
        vec3 d = normalize(vD);
        float band = exp(-pow(dot(d, normalize(vec3(0.35, 1.0, -0.25))) * 3.2, 2.0));
        float n = fbm(d * 3.0 + vec3(0.0, uTime * 0.004, 0.0));
        float n2 = fbm(d * 7.0 - 3.0);
        vec3 col = mix(vec3(0.05, 0.02, 0.12), vec3(0.35, 0.08, 0.45), n) * band * (0.6 + n2);
        col += vec3(0.02, 0.18, 0.25) * pow(n2, 3.0) * band * 2.0;
        col += vec3(0.01, 0.012, 0.03);
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  dome.renderOrder = -2;
  scene.add(dome);
  const n = 2200, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), ph = new Float32Array(n), sz = new Float32Array(n), r = mulberry32(3);
  for (let i = 0; i < n; i++) {
    let d = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).normalize();
    // more stars along the nebula band
    if (i % 3 === 0) d = d.addScaledVector(new THREE.Vector3(0.35, 1, -0.25).normalize(), -d.dot(new THREE.Vector3(0.35, 1, -0.25).normalize()) * 0.85).normalize();
    pos.set(d.multiplyScalar(170 + r() * 30).toArray(), i * 3);
    const c = new THREE.Color().setHSL(0.55 + r() * 0.25 - (r() < 0.15 ? 0.5 : 0), 0.5, 0.65 + r() * 0.35);
    col.set([c.r, c.g, c.b], i * 3);
    ph[i] = r() * 6.28; sz[i] = 1 + Math.pow(r(), 6) * 4;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
  g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
  const stars = new THREE.Points(g, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    uniforms: { uTime: timeU, uPR: { value: Math.min(window.devicePixelRatio, 2) } },
    vertexShader: `attribute float aPhase; attribute float aSize; uniform float uTime; uniform float uPR; varying vec3 vC; varying float vA;
      void main() { vC = color; vA = 0.55 + 0.45 * sin(uTime * (1.0 + fract(aPhase) * 2.5) + aPhase * 7.0);
        gl_PointSize = aSize * uPR * (0.8 + vA * 0.6); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec3 vC; varying float vA;
      void main() { vec2 q = gl_PointCoord - 0.5; float d = length(q); float a = smoothstep(0.5, 0.0, d);
        a += smoothstep(0.06, 0.0, abs(q.x)) * smoothstep(0.5, 0.1, abs(q.y)) * 0.4 + smoothstep(0.06, 0.0, abs(q.y)) * smoothstep(0.5, 0.1, abs(q.x)) * 0.4;
        gl_FragColor = vec4(vC * a * vA * 1.6, 1.0); }`,
  }));
  stars.renderOrder = -1;
  scene.add(stars);
}

// ------------------------------------------------------------------ planet mesh, water, atmosphere
// The planet: a hex column per cell with a bevelled top, and cliff walls down to lower neighbours.
const MAXT = NF * 3 * 3 + NF * 3;
const planetGeo = new THREE.BufferGeometry();
planetGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXT * 9), 3));
planetGeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(MAXT * 9), 3));
planetGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAXT * 9), 3));
planetGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R + 2);
const triCell = new Int32Array(MAXT);
const planet = new THREE.Mesh(planetGeo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 }));
planet.castShadow = planet.receiveShadow = true;
scene.add(planet);
const C = (x) => new THREE.Color(x);
const PAL = { deep: C(0x2a3a5a), bed: C(0xb8a070), dry: C(0xd2bc6a), lush: C(0x4aa63a), snow: C(0xf4f8fb), ice: C(0xe2eef6), burnt: C(0x3a2e28), brown: C(0x9a8a5a), cliff: C(0x7a6450), soil: C(0x9a7a4a) };
// one colour per terrace, alternating light and dark so each level reads at a glance
const BANDS = [0xe9d6a0, 0xa6d86a, 0x6fbd45, 0x93c858, 0x4f9a36, 0x8aa04e, 0x9a8a62, 0x8f8a82, 0xb4b0aa, 0xf0f4f8, 0xf4f8fb].map(C);
const DIST_COL = [0xd88a5a, 0x8ab0d8, 0xd8c070, 0x9ac88a, 0xc08ac8, 0xe0a0a0].map(C);
const SWAMP_COL = new THREE.Color(0x3a4a22);
const PAVE = [0xb09060, 0xd0b070, 0xece4d0, 0xb8ae9a, 0xa89480, 0xa8aeb6, 0xe8eef4].map(C);
const owner = new Int32Array(NV).fill(-1), tileKind = new Uint8Array(NV), bTribe = new Uint8Array(NV);
const RED = C(0xc84a3a);
const tc = new THREE.Color();
function cellColor(v) {
  const lat = Math.abs(DIRS[v].y);
  if (burn[v] > 0) return tc.copy(PAL.burnt);
  if (h[v] <= G.sea) return tc.copy(PAL.bed).lerp(PAL.deep, clamp((G.sea - h[v]) / 4, 0, 1));
  if (tileKind[v] === 1 || tileKind[v] === 2) { const t = G.settlements[owner[v]]; tc.copy(PAVE[eraOf(t)]); if (eraOf(t) >= 1 && t.dist) { const d = t.dist.get(v) ?? 0; if (d) tc.lerp(DIST_COL[hash(d * 13 + t.v) % DIST_COL.length], 0.42); else tc.multiplyScalar(1.08); } return t.tribe ? tc.lerp(RED, 0.3) : tc; }
  if (tileKind[v] === 6) { const t = G.settlements[owner[v]]; return tc.copy(PAL.lush).lerp(PAVE[eraOf(t)], 0.25); }
  if (tileKind[v] === 4) return tc.copy(PAVE[G.era]);
  if (tileKind[v] === 5) { tc.copy(PAVE[eraOfTribe(bTribe[v])]).multiplyScalar(1.12); return bTribe[v] ? tc.lerp(RED, 0.3) : tc; }
  if (tileKind[v] === 3) return tc.copy(PAL.soil);
  if (lat > 0.88) return tc.copy(PAL.ice);
  const up = h[v] - G.sea;
  const col = tc.copy(BANDS[Math.min(BANDS.length - 1, up - 1)]);
  if (up >= 2 && up <= 5) {
    if (lat < 0.22) col.lerp(PAL.dry, 0.45);
    if (rain[v] > 0) col.lerp(PAL.lush, 0.5);
  }
  if (swamp[v] > 0) col.lerp(SWAMP_COL, 0.75);
  if (G.health < 90 && up < 9) col.lerp(PAL.brown, (1 - G.health / 100) * 0.55);
  if (lat > 0.7) col.lerp(PAL.snow, Math.min(1, (lat - 0.7) * 3.5));
  return col.multiplyScalar(0.96 + (((v * 2654435761) >>> 0) % 1000) / 12500);
}
const BEV = 0.84, DROP = 0.02;
const pa = new THREE.Vector3(), pb = new THREE.Vector3(), pc = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), nrm = new THREE.Vector3();
const inner = Array.from({ length: 6 }, () => new THREE.Vector3()), outer = Array.from({ length: 6 }, () => new THREE.Vector3());
const ctr = new THREE.Vector3(), wallOut = new THREE.Vector3(), cBuf = new THREE.Color(), wBuf = new THREE.Color(), eBuf = new THREE.Color();
function rebuildPlanet() {
  const P = planetGeo.attributes.position.array, N = planetGeo.attributes.normal.array, CO = planetGeo.attributes.color.array;
  let o = 0, t = 0;
  // writes one triangle; if `out` is given, the winding is flipped to face it
  const tri = (a, b, c, col, cell, out) => {
    e1.subVectors(b, a); e2.subVectors(c, a); nrm.crossVectors(e1, e2);
    if (out && nrm.dot(out) < 0) { const x = b; b = c; c = x; nrm.negate(); }
    nrm.normalize();
    for (const q of [a, b, c]) { P[o] = q.x; P[o + 1] = q.y; P[o + 2] = q.z; N[o] = nrm.x; N[o + 1] = nrm.y; N[o + 2] = nrm.z; CO[o] = col.r; CO[o + 1] = col.g; CO[o + 2] = col.b; o += 3; }
    triCell[t++] = cell;
  };
  for (let v = 0; v < NV; v++) {
    const cell = CELLS[v], k = cell.fs.length, r = radiusOf(v), d = DIRS[v];
    cBuf.copy(cellColor(v));
    eBuf.copy(cBuf).multiplyScalar(0.84);
    wBuf.copy(cBuf).lerp(PAL.cliff, h[v] <= G.sea ? 0.2 : 0.45).multiplyScalar(0.78);
    ctr.copy(d).multiplyScalar(r);
    for (let i = 0; i < k; i++) {
      const cn = CORN[cell.fs[i]];
      inner[i].copy(d).multiplyScalar(1 - BEV).addScaledVector(cn, BEV).normalize().multiplyScalar(r);
      outer[i].copy(cn).multiplyScalar(r - DROP);
    }
    for (let i = 0; i < k; i++) {
      const j = (i + 1) % k;
      tri(ctr, inner[i], inner[j], cBuf, v, d);
      tri(inner[i], outer[i], outer[j], eBuf, v, d);
      tri(inner[i], outer[j], inner[j], eBuf, v, d);
      const n = cell.nb[i];
      if (h[n] < h[v]) {
        const rn = radiusOf(n) - DROP;
        pa.copy(CORN[cell.fs[i]]).multiplyScalar(rn); pb.copy(CORN[cell.fs[j]]).multiplyScalar(rn);
        wallOut.copy(DIRS[n]).sub(d);
        tri(outer[i], outer[j], pb, wBuf, v, wallOut);
        tri(outer[i], pb, pa, wBuf, v, wallOut);
      }
    }
  }
  planetGeo.setDrawRange(0, o / 3);
  planetGeo.attributes.position.needsUpdate = planetGeo.attributes.normal.needsUpdate = planetGeo.attributes.color.needsUpdate = true;
  updateWaterDepth();
  layoutTrees();
  layoutScenery();
  roadsDirty = true;
  seedFireflies();
  layoutBeacon();
  setDirty = true;
}
// hex cells line up with buildings: the yaw that turns a model's x-axis towards a cell's first corner
const YAW = (() => {
  const Y = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), c = new THREE.Vector3();
  return DIRS.map((d, v) => {
    q.setFromUnitVectors(Y, d).invert();
    c.copy(CORN[CELLS[v].fs[0]]).applyQuaternion(q);
    return Math.atan2(-c.z, c.x);
  });
})();
// water: a sphere with depth-tinted colour, shoreline foam and sun glints
const waterGeo = new THREE.BufferGeometry();
{
  const pos = new Float32Array(NV * 3), idx = [];
  DIRS.forEach((d, i) => pos.set([d.x, d.y, d.z], i * 3));
  for (const f of FACES) idx.push(...f);
  waterGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  waterGeo.setAttribute('aDepth', new THREE.BufferAttribute(new Float32Array(NV), 1));
  waterGeo.setIndex(idx);
}
const waterMat = new THREE.ShaderMaterial({
  transparent: true,
  uniforms: { uSun: sunU, uTime: timeU, uCam: { value: camera.position }, uShallow: { value: C(0x4fd0e0) }, uDeep: { value: C(0x154f9a) }, uR: { value: R } },
  vertexShader: `attribute float aDepth; uniform float uR; varying float vDepth; varying vec3 vN; varying vec3 vW;
    uniform float uTime;
    void main() { vDepth = aDepth; vN = normalize(position); float wave = sin(uTime * 1.3 + position.x * 23.0 + position.z * 17.0) * sin(uTime * 0.9 + position.y * 19.0); vec4 w = modelMatrix * vec4(position * uR * (1.0 + wave * 0.0025), 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform vec3 uSun; uniform vec3 uCam; uniform vec3 uShallow; uniform vec3 uDeep; uniform float uTime;
    varying float vDepth; varying vec3 vN; varying vec3 vW;
    void main() {
      float d = clamp(vDepth, 0.0, 1.0);
      vec3 col = mix(uShallow, uDeep, smoothstep(0.0, 1.0, d));
      float foam = smoothstep(0.1, 0.0, vDepth) + smoothstep(0.82, 1.0, sin(uTime * 1.5 - vDepth * 30.0) * 0.5 + 0.5) * smoothstep(0.4, 0.08, vDepth) * 0.7;
      col = mix(col, vec3(1.0), clamp(foam, 0.0, 1.0) * 0.8);
      float lambert = max(dot(vN, uSun), 0.0);
      vec3 V = normalize(uCam - vW), H = normalize(V + uSun);
      float spec = pow(max(dot(vN, H), 0.0), 80.0) * step(0.0, dot(vN, uSun));
      float fres = pow(1.0 - max(dot(V, vN), 0.0), 3.0);
      col = col * (0.12 + 0.95 * lambert) + spec * 0.8 + fres * vec3(0.25, 0.45, 0.7) * (0.2 + lambert);
      // at night the surf glows with plankton, and sparks drift in the shallows
      float night = smoothstep(0.1, -0.25, dot(vN, uSun));
      float glowFoam = clamp(smoothstep(0.16, 0.0, vDepth) * (0.6 + 0.4 * sin(uTime * 2.0 + vW.x * 9.0 + vW.z * 7.0)), 0.0, 1.0);
      vec3 cell = floor(vW * 14.0 + vec3(0.0, uTime * 0.3, 0.0));
      float spark = step(0.985, fract(sin(dot(cell, vec3(12.99, 78.23, 37.72))) * 43758.5)) * (0.5 + 0.5 * sin(uTime * 4.0 + cell.x)) * smoothstep(0.6, 0.0, vDepth);
      col += vec3(0.1, 0.85, 1.0) * (glowFoam * 1.8 + spark * 2.5) * night;
      col += vec3(0.02, 0.05, 0.12) * night;
      gl_FragColor = vec4(col, mix(0.78, 0.94, d));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});
const water = new THREE.Mesh(waterGeo, waterMat);
water.renderOrder = 1;
scene.add(water);
function updateWaterDepth() {
  const a = waterGeo.attributes.aDepth.array;
  for (let v = 0; v < NV; v++) a[v] = (G.seaVis + 0.5 - h[v]) * 0.33;
  waterGeo.attributes.aDepth.needsUpdate = true;
}
const atmoColor = new THREE.Color(0x5fa8ff);
const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.16, 48, 32), new THREE.ShaderMaterial({
  side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  uniforms: { uSun: sunU, uColor: { value: atmoColor } },
  vertexShader: `varying vec3 vN; varying vec3 vW; void main() { vN = normalize(normalMatrix * normal); vW = normalize((modelMatrix * vec4(position, 1.0)).xyz); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform vec3 uSun; uniform vec3 uColor; varying vec3 vN; varying vec3 vW;
    void main() { float i = pow(clamp(0.78 - dot(vN, vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 3.0); float lit = 0.2 + 0.8 * clamp(dot(vW, uSun) + 0.35, 0.0, 1.0);
      gl_FragColor = vec4(uColor * i * lit * 1.8, 1.0); }`,
}));
scene.add(atmo);

// the sun's glare, a moon, and a thin layer of scattering over the day side
const glowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  rg.addColorStop(0, 'rgba(255,255,240,1)'); rg.addColorStop(0.12, 'rgba(255,240,200,0.9)'); rg.addColorStop(0.35, 'rgba(255,200,120,0.25)'); rg.addColorStop(1, 'rgba(255,180,100,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();
const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
sunSprite.scale.setScalar(40);
scene.add(sunSprite);
const moon = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 2), new THREE.MeshStandardMaterial({ color: 0xc8c4bc, flatShading: true, roughness: 1 }));
moon.castShadow = true;
scene.add(moon);
const haze = new THREE.Mesh(new THREE.SphereGeometry(R * 1.035, 64, 48), new THREE.ShaderMaterial({
  transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  uniforms: { uSun: sunU, uColor: { value: atmoColor } },
  vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = normalize(w.xyz); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform vec3 uSun; uniform vec3 uColor; varying vec3 vN; varying vec3 vV; varying vec3 vW;
    void main() { float rim = pow(1.0 - max(dot(vN, vV), 0.0), 2.5); float lit = smoothstep(-0.25, 0.4, dot(vW, uSun));
      float dusk = smoothstep(0.35, 0.0, abs(dot(vW, uSun))) * lit;
      vec3 c = mix(uColor, vec3(1.0, 0.55, 0.3), dusk * 0.7);
      gl_FragColor = vec4(c * (rim * 0.9 + 0.04) * lit, 1.0); }`,
}));
haze.renderOrder = 2;
scene.add(haze);

// ------------------------------------------------------------------ bloom: HDR scene -> bright pass -> blur -> composite
const post = (() => {
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  const quadScene = new THREE.Scene(); quadScene.add(quad);
  const opts = { type: THREE.HalfFloatType, depthBuffer: false };
  const rtScene = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const rtA = new THREE.WebGLRenderTarget(1, 1, opts), rtB = new THREE.WebGLRenderTarget(1, 1, opts);
  const vs = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const bright = new THREE.ShaderMaterial({ uniforms: { tMap: { value: null } }, vertexShader: vs, depthTest: false,
    fragmentShader: 'uniform sampler2D tMap; varying vec2 vUv; void main() { vec3 c = texture2D(tMap, vUv).rgb; float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(0.85, 1.6, l), 1.0); }' });
  const blur = new THREE.ShaderMaterial({ uniforms: { tMap: { value: null }, uDir: { value: new THREE.Vector2() } }, vertexShader: vs, depthTest: false,
    fragmentShader: `uniform sampler2D tMap; uniform vec2 uDir; varying vec2 vUv;
      void main() { vec3 c = texture2D(tMap, vUv).rgb * 0.227;
        c += texture2D(tMap, vUv + uDir * 1.385).rgb * 0.316; c += texture2D(tMap, vUv - uDir * 1.385).rgb * 0.316;
        c += texture2D(tMap, vUv + uDir * 3.23).rgb * 0.07; c += texture2D(tMap, vUv - uDir * 3.23).rgb * 0.07;
        gl_FragColor = vec4(c, 1.0); }` });
  const comp = new THREE.ShaderMaterial({ uniforms: { tScene: { value: rtScene.texture }, tBloom: { value: rtA.texture }, uStrength: { value: 0.9 } }, vertexShader: vs, depthTest: false,
    fragmentShader: `uniform sampler2D tScene; uniform sampler2D tBloom; uniform float uStrength; varying vec2 vUv;
      void main() { vec3 c = texture2D(tScene, vUv).rgb + texture2D(tBloom, vUv).rgb * uStrength;
        vec2 d = vUv - 0.5; c *= 1.0 - dot(d, d) * 0.55;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        // grading: a touch more colour, cool shadows and warm highlights
        vec3 g = gl_FragColor.rgb;
        float l = dot(g, vec3(0.299, 0.587, 0.114));
        g = mix(vec3(l), g, 1.14);
        g += vec3(-0.012, 0.0, 0.025) * (1.0 - smoothstep(0.0, 0.45, l)) + vec3(0.025, 0.012, -0.015) * smoothstep(0.55, 1.0, l);
        g = mix(g, g * g * (3.0 - 2.0 * g), 0.18);
        gl_FragColor.rgb = clamp(g, 0.0, 1.0);
        #include <colorspace_fragment>
      }` });
  comp.toneMapped = true;
  let bw = 1, bh = 1;
  const pass = (mat, target) => { quad.material = mat; renderer.setRenderTarget(target); renderer.render(quadScene, quadCam); };
  return {
    setSize(w, h, pr) {
      pr = Math.min(pr, 1.5);
      rtScene.setSize(Math.floor(w * pr), Math.floor(h * pr));
      bw = Math.max(1, Math.floor((w * pr) / 4)); bh = Math.max(1, Math.floor((h * pr) / 4));
      rtA.setSize(bw, bh); rtB.setSize(bw, bh);
    },
    render() {
      renderer.setRenderTarget(rtScene);
      renderer.render(scene, camera);
      bright.uniforms.tMap.value = rtScene.texture; pass(bright, rtA);
      for (let i = 0; i < 2; i++) {
        blur.uniforms.tMap.value = rtA.texture; blur.uniforms.uDir.value.set(1 / bw, 0); pass(blur, rtB);
        blur.uniforms.tMap.value = rtB.texture; blur.uniforms.uDir.value.set(0, 1 / bh); pass(blur, rtA);
      }
      pass(comp, null);
    },
  };
})();

// ------------------------------------------------------------------ materials and instanced things
const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8 });
// fires, windows and neon: muted by day, glowing on the night side
const glowMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, side: THREE.DoubleSide });
glowMat.onBeforeCompile = (s) => {
  s.uniforms.uSun = sunU;
  s.vertexShader = 'varying vec3 vWorldP;\n' + s.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
    #ifdef USE_INSTANCING
      vWorldP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
    #else
      vWorldP = (modelMatrix * vec4(transformed, 1.0)).xyz;
    #endif`);
  s.fragmentShader = 'uniform vec3 uSun; varying vec3 vWorldP;\n' + s.fragmentShader
    .replace('#include <color_fragment>', '#include <color_fragment>\n  float night = smoothstep(0.15, -0.2, dot(normalize(vWorldP), uSun));\n  vec3 glowCol = diffuseColor.rgb;\n  diffuseColor.rgb = mix(glowCol * 0.55, glowCol * 0.15, night);')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += glowCol * (0.2 + night * 3.4);');
};
glowMat.customProgramCacheKey = () => 'glow';
function inst(geo, mat, max, shadow = true) { const m = new THREE.InstancedMesh(geo, mat, max); m.count = 0; m.frustumCulled = false; m.castShadow = m.receiveShadow = shadow; scene.add(m); return m; }
const dummy = new THREE.Object3D();
const UP = new THREE.Vector3(0, 1, 0), qa = new THREE.Quaternion(), qy = new THREE.Quaternion();
function placeOn(m, n, v, extra = 0, yaw = 0, scale = 1, dir = null) {
  const d = dir || DIRS[v];
  qa.setFromUnitVectors(UP, d);
  qy.setFromAxisAngle(UP, yaw);
  dummy.quaternion.copy(qa).multiply(qy);
  dummy.position.copy(d).multiplyScalar((dir ? 0 : radiusOf(v)) + extra);
  if (dir) dummy.position.copy(dir).multiplyScalar(extra);
  dummy.scale.setScalar(scale);
  dummy.updateMatrix();
  m.setMatrixAt(n, dummy.matrix);
}
const treeMeshes = treeGeos().map((g) => inst(g, bodyMat, NV * 2));
const TREE_SPOTS = [[0, 0], [0.09, 0.05], [-0.08, 0.07], [0.02, -0.1]];
function placeIn(m, n, v, ox, oz, yaw, scale, lift = 0) {
  const c = CELLS[v];
  qa.setFromUnitVectors(UP, DIRS[v]);
  qy.setFromAxisAngle(UP, yaw);
  dummy.quaternion.copy(qa).multiply(qy);
  dummy.position.copy(DIRS[v]).multiplyScalar(radiusOf(v) + lift).addScaledVector(c.t1, ox).addScaledVector(c.t2, oz);
  dummy.scale.setScalar(scale);
  dummy.updateMatrix();
  m.setMatrixAt(n, dummy.matrix);
}
function layoutTrees() {
  const n = [0, 0];
  for (let v = 0; v < NV; v++) {
    if (!tree[v] || !isLand(v) || tileKind[v]) continue;
    const count = 2 + (v % 3);
    for (let i = 0; i < count; i++) {
      const k = (v + i) % 2, m = treeMeshes[k], [ox, oz] = TREE_SPOTS[i];
      placeIn(m, n[k]++, v, ox, oz, v * 1.7 + i, 0.8 + ((v + i * 3) % 5) * 0.08, -0.01);
    }
  }
  treeMeshes[0].count = n[0]; treeMeshes[1].count = n[1];
  for (const m of treeMeshes) m.instanceMatrix.needsUpdate = true;
}
const centerT = {}, tileT = {};
const mkT = (t, max) => ({ body: inst(t.body, bodyMat, max), glow: t.glow ? inst(t.glow, glowMat, max) : null, smoke: t.smoke });
for (let e = 0; e < 7; e++) {
  for (let l = 1; l <= 4; l++) centerT[`${e}-${l}`] = mkT(centerModel(e, l), 80);
  for (let k = 0; k < 12; k++) if (k !== 3 || (e >= 1 && e <= 3)) tileT[`${e}-${k}`] = mkT(tileModel(e, k), 700);
}
const ALL_T = [...Object.values(centerT), ...Object.values(tileT)];
// small colour shifts so neighbouring blocks never look identical
const TINTS = [[1, 1, 1], [1, 0.94, 0.88], [0.92, 0.95, 1], [1, 1, 0.9], [0.9, 0.9, 0.92], [1, 0.92, 0.94], [0.94, 1, 0.94]].map(([r, g, b]) => new THREE.Color(r, g, b));
// things that appear spring up with a little overshoot
const born = new Map();
const hash = (x) => ((x * 2654435761) >>> 0) % 997;
function popIn(t0, dur = 0.6) {
  if (t0 === undefined) return 1;
  const k = (t - t0) / dur;
  if (k >= 1) return 1;
  if (k <= 0) return 0.01;
  const c = 1.9, x = k - 1;
  return Math.max(0.01, 1 + (c + 1) * x * x * x + c * x * x);
}
const buildT = Object.fromEntries(BUILDINGS.map((b) => [b.id, mkT(buildingModel(b.id), 60)]));
let smokers = [];
function layoutBuildings() {
  for (const tp of Object.values(buildT)) tp.n = 0;
  smokers = [];
  for (const b of G.buildings) {
    const tp = buildT[b.id], n = tp.n++;
    placeIn(tp.body, n, b.v, 0, 0, YAW[b.v], 1.25 * popIn(b.t0, 0.8), -0.002);
    if (tp.glow) tp.glow.setMatrixAt(n, dummy.matrix);
    for (const sp of tp.smoke) smokers.push(new THREE.Vector3(...sp).applyMatrix4(dummy.matrix));
  }
  for (const tp of Object.values(buildT)) for (const m of [tp.body, tp.glow]) if (m) { m.count = tp.n; m.visible = tp.n > 0; m.instanceMatrix.needsUpdate = true; }
}
const flags = inst(mergeParts([{ g: new THREE.CylinderGeometry(0.005, 0.005, 0.2, 5).translate(0, 0.1, 0), c: 0xdddddd }, { g: new THREE.BoxGeometry(0.08, 0.045, 0.004).translate(0.04, 0.17, 0), c: 0xffffff }]), bodyMat, 80);
flags.setColorAt(0, new THREE.Color());
const FLAG_BLUE = new THREE.Color(0x3a8aff), FLAG_RED = new THREE.Color(0xff3a3a);
const people = inst(personGeo(), bodyMat, 240);
people.setColorAt(0, new THREE.Color());
const planes = inst(planeGeo(), bodyMat, 40);
const sats = inst(satelliteGeo(), bodyMat, 16);
// an arrow over a glowing ring: green "raise here", red "lower here"
function arrowGeo(down) {
  const parts = [
    { g: new THREE.TorusGeometry(0.13, 0.014, 4, 6).rotateX(Math.PI / 2).rotateY(Math.PI / 6), c: 0xffffff },
    { g: new THREE.CylinderGeometry(0.022, 0.022, 0.09, 6).translate(0, 0.045, 0), c: 0xffffff },
    { g: new THREE.ConeGeometry(0.06, 0.09, 6).translate(0, 0.135, 0), c: 0xffffff },
  ];
  if (down) for (const q of parts.slice(1)) q.g.rotateX(Math.PI).translate(0, 0.18, 0);
  return mergeParts(parts);
}
const guideUp = inst(arrowGeo(false), new THREE.MeshBasicMaterial({ color: 0x5aff7a }), 600, false);
const guideDown = inst(arrowGeo(true), new THREE.MeshBasicMaterial({ color: 0xff5a4a }), 600, false);
const spotGeo = new THREE.TorusGeometry(0.13, 0.01, 4, 6).rotateX(Math.PI / 2).rotateY(Math.PI / 6);
const lockRings = inst(new THREE.TorusGeometry(0.12, 0.012, 4, 6).rotateX(Math.PI / 2).rotateY(Math.PI / 6), new THREE.MeshBasicMaterial({ color: 0xff3a3a, transparent: true, opacity: 0.85 }), 1500, false);
const buildSpots = inst(spotGeo, new THREE.MeshBasicMaterial({ color: 0x7ad0ff, transparent: true, opacity: 0.8 }), 1200, false);
const cloudMesh = inst(cloudGeo(), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x6a7890, transparent: true, opacity: 0.9, roughness: 1 }), 24, false);
cloudMesh.castShadow = true;
const clouds = Array.from({ length: 22 }, (_, i) => ({ dir: new THREE.Vector3(rnd() * 2 - 1, (rnd() * 2 - 1) * 0.8, rnd() * 2 - 1).normalize(), yaw: rnd() * 6, s: 0.7 + rnd() * 0.8, i }));
const cursor = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthTest: false }));
cursor.visible = false; cursor.renderOrder = 5;
scene.add(cursor);
let cursorT = 0;
const wonderGroup = new THREE.Group();
scene.add(wonderGroup);

// auroras dance over both poles on the night side
const auroras = [1, -1].map((sgn) => {
  const geo = new THREE.CylinderGeometry(R * 0.62, R * 0.5, 1.3, 160, 1, true);
  const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uTime: timeU, uSun: sunU, uSeed: { value: sgn > 0 ? 0 : 5 } },
    vertexShader: `uniform float uTime; uniform float uSeed; varying vec2 vUv; varying vec3 vW;
      void main() { vUv = uv; vec3 p = position; float a = uv.x * 6.2831;
        float wob = sin(a * 5.0 + uTime * 0.4 + uSeed) * 0.18 + sin(a * 11.0 - uTime * 0.7) * 0.07;
        p.xz *= 1.0 + wob; vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime; uniform vec3 uSun; uniform float uSeed; varying vec2 vUv; varying vec3 vW;
      void main() {
        float night = smoothstep(0.35, -0.3, dot(normalize(vec3(vW.x, 0.0, vW.z)), normalize(vec3(uSun.x, 0.0, uSun.z))));
        float x = vUv.x * 60.0 + uSeed;
        float curtain = pow(0.5 + 0.5 * sin(x + sin(x * 0.37 + uTime * 0.6) * 3.0 + uTime * 0.25), 3.0);
        curtain *= 0.6 + 0.4 * sin(vUv.x * 17.0 - uTime * 0.9 + uSeed);
        float y = vUv.y;
        float fade = smoothstep(0.0, 0.18, y) * smoothstep(1.0, 0.35, y);
        vec3 col = mix(vec3(0.1, 1.0, 0.55), vec3(0.65, 0.25, 1.0), smoothstep(0.25, 0.95, y));
        gl_FragColor = vec4(col * curtain * fade * night * 2.0, 1.0);
      }`,
  }));
  m.position.y = sgn * (R + 0.55);
  if (sgn < 0) m.rotation.x = Math.PI;
  m.renderOrder = 3;
  scene.add(m);
  return m;
});

// fireflies drift over forests after dark
const FF = 1600;
const ffGeo = new THREE.BufferGeometry();
ffGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(FF * 3), 3));
ffGeo.setAttribute('aPhase', new THREE.BufferAttribute(Float32Array.from({ length: FF }, () => rnd() * 100), 1));
ffGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(FF * 3), 3));
const fireflies = new THREE.Points(ffGeo, new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uTime: timeU, uSun: sunU, uPR: { value: Math.min(window.devicePixelRatio, 2) } },
  vertexShader: `attribute float aPhase; attribute vec3 color; uniform float uTime; uniform vec3 uSun; uniform float uPR; varying float vA; varying vec3 vC;
    void main() { vec3 p = position;
      // city lights: steady warm windows that switch on at dusk, a few at a time
      float night = smoothstep(0.12 - fract(aPhase) * 0.25, -0.2 - fract(aPhase) * 0.1, dot(normalize(p), uSun));
      vA = night * (0.85 + 0.15 * step(0.97, fract(sin(floor(uTime * 0.5) + aPhase) * 43.7)));
      vC = color;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_PointSize = uPR * 22.0 / -mv.z; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying float vA; varying vec3 vC; void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.05, d); gl_FragColor = vec4(vC * a * vA * 1.8, 1.0); }`,
}));
fireflies.frustumCulled = false;
fireflies.renderOrder = 4;
scene.add(fireflies);
// city lights: every town hex glows with windows at night, more of them in later ages
const LIGHT_COLS = [[0xffa040, 0xff8a30], [0xffb050, 0xffa040], [0xffc070, 0xffb060], [0xffc878, 0xffd890], [0xffe0a0, 0xffd080], [0xfff0d0, 0xffe8b0, 0xbfe0ff], [0x9ff4ff, 0xffffff, 0xff9af0]].map((a) => a.map((c) => new THREE.Color(c)));
function seedFireflies() {
  const a = ffGeo.attributes.position.array, col = ffGeo.attributes.color.array;
  let i = 0;
  for (const s of G.settlements) {
    const era = eraOf(s), per = 2 + Math.min(5, era);
    for (const v of [s.v, ...(s.tiles || [])]) {
      if (tileKind[v] === 3 || tileKind[v] === 6) continue;
      const c = CELLS[v];
      for (let j = 0; j < per && i < FF; j++, i++) {
        const hj = hash(v * 7 + j * 131), hk = hash(v * 13 + j * 71);
        const lift = 0.015 + (hk % 10) * (era >= 5 ? 0.02 : 0.008);
        const p = DIRS[v].clone().multiplyScalar(radiusOf(v) + lift).addScaledVector(c.t1, ((hj % 21) - 10) * 0.012).addScaledVector(c.t2, (((hj >> 3) % 21) - 10) * 0.012);
        a.set(p.toArray(), i * 3);
        const lc = LIGHT_COLS[era][hk % LIGHT_COLS[era].length];
        col[i * 3] = lc.r; col[i * 3 + 1] = lc.g; col[i * 3 + 2] = lc.b;
      }
    }
  }
  for (; i < FF; i++) a[i * 3] = a[i * 3 + 1] = a[i * 3 + 2] = 0;
  ffGeo.attributes.position.needsUpdate = ffGeo.attributes.color.needsUpdate = true;
}

// treasures on the map
const resMeshes = (() => {
  const P = (g, c) => ({ g, c });
  const crystal = mergeParts([0, 1, 2, 3].map((i) => { const a = i * 1.7; return P(new THREE.OctahedronGeometry(0.035 + (i % 2) * 0.015, 0).scale(1, 2.6, 1).rotateZ(0.25 * Math.sin(a)).translate(Math.cos(a) * 0.05 * (i ? 1 : 0), 0.07 + (i % 2) * 0.02, Math.sin(a) * 0.05 * (i ? 1 : 0)), i % 2 ? 0xc87aff : 0x5ff0ff); }));
  const gold = mergeParts([0, 1, 2, 3, 4].map((i) => P(new THREE.IcosahedronGeometry(0.022 + (i % 3) * 0.008, 0).translate(Math.cos(i * 1.3) * 0.06, 0.02, Math.sin(i * 1.3) * 0.06), 0xffc830)));
  const rocks = mergeParts([0, 1, 2].map((i) => P(new THREE.DodecahedronGeometry(0.03, 0).translate(Math.cos(i * 2.1) * 0.08, 0.015, Math.sin(i * 2.1) * 0.08), 0x8a8478)));
  const fish = mergeParts([
    P(new THREE.SphereGeometry(0.03, 8, 6).scale(1.6, 0.8, 0.7), 0xff8a3a), P(new THREE.ConeGeometry(0.025, 0.04, 4).rotateZ(Math.PI / 2).translate(-0.06, 0, 0), 0xff6a2a),
    P(new THREE.SphereGeometry(0.025, 8, 6).scale(1.6, 0.8, 0.7).translate(0.04, 0, 0.08), 0xffb84a), P(new THREE.ConeGeometry(0.02, 0.035, 4).rotateZ(Math.PI / 2).translate(-0.01, 0, 0.08), 0xff9a3a)]);
  const ring = mergeParts([P(new THREE.TorusGeometry(0.1, 0.022, 5, 10).rotateX(Math.PI / 2), 0x9a948a)]);
  const pool = mergeParts([P(new THREE.CircleGeometry(0.09, 16).rotateX(-Math.PI / 2).translate(0, 0.012, 0), 0x5fd8ff), P(new THREE.CylinderGeometry(0.012, 0.004, 0.12, 6).translate(0, 0.06, 0), 0xbff4ff)]);
  const derrick = mergeParts([
    ...[0, 1, 2, 3].map((i) => P(new THREE.CylinderGeometry(0.004, 0.006, 0.26, 4).translate(0, 0.13, 0).rotateZ(0.12 * (i % 2 ? 1 : -1)).rotateY(i * Math.PI / 2), 0x2a2a30)),
    P(new THREE.CylinderGeometry(0.07, 0.07, 0.01, 10).translate(0.08, 0.005, 0.05), 0x101014), P(new THREE.BoxGeometry(0.06, 0.03, 0.04).translate(-0.06, 0.015, 0.06), 0x8a3a2a)]);
  return {
    1: [inst(crystal, glowMat, 40), inst(rocks, bodyMat, 40)],
    2: [inst(gold, glowMat, 40), inst(rocks, bodyMat, 40)],
    3: [inst(fish, bodyMat, 40)],
    4: [inst(ring, bodyMat, 40), inst(pool, glowMat, 40)],
    6: [inst(derrick, bodyMat, 40)],
    5: [inst(mergeParts([0, 1, 2, 3, 4].map((i) => P(new THREE.BoxGeometry(0.03, 0.05 + (i % 3) * 0.03, 0.03).translate(Math.cos(i * 1.26) * 0.08, 0.025 + (i % 3) * 0.015, Math.sin(i * 1.26) * 0.08), 0xd8ccb0)).concat([P(new THREE.BoxGeometry(0.1, 0.02, 0.03).translate(0, 0.01, 0), 0xc8bca0)])), bodyMat, 40)],
  };
})();
function layoutResources() {
  const n = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  for (let v = 0; v < NV; v++) {
    const r = res[v];
    if (!r || RES[r].land !== isLand(v) || (RES[r].era && G.era < RES[r].era) || tileKind[v] === 4 || tileKind[v] === 5) continue;
    const k = n[r]++;
    if (r === 3) {
      const lift = (G.seaVis + 0.5 - h[v]) * STEP + Math.max(0, Math.sin(t * 2.2 + v)) * 0.06 - 0.01;
      placeIn(resMeshes[3][0], k, v, 0, 0, t * 0.8 + v, 1, lift);
      continue;
    }
    const sc = r === 1 ? 1 + Math.sin(t * 1.5 + v) * 0.04 : 1;
    for (const m of resMeshes[r]) placeIn(m, k, v, 0.05, -0.04, YAW[v] + (r === 1 ? t * 0.2 : 0), sc, 0);
  }
  for (const r of [1, 2, 3, 4, 5, 6]) for (const m of resMeshes[r]) { m.count = n[r]; m.instanceMatrix.needsUpdate = true; }
}

// the beacon: a pillar of light where settlers should go
const beaconBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.12, 2.4, 16, 1, true).translate(0, 1.2, 0), new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uTime: timeU },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform float uTime; varying vec2 vUv; void main() { float a = (1.0 - vUv.y) * (0.6 + 0.4 * sin(uTime * 3.0 - vUv.y * 12.0)); gl_FragColor = vec4(vec3(1.0, 0.82, 0.35) * a * 1.4, 1.0); }',
}));
const beaconRing = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.012, 6, 6).rotateX(Math.PI / 2).rotateY(Math.PI / 6), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
const beacon = new THREE.Group();
beacon.add(beaconBeam, beaconRing);
beacon.visible = false;
scene.add(beacon);
function layoutBeacon() {
  beacon.visible = G.beacon >= 0;
  if (!beacon.visible) return;
  const v = G.beacon;
  beacon.quaternion.setFromUnitVectors(UP, DIRS[v]);
  beacon.position.copy(DIRS[v]).multiplyScalar(radiusOf(v) + 0.01);
}

// shooting stars streak across the night sky
let shootT = 4, shooter = null;
function updateShootingStars(dt) {
  shootT -= dt;
  if (!shooter && shootT <= 0) {
    shootT = 4 + rnd() * 8;
    // start somewhere on the far side of the camera's view, away from the sun
    const back = camera.position.clone().normalize().multiplyScalar(-1);
    const p = back.clone().add(new THREE.Vector3(rnd() - 0.5, rnd() * 0.5 + 0.2, rnd() - 0.5)).normalize().multiplyScalar(30);
    if (p.clone().normalize().dot(sunDir) > 0.2) return;
    const v = new THREE.Vector3(rnd() - 0.5, -0.4 - rnd() * 0.3, rnd() - 0.5).normalize().multiplyScalar(32);
    shooter = { p, v, life: 0.7 };
  }
  if (shooter) {
    shooter.life -= dt;
    for (let i = 0; i < 4; i++) { shooter.p.addScaledVector(shooter.v, dt / 4); parts.push({ p: shooter.p.clone(), v: new THREE.Vector3(), c: new THREE.Color(i % 2 ? 0xbfe8ff : 0xffffff), life: 0.5, max: 0.5, g: 0 }); }
    if (shooter.life <= 0) shooter = null;
  }
}

// ------------------------------------------------------------------ streets: along the hex edges inside and around each town
let roadsDirty = true;
const avTrees = inst(treeGeos()[1], bodyMat, 1500, true);
const roadMesh = inst(roadGeo(), bodyMat, 6000, false);
roadMesh.receiveShadow = true;
const laneMesh = inst(laneGeo(), glowMat, 3000, false);
const LG = lampGeos();
const lampPost = inst(LG.post, bodyMat, 1200, false), lampLight = inst(LG.light, glowMat, 1200, false);
const poolMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uSun: sunU },
  vertexShader: 'varying vec2 vUv; varying vec3 vW; void main() { vUv = uv; vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
  fragmentShader: 'uniform vec3 uSun; varying vec2 vUv; varying vec3 vW; void main() { float night = smoothstep(0.1, -0.2, dot(normalize(vW), uSun)); float d = length(vUv - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - d), 2.0) * night; gl_FragColor = vec4(vec3(1.0, 0.72, 0.35) * a * 0.55, 1.0); }',
});
const lampPool = inst(new THREE.PlaneGeometry(0.13, 0.13).rotateX(-Math.PI / 2).translate(0, 0.008, 0), poolMat, 1200, false);
lampPool.renderOrder = 2;
roadMesh.setColorAt(0, new THREE.Color()); laneMesh.setColorAt(0, new THREE.Color()); lampLight.setColorAt(0, new THREE.Color());
const tmpRoad = new THREE.Color();
const ROAD_COL = [0x8a6a44, 0x7a5a38, 0x6a6458, 0x55504a, 0x44444c, 0x2e3038, 0x9ab8e0].map((c) => new THREE.Color(c));
const LAMP_COL = [0xffb060, 0xffb060, 0xffc070, 0xffc070, 0xffd890, 0xfff2d8, 0x8ff4ff].map((c) => new THREE.Color(c));
let segs = [], cornerSegs = new Map();
const mtx = new THREE.Matrix4(), bx = new THREE.Vector3(), by = new THREE.Vector3(), bz = new THREE.Vector3(), sc3 = new THREE.Vector3();
function placeSeg(m, n, a, b, up, width, lift) {
  bx.subVectors(b, a); const len = bx.length(); bx.normalize();
  by.copy(up); bz.crossVectors(bx, by).normalize(); by.crossVectors(bz, bx);
  mtx.makeBasis(bx, by, bz);
  mtx.scale(sc3.set(len, 1, width));
  mtx.setPosition(a.clone().add(b).multiplyScalar(0.5).addScaledVector(up, lift));
  m.setMatrixAt(n, mtx);
}
function layoutRoads() {
  roadsDirty = false;
  segs = []; cornerSegs = new Map();
  let nr = 0, nl = 0, np = 0, nt = 0;
  const done = new Set();
  for (const s of G.settlements) {
    const era = eraOf(s), cells = new Set([s.v, ...s.tiles]);
    if (cells.size < 2) continue;
    for (const c of cells) {
      const cell = CELLS[c], k = cell.fs.length, rr = radiusOf(c);
      for (let i = 0; i < k; i++) {
        const nb = cell.nb[i], inside = cells.has(nb);
        if (era < 1 && !inside) continue;
        if (inside && h[nb] !== h[c]) continue;
        const avenue = inside && SECTION[nb] !== SECTION[c];
        if (inside && !avenue && (era >= 1 || (c + nb) % 3)) continue;
        const f1 = cell.fs[i], f2 = cell.fs[(i + 1) % k], key = f1 < f2 ? `${f1}-${f2}` : `${f2}-${f1}`;
        if (done.has(key) || nr >= 6000) continue;
        done.add(key);
        const a = CORN[f1].clone().multiplyScalar(rr - 0.011), b = CORN[f2].clone().multiplyScalar(rr - 0.011), up = DIRS[c];
        placeSeg(roadMesh, nr, a, b, up, era < 1 ? 0.018 : era >= 4 ? 0.05 : 0.04, 0.0);
        if (avenue && nt < 1500) for (const k of [0.3, 0.7]) { const p = a.clone().lerp(b, k), side = new THREE.Vector3().crossVectors(b.clone().sub(a), up).normalize().multiplyScalar(k < 0.5 ? 0.026 : -0.026); dummy.position.copy(p).add(side); dummy.quaternion.setFromUnitVectors(UP, up); dummy.scale.setScalar(0.5 + (hash(f1 + f2) % 3) * 0.06); dummy.updateMatrix(); avTrees.setMatrixAt(nt++, dummy.matrix); }
        roadMesh.setColorAt(nr++, ROAD_COL[era]);
        if (era >= 4 && (avenue || !inside) && nl < 3000) { placeSeg(laneMesh, nl, a.clone().lerp(b, 0.12), b.clone().lerp(a, 0.12), up, 0.003, 0.0); laneMesh.setColorAt(nl++, era === 6 ? LAMP_COL[6] : new THREE.Color(0xf4f0d0)); }
        if (era >= 1 && np < 1200 && (f1 + f2) % 2 === 0) {
          const mid = a.clone().lerp(b, 0.5).addScaledVector(DIRS[c].clone().sub(a.clone().normalize()).normalize(), 0);
          dummy.position.copy(mid); dummy.quaternion.setFromUnitVectors(UP, up); dummy.scale.setScalar(1); dummy.updateMatrix();
          lampPost.setMatrixAt(np, dummy.matrix); lampLight.setMatrixAt(np, dummy.matrix); lampPool.setMatrixAt(np, dummy.matrix); lampLight.setColorAt(np++, LAMP_COL[era]);
        }
        const si = segs.length;
        segs.push({ a, b, up, f1, f2, era, len: a.distanceTo(b) });
        for (const f of [f1, f2]) { if (!cornerSegs.has(f)) cornerSegs.set(f, []); cornerSegs.get(f).push(si); }
      }
    }
  }
  roadMesh.count = nr; laneMesh.count = nl; lampPost.count = lampLight.count = lampPool.count = np; avTrees.count = nt; avTrees.instanceMatrix.needsUpdate = true;
  for (const m of [roadMesh, laneMesh, lampPost, lampLight, lampPool]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  seedTraffic();
}
// people, carts, cars and hover pods moving from street to street
const peds = inst(personGeo(), bodyMat, 700, false), crowd3 = inst(personGeo(), bodyMat, 700, false), cars = inst(carGeo(), bodyMat, 400, false), heads = inst(mergeParts([{ g: new THREE.BoxGeometry(0.003, 0.004, 0.012).translate(0.0135, 0.01, 0), c: 0xfff4c0 }]), glowMat, 400, false), pods = inst(podGeo(), glowMat, 400, false);
for (const m of [peds, cars, pods, crowd3]) m.setColorAt(0, new THREE.Color());
const CAR_COL = [0xd04a3a, 0x3a7ad0, 0xe0c040, 0xf2f2f2, 0x2a2a30, 0x4ab06a, 0xe07a2a, 0x8a5ad0].map((c) => new THREE.Color(c));
const PED_COL = [0xb05a3a, 0x3a6a8a, 0xd8b04a, 0x6a8a3a, 0x8a4a8a, 0xe0e0d8].map((c) => new THREE.Color(c));
let traffic = [], crowdSpots = [];
function seedTraffic() {
  traffic = [];
  const n = Math.min(900, Math.floor(segs.length * 0.6));
  for (let i = 0; i < n; i++) {
    const si = (rnd() * segs.length) | 0, sg = segs[si];
    // people walk in every age; vehicles join them later
    const ped = sg.era <= 3 || rnd() < 0.45;
    traffic.push({ si, t: rnd(), fwd: rnd() < 0.5, ped, speed: ped ? 0.018 + rnd() * 0.015 : 0.09 + rnd() * 0.06, col: i });
  }
}
const tA = new THREE.Vector3(), tB = new THREE.Vector3(), tP = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
function updateTraffic(dt) {
  let np = 0, nc = 0, nd = 0;
  for (const a of traffic) {
    let sg = segs[a.si];
    if (!sg) continue;
    a.t += (a.speed * dt) / sg.len;
    if (a.t >= 1) {
      // turn onto another street at the corner we reached
      const corner = a.fwd ? sg.f2 : sg.f1, opts = (cornerSegs.get(corner) || []).filter((x) => x !== a.si);
      if (opts.length) { const ni = opts[(rnd() * opts.length) | 0]; a.si = ni; a.fwd = segs[ni].f1 === corner; }
      else a.fwd = !a.fwd;
      a.t = 0; sg = segs[a.si];
    }
    const from = a.fwd ? sg.a : sg.b, to = a.fwd ? sg.b : sg.a;
    tP.copy(from).lerp(to, a.t);
    tA.subVectors(to, from).normalize();
    tB.crossVectors(tA, sg.up).normalize();
    tP.addScaledVector(tB, a.ped ? (a.col % 2 ? 0.013 : -0.013) : 0.006);
    dummy.position.copy(tP);
    dummy.up.copy(sg.up);
    dummy.lookAt(tP.clone().add(tB));
    dummy.scale.setScalar(a.ped ? 1.05 : 1.5);
    if (a.ped) dummy.position.addScaledVector(sg.up, Math.abs(Math.sin(t * 9 + a.col)) * 0.003);
    dummy.updateMatrix();
    dummy.up.set(0, 1, 0);
    if (a.ped) { if (np >= 700) continue; peds.setMatrixAt(np, dummy.matrix); peds.setColorAt(np++, PED_COL[a.col % PED_COL.length]); }
    else if (sg.era <= 5) { cars.setMatrixAt(nc, dummy.matrix); heads.setMatrixAt(nc, dummy.matrix); cars.setColorAt(nc++, CAR_COL[a.col % CAR_COL.length]); }
    else { pods.setMatrixAt(nd, dummy.matrix); pods.setColorAt(nd++, a.col % 2 ? LAMP_COL[6] : new THREE.Color(0xff8af0)); }
  }
  peds.count = np; cars.count = heads.count = nc; pods.count = nd;
  // crowds mill around markets, plazas and town squares
  let nq = 0;
  for (const c of crowdSpots) {
    for (let k = 0; k < c.n && nq < 700; k++) {
      const a = t * (0.15 + (k % 3) * 0.08) * (k % 2 ? 1 : -1) + k * 1.7 + c.v, rr = 0.04 + ((k * 37 + c.v) % 7) * 0.012;
      const cell = CELLS[c.v];
      tP.copy(DIRS[c.v]).multiplyScalar(radiusOf(c.v) + 0.004).addScaledVector(cell.t1, Math.cos(a) * rr).addScaledVector(cell.t2, Math.sin(a) * rr);
      dummy.position.copy(tP); dummy.up.copy(DIRS[c.v]);
      dummy.lookAt(tP.clone().addScaledVector(cell.t1, -Math.sin(a)).addScaledVector(cell.t2, Math.cos(a)));
      dummy.scale.setScalar(1.05); dummy.updateMatrix(); dummy.up.set(0, 1, 0);
      crowd3.setMatrixAt(nq, dummy.matrix); crowd3.setColorAt(nq++, PED_COL[(k + c.v) % PED_COL.length]);
    }
  }
  crowd3.count = nq; crowd3.instanceMatrix.needsUpdate = true; if (crowd3.instanceColor) crowd3.instanceColor.needsUpdate = true;
  for (const m of [peds, cars, pods, heads]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
}

// boats on the seas and birds over the land
const BG = boatGeos();
const sails = inst(BG.sail, bodyMat, 30, true), ships = inst(BG.ship, bodyMat, 30, true);
const boats = Array.from({ length: 16 }, (_, i) => ({ axis: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(), ang: rnd() * 6.28, speed: (0.012 + rnd() * 0.012) * (i % 2 ? 1 : -1), start: new THREE.Vector3(), wet: false, check: 0 }));
for (const b of boats) b.start.set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).projectOnPlane(b.axis).normalize();
const birdMesh = inst(birdGeo(), bodyMat, 60, false);
const flocks = Array.from({ length: 5 }, () => ({ c: new THREE.Vector3(rnd() - 0.5, (rnd() - 0.5) * 1.2, rnd() - 0.5).normalize(), r: 0.25 + rnd() * 0.3, ph: rnd() * 6, sp: 0.25 + rnd() * 0.2 }));
const nearestCell = (d) => { let best = 0, bd = -2; for (let v = 0; v < NV; v += 1) { const k = DIRS[v].dot(d); if (k > bd) { bd = k; best = v; } } return best; };
function updateBoats(dt) {
  let ns = 0, nh = 0;
  for (const b of boats) {
    b.ang += b.speed * dt;
    const d = b.start.clone().applyAxisAngle(b.axis, b.ang);
    b.check -= dt;
    if (b.check <= 0) { b.check = 0.5; b.wet = !isLand(nearestCell(d)) && Math.abs(d.y) < 0.85; }
    if (!b.wet) continue;
    const fwd = b.axis.clone().cross(d).multiplyScalar(Math.sign(b.speed)).normalize();
    dummy.position.copy(d).multiplyScalar(R + (G.seaVis + 0.5) * STEP + 0.004 + Math.sin(t * 2 + b.ang * 9) * 0.004);
    dummy.up.copy(d); dummy.lookAt(dummy.position.clone().add(fwd.cross(d)));
    dummy.scale.setScalar(1.3); dummy.updateMatrix(); dummy.up.set(0, 1, 0);
    if (G.era >= 4) { ships.setMatrixAt(nh++, dummy.matrix); if (G.era === 4 && rnd() < dt * 1.5) emit(dummy.position.clone().addScaledVector(d, 0.06), 0x4a4a50, 1, 0.15, 0.03, 1.5, -0.05); }
    else sails.setMatrixAt(ns++, dummy.matrix);
  }
  sails.count = ns; ships.count = nh;
  sails.instanceMatrix.needsUpdate = ships.instanceMatrix.needsUpdate = true;
  let nb = 0;
  for (const f of flocks) {
    const t1 = new THREE.Vector3(0, 1, 0).cross(f.c).normalize(), t2 = f.c.clone().cross(t1);
    for (let i = 0; i < 9; i++) {
      const a = t * f.sp + f.ph - i * 0.05, off = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.025;
      const p = f.c.clone().addScaledVector(t1, Math.cos(a) * f.r).addScaledVector(t2, Math.sin(a) * f.r).normalize();
      const n = p.clone(), tang = t1.clone().multiplyScalar(-Math.sin(a)).addScaledVector(t2, Math.cos(a)).normalize();
      dummy.position.copy(p).multiplyScalar(R + 1.0 + Math.sin(t * 3 + i) * 0.02).addScaledVector(tang.clone().cross(n), off).addScaledVector(tang, -Math.abs(off) * 1.2);
      dummy.up.copy(n); dummy.lookAt(dummy.position.clone().add(tang.clone().cross(n).multiplyScalar(-1)));
      dummy.scale.set(1, 1, 1 + Math.sin(t * 12 + i) * 0.4); dummy.updateMatrix(); dummy.up.set(0, 1, 0);
      birdMesh.setMatrixAt(nb++, dummy.matrix);
    }
  }
  birdMesh.count = G.era <= 5 ? nb : 0;
  birdMesh.instanceMatrix.needsUpdate = true;
}

// small details on open land: grass tufts, flowers and rocks
const SG = sceneryGeos();
const tufts = inst(SG.tuft, bodyMat, 2500, false), flowers = inst(SG.flower, bodyMat, 1500, false), rocks = inst(SG.rock, bodyMat, 1000, false);
flowers.setColorAt(0, new THREE.Color());
const FLOWER_COL = [0xff6a8a, 0xffe04a, 0xffffff, 0xb07aff, 0xff9a3a].map((c) => new THREE.Color(c));
function layoutScenery() {
  let nt = 0, nf = 0, nr = 0;
  for (let v = 0; v < NV; v++) {
    if (!isLand(v) || tileKind[v] || owner[v] >= 0 || Math.abs(DIRS[v].y) > 0.86) continue;
    const up = h[v] - G.sea, hv = hash(v);
    if (up >= 4) { if (hv % 2 === 0 && nr < 1000) placeIn(rocks, nr++, v, ((hv % 7) - 3) * 0.02, ((hv % 5) - 2) * 0.025, hv, 0.9 + (hv % 4) * 0.2, 0); continue; }
    if (up <= 0 || tree[v]) continue;
    for (let i = 0; i < 1 + (hv % 2) && nt < 2500; i++) placeIn(tufts, nt++, v, (((hv >> i) % 9) - 4) * 0.022, (((hv >> (i + 2)) % 9) - 4) * 0.022, hv + i, 1, 0);
    if (hv % 3 === 0 && nf < 1500 && up <= 2) { placeIn(flowers, nf, v, ((hv % 11) - 5) * 0.015, ((hv % 7) - 3) * 0.02, 0, 1, 0); flowers.setColorAt(nf++, FLOWER_COL[hv % FLOWER_COL.length]); }
    if (hv % 11 === 0 && nr < 1000) placeIn(rocks, nr++, v, -0.05, 0.04, hv, 0.6, 0);
  }
  tufts.count = nt; flowers.count = nf; rocks.count = nr;
  for (const m of [tufts, flowers, rocks]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
}

// ------------------------------------------------------------------ shattering land: chunks of the hex fly apart when you reshape it
const DMAX = 700;
const debrisMesh = inst(new THREE.DodecahedronGeometry(0.026, 0), new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9 }), DMAX, false);
debrisMesh.setColorAt(0, new THREE.Color());
const debris = [];
const shockRings = Array.from({ length: 8 }, () => {
  const m = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.012, 4, 6).rotateX(Math.PI / 2).rotateY(Math.PI / 6), new THREE.MeshBasicMaterial({ color: 0xfff4d0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.visible = false; m.life = 0; scene.add(m); return m;
});
const dCol = new THREE.Color(), dCol2 = new THREE.Color();
function shatterCell(v, raised, strength, col) {
  const cell = CELLS[v], up = DIRS[v], r = radiusOf(v);
  const n = Math.round(20 * strength);
  for (let i = 0; i < n; i++) {
    if (debris.length >= DMAX) debris.shift();
    const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * 0.14;
    const off = cell.t1.clone().multiplyScalar(Math.cos(a) * rr).addScaledVector(cell.t2, Math.sin(a) * rr);
    const p = up.clone().multiplyScalar(r + (raised ? -0.02 : 0.005)).add(off);
    const out = off.clone().normalize();
    const v0 = up.clone().multiplyScalar((raised ? 0.7 : 0.9) + rnd() * 0.8).addScaledVector(out, 0.35 + rnd() * 0.6);
    // top colour chunks, darker soil chunks from inside the column
    const c = rnd() < 0.55 ? col.clone() : col.clone().lerp(PAL.cliff, 0.6).multiplyScalar(0.8);
    debris.push({ p, v: v0.multiplyScalar(strength > 0.6 ? 1 : 0.7), rot: new THREE.Euler(rnd() * 6, rnd() * 6, rnd() * 6), spin: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(14), life: 0.9 + rnd() * 0.5, max: 1.4, s: (0.6 + rnd() * 0.9) * (0.6 + strength * 0.5), c });
  }
  emit(up.clone().multiplyScalar(r + 0.03), raised ? 0xd8c8a0 : 0xb8a888, Math.round(6 * strength), 0.25, 0.25, 0.9, 0.3);
  if (strength > 0.6) {
    const ring = shockRings.find((m) => m.life <= 0) || shockRings[0];
    ring.quaternion.setFromUnitVectors(UP, up); ring.rotateY(YAW[v]);
    ring.position.copy(up).multiplyScalar(r + 0.02);
    ring.life = 0.45; ring.visible = true; ring.material.color.set(raised ? 0xfff0c0 : 0xc8e0ff);
  }
}
function updateDebris(dt) {
  let n = 0;
  for (let i = debris.length - 1; i >= 0; i--) {
    const d = debris[i];
    d.life -= dt;
    if (d.life <= 0) { debris.splice(i, 1); continue; }
    const len = d.p.length();
    d.v.addScaledVector(d.p, (-3.2 * dt) / len);
    d.p.addScaledVector(d.v, dt);
    // chunks bounce once off the ground and then crumble
    const v = nearestCellFast(d.p), floor = radiusOf(v);
    if (d.p.length() < floor && d.v.dot(d.p) < 0) { d.p.setLength(floor); const nrm = d.p.clone().normalize(); d.v.addScaledVector(nrm, -1.5 * d.v.dot(nrm)).multiplyScalar(0.45); }
    d.rot.x += d.spin.x * dt; d.rot.y += d.spin.y * dt; d.rot.z += d.spin.z * dt;
    dummy.position.copy(d.p); dummy.rotation.copy(d.rot); dummy.scale.setScalar(d.s * Math.min(1, d.life * 2.2)); dummy.updateMatrix();
    debrisMesh.setMatrixAt(n, dummy.matrix); debrisMesh.setColorAt(n++, d.c);
  }
  debrisMesh.count = n; debrisMesh.instanceMatrix.needsUpdate = true; if (debrisMesh.instanceColor) debrisMesh.instanceColor.needsUpdate = true;
  for (const m of shockRings) if (m.life > 0) { m.life -= dt; const k = 1 - m.life / 0.45; m.scale.setScalar(1 + k * 1.6); m.material.opacity = (1 - k) * 0.9; if (m.life <= 0) m.visible = false; }
}
// a cheap nearest-cell lookup: walk from the last answer toward the point
let ncLast = 0;
function nearestCellFast(p) {
  const d = tmpV.copy(p).normalize();
  let v = ncLast, best = DIRS[v].dot(d), moved = true;
  for (let k = 0; k < 40 && moved; k++) { moved = false; for (const n of NBR[v]) { const q = DIRS[n].dot(d); if (q > best) { best = q; v = n; moved = true; } } }
  ncLast = v; return v;
}
// shapes the land and shatters every hex that changed
function shapeWith(fn, v) {
  const area = bfs(v, 3), before = area.map(([x]) => h[x]), cols = area.map(([x]) => cellColor(x).clone());
  const ok = fn(v);
  if (!ok) return false;
  if (area.some(([x], i) => h[x] !== before[i] && (tileKind[x] === 4 || tileKind[x] === 5))) { area.forEach(([x], i) => { h[x] = before[i]; }); terrainDirty = true; return false; }
  const changed = new Set();
  area.forEach(([x, d], i) => { if (h[x] !== before[i]) { changed.add(x); shatterCell(x, h[x] > before[i], x === v ? 1 : 0.45, cols[i]); } });
  if (changed.size) crushAt(changed);
  return true;
}

// ------------------------------------------------------------------ golden wisps: tap them for inspiration
const wispMesh = inst(new THREE.IcosahedronGeometry(0.05, 1), new THREE.MeshBasicMaterial({ color: 0xffe27a }), 8, false);
const wispHalo = inst(new THREE.PlaneGeometry(0.34, 0.34), new THREE.MeshBasicMaterial({ map: dotTexEarly(), color: 0xffd060, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), 8, false);
let wisps = [], wispT = 25;
function dotTexEarly() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.3, 'rgba(255,255,255,0.5)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
function updateWisps(dt) {
  if (G.mode === 'play') {
    wispT -= dt;
    const mine = G.settlements.filter((x) => !x.tribe);
    if (wispT <= 0 && mine.length && wisps.length < 3) {
      wispT = 30 + rnd() * 25;
      const s = mine[(rnd() * mine.length) | 0];
      const spots = bfs(s.v, 4).filter(([x, d]) => d >= 2 && isLand(x)).map(([x]) => x);
      if (spots.length) { wisps.push({ v: spots[(rnd() * spots.length) | 0], t0: t, life: 28 }); tip('wisp', '✨ A golden wisp! Tap it for inspiration before it fades.', true); }
    }
    for (const w of wisps) w.life -= dt;
    wisps = wisps.filter((w) => w.life > 0);
  }
  let n = 0;
  const camQ = camera.quaternion;
  for (const w of wisps) {
    const p = posOf(w.v, 0.25 + Math.sin(t * 2 + w.v) * 0.05);
    const k = Math.min(1, w.life / 3) * popIn(w.t0, 0.5);
    dummy.position.copy(p); dummy.quaternion.copy(camQ); dummy.scale.setScalar(k * (1 + Math.sin(t * 5) * 0.12)); dummy.updateMatrix();
    wispMesh.setMatrixAt(n, dummy.matrix); wispHalo.setMatrixAt(n++, dummy.matrix);
    if (rnd() < dt * 4) emit(p, 0xffe27a, 1, 0.1, 0.08, 0.8, -0.1);
  }
  wispMesh.count = wispHalo.count = n;
  wispMesh.instanceMatrix.needsUpdate = wispHalo.instanceMatrix.needsUpdate = true;
}
function collectWisp(v) {
  const near = new Set(bfs(v, 1).map(([x]) => x));
  const w = wisps.find((x) => near.has(x.v));
  if (!w) return false;
  wisps.splice(wisps.indexOf(w), 1);
  const gain = 25 + G.era * 15;
  addMana(gain); G.know += needOf(G.era) * 0.03;
  const p = posOf(w.v, 0.25);
  emit(p, 0xffe27a, 40, 0.8, 0.5, 1.1, -0.2); emit(p, 0xffffff, 15, 1.2, 0.3, 0.5, 0);
  floatText(w.v, `✨ +${gain}✦ +📜`, 'gold');
  sfx.grow(); bump($('mana').closest('.orb'));
  return true;
}

// ------------------------------------------------------------------ fireworks when a town celebrates
const FW_COLS = [0xff5a6a, 0xffd25a, 0x5ad8ff, 0x8aff8a, 0xd08aff, 0xffffff];
function fireworks(v, n = 3) {
  for (let i = 0; i < n + 1; i++) setTimeout(() => {
    const p = posOf(v, 0.55 + rnd() * 0.35).addScaledVector(CELLS[v].t1, (rnd() - 0.5) * 0.3).addScaledVector(CELLS[v].t2, (rnd() - 0.5) * 0.3);
    const c = FW_COLS[(rnd() * FW_COLS.length) | 0];
    emit(p, c, 46, 0.05, 1.1, 1.3, 0.25); emit(p, 0xffffff, 8, 0.05, 0.4, 0.4, 0);
    sfx.pop?.();
  }, i * 260 + rnd() * 120);
}

// ------------------------------------------------------------------ particles (radial gravity)
const PMAX = 1200;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(PMAX * 3), pCol = new Float32Array(PMAX * 3);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const dotTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'), rg = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.5, 'rgba(255,255,255,0.7)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
})();
const points = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.09, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
points.frustumCulled = false;
scene.add(points);
const parts = [];
const tmpV = new THREE.Vector3();
function emit(p, color, n = 8, out = 0.6, spread = 0.3, life = 1, g = 0.8) {
  const c = new THREE.Color(color), nrm = p.clone().normalize();
  for (let k = 0; k < n; k++) {
    if (parts.length >= PMAX) parts.shift();
    const v = nrm.clone().multiplyScalar(out * (0.5 + rnd())).add(new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(spread));
    parts.push({ p: p.clone(), v, c, life: life * (0.6 + rnd() * 0.6), max: life, g });
  }
}
function updateParticles(dt) {
  for (let k = parts.length - 1; k >= 0; k--) {
    const q = parts[k];
    q.life -= dt;
    if (q.life <= 0) { parts.splice(k, 1); continue; }
    tmpV.copy(q.p).normalize().multiplyScalar(-q.g * dt);
    q.v.add(tmpV);
    q.p.addScaledVector(q.v, dt);
  }
  for (let k = 0; k < PMAX; k++) {
    const q = parts[k];
    if (q) { pPos[k * 3] = q.p.x; pPos[k * 3 + 1] = q.p.y; pPos[k * 3 + 2] = q.p.z; const f = Math.min(1, (q.life / q.max) * 1.6); pCol[k * 3] = q.c.r * f; pCol[k * 3 + 1] = q.c.g * f; pCol[k * 3 + 2] = q.c.b * f; }
    else { pPos[k * 3] = pPos[k * 3 + 1] = pPos[k * 3 + 2] = 0; pCol[k * 3] = pCol[k * 3 + 1] = pCol[k * 3 + 2] = 0; }
  }
  pGeo.attributes.position.needsUpdate = pGeo.attributes.color.needsUpdate = true;
}

// ------------------------------------------------------------------ settlements and people
const capOf = (s) => sizeOf(s) * DENSITY[eraOf(s)] * (1 + (s.fx ? s.fx.food : 0) * 0.5);
function fertility(v) {
  let f = 0.6;
  if (NBR[v].some((x) => !isLand(x))) f += 0.3;
  if (rain[v] > 0) f += 0.4;
  if (bfs(v, 2).some(([x]) => tree[x])) f += 0.2;
  f -= Math.abs(DIRS[v].y) * 0.4;
  return Math.max(0.2, f) * (0.6 + G.health / 250);
}
const NAME_A = ['Ash', 'Bel', 'Cor', 'Dun', 'El', 'Fen', 'Gal', 'Har', 'Ir', 'Kel', 'Lun', 'Mar', 'Nor', 'Os', 'Pel', 'Riv', 'Sol', 'Tal', 'Ul', 'Ver', 'Wyn', 'Zan'];
const NAME_B = ['ford', 'haven', 'dale', 'wick', 'mere', 'stead', 'holm', 'ton', 'brook', 'gate', 'moor', 'vale', 'crest', 'field', 'port', 'by'];
const RED_A = ['Kar', 'Vor', 'Zul', 'Rhak', 'Mor', 'Gra', 'Tor', 'Xa', 'Dra', 'Sku'];
const RED_B = ['goth', 'zar', 'mok', 'thul', 'rak', 'gar', 'vex', 'dun'];
const genName1 = (tribe) => tribe ? RED_A[(rnd() * RED_A.length) | 0] + RED_B[(rnd() * RED_B.length) | 0] : NAME_A[(rnd() * NAME_A.length) | 0] + NAME_B[(rnd() * NAME_B.length) | 0];
function genName(tribe) { for (let k = 0; k < 12; k++) { const n = genName1(tribe); if (!G.settlements?.some((x) => x.name === n)) return n; } return genName1(tribe); }
const newTown = (v, pop, tiles = [], tribe = 0) => ({ name: genName(tribe), v, pop, tiles, tribe, res: [], seen: new Set(), level: 1, grow: 0, sick: 0, inspire: 0, cool: 6, fert: 1, growT: 2, stuck: 0, fx: { food: 0, know: 0, size: 0, health: 0, defend: 0 }, fxN: {} });
function found(v, pop, tribe = 0) {
  const s = newTown(v, pop, [], tribe);
  s.fert = fertility(v);
  for (const [x] of bfs(v, 1)) tree[x] = 0;
  G.settlements.push(s);
  assignTiles(); computeFx();
  if (!tribe) G.stats.founded++;
  setDirty = true; terrainDirty = true;
  return s;
}
function removeSettlement(s, why) {
  G.settlements.splice(G.settlements.indexOf(s), 1);
  G.stats.lost++;
  assignTiles(); computeFx();
  setDirty = true;
  emit(posOf(s.v, 0.05), 0xb8a888, 20, 0.5, 0.4, 1);
  if (why) toast(why);
}
function spawnWalker(v, pop, tribe = 0, war = -1) {
  const w = { v, pop, tribe, war, path: [], t: 0, from: v, to: v, think: 0, tries: 0, age: 0 };
  G.walkers.push(w);
  return w;
}
function findSpot(v, tribe = 0, useBeacon = true) {
  const B = useBeacon && !tribe && G.beacon >= 0 ? G.beacon : -1;
  let best = null, bestScore = -1e9;
  for (const [x, d] of B >= 0 ? bfs(B, 4) : bfs(v, 11, isLand)) {
    if ((B < 0 && d < 3) || !canSettle(x) || (!tribe && lock[x])) continue;
    const sc = sameNeighbours(x) * 2 + flatScore(x) * 0.6 - d * (B >= 0 ? 3 : 0.5) + fertility(x) * 4 + rnd();
    if (sc > bestScore) { bestScore = sc; best = x; }
  }
  return best;
}
function pathTo(a, b, anyCell = false) {
  const prev = new Map([[a, -1]]), q = [a];
  for (let i = 0; i < q.length && i < NV; i++) {
    const x = q[i];
    if (x === b) break;
    for (const n of NBR[x]) if (!prev.has(n) && (anyCell || isLand(n))) { prev.set(n, x); q.push(n); }
  }
  if (!prev.has(b)) return null;
  const path = [];
  for (let x = b; x !== a; x = prev.get(x)) path.push(x);
  return path.reverse();
}
function updateWalkers(dt) {
  for (let i = G.walkers.length - 1; i >= 0; i--) {
    const w = G.walkers[i];
    w.age += dt;
    if (w.war === -2) {
      // a trade caravan: there and back, paid on arrival
      if (w.t < 1 && w.from !== w.to) { w.t += dt * 1.3; continue; }
      w.from = w.to; w.t = 0;
      if (w.path.length) { w.to = w.path.shift(); continue; }
      G.walkers.splice(i, 1);
      const gain = Math.round(15 + G.era * 8);
      addMana(gain); G.rival.mana = Math.min(999, G.rival.mana + gain * 0.5); G.rival.rel = Math.min(100, G.rival.rel + 1.5);
      floatText(w.from, `🐪 Trade +${gain}✦`, 'gold');
      tip('trade', '🐪 Trade caravans travel while you are at peace with the Crimson. Allies trade more often.', true);
      continue;
    }
    if (w.war >= 0) {
      if (w.t < 1 && w.from !== w.to) { w.t += dt * 1.1; continue; }
      w.from = w.to; w.t = 0;
      if (w.path.length) { w.to = w.path.shift(); continue; }
      G.walkers.splice(i, 1);
      battle(w);
      continue;
    }
    if (!isLand(w.to) || !isLand(w.from)) { G.walkers.splice(i, 1); emit(posOf(w.from, 0.05), 0xbfe6ff, 10, 0.4, 0.3, 0.8); G.stats.lost++; continue; }
    if (w.t < 1 && w.from !== w.to) { w.t += dt * 0.9; continue; }
    w.from = w.to; w.t = 0;
    if (w.path.length) { w.to = w.path.shift(); continue; }
    // arrived (or idle): settle, or look for a new spot
    if (w.target === w.from && canSettle(w.from)) { if (!w.tribe && G.beacon >= 0 && bfs(G.beacon, 4).some(([x]) => x === w.from)) { G.beacon = -1; layoutBeacon(); toast('🚩 Your settlers reached the beacon!', w.from); } found(w.from, w.pop, w.tribe); if (!w.tribe) floatText(w.from, `🏘️ ${G.settlements[G.settlements.length - 1].name} founded!`, 'gold'); G.walkers.splice(i, 1); if (!w.tribe) { sfx.found(); tip('found', 'A new settlement! Level the land around it so it can grow.'); } continue; }
    w.think -= dt;
    if (w.think > 0) continue;
    w.think = 1.5;
    if (!w.tribe && G.behave === 'fight' && G.rival.status === 'war') {
      // march on the nearest Crimson town
      const tg = G.settlements.filter((x) => x.tribe === 1).sort((a, b) => DIRS[a.v].distanceTo(DIRS[w.from]) - DIRS[b.v].distanceTo(DIRS[w.from]))[0];
      const pth = tg && pathTo(w.from, tg.v, true);
      if (pth) { w.war = tg.v; w.path = pth; w.to = w.path.shift(); continue; }
    }
    if (!w.tribe && G.behave === 'gather' && G.beacon >= 0) {
      // gather at the beacon and merge into one band
      w.age = 0;
      const near = bfs(G.beacon, 1).some(([x]) => x === w.from);
      if (!near) { const pth = pathTo(w.from, G.beacon); if (pth) { w.path = pth; w.to = w.path.shift(); continue; } }
      else {
        for (const o of G.walkers) if (o !== w && !o.tribe && o.war === -1 && bfs(G.beacon, 1).some(([x]) => x === o.from)) { w.pop += o.pop; o.pop = 0; }
        G.walkers = G.walkers.filter((o) => o.pop > 0);
        if (rnd() < 0.3) floatText(w.from, `🧲 ${fmt(w.pop)} gathered`, 'gold');
        w.think = 3; continue;
      }
    }
    let spot = findSpot(w.from, w.tribe);
    let path = spot !== null ? pathTo(w.from, spot) : null;
    if (!path && !w.tribe && G.beacon >= 0) { spot = findSpot(w.from, 0, false); path = spot !== null ? pathTo(w.from, spot) : null; }
    if (path) { w.target = spot; w.path = path; w.to = w.path.shift(); }
    else if (++w.tries > 3 || w.age > 60) {
      // nowhere to go: rejoin the nearest settlement
      const home = nearestSettlement(w.from, w.tribe);
      if (home) home.pop += w.pop;
      G.walkers.splice(i, 1);
    } else { const n = NBR[w.from].filter(isLand); if (n.length) w.to = n[(rnd() * n.length) | 0]; }
  }
}
function nearestSettlement(v, tribe = 0) {
  let best = null, bd = 1e9;
  for (const s of G.settlements) {
    if ((s.tribe || 0) !== tribe) continue; const d = DIRS[s.v].distanceToSquared(DIRS[v]); if (d < bd) { bd = d; best = s; } }
  return best;
}
const totalPop = (tribe = 0) => G.settlements.reduce((a, s) => a + (s.tribe === tribe ? s.pop : 0), 0) + G.walkers.reduce((a, w) => a + (w.tribe === tribe ? w.pop : 0), 0);

// ------------------------------------------------------------------ powers
// Level: step toward the height of the nearest of your towns (or the first hex of this stroke)
// the Level tool aims at a chosen height, or at the nearest town's height in Auto
let lvlPin = null, lvlPicking = false;
function renderLvl() {
  $('lvl').hidden = tool !== 'level' || G.mode !== 'play';
  $('lvl').classList.toggle('auto', lvlPin === null);
  $('lvl-auto').classList.toggle('on', lvlPin === null);
  $('lvl-pick').classList.toggle('on', lvlPicking);
  $('lvl-h').textContent = lvlPin === null ? '–' : `${lvlPin - G.sea > 0 ? '+' : ''}${lvlPin - G.sea}`;
}
$('lvl-auto').addEventListener('click', () => { lvlPin = null; lvlPicking = false; renderLvl(); sfx.click(); toast('🏘️ Auto: Level flattens toward your nearest town.'); });
$('lvl-up').addEventListener('click', () => { lvlPin = Math.min(G.sea + 9, (lvlPin ?? G.sea + 1) + 1); lvlPicking = false; renderLvl(); sfx.click(); });
$('lvl-down').addEventListener('click', () => { lvlPin = Math.max(G.sea + 1, (lvlPin ?? G.sea + 2) - 1); lvlPicking = false; renderLvl(); sfx.click(); });
$('lvl-pick').addEventListener('click', () => { lvlPicking = !lvlPicking; renderLvl(); sfx.click(); if (lvlPicking) toast('💧 Tap a hex to copy its height.'); });
function levelTarget(v) {
  if (lvlPin !== null) return Math.max(lvlPin, G.sea + 1);
  for (const [x] of bfs(v, 4)) if (owner[x] >= 0 && G.settlements[owner[x]].tribe === 0) return h[G.settlements[owner[x]].v];
  if (press && press.base !== undefined) return press.base;
  return h[v];
}
const combo = { n: 0, t: -9 };
let surging = false;
// god powers that break land: towns lose the hexes that no longer match, buildings in the way fall
const WRATH = { bolt: { ship: 10 }, quake: { ship: 20 }, swamp: { ship: 0 }, volcano: { ship: 30 }, plague: { ship: 0 }, strike: { ship: 40 }, orbital: { ship: 60 } };
function wrath(id, v, tribe) {
  const foe = 1 - tribe, P = PW[id], area = P.r ? bfs(v, P.r) : [[v, 0]];
  const townAt = (x) => (owner[x] >= 0 ? G.settlements[owner[x]] : null);
  const target = townAt(v);
  if ((id === 'bolt' || id === 'plague' || id === 'orbital') && !(target && target.tribe === foe) && !G.wonders.some((w) => w.v === v && w.tribe === foe && w.build > 0)) { if (!tribe) { toast('Tap a Crimson town (or their Starship)'); sfx.deny(); } return false; }
  if (id === 'bolt') {
    if (target) { target.pop *= 0.67; for (const x of [target.v, ...target.tiles.slice(0, 2)]) burn[x] = 6; }
    for (let i = 0; i < 3; i++) emit(posOf(v, 1.2 - i * 0.4), 0xdfe8ff, 20, 0.3, 0.2, 0.3, 2);
    emit(posOf(v, 0.1), 0xffe27a, 30, 0.6, 0.5, 0.8, 0.2); quakeT = Math.max(quakeT, 0.3); sfx.boom(); terrainDirty = true;
  } else if (id === 'quake') {
    for (const [x, d] of area) {
      if (!isLand(x) || tileKind[x] === 4) continue;
      const c = cellColor(x).clone(), dh = (hash(x * 7 + (G.elapsed | 0)) % 3) - 1 || (d % 2 ? 1 : -1);
      setHeight(x, Math.max(G.sea + (h[x] > G.sea ? 1 : 0), h[x] + dh)); shatterCell(x, dh > 0, 0.8, c);
    }
    wreck(area, tribe); cam.shake = 0.6; quakeT = Math.max(quakeT, 1.2); sfx.rumble();
  } else if (id === 'swamp') {
    let n = 0;
    for (const [x] of area) if (isLand(x) && tileKind[x] !== 4 && tileKind[x] !== 5 && tileKind[x] !== 1) { swamp[x] = 90; tree[x] = 0; n++; }
    if (!n) return false;
    terrainDirty = true; layoutTrees(); for (const [x] of area) emit(posOf(x, 0.05), 0x5a7a2a, 8, 0.3, 0.2, 1, 0.1);
  } else if (id === 'volcano') {
    for (const [x, d] of area) { const c = cellColor(x).clone(); setHeight(x, Math.max(h[x], G.sea + 1) + (3 - d) + (d === 0 ? 1 : 0)); tree[x] = 0; burn[x] = 8 - d * 2; shatterCell(x, true, 1, c); }
    wreck(area, tribe);
    for (let i = 0; i < 70; i++) emit(posOf(v, 0.4), i % 3 ? 0xff6a2a : 0x4a4040, 1, 0.9, 0.9, 1.6, -0.4);
    cam.shake = 0.8; quakeT = Math.max(quakeT, 1.5); sfx.boom(); layoutTrees();
  } else if (id === 'plague') {
    let n = 0;
    for (const s of G.settlements) if (s.tribe === foe && area.some(([x]) => x === s.v) && s.fx.health < 1) { s.sick = 45; s.pop *= 0.85; n++; emit(posOf(s.v, 0.3), 0x8aff6a, 30, 0.6, 0.4, 1.4, -0.1); }
    if (!n) { if (!tribe) toast('Their hospitals keep the plague out'); return false; }
    sfx.alarm();
  } else if (id === 'strike') {
    for (const [x, d] of area) { const c = cellColor(x).clone(); setHeight(x, d === 0 ? G.sea - 1 : Math.max(G.sea - (d === 1 ? 0 : -1), h[x] - (3 - d))); tree[x] = 0; burn[x] = 5; shatterCell(x, false, 1, c); }
    wreck(area, tribe);
    for (let i = 0; i < 80; i++) emit(posOf(v, 0.3), i % 2 ? 0xffa040 : 0x6a5a50, 1, 1.2, 1.1, 1.6, -0.3);
    cam.shake = 1; quakeT = Math.max(quakeT, 1.8); sfx.boom();
  } else if (id === 'orbital') {
    if (target) { removeSettlement(target, ''); }
    for (const [x] of area) { burn[x] = 10; tree[x] = 0; }
    for (let i = 0; i < 6; i++) emit(posOf(v, 2 - i * 0.35), 0xffffff, 30, 0.2, 0.15, 0.6, 0);
    emit(posOf(v, 0.1), 0xffe27a, 90, 1.2, 1, 1.2, -0.2);
    wreck(area, tribe); cam.shake = 0.9; quakeT = Math.max(quakeT, 1.4); sfx.boom();
  }
  // a Starship in the blast is damaged
  const dmg = WRATH[id].ship;
  if (dmg) for (const w of G.wonders.slice()) if (w.build > 0 && w.tribe === foe && area.some(([x]) => x === w.v || NBR[x].includes(w.v))) damageShip(w, dmg);
  const names = { bolt: '⚡ LIGHTNING!', quake: '💥 QUAKE!', swamp: '🐸 SWAMP!', volcano: '🌋 ERUPTION!', plague: '☠️ PESTILENCE!', strike: '☄️ IMPACT!', orbital: '🔆 SUN LANCE!' };
  floatText(v, names[id], tribe ? 'red' : 'gold');
  terrainDirty = true; setDirty = true;
  return true;
}
function damageShip(w, dmg) {
  if (w.shield > 0 && dmg < 999) { floatText(w.v, '🛡️ Shield holds!', w.tribe ? 'red' : 'gold'); emit(posOf(w.v, 0.5), 0x9fd8ff, 40, 0.8, 0.6, 0.8, 0); return; }
  w.hp = (w.hp ?? 100) - dmg;
  floatText(w.v, `🚀 -${dmg} hull`, w.tribe ? 'gold' : 'red');
  if (w.hp > 0) return;
  G.wonders.splice(G.wonders.indexOf(w), 1);
  emit(posOf(w.v, 0.4), 0xff8a3a, 90, 1.2, 1.2, 1.5, -0.2); sfx.boom(); cam.shake = 1;
  if (w.tribe) { toast('💥 The Crimson Starship is destroyed! They must start again.', w.v); G.rival.mana = 0; celebrate(60); }
  else toast('💥 Your Starship was destroyed! Build it again from the 🚀 goal.', w.v);
  assignTiles(); layoutWonders(); setDirty = true;
}
function wreck(area, tribe = 0) {
  const cells = new Set(area.map(([x]) => x));
  for (const b of G.buildings.slice()) if (cells.has(b.v)) { G.buildings.splice(G.buildings.indexOf(b), 1); emit(posOf(b.v, 0.1), 0x9a8a7a, 20, 0.6, 0.5, 1); }
  for (const s of G.settlements) if (cells.has(s.v)) { s.pop *= 0.5; floatText(s.v, s.tribe ? `💀 ${s.name} in ruins` : `💀 ${s.name} hit`, s.tribe ? 'gold' : 'red'); }
  assignTiles(); computeFx(); layoutBuildings(); crushAt(cells);
  terrainDirty = true; setDirty = true;
}
function applyPower(id, v) {
  const p = PW[id];
  if (G.era < p.era) { toast(`${p.name} arrives in the ${ERAS[p.era].name}`); sfx.deny(); return false; }
  if (G.mana < p.cost) { toast('Not enough inspiration ✦'); sfx.deny(); return false; }
  if (SHAPERS.has(id) && (tileKind[v] === 4 || tileKind[v] === 5)) { toast('A building stands here'); sfx.deny(); return false; }
  if (SHAPERS.has(id) && lock[v] && id !== 'terraform' && id !== 'quake' && id !== 'volcano') { toast('🔴 Crimson land: their god will not let you shape it.'); floatText(v, '🔒', 'red'); sfx.deny(); return false; }
  let ok = true;
  const area = p.r ? bfs(v, p.r) : [[v, 0]];
  const R = G.rival, theirs = (x) => owner[x] >= 0 && G.settlements[owner[x]].tribe === 1;
  if (id === 'war') {
    const t = theirs(v) ? G.settlements[owner[v]] : null;
    if (!t) { toast('Tap a Crimson town to send your knight against it'); sfx.deny(); return false; }
    if (R.status !== 'war') declareWar(false);
    // the best town to send from: big, and not too far away
    const score = (x) => x.pop / (1 + DIRS[x.v].distanceTo(DIRS[t.v]) * 3);
    const froms = G.settlements.filter((x) => !x.tribe && x.pop >= 8).sort((a, b) => score(b) - score(a));
    const band = froms.length ? Math.max(4, froms[0].pop * 0.5) : 0;
    const att = band * TECH[G.era] * 1.5, def = t.pop * TECH[eraOf(t)] * 0.85 * (t.fx.defend ? 1.6 : 1);
    if (!froms.length || !sendBand(froms[0], t, 0, 0.5)) { toast('None of your towns is big enough to send a knight'); sfx.deny(); return false; }
    G.walkers[G.walkers.length - 1].knight = true;
    const odds = att / (att + def);
    toast(`🛡️ A knight leads ${fmt(band)} warriors out. ${odds > 0.6 ? '💪 They should win.' : odds > 0.45 ? '⚖️ It will be close.' : '⚠️ They are outmatched: send more, or wait for better weapons.'}`, froms[0].v);
  }
  if ((id === 'bless' || id === 'inspire' || id === 'rain') && area.some(([x]) => theirs(x) && tileKind[x] === 1)) {
    R.rel = Math.min(100, R.rel + (id === 'rain' ? 2 : 8));
    tip('kind', '💛 The Crimson are grateful for your help.', true);
  }
  if (id === 'level') {
    const own = owner[v] >= 0 && G.settlements[owner[v]].tribe === 0 ? G.settlements[owner[v]] : null;
    let n = 0;
    const stepTo = (x, target) => { for (let k = 0; k < 10; k++) { if (lock[x] || tileKind[x] === 4 || tileKind[x] === 5 || h[x] === target || G.mana < p.cost * (n + 1)) return; if (shapeWith(h[x] < target ? raiseV : lowerV, x)) n++; else return; } };
    if (lvlPicking) { lvlPin = Math.max(G.sea + 1, h[v]); lvlPicking = false; renderLvl(); floatText(v, `💧 Height ${lvlPin - G.sea > 0 ? '+' : ''}${lvlPin - G.sea}`, 'blue'); sfx.click(); return false; }
    if (own && v === own.v) {
      // tapping your town's centre levels every marked hex around it by one step
      const ring = new Set();
      for (const c of [own.v, ...own.tiles]) for (const x of NBR[c]) if (!tileKind[x] && owner[x] < 0 && h[x] !== h[own.v]) ring.add(x);
      for (const x of ring) stepTo(x, h[own.v]);
      if (n) floatText(v, `🪄 ${n} hexes`, 'gold'); else toast(`${own.name} has no uneven ground around it.`);
    } else {
      // a 7-hex brush: the hex and its neighbours step toward the nearest town's height
      const target = levelTarget(v);
      for (const x of [v, ...NBR[v]]) if (!(owner[x] >= 0)) stepTo(x, target);
    }
    if (!n) return false;
    G.mana -= p.cost * (n - 1);
  } else if (WRATH[id]) {
    ok = wrath(id, v, 0);
  } else if (id === 'beacon') {
    if (!isLand(v)) { toast('Place the beacon on dry land'); sfx.deny(); return false; }
    G.beacon = v; layoutBeacon();
    toast('🚩 Beacon planted. Your next settlers will head here.', v);
  } else if (id === 'raise') ok = shapeWith(raiseV, v);
  else if (id === 'lower') ok = shapeWith(lowerV, v);
  else if (id === 'rain') {
    for (const [x] of area) { rain[x] = 45; burn[x] = 0; }
    for (let i = 0; i < 40; i++) { const [x] = area[(rnd() * area.length) | 0]; const q = posOf(x, 0.9); parts.push({ p: q, v: DIRS[x].clone().multiplyScalar(-2.2), c: new THREE.Color(0x9fd4ff), life: 0.45, max: 0.45, g: 0 }); }
    terrainDirty = true;
  } else if (id === 'forest') {
    let n = 0;
    for (const [x] of area) if (isLand(x) && !crowd[x] && h[x] - G.sea < 5) { tree[x] = 1; n++; }
    ok = n > 0;
    if (ok) { G.health = Math.min(100, G.health + 2); layoutTrees(); }
  } else if (id === 'inspire') {
    let n = 0;
    for (const s of G.settlements) if (area.some(([x]) => x === s.v)) { s.inspire = 40; n++; emit(posOf(s.v, 0.2), 0xffe27a, 24, 0.6, 0.4, 1.4, -0.2); }
    ok = n > 0;
    if (!ok) toast('No settlement there to inspire');
  } else if (id === 'bless') {
    for (const [x] of area) burn[x] = 0;
    for (const s of G.settlements) if (area.some(([x]) => x === s.v)) { s.unrest = s.riot ? 0 : -90; s.sick = 0; s.pop = Math.min(capOf(s), s.pop * 1.1 + 2); emit(posOf(s.v, 0.2), 0xffffff, 20, 0.6, 0.4, 1.2, -0.2); }
    for (const st of storms) if (st.dir.distanceTo(DIRS[v]) < 0.4) st.life = 0;
    terrainDirty = true;
  } else if (id === 'cleanse') {
    G.health = Math.min(100, G.health + 14);
    for (let i = 0; i < 60; i++) emit(DIRS[(rnd() * NV) | 0].clone().multiplyScalar(R + 0.8), 0x9fffc8, 1, 0.3, 0.2, 1.2, 0);
    terrainDirty = true;
  } else if (id === 'terraform') {
    const target = Math.max(h[v], G.sea + 1);
    for (const [x] of area) if (!lock[x] && tileKind[x] !== 4 && tileKind[x] !== 5 && h[x] !== target) { const c = cellColor(x).clone(), up = h[x] < target; setHeight(x, target); shatterCell(x, up, 0.7, c); }
    cam.shake = 0.3; quakeT = Math.max(quakeT, 0.25);
  } else if (id === 'deflect' && !meteor) {
    // no meteor: shield your Starship instead
    const sh = G.wonders.find((w) => !w.tribe && w.build > 0);
    if (!sh) { toast('No meteor in the sky, and no Starship to shield'); return false; }
    sh.shield = 40; toast('🛡️ Your Starship is shielded for 40 seconds.', sh.v); emit(posOf(sh.v, 0.5), 0x9fd8ff, 60, 1, 0.8, 1.2, 0);
  } else if (id === 'deflect') {
    emit(meteor.pos, 0xffc060, 80, 1.2, 1.2, 1.4, 0); emit(meteor.pos, 0xffffff, 30, 2, 1.5, 0.6, 0);
    scene.remove(meteor.mesh, meteor.ring); meteor = null;
    toast('Meteor destroyed! 🎉'); sfx.boom();
  }
  if (!ok) { if (id === 'raise' || id === 'lower') sfx.deny(); return false; }
  G.mana -= p.cost;
  if (SHAPERS.has(id)) { G.qc.shape++; if (G.qc.shape === 4) tip('brush', '🖌️ Tip: hold your finger still for a moment, then drag to shape many hexes at once.', true); }
  if (id === 'beacon') G.qc.beacon++;
  if (id === 'raise' || id === 'level') sfx.raise(Math.min(combo.n, 12)); else if (id === 'lower') sfx.lower(Math.min(combo.n, 12)); else sfx.power();
  if (SHAPERS.has(id)) {
    // combo: quick strokes chain together and the sound climbs
    combo.n = t - combo.t < 0.8 ? combo.n + 1 : 1; combo.t = t;
    if (boon('shapers') && G.qc.shape % 10 === 0) { addMana(10 * boon('shapers')); floatText(v, `🪄 +${10 * boon('shapers')}✦`, 'gold'); }
    if (combo.n >= 4 && combo.n % 4 === 0) floatText(v, `🪄 x${combo.n}`, 'gold');
    if (combo.n === 8 && G.surge <= 0) { G.surge = 6; floatText(v, '⚡ EARTH SURGE!', 'gold'); toast('⚡ Earth Surge: for 6 seconds every stroke shapes a whole area.'); sfx.fanfare(); }
    if (G.surge > 0 && !surging && (id === 'level' || id === 'raise' || id === 'lower')) { surging = true; for (const n of NBR[v]) if (!lock[n] && tileKind[n] !== 4 && tileKind[n] !== 5) { if (id === 'level') { const tg = levelTarget(n); if (h[n] !== tg) shapeWith(h[n] < tg ? raiseV : lowerV, n); } else shapeWith(id === 'raise' ? raiseV : lowerV, n); } surging = false; }
    quakeT = Math.max(quakeT, 0.08);
  }
  return true;
}

function townInfo(s) {
  const fx = s.fx, bits = [];
  if (fx.food) bits.push(`🌾+${Math.round(fx.food * 100)}%`);
  if (fx.know) bits.push(`📜+${Math.round(fx.know * 100)}%`);
  if (fx.health) bits.push('🛡️ plague');
  if (fx.defend) bits.push('🏰');
  toast(`🏘️ ${s.name}: ${sizeOf(s)}/${maxTiles(s) + 1} hexes · ${fmt(s.pop)}/${fmt(capOf(s))} people${bits.length ? ' · ' + bits.join(' ') : ''}`, s.v);
}
const canBuildAt = (v, tribe = 0) => isLand(v) && (tileKind[v] === 0 || tileKind[v] === 2 || tileKind[v] === 3 || tileKind[v] === 6) && bfs(v, 2).some(([x]) => owner[x] >= 0 && G.settlements[owner[x]].tribe === tribe);
function placeBuilding(id, v) {
  const b = BD[id];
  if (tileKind[v] === 1) { const t = G.settlements[owner[v]]; if (t.tribe) { toast(`🔴 ${t.name} (Crimson): ${sizeOf(t)} hexes, ${fmt(t.pop)} people.`, t.v); return false; } townInfo(t); return false; }
  if (G.era < b.era) { toast(`${b.name} arrives in the ${ERAS[b.era].name}`); sfx.deny(); return false; }
  if (!canBuildAt(v)) { toast('Build on dry land within 2 hexes of a town'); sfx.deny(); return false; }
  if (G.mana < bCost(b)) { toast('Not enough inspiration ✦'); sfx.deny(); return false; }
  G.mana -= bCost(b);
  G.buildings.push({ id, v, tribe: 0, t0: t });
  tree[v] = 0;
  assignTiles(); computeFx(); layoutBuildings(); renderDiplo(); layoutGuides();
  emit(posOf(v, 0.15), 0xffe27a, 30, 0.6, 0.4, 1.2, -0.2);
  sfx.found();
  toast(`${b.icon} ${b.name} built. ${b.desc}`);
  floatText(v, `${b.icon} -${bCost(b)}✦`, 'gold');
  return true;
}

// ------------------------------------------------------------------ disasters
const storms = [], volcanoes = [];
let meteor = null, disasterT = 45, quakeT = 0;
function nextDisaster() {
  const e = G.era, pool = [];
  const yours = G.settlements.filter((t) => !t.tribe);
  if (yours.length < 2) return;
  if (e <= 3 && treeCount() > 10) pool.push('fire');
  if (e >= 1 && e <= 5) pool.push('plague');
  if (e >= 2) pool.push('quake');
  if (e >= 5) pool.push('storm', 'meteor');
  if (e >= 2) pool.push('volcano');
  if (!pool.length) return;
  const kind = pool[(rnd() * pool.length) | 0];
  G.stats.disasters++;
  const s = yours[(rnd() * yours.length) | 0];
  if (kind === 'fire') {
    const near = bfs(s.v, 7).map(([x]) => x).filter((x) => tree[x]);
    if (!near.length) return;
    const v = near[(rnd() * near.length) | 0];
    burn[v] = 6; terrainDirty = true;
    alarm('🔥 Wildfire! Rain can put it out.', v);
  } else if (kind === 'plague') {
    if (s.fx.health >= 1) { toast(`🛡️ A plague was stopped by your ${G.era >= 5 ? 'hospital' : 'temple'}.`, s.v); return; }
    s.sick = G.era >= 2 ? 40 : 18;
    alarm(G.era >= 2 ? '☠️ Plague! Bless the town to heal it.' : '☠️ A sickness spreads…', s.v);
  } else if (kind === 'quake') {
    quakeT = 2;
    for (let i = 0; i < 26; i++) { const area = bfs(s.v, 3); const [x] = area[(rnd() * area.length) | 0]; if (rnd() < 0.5) raiseV(x); else lowerV(x); }
    alarm('🌋 Earthquake! Level the land again.', s.v);
    sfx.rumble();
  } else if (kind === 'storm') {
    const axis = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize().cross(DIRS[s.v]).normalize();
    const start = DIRS[s.v].clone().applyAxisAngle(axis, -0.9);
    const mesh = new THREE.Group();
    for (let i = 0; i < 9; i++) { const c = new THREE.Mesh(cloudMesh.geometry, new THREE.MeshStandardMaterial({ color: 0x8a8f9a, flatShading: true, transparent: true, opacity: 0.9 })); const a = (i / 9) * Math.PI * 2; c.position.set(Math.cos(a) * 0.35, 0, Math.sin(a) * 0.35); c.scale.setScalar(0.7); mesh.add(c); }
    scene.add(mesh);
    storms.push({ dir: start, axis, life: 24, mesh });
    alarm('🌀 Hurricane! Bless it to calm the winds.', s.v);
  } else if (kind === 'volcano') {
    const peaks = bfs(s.v, 6).filter(([x, d]) => d >= 3 && isLand(x) && !tileKind[x] && owner[x] < 0).map(([x]) => x).sort((a, b) => h[b] - h[a]);
    const v = peaks[0];
    if (v === undefined) return;
    for (let i = 0; i < 3; i++) shapeWith(raiseV, v);
    volcanoes.push({ v, life: 26 });
    for (const [x, d] of bfs(v, 2)) if (d > 0 && isLand(x) && rnd() < 0.6) { burn[x] = 8; tree[x] = 0; }
    terrainDirty = true; quakeT = 1.5;
    alarm('🌋 A volcano erupts! Lava pours down the slopes. Rain cools it.', v);
    sfx.rumble();
  } else if (kind === 'meteor') {
    if (meteor) return;
    const target = s.v;
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), new THREE.MeshStandardMaterial({ color: 0x5a4a3a, emissive: 0xff6a2a, emissiveIntensity: 0.6, flatShading: true }));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.03, 6, 32), new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, depthTest: false }));
    ring.renderOrder = 6;
    scene.add(mesh, ring);
    const from = DIRS[target].clone().add(new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(1.2)).normalize().multiplyScalar(R * 4);
    meteor = { target, from, t: 0, dur: 24, mesh, ring, pos: from.clone() };
    alarm('☄️ Meteor incoming! Use Deflect before it hits.', target);
  }
}
const treeCount = () => { let n = 0; for (let v = 0; v < NV; v++) n += tree[v]; return n; };
function alarm(msg, v) { toast(msg, v); sfx.alarm(); }
function updateDisasters(dt) {
  disasterT -= dt;
  if (disasterT <= 0) { disasterT = (Math.max(28, 70 - G.era * 6) + rnd() * 30) * DF().disaster; if (G.elapsed > 60) nextDisaster(); }
  for (let i = volcanoes.length - 1; i >= 0; i--) {
    const vo = volcanoes[i];
    vo.life -= dt;
    const top = posOf(vo.v, 0.05);
    if (rnd() < dt * 18) emit(top, rnd() < 0.7 ? 0xff5a1a : 0xffc040, 1, 1.1, 0.35, 1.4, 1.1);
    if (rnd() < dt * 5) emit(top, 0x3a3434, 1, 0.5, 0.15, 2.5, -0.1);
    if (rnd() < dt * 0.6) { const ring = bfs(vo.v, 2).filter(([x, d]) => d > 0 && isLand(x)); const [x] = ring[(rnd() * ring.length) | 0] || [vo.v]; burn[x] = 6; tree[x] = 0; terrainDirty = true; }
    if (rain[vo.v] > 0) vo.life = Math.min(vo.life, 2);
    if (vo.life <= 0) volcanoes.splice(i, 1);
  }
  // fire spreads through forests
  let burning = false;
  for (let v = 0; v < NV; v++) {
    if (burn[v] <= 0) continue;
    burning = true;
    burn[v] -= dt;
    if (rnd() < dt * 6) emit(posOf(v, 0.05), rnd() < 0.6 ? 0xff7a2a : 0x6a6a6a, 1, 0.5, 0.15, 1, -0.3);
    if (rnd() < dt * 0.9) for (const n of NBR[v]) if (tree[n] && burn[n] <= 0 && rnd() < 0.5) { burn[n] = 6; terrainDirty = true; }
    for (const s of G.settlements) if (s.v === v || NBR[s.v].includes(v)) s.pop -= dt * (s.fx.defend ? 1 : 2);
    if (burn[v] <= 0) { burn[v] = 0; tree[v] = 0; terrainDirty = true; }
  }
  if (burning && rnd() < dt) layoutTrees();
  // plague
  for (const s of G.settlements) {
    if (s.sick <= 0) continue;
    s.sick -= dt;
    s.pop -= s.pop * dt * 0.03;
    if (rnd() < dt * 0.4) emit(posOf(s.v, 0.15), 0x8aff6a, 2, 0.2, 0.2, 1.2, -0.1);
    if (rnd() < dt * 0.08) { const o = G.settlements.find((x) => x !== s && x.sick <= 0 && DIRS[x.v].distanceTo(DIRS[s.v]) < 0.5); if (o && o.fx.health < 1 && !(rel('chalice') && !o.tribe)) o.sick = s.sick + 5; }
  }
  // storms sweep across the surface
  for (let i = storms.length - 1; i >= 0; i--) {
    const st = storms[i];
    st.life -= dt;
    st.dir.applyAxisAngle(st.axis, dt * 0.07).normalize();
    qa.setFromUnitVectors(UP, st.dir);
    st.mesh.quaternion.copy(qa);
    st.mesh.position.copy(st.dir).multiplyScalar(R + 0.75);
    st.mesh.rotateY(t * 3);
    for (const s of G.settlements) if (DIRS[s.v].distanceTo(st.dir) < 0.13) { s.pop -= s.pop * dt * (s.fx.defend ? 0.05 : 0.1); if (rnd() < dt * 2) emit(posOf(s.v, 0.3), 0xdfe9ff, 2, 0.4, 0.4, 0.5); }
    if (rnd() < dt * 1.5) { const fl = new THREE.PointLight(0xcfe0ff, 30, 3); fl.position.copy(st.mesh.position); scene.add(fl); setTimeout(() => scene.remove(fl), 90); }
    if (st.life <= 0) { scene.remove(st.mesh); storms.splice(i, 1); }
  }
  // meteor
  if (meteor) {
    meteor.t += dt;
    const k = meteor.t / meteor.dur, target = DIRS[meteor.target].clone().multiplyScalar(radiusOf(meteor.target));
    meteor.pos.copy(meteor.from).lerp(target, k * k);
    meteor.mesh.position.copy(meteor.pos);
    meteor.mesh.rotation.x += dt * 2;
    if (rnd() < dt * 30) emit(meteor.pos, 0xff8a3a, 1, 0, 0.1, 0.8, 0);
    qa.setFromUnitVectors(new THREE.Vector3(0, 0, 1), DIRS[meteor.target]);
    meteor.ring.quaternion.copy(qa);
    meteor.ring.position.copy(DIRS[meteor.target]).multiplyScalar(radiusOf(meteor.target) + 0.05);
    meteor.ring.material.opacity = 0.5 + 0.5 * Math.sin(t * 8);
    $('meteor').hidden = false;
    $('meteor').textContent = `☄️ Impact in ${Math.ceil(meteor.dur - meteor.t)}s`;
    if (meteor.t >= meteor.dur) impact();
  } else $('meteor').hidden = true;
}
function impact() {
  const v = meteor.target;
  scene.remove(meteor.mesh, meteor.ring);
  meteor = null;
  for (const [x, d] of bfs(v, 3)) { for (let i = 0; i < 4 - d; i++) lowerV(x); burn[x] = d < 2 ? 3 : 0; tree[x] = 0; }
  for (const s of G.settlements.slice()) if (DIRS[s.v].distanceTo(DIRS[v]) < 0.22) removeSettlement(s);
  G.buildings = G.buildings.filter((b) => DIRS[b.v].distanceTo(DIRS[v]) >= 0.18);
  setDirty = true; layoutBuildings();
  emit(posOf(v, 0.1), 0xffa040, 120, 2, 1, 1.6, 1.2); emit(posOf(v, 0.1), 0x6a5a4a, 80, 1.2, 1, 2, 0.6);
  quakeT = 3;
  G.health = Math.max(0, G.health - 10);
  toast('☄️ The meteor struck!', v);
  sfx.boom();
}

// ------------------------------------------------------------------ simulation
let fxT = 0;
function simulate(dt) {
  G.elapsed += dt;
  let poll = 0;
  const T = [{ pop: 0, know: 0, n: 0 }, { pop: 0, know: 0, n: 0 }];
  for (const s of G.settlements) T[s.tribe].n++;
  for (const w of G.walkers) if (w.war === -1) T[w.tribe].n++;
  for (const s of G.settlements.slice()) {
    if (!isLand(s.v)) {
      const dry = bfs(s.v, 4).find(([x]) => isLand(x));
      if (dry && s.pop > 4) spawnWalker(dry[0], s.pop * 0.5, s.tribe);
      removeSettlement(s, s.tribe ? '' : `🌊 ${s.name} was swallowed by the sea! ${dry && s.pop > 4 ? 'Its survivors flee inland.' : ''}`);
      continue;
    }
    if (s.pop < 0.5) { removeSettlement(s, s.tribe ? '' : 'A settlement has died out.'); continue; }
    s.cool -= dt; s.inspire = Math.max(0, s.inspire - dt);
    const cap = capOf(s);
    // spreading: a crowded town claims the next flat hex
    s.growT -= dt * (1 + s.fx.food);
    if (s.growT <= 0) {
      s.growT = 2.5;
      s.fert = fertility(s.v);
      if (s.pop >= cap * 0.8 && s.tiles.length < maxTiles(s)) {
        const x = frontier(s);
        if (x !== null) {
          s.tiles.push(x); s.stuck = 0; born.set(x, t);
          const lv = s.level;
          assignTiles();
          if (!s.tribe) floatText(x, '+1 🏘️', 'green');
          if (s.level > lv) { s.grow = 0; if (!s.tribe) { sfx.grow(); const pay = Math.round(s.level * 6 * (1 + G.era * 0.3)); addMana(pay); floatText(s.v, `⭐ ${s.name} level ${s.level}! +${pay}✦`, 'gold'); fireworks(s.v, s.level); if (s.level >= 5 && !(s.mega)) { s.mega = true; toast(`🌆 ${s.name} became a METROPOLIS!`, s.v); celebrate(40); } } emit(posOf(s.v, 0.2), 0xfff3c4, 20, 0.5, 0.4, 1, -0.1); }
          emit(posOf(x, 0.05), 0xfff3c4, 6, 0.3, 0.2, 0.8, -0.1);
        } else s.stuck++;
      }
    }
    if (s.sick <= 0) s.pop = Math.min(cap, s.pop + (s.pop * 0.045 * s.fert * (1 + s.fx.food) + 0.25) * dt);
    // when it cannot spread any more, some people leave to found a colony
    if (s.pop >= cap * 0.98 && s.cool <= 0 && (s.tiles.length >= maxTiles(s) || s.stuck >= 2) && G.walkers.length < 30 && (T[s.tribe].n < maxTowns(eraOfTribe(s.tribe)) || (!s.tribe && G.behave && G.behave !== 'settle'))) {
      s.cool = 25;
      spawnWalker(s.v, s.pop * 0.3, s.tribe);
      s.pop *= 0.7;
      T[s.tribe].n++;
    }
    const tt = T[s.tribe];
    tt.pop += s.pop;
    tt.know += s.riot ? 0 : s.pop * (s.inspire > 0 ? 3 : 1) * (0.7 + s.level * 0.15) * (1 + s.fx.know);
    if (s.inspire > 0 && rnd() < dt * 3) emit(posOf(s.v, 0.15), 0xffe27a, 1, 0.4, 0.2, 1, -0.1);
  }
  for (const w of G.walkers) if (w.war === -1) T[w.tribe].pop += w.pop;
  const pop = T[0].pop, R = G.rival, ally = false;
  const kn = (tt, era) => (tt.pop > 0 ? (tt.know / tt.pop) * Math.sqrt(tt.pop) * 0.07 * (1 + era * 0.35) : 0);
  // knowledge grows with the square root of the people: a bigger world helps, but not linearly
  fxT -= dt;
  if (fxT <= 0) { fxT = 1; computeFx(); }
  // allies share what they learn and trade
  G.know += kn(T[0], G.era) * (1 + worldFx[0].global + (perk(0) ? 0.15 : 0) + (perk(5) ? 0.25 : 0) + (rel('scroll') ? 0.2 : 0) + boon('scholars') * 0.15 + (legacy.has('wisdom') ? 0.1 : 0) + (G.golden > 0 ? 0.5 : 0)) * (ally ? 1.15 : 1) * dt;
  addMana((0.8 + Math.pow(pop, 0.35) * 0.35 + worldFx[0].mana + (ally ? 0.5 : 0) + (perk(2) ? 1 : 0) + (rel('idol') ? 1 : 0) + boon('devotion')) * (G.golden > 0 ? 1.5 : 1) * dt);
  if (R.alive) {
    R.know += kn(T[1], R.era) * (1 + worldFx[1].global) * (ally ? 1.15 : 1) * DF().rival * (1 + 0.6 * Math.max(0, G.era - R.era)) * dt;
    R.mana = Math.min(manaCap(G.rival.era), R.mana + (0.8 + Math.pow(T[1].pop, 0.35) * 0.35 + worldFx[1].mana) * dt);
  }
  // buildings on flooded hexes are lost
  for (const b of G.buildings.slice()) if (!isLand(b.v)) { G.buildings.splice(G.buildings.indexOf(b), 1); toast(`🌊 The ${BD[b.id].name} was lost to the sea!`, b.v); setDirty = true; layoutBuildings(); }
  G.stats.peak = Math.max(G.stats.peak, pop);
  // the planet's health: pollution against forests and time
  poll = Math.pow(pop, 0.4) * POLLUTE[G.era] + Math.pow(T[1].pop, 0.4) * POLLUTE[R.era] * 0.5;
  const before = G.health;
  G.health = clamp(G.health + (0.1 + treeCount() * 0.0012 + worldFx[0].clean + worldFx[1].clean + (rel('chalice') ? 0.06 : 0) + boon('gaia') * 0.08 - poll - Math.sqrt(worldFx[0].poll * 0.06) - Math.sqrt(worldFx[1].poll * 0.03)) * dt, 0, 100);
  // the seas rise at 70/45/25% health but only retreat 6% above that, and they warn first
  const lvDown = SEA0 + (G.health < 70) + (G.health < 45) + (G.health < 25), lvUp = SEA0 + (G.health < 76) + (G.health < 51) + (G.health < 31);
  const seaTarget = lvDown > G.sea ? lvDown : lvUp < G.sea ? lvUp : G.sea;
  if (SEA0 + (G.health < 75) + (G.health < 50) + (G.health < 30) > G.sea && G.health < before && G.elapsed - (G.seaWarn ?? -99) > 25) { G.seaWarn = G.elapsed; toast('🌊 The ice is cracking: the seas will rise soon! 🌿 Cleanse the skies and plant forests.'); }
  if (seaTarget !== G.sea) {
    const rising = seaTarget > G.sea;
    G.sea = seaTarget;
    terrainDirty = true;
    toast(rising ? '🌊 The ice caps are melting: the seas are rising! Raise your coasts.' : '🌊 The seas are retreating.');
    if (rising) sfx.rumble();
  }
  if (Math.floor(before / 10) !== Math.floor(G.health / 10) && G.health < before && G.health < 80) tip(`h${Math.floor(G.health / 10)}`, `🌍 Planet health ${Math.round(G.health)}%: plant forests and cleanse the skies.`, true);
  for (let v = 0; v < NV; v++) { if (rain[v] > 0) { rain[v] -= dt; if (rain[v] <= 0) terrainDirty = true; } if (swamp[v] > 0) { swamp[v] -= dt; if (swamp[v] <= 0) terrainDirty = true; else if (rnd() < dt * 0.3) emit(posOf(v, 0.03), 0x6a8a3a, 1, 0.1, 0.05, 1.2, -0.05); } }
  // the swamp swallows anyone who walks into it
  for (let i = G.walkers.length - 1; i >= 0; i--) { const w = G.walkers[i]; if (swamp[w.from] > 0 || (w.t > 0.5 && swamp[w.to] > 0)) { G.walkers.splice(i, 1); emit(posOf(w.from, 0.05), 0x5a7a2a, 16, 0.4, 0.3, 0.9, 0.3); floatText(w.from, w.tribe ? `🐸 ${fmt(w.pop)} Crimson sank!` : `🐸 ${fmt(w.pop)} of yours sank`, w.tribe ? 'gold' : 'red'); if (!w.tribe) G.stats.lost++; } }
  for (const r of raiders) if (swamp[r.from] > 0) r.pop = 0;
  updateWalkers(dt);
  updateDisasters(dt);
  updateRival(dt);
  maybeEvent(dt);
  updateRaiders(dt);
  updateOmen(dt);
  updateMood(dt);
  if (G.surge > 0) G.surge -= dt;
  if (G.elapsed > 25) tip('rival', '🔴 Another tribe lives across the sea: the Crimson. Tap 🕊️ to deal with them.', true);
  if (G.elapsed > 35 && G.era === 0) tip('build', '🏗️ Open the Build tab: hunting grounds and shrines help nearby towns.', true);
  if (G.know >= needOf(G.era) && !tips[`ready${G.era}`]) tip(`ready${G.era}`, `💡 Your people are ready to build the ${WONDERS[G.era]}! Tap the goal above.`, true);
  if (G.started && G.elapsed > 5 && totalPop(0) < 1) endGame(false, 'Your people are gone.');
  if (G.health <= 0) endGame(false, 'The planet has died.');
}

// ------------------------------------------------------------------ the Crimson: a rival tribe with its own god
const strength = (tribe) => G.settlements.reduce((a, s) => a + (s.tribe === tribe ? s.pop : 0), 0) * TECH[eraOfTribe(tribe)];
function updateRival(dt) {
  const R = G.rival;
  if (!R.alive) return;
  const mine = G.settlements.filter((s) => s.tribe === 1);
  if (!mine.length && !G.walkers.some((w) => w.tribe === 1)) { R.alive = false; toast('🏳️ The Crimson tribe is no more.'); if (G.mode !== 'end') endGame(true, '⚔️ The Crimson god has fallen. Your people inherit the whole world.'); return; }
  // their god levels the edges of their towns
  R.shapeT -= dt;
  if (R.shapeT <= 0 && mine.length) {
    R.shapeT = 0.8;
    const s = mine[(rnd() * mine.length) | 0];
    if (s.tiles.length < maxTiles(s)) {
      const cands = [];
      for (const c of [s.v, ...s.tiles]) for (const x of NBR[c]) if (!tileKind[x] && owner[x] < 0 && h[x] !== h[s.v] && !NBR[x].some((n) => owner[n] >= 0 && G.settlements[owner[n]].tribe === 0)) cands.push(x);
      if (cands.length) { const x = cands[(rnd() * cands.length) | 0]; shapeWith(h[x] > h[s.v] ? lowerV : raiseV, x); }
    }
  }
  // they build too
  R.buildT -= dt;
  if (R.buildT <= 0 && mine.length) {
    R.buildT = 28;
    const av = BUILDINGS.filter((b) => b.era <= R.era && R.mana >= b.cost + 40).sort((a, b) => b.era - a.era).slice(0, 3);
    const b = av[(rnd() * av.length) | 0], best = bestSettlement(1);
    if (b && best) {
      const spot = bfs(best.v, 3).map(([x]) => x).find((x) => tileKind[x] === 0 && canBuildAt(x, 1));
      if (spot !== undefined) { R.mana -= b.cost; G.buildings.push({ id: b.id, v: spot, tribe: 1 }); tree[spot] = 0; assignTiles(); computeFx(); layoutBuildings(); }
    }
  }
  // and race you through the ages
  const best = bestSettlement(1), e = ERAS[R.era];
  if (best && R.know >= needOf(R.era) * 0.9 && R.mana >= e.cost && sizeOf(best) >= REQ[R.era] * (R.era === 6 ? 0.7 : 1) && !launching && G.mode !== 'end' && !G.wonders.some((w) => w.tribe === 1 && w.build > 0)) rivalWonder(best);
  R.dipT -= dt;
  if (R.dipT <= 0) { R.dipT = 1; diplomacyTick(mine); }
  // caravans: peaceful neighbours trade goods, allies trade more
  R.tradeT = (R.tradeT ?? 25) - dt;
  if (R.tradeT <= 0 && mine.length && R.status === 'ally') {
    R.tradeT = R.status === 'ally' ? 18 : 30;
    const ours = G.settlements.filter((t) => !t.tribe && t.pop > 10);
    if (ours.length) {
      const a = ours[(rnd() * ours.length) | 0];
      const b = mine.reduce((x, y) => (DIRS[y.v].distanceTo(DIRS[a.v]) < DIRS[x.v].distanceTo(DIRS[a.v]) ? y : x));
      const path = pathTo(a.v, b.v, true);
      if (path && path.length < 60) { const w = spawnWalker(a.v, 3, 0, -2); w.path = path; w.to = w.path.shift(); w.home = a.v; }
    }
  }
  if (R.status === 'war') {
    R.warT += dt;
    R.attackT -= dt;
    if (R.attackT <= 0) { R.attackT = ((strength(1) > strength(0) * 0.9 ? 45 : 65) + rnd() * 25) * (0.7 + DF().disaster * 0.3); rivalAttack(mine); }
    R.castT = (R.castT ?? 150) - dt;
    if (R.castT <= 0 && G.elapsed > 150) {
      // their god casts the strongest wrath of their age they can afford; a Starship is the first target
      R.castT = (40 + rnd() * 25) * DF().disaster;
      const theirShip = G.wonders.find((w) => w.tribe === 1 && w.build > 0);
      if (theirShip && !(theirShip.shield > 0) && R.mana >= 300 && rnd() < 0.4) { theirShip.shield = 40; R.mana -= 300; toast('🔴 The Crimson shielded their Starship for 40 seconds.', theirShip.v); }
      const myShip = G.wonders.find((w) => !w.tribe && w.build > 0);
      const towns = G.settlements.filter((x) => !x.tribe).sort((a, b) => b.pop - a.pop);
      const opts = POWERS.filter((p) => WRATH[p.id] && p.era <= R.era && R.mana >= p.cost && (!myShip || WRATH[p.id].ship > 0)).sort((a, b) => b.era - a.era);
      const pw = opts[rnd() < 0.7 ? 0 : (rnd() * opts.length) | 0];
      const tv = myShip ? myShip.v : towns[Math.min(towns.length - 1, (rnd() * 3) | 0)]?.v;
      if (pw && tv !== undefined) {
        const at = pw.id === 'swamp' ? (NBR[tv].find((x) => isLand(x) && !tileKind[x]) ?? tv) : pw.id === 'bolt' || pw.id === 'plague' || pw.id === 'orbital' ? (myShip && owner[myShip.v] < 0 ? myShip.v : tv) : tv;
        if (wrath(pw.id, at, 1)) { R.mana -= pw.cost; toast(`🔴 The Crimson god cast ${ICON[pw.id]} ${pw.name}${myShip ? ' on your Starship' : ''}!`, at); sfx.alarm(); }
      }
    }
    R.godT = (R.godT ?? 40) - dt;
    if (R.godT <= 0) {
      R.godT = (70 + rnd() * 40) * DF().disaster;
      const targets = G.settlements.filter((x) => !x.tribe);
      const tg = targets[(rnd() * targets.length) | 0];
      if (tg && rnd() < 0.6 && tg.tiles.length) {
        for (const x of tg.tiles.slice(-3)) shapeWith(lowerV, x);
        toast(`🔴 The Crimson god sank the land of ${tg.name}! Level it again.`, tg.v); sfx.rumble(); quakeT = 1;
      } else if (tg && rnd() < 0.5 && G.era >= 1) {
        // their god shakes your town
        const area = bfs(tg.v, 1).filter(([x]) => x !== tg.v);
        for (const [x] of area) if (isLand(x) && tileKind[x] !== 4) { const c = cellColor(x).clone(); setHeight(x, Math.max(G.sea + 1, h[x] + (rnd() < 0.5 ? 1 : -1))); shatterCell(x, true, 0.6, c); }
        wreck(area.filter(([x]) => tileKind[x] === 5)); quakeT = 1; sfx.rumble();
        toast(`🔴 The Crimson god shook ${tg.name}! Level its land again.`, tg.v);
      } else if (tg && tg.fx.health < 1) { tg.sick = 30; toast(`🔴 The Crimson god cursed ${tg.name} with plague!`, tg.v); sfx.alarm(); }
    }
  }
}
function rivalWonder(s) {
  const R = G.rival;
  R.mana -= ERAS[R.era].cost;
  const spots = bfs(s.v, 3).filter(([x, d]) => d === 3 && isLand(x) && !tileKind[x]).map(([x]) => x);
  const v = spots.length ? spots[0] : (bfs(s.v, 6).find(([x, d]) => d >= 2 && isLand(x) && !tileKind[x] && !G.wonders.some((o) => o.v === x)) || [NBR[s.v][0]])[0];
  const w = { era: R.era, v, tribe: 1 };
  G.wonders.push(w); assignTiles();
  rebuildCrowd(); layoutWonders(); setDirty = true;
  if (R.era === 6) { w.build = SHIP_T(); w.hp = SHIP_HP; w.max = w.build; toast('🔴 The Crimson are building their Starship! Break it with your wrath or capture the town beside it.', v); sfx.alarm(); tip('rship', '🚀 Hit their Starship with ⚡ 💥 🌋 ☄️ 🔆, or take the town next to it.', true); return; }
  toast(`🔴 The Crimson built the ${WONDERS[R.era]} and entered the ${ERAS[R.era + 1].name}!${R.era === G.era ? ' Yours will now cost 30% more.' : ''}`, v);
  R.era++; R.know = 0;
  if (R.era > G.era) tip(`ahead${R.era}`, '⚠️ The Crimson are ahead of you! If their Starship lifts off first, you lose: break it with your wrath.', true);
  setDirty = true; terrainDirty = true;
}
function diplomacyTick() {}
function declareWar(byThem) {
  const R = G.rival;
  R.status = 'war'; R.warT = 0; R.offer = null; R.attackT = byThem ? 20 : 45;
  R.rel = Math.min(R.rel, -60);
  toast(byThem ? '⚔️ The Crimson god declares war! Their warriors will march on your towns. Use 🛡️ Knight, 💥 Quake and ⚔️ Fight mode.' : '⚔️ War with the Crimson!');
  sfx.alarm(); renderDiplo(); if (byThem) $('b-diplo').classList.add('pulse');
}
// a war band leaves the strongest town for the nearest enemy town; it can sail across the sea
function sendBand(from, target, tribe, share = 0.4) {
  const band = Math.max(4, from.pop * share);
  if (from.pop < 8) return false;
  const path = pathTo(from.v, target.v, true);
  if (!path) return false;
  from.pop -= band;
  const w = spawnWalker(from.v, band, tribe, target.v);
  w.path = path; w.to = w.path.shift();
  return true;
}
function rivalAttack(mine) {
  const targets = G.settlements.filter((s) => !s.tribe);
  if (!mine.length || !targets.length) return;
  const from = mine.reduce((a, s) => (s.pop > a.pop ? s : a));
  if (from.pop < 40) return;
  // they strike the weakest of your nearer towns
  const near = targets.slice().sort((a, b) => DIRS[a.v].distanceTo(DIRS[from.v]) - DIRS[b.v].distanceTo(DIRS[from.v])).slice(0, 4);
  const target = near.reduce((a, s) => (s.pop * (s.fx.defend ? 1.6 : 1) < a.pop * (a.fx.defend ? 1.6 : 1) ? s : a));
  if (sendBand(from, target, 1)) toast('⚔️ A Crimson war band is marching on your town!', target.v);
}
function battle(w) {
  const t = owner[w.war] >= 0 ? G.settlements[owner[w.war]] : null;
  const home = () => { const n = nearestSettlement(w.from, w.tribe); if (n) n.pop += w.pop; };
  if (!t || t.tribe === w.tribe) { home(); return; }
  const att = w.pop * TECH[eraOfTribe(w.tribe)] * (w.knight ? 1.5 : 1) * (!w.tribe && rel('spear') ? 1.4 : 1) * (!w.tribe ? 1 + boon('warlords') * 0.3 : 1), def = t.pop * TECH[eraOf(t)] * 0.85 * (t.fx.defend ? 1.6 : 1) * (!t.tribe ? 1 + boon('walls') * 0.4 : 1) * (Object.keys(t.fxN || {}).length ? 1.25 : 1) * (G.settlements.filter((x) => x.tribe === t.tribe).length <= 2 ? 2.5 : 1);
  emit(posOf(t.v, 0.15), 0xff6a3a, 40, 0.8, 0.5, 1, 0.4); emit(posOf(t.v, 0.15), 0xdddddd, 20, 0.5, 0.4, 1.2, 0);
  sfx.boom(); quakeT = Math.max(quakeT, 0.4);
  G.stats.battles = (G.stats.battles || 0) + 1;
  if (att > def) {
    if (!w.tribe) G.stats.captured = (G.stats.captured || 0) + 1;
    t.tribe = w.tribe; t.pop = Math.max(3, w.pop * 0.5, (att - def) / TECH[eraOfTribe(w.tribe)]); t.sick = 0; t.inspire = 0; t.unrest = 0; t.riot = false;
    if (!w.tribe) { const loot = 40 + G.era * 25; addMana(loot); G.know += needOf(G.era) * 0.05; floatText(t.v, `💰 +${loot}✦ +📜`, 'gold'); }
    assignTiles(); computeFx(); terrainDirty = true;
    toast(w.tribe ? '🔥 The Crimson captured one of your towns!' : '🏆 Victory! You captured a Crimson town.', t.v);
    for (const sw of G.wonders.slice()) if (sw.build > 0 && sw.tribe !== w.tribe && bfs(t.v, 3).some(([x]) => x === sw.v)) damageShip(sw, 999);
    // a knight rides on to the next Crimson town with the survivors
    if (w.knight && t.pop > 10) {
      const next = G.settlements.filter((x) => x.tribe !== w.tribe && x !== t).sort((a, b) => DIRS[a.v].distanceTo(DIRS[t.v]) - DIRS[b.v].distanceTo(DIRS[t.v]))[0];
      if (next && DIRS[next.v].distanceTo(DIRS[t.v]) < 0.8 && sendBand(t, next, w.tribe, 0.6)) { G.walkers[G.walkers.length - 1].knight = true; floatText(t.v, '🛡️ The knight rides on!', 'gold'); }
    }
    floatText(t.v, w.tribe ? '🔥 Lost!' : '🏆 Captured!', w.tribe ? 'red' : 'gold');
  } else {
    t.pop = Math.max(1, t.pop - att / (TECH[eraOf(t)] * 0.85));
    toast(w.tribe ? '🛡️ Your town drove off the Crimson attack!' : '💀 Your war band was defeated.', t.v);
    floatText(t.v, w.tribe ? '🛡️ Held!' : '💀 Defeated', w.tribe ? 'green' : 'red');
  }
}
// what your followers do when a town is full: settle new land, gather at the beacon, or march to war
const BEHAVE = { settle: ['🏘️', 'Settle: your people found new towns'], gather: ['🧲', 'Gather: your people march to the 🚩 Beacon and join into one big band'], fight: ['⚔️', 'Fight: your people march on the nearest Crimson town'] };
function renderBehave() { $('b-diplo').textContent = BEHAVE[G.behave || 'settle'][0]; }
$('b-diplo').addEventListener('click', () => {
  const order = ['settle', 'gather', 'fight'];
  G.behave = order[(order.indexOf(G.behave || 'settle') + 1) % 3];
  $('b-diplo').classList.remove('pulse'); renderBehave(); toast(BEHAVE[G.behave][1] + (G.behave === 'gather' && G.beacon < 0 ? ' (plant a 🚩 Beacon first).' : '.')); sfx.click();
  if (G.behave === 'fight') for (const w of G.walkers) if (!w.tribe && w.war === -1) w.think = 0;
});
function renderDiplo() { renderBehave(); }

// ------------------------------------------------------------------ missions
const ownTowns = () => G.settlements.filter((t) => !t.tribe);
const MISSIONS = [
  { text: 'Level 6 hexes with 🪄', goal: 6, val: () => G.qc.shape, reward: 40 },
  { text: 'Grow a town to 5 hexes', goal: 5, val: () => Math.max(0, ...ownTowns().map(sizeOf)), reward: 50 },
  { text: 'Build a Shrine or Hunting Grounds', goal: 1, val: () => G.buildings.filter((b) => !b.tribe).length, reward: 60 },
  { text: 'Have 3 towns', goal: 3, val: () => ownTowns().length, reward: 60 },
  { text: 'Plant a 🚩 Beacon', goal: 1, val: () => G.qc.beacon, reward: 30 },
  { text: 'Build Stonehenge', goal: 1, val: () => G.wonders.filter((w) => !w.tribe).length, reward: 100 },
  { text: 'Reach a 💎 treasure', goal: 1, val: () => ownTowns().reduce((a, t) => a + (t.res?.length || 0), 0), reward: 80 },
  { text: 'Have 6 towns', goal: 6, val: () => ownTowns().length, reward: 100 },
  { text: 'Place 5 buildings', goal: 5, val: () => G.buildings.filter((b) => !b.tribe).length, reward: 120 },
  { text: 'Reach 2,000 people', goal: 2000, val: () => totalPop(0), reward: 150 },
  { text: 'Capture a Crimson town', goal: 1, val: () => G.stats.captured || 0, reward: 150 },
  { text: 'Own 4 treasures', goal: 4, val: () => ownTowns().reduce((a, t) => a + (t.res?.length || 0), 0), reward: 200 },
  { text: 'Reach the Industrial Age', goal: 4, val: () => G.era, reward: 200 },
  { text: 'Reach 8,000 people', goal: 8000, val: () => totalPop(0), reward: 250 },
  { text: 'Reach the Space Age', goal: 6, val: () => G.era, reward: 300 },
];
let lastMission = -1, missionTimer = 0;
function openMission(ms) { $('mission').classList.add('open'); clearTimeout(missionTimer); missionTimer = setTimeout(() => $('mission').classList.remove('open'), ms); }
$('mission').addEventListener('click', () => { if ($('mission').classList.contains('open')) $('mission').classList.remove('open'); else openMission(4000); sfx.click(); });
function updateMission() {
  const m = MISSIONS[G.q];
  if (!m) { $('mission').hidden = true; return; }
  const v = Math.min(m.goal, m.val());
  $('mission').hidden = false;
  $('m-text').textContent = m.text;
  $('m-prog').textContent = m.goal > 1 ? (m.goal >= 1000 ? `${Math.floor((v / m.goal) * 100)}%` : `${v}/${m.goal}`) : '0/1';
  if (G.q !== lastMission) { lastMission = G.q; openMission(G.q < 2 ? 9000 : 6000); }
  $('m-fill').style.width = `${(v / m.goal) * 100}%`;
  $('m-reward').textContent = `+${m.reward}✦`;
  if (G.mode !== 'play') return;
  if (G.qT === undefined || G.q !== G.qLast || G.qT > G.elapsed) { G.qT = G.elapsed; G.qLast = G.q; }
  if (v < m.goal && G.elapsed - G.qT > 180) { G.q++; toast(`🎯 New mission (skipped: ${m.text})`); return; }
  if (v >= m.goal && G.elapsed - (G.qPaid ?? -9) > 1.6) {
    G.qPaid = G.elapsed;
    G.q++;
    addMana(m.reward);
    floatText(null, `🎯 ${m.text}  +${m.reward}✦`, 'gold');
    bump($('mission').querySelector('.m-ic') || $('mission')); sfx.grow();
    if (G.q % 3 === 0) celebrate(40);
  }
}

// ------------------------------------------------------------------ event cards
const myTowns = () => G.settlements.filter((t) => !t.tribe).sort((a, b) => b.pop - a.pop);
function gainKnow(f) { const n = Math.round(needOf(G.era) * f); G.know += n; floatText(null, `+${fmt(n)} 📜`, 'blue'); }
const evScale = () => 1 + G.era * 0.4;
function gainMana(n) { n = Math.round(n * evScale()); addMana(n); floatText(null, `+${n} ✦`, 'gold'); }
function growTowns(f) { for (const t of myTowns()) t.pop = Math.max(1, Math.min(capOf(t) * 1.2, t.pop * (1 + f))); floatText(null, `${f > 0 ? '+' : ''}${Math.round(f * 100)}% 👥`, f > 0 ? 'green' : 'red'); }
let curEvent = null;
function maybeEvent(dt) {
  G.eventT -= dt;
  if (G.eventT > 0 || G.mode !== 'play' || !G.started) return;
  if (!$('goal-sheet').hidden) return;
  G.eventT = 75 + rnd() * 45;
  const pool = EVENTS.filter((e) => G.era >= e.era[0] && G.era <= e.era[1] && (!e.cond || e.cond()) && !G.seenEvents.slice(-4).includes(e.id));
  if (!pool.length) return;
  curEvent = pool[(rnd() * pool.length) | 0];
  G.seenEvents.push(curEvent.id);
  $('ev-icon').textContent = curEvent.icon;
  $('ev-title').textContent = curEvent.title;
  $('ev-text').textContent = curEvent.text;
  const fxOf = (c) => c.fx.replace(/\+(\d+) ✦/, (m, n) => `+${Math.round(n * evScale())} ✦`);
  const costOf = (c) => +((c.fx.match(/−(\d+) ✦/) || [])[1] || 0);
  for (const k of ['a', 'b']) { const c = curEvent[k]; $('ev-' + k).innerHTML = `${c.label}<small>${fxOf(c)}</small>`; $('ev-' + k).disabled = G.mana < costOf(c); }
  $('event').hidden = false;
  G.mode = 'event';
  sfx.fanfare();
}
function offerRelic(x) {
  if (G.mode !== 'play' || !$('goal-sheet').hidden || !$('event').hidden) { const sd = G.seed; setTimeout(() => G.seed === sd && offerRelic(x), 2500); return; }
  const pool = RELICS.filter((r) => !G.relics.includes(r.id) && (r.id !== 'spear' || G.rival.status === 'war' || G.era >= 2));
  if (pool.length < 1) return;
  const a = pool.splice((rnd() * pool.length) | 0, 1)[0], b = pool.length ? pool[(rnd() * pool.length) | 0] : a;
  curEvent = {
    a: { run: () => { G.relics.push(a.id); floatText(x, `${a.icon} ${a.name}`, 'gold'); } },
    b: { run: () => { G.relics.push(b.id); floatText(x, `${b.icon} ${b.name}`, 'gold'); } },
  };
  $('ev-icon').textContent = '🏺';
  $('ev-title').textContent = 'Ancient Ruins';
  $('ev-text').textContent = 'Your people dig through the ruins of a forgotten people and find two relics. Only one can be carried home.';
  $('ev-a').disabled = $('ev-b').disabled = false;
  $('ev-a').innerHTML = `${a.icon} ${a.name}<small>${a.fx}</small>`;
  $('ev-b').innerHTML = `${b.icon} ${b.name}<small>${b.fx}</small>`;
  $('event').hidden = false;
  if (G.mode === 'play') G.mode = 'event';
  sfx.fanfare();
}
function chooseEvent(k) {
  if (!curEvent) return;
  curEvent[k].run();
  curEvent = null;
  $('event').hidden = true;
  G.mode = 'play';
  sfx.power(); updateHud();
}
$('ev-a').addEventListener('click', () => chooseEvent('a'));
$('ev-b').addEventListener('click', () => chooseEvent('b'));

// ------------------------------------------------------------------ raiders: barbarians who come from the coasts
const raiders = [];
const raiderMesh = inst(mergeParts([
  { g: new THREE.CylinderGeometry(0.011, 0.014, 0.032, 6).translate(0, 0.016, 0), c: 0x2a2228 },
  { g: new THREE.IcosahedronGeometry(0.009, 0).translate(0, 0.04, 0), c: 0xc89a7a },
  { g: new THREE.ConeGeometry(0.01, 0.012, 5).translate(0, 0.052, 0), c: 0x5a3a2a },
  { g: new THREE.CylinderGeometry(0.0015, 0.0015, 0.05, 3).translate(0.014, 0.03, 0), c: 0x6a4a2a },
  { g: new THREE.IcosahedronGeometry(0.005, 0).translate(0.014, 0.057, 0), c: 0xff8a2a },
]), bodyMat, 120, false);
function spawnRaid() {
  const mine = G.settlements.filter((x) => !x.tribe && x.pop > 15);
  if (!mine.length) return;
  const target = mine[(rnd() * mine.length) | 0];
  const coast = bfs(target.v, 11).filter(([x, d]) => d >= 7 && isLand(x) && !tileKind[x] && owner[x] < 0 && !lock[x] && NBR[x].some((n) => !isLand(n))).map(([x]) => x);
  if (!coast.length) return;
  const start = coast[(rnd() * coast.length) | 0];
  const path = pathTo(start, target.v);
  if (!path) return;
  const size = 6 + G.era * 4 + Math.floor(G.elapsed / 90), pop = Math.round(target.pop * (0.35 + rnd() * 0.3) + size);
  raiders.push({ from: start, to: start, path, t: 0, pop, n: Math.min(9, 3 + Math.floor(pop / 15)), target: target.v });
  alarm(`⚔️ Raiders land on the coast and march on ${target.name}! Sink the land under them to drown them.`, start);
  tip('raid', '💡 Lower or Level the hexes in front of the raiders: if their path turns to sea, they drown.', true);
}
function updateRaiders(dt) {
  if (G.mode === 'play' && G.era >= 1 && G.elapsed > 150) {
    G.raidT -= dt;
    if (G.raidT <= 0) { G.raidT = (110 + rnd() * 70) * DF().disaster; spawnRaid(); }
  }
  for (let i = raiders.length - 1; i >= 0; i--) {
    const r = raiders[i];
    if (!isLand(r.from) || r.pop < 1) {
      raiders.splice(i, 1);
      const p = posOf(r.from, 0.03);
      emit(p, 0xbfe6ff, 40, 0.8, 0.5, 0.9, 1); emit(p, 0xffffff, 15, 0.5, 0.3, 0.6, 0.6);
      const gain = (30 + G.era * 15) * (1 + boon('tide'));
      addMana(gain);
      floatText(r.from, `🌊 Raiders drowned! +${gain}✦`, 'gold'); sfx.boom();
      continue;
    }
    if (r.from !== r.to && !isLand(r.to)) { const np = pathTo(r.from, r.target); if (np && np.length) { r.path = np; r.to = r.path.shift(); r.t = 0; } else { r.pop = 0; } continue; }
    if (r.t < 1 && r.from !== r.to) { r.t += dt * 0.45; continue; }
    r.from = r.to; r.t = 0;
    if (r.path.length) {
      r.to = r.path.shift();
      if (!isLand(r.to)) { const np = pathTo(r.from, r.target); if (np && np.length) { r.path = np; r.to = r.path.shift(); } }
      continue;
    }
    // they reached the town
    raiders.splice(i, 1);
    const town = owner[r.from] >= 0 ? G.settlements[owner[r.from]] : G.settlements.find((x) => x.v === r.target);
    if (!town || town.tribe) continue;
    const def = town.pop * 0.6 * (town.fx.defend ? 1.8 : 1) * (rel('spear') ? 1.3 : 1) * (1 + boon('walls') * 0.4);
    emit(posOf(town.v, 0.15), 0xff6a3a, 40, 0.8, 0.5, 1, 0.4); sfx.boom(); quakeT = Math.max(quakeT, 0.4);
    if (r.pop > def) {
      town.pop = Math.max(2, town.pop * 0.45);
      for (const x of town.tiles.slice(0, 3)) burn[x] = 5;
      terrainDirty = true;
      toast(`🔥 Raiders sacked ${town.name}!`, town.v); floatText(town.v, '🔥 Sacked!', 'red');
    } else { town.pop -= r.pop * 0.3; toast(`🛡️ ${town.name} drove off the raiders!`, town.v); floatText(town.v, '🛡️ Held!', 'green'); }
  }
  let n = 0;
  for (const r of raiders) {
    const a = DIRS[r.from], b = DIRS[r.to], tt = Math.min(1, r.t);
    const dir = a.clone().lerp(b, tt).normalize(), rr = R + (h[r.from] * (1 - tt) + h[r.to] * tt) * STEP;
    const side = new THREE.Vector3().crossVectors(dir, b.clone().sub(a)).normalize();
    for (let k = 0; k < r.n && n < 120; k++) {
      const d2 = dir.clone().multiplyScalar(rr).addScaledVector(side, ((k % 3) - 1) * 0.025).addScaledVector(b.clone().sub(a).normalize(), -Math.floor(k / 3) * 0.03);
      dummy.position.copy(d2).addScaledVector(dir, Math.abs(Math.sin(t * 10 + k)) * 0.004);
      dummy.quaternion.setFromUnitVectors(UP, dir); dummy.scale.setScalar(1.25); dummy.updateMatrix();
      raiderMesh.setMatrixAt(n++, dummy.matrix);
    }
    if (rnd() < dt * 2) emit(dir.clone().multiplyScalar(rr + 0.07), 0xff9a3a, 1, 0.1, 0.03, 0.5, -0.1);
  }
  raiderMesh.count = n; raiderMesh.instanceMatrix.needsUpdate = true;
}
// reshaped land crushes enemies standing on it
function crushAt(cells) {
  for (const r of raiders) if (cells.has(r.from) || cells.has(r.to)) { r.pop *= 0.5; r.n = Math.max(1, Math.ceil(r.n / 2)); floatText(r.from, '💥 Crushed!', 'gold'); }
  for (const w of G.walkers) if (w.war >= 0 && w.tribe === 1 && (cells.has(w.from) || cells.has(w.to))) { w.pop *= 0.5; floatText(w.from, '💥 Crushed!', 'gold'); }
}

// ------------------------------------------------------------------ omens: timed challenges
const OMENS = [
  { text: 'Found a new town', time: 100, base: () => G.settlements.filter((x) => !x.tribe).length, ok: (b) => G.settlements.filter((x) => !x.tribe).length > b },
  { text: 'Grow a town by 3 hexes', time: 90, base: () => Math.max(0, ...G.settlements.filter((x) => !x.tribe).map(sizeOf)), ok: (b) => Math.max(0, ...G.settlements.filter((x) => !x.tribe).map(sizeOf)) >= b + 3 },
  { text: 'Place 2 buildings', time: 90, base: () => G.buildings.filter((x) => !x.tribe).length, ok: (b) => G.buildings.filter((x) => !x.tribe).length >= b + 2 },
  { text: 'Level 30 hexes', time: 60, base: () => G.qc.shape, ok: (b) => G.qc.shape >= b + 30 },
  { text: 'Gather 300 ✦', time: 80, cond: () => G.mana < manaCap() - 320, base: () => Math.floor(G.mana), ok: (b) => G.mana >= Math.min(manaCap() - 5, b + 300) },
];
function updateOmen(dt) {
  if (G.mode !== 'play') return;
  if (!G.omen) {
    G.omenT -= dt;
    if (G.omenT <= 0 && G.elapsed > 90) {
      const okO = OMENS.map((o, k) => k).filter((k) => !OMENS[k].cond || OMENS[k].cond());
      const i = okO[(rnd() * okO.length) | 0];
      G.omen = { i, base: OMENS[i].base(), left: OMENS[i].time + boon('oracles') * 15 };
      toast(`⏳ An omen! ${OMENS[i].text} in ${OMENS[i].time}s for a great reward, or the gods will be displeased.`);
      sfx.alarm();
    }
    $('omen').hidden = true;
    return;
  }
  const o = G.omen, O = OMENS[o.i];
  o.left -= dt;
  $('omen').hidden = false;
  $('omen').textContent = `⏳ ${O.text} · ${Math.ceil(o.left)}s`;
  if (O.ok(o.base)) {
    G.omenStreak = (G.omenStreak || 0) + 1;
    const k = (1 + 0.5 * (G.omenStreak - 1)) * (1 + boon('oracles') * 0.5), gain = Math.round((120 + G.era * 50) * k);
    addMana(gain); G.know += needOf(G.era) * 0.15 * k;
    floatText(null, `⏳ Omen fulfilled! +${gain}✦ +📜${G.omenStreak > 1 ? `  🔥 streak ×${G.omenStreak}` : ''}`, 'gold'); celebrate(50); sfx.fanfare();
    if (G.omenStreak % 3 === 0 && G.golden <= 0) { G.golden = 45; document.body.classList.add('golden'); toast('🌟 Three omens in a row: a GOLDEN AGE!'); celebrate(80); }
    G.omen = null; G.omenT = 90 + rnd() * 60;
  } else if (o.left <= 0) {
    const mine = G.settlements.filter((x) => !x.tribe);
    const victim = mine[(rnd() * mine.length) | 0];
    G.omenStreak = 0;
    if (victim) { victim.pop *= 0.65; floatText(victim.v, '⚡ The gods are displeased', 'red'); emit(posOf(victim.v, 0.6), 0xbfd8ff, 30, 1.5, 0.3, 0.4, 2); }
    toast('⚡ The omen failed. Lightning strikes your people.'); sfx.boom();
    G.omen = null; G.omenT = 90 + rnd() * 60;
  }
}

// ------------------------------------------------------------------ golden age and unrest
function updateMood(dt) {
  const mine = G.settlements.filter((x) => !x.tribe);
  // a golden age: three proud towns on a healthy planet
  if (G.golden > 0) { G.golden -= dt; if (G.golden <= 0) { G.goldenCD = 200; document.body.classList.remove('golden'); toast('🌟 The golden age fades.'); } }
  else {
    G.goldenCD -= dt;
    if (G.goldenCD <= 0 && mine.filter((x) => x.level >= 3 && !x.riot).length >= 3 && G.health >= 70) {
      G.golden = 45; document.body.classList.add('golden');
      toast('🌟 A GOLDEN AGE! +50% knowledge and inspiration for 45 seconds.'); celebrate(80); sfx.fanfare();
      for (const x of mine.slice(0, 5)) fireworks(x.v, 2);
    }
  }
  // unrest: big towns with nothing to do grow restless
  for (const x of mine) {
    const content = Object.keys(x.fxN || {}).length > 0 || x.inspire > 0 || G.golden > 0;
    if (sizeOf(x) >= 10 && !content) x.unrest = (x.unrest || 0) + dt; else x.unrest = Math.max(0, (x.unrest || 0) - dt * 3);
    if (!x.riot && x.unrest > 75 + ((x.v * 37) % 60)) { x.riot = true; toast(`😠 ${x.name} riots! It makes no knowledge until you Bless it or build near it.`, x.v); sfx.alarm(); }
    if (x.riot && x.unrest <= 0.5) { x.riot = false; floatText(x.v, `😊 ${x.name} is calm again`, 'green'); }
    if (x.riot) { x.pop -= x.pop * dt * 0.004; if (rnd() < dt * 0.5) emit(posOf(x.v, 0.2), 0xff4a3a, 2, 0.3, 0.2, 0.8, -0.1); }
  }
}

// ------------------------------------------------------------------ wonders and the ages
function bestSettlement(tribe = 0) { return G.settlements.reduce((a, s) => (s.tribe !== tribe ? a : !a || sizeOf(s) > sizeOf(a) || (sizeOf(s) === sizeOf(a) && s.pop > a.pop) ? s : a), null); }
function wonderReady() {
  const e = ERAS[G.era], best = bestSettlement();
  return { know: G.know >= needOf(G.era), mana: G.mana >= wCost(G.era), level: !!best && sizeOf(best) >= REQ[G.era], best };
}
// you choose where a wonder rises: towns close to it learn faster forever
const canWonderAt = (v) => isLand(v) && (tileKind[v] === 0 || tileKind[v] === 3 || tileKind[v] === 6) && !lock[v] && !G.wonders.some((w) => w.v === v) && bfs(v, 2).some(([x]) => owner[x] >= 0 && !G.settlements[owner[x]].tribe);
function autoWonderSpot() {
  const s = bestSettlement();
  const spots = bfs(s.v, 4).filter(([x, d]) => d >= 2 && canWonderAt(x)).map(([x]) => x).sort((a, b) => Math.abs(h[a] - h[s.v]) - Math.abs(h[b] - h[s.v]));
  return spots.length ? spots[0] : (bfs(s.v, 6).find(([x, d]) => d >= 2 && isLand(x) && !tileKind[x] && !G.wonders.some((o) => o.v === x)) || [NBR[s.v][0]])[0];
}
function buildWonder(at, force = false) {
  const r = wonderReady(), e = ERAS[G.era];
  if (!r.know || !r.mana || !r.level) { sfx.deny(); return; }
  if (G.wonders.some((w) => !w.tribe && w.build > 0)) { toast('🚀 Your Starship is already being built'); sfx.deny(); return; }
  if (at === undefined) {
    // pick the spot on the planet
    $('goal-sheet').hidden = true;
    setTool('wonder');
    flyTo(r.best.v, 12);
    return;
  }
  if (!force && !canWonderAt(at)) { toast(`Choose a golden hex next to one of your towns`); sfx.deny(); return false; }
  setTool('level');
  G.mana -= wCost(G.era);
  if (!G.wonders.some((w) => w.tribe === 1 && w.era === G.era)) { const bonus = 60 + G.era * 30; const sd = G.seed; setTimeout(() => { if (G.seed !== sd) return; addMana(bonus); floatText(null, `🏁 First to build it! +${bonus}✦`, 'gold'); }, 1200); }
  // the wonder stands on flat ground two steps from the town
  const v = at;
  const w = { era: G.era, v, tribe: 0 };
  G.wonders.push(w); assignTiles(); computeFx();
  for (const [x] of bfs(v, 1)) tree[x] = 0;
  { const near = G.settlements.filter((x) => !x.tribe && bfs(v, WONDER_R).some(([c]) => c === x.v)).length; if (near) setTimeout(() => floatText(v, `🏛️ ${near} town${near > 1 ? 's' : ''} learn +20%`, 'gold'), 1500); }
  rebuildCrowd(); layoutWonders();
  flyTo(v, 11);
  fireworks(v, 7);
  emit(posOf(v, 0.3), 0xffe27a, 80, 1, 0.8, 1.8, -0.2);
  sfx.fanfare();
  $('goal-sheet').hidden = true;
  if (G.era === 6) { w.build = SHIP_T(); w.hp = SHIP_HP; w.max = w.build; toast('🚀 Your Starship is being built! Defend it until it is ready to launch.', v); save(); return; }
  G.era++;
  G.know = 0;
  setDirty = true; terrainDirty = true;
  score?.setEra(G.era);
  showEra();
  save();
}
function layoutWonders() {
  wonderGroup.clear();
  for (const w of G.wonders) {
    const m = wonderModel(w.era);
    const g = new THREE.Group();
    const wb = new THREE.Mesh(m.body, bodyMat); wb.castShadow = wb.receiveShadow = true; g.add(wb);
    if (m.glow) g.add(new THREE.Mesh(m.glow, glowMat));
    if (w.era === 6) { const ship = starshipModel(); const sg = new THREE.Group(); const sb = new THREE.Mesh(ship.body, bodyMat); sb.castShadow = true; sg.add(sb); if (ship.glow) sg.add(new THREE.Mesh(ship.glow, glowMat)); g.add(sg); w.ship = sg; }
    qa.setFromUnitVectors(UP, DIRS[w.v]);
    g.quaternion.copy(qa);
    g.position.copy(DIRS[w.v]).multiplyScalar(radiusOf(w.v));
    g.scale.setScalar(1.1);
    g.rotateY(YAW[w.v]);
    wonderGroup.add(g);
    w.group = g;
  }
}
let launching = null;
const SHIP_T = () => 120, SHIP_HP = 160;
function updateShips(dt) {
  let txt = '';
  for (const w of G.wonders.slice()) {
    if (!(w.build > 0)) continue;
    w.build -= dt; if (w.shield > 0) w.shield -= dt;
    const k = 1 - Math.max(0, w.build) / w.max;
    if (w.ship) w.ship.scale.set(1, 0.25 + 0.75 * k, 1);
    txt += `${w.tribe ? '🔴' : '🚀'} ${Math.floor(k * 100)}% ❤️${Math.max(0, Math.round(w.hp))}${w.shield > 0 ? '🛡️' : ''}  `;
    if (rnd() < dt * 3) emit(posOf(w.v, 0.2 + k * 0.4), 0xffe27a, 1, 0.2, 0.1, 0.6, -0.1);
    if (w.build <= 0 && G.mode !== 'end' && G.mode !== 'launch' && !launching) { w.build = 0; launch(w); return; }
  }
  $('ship').hidden = !txt; if (txt) $('ship').textContent = txt.trim();
}
function launch(w) {
  G.mode = 'launch';
  launching = { w, t: 0 };
  flyTo(w.v, 11);
  toast(w.tribe ? '🚀 The Crimson are launching their Starship!' : '🚀 Ignition! Your people head for the stars.');
}
function updateLaunch(dt) {
  if (!launching) return;
  const L = launching;
  L.t += dt;
  const ship = L.w.ship;
  const lift = L.t < 1.5 ? 0 : Math.pow(L.t - 1.5, 2) * 0.35;
  ship.position.set(0, lift, 0);
  const base = new THREE.Vector3(0, lift, 0).applyMatrix4(L.w.group.matrixWorld);
  emit(base, rnd() < 0.5 ? 0xffb040 : 0xffffff, 6, -0.6, 0.4, 0.8, 0);
  if (L.t < 2) cam.shake = 0.6;
  cam.tDist = 11 + L.t * 2.5;
  if (L.t > 7.5) {
    launching = null;
    if (!L.w.tribe) endGame(true);
    else endGame(false, 'The Crimson reached the stars first. Their ship leaves you behind on a dying world.');
  }
}
function showEra() {
  const e = ERAS[G.era];
  G.mode = 'banner';
  $('era-icon').textContent = e.icon;
  $('era-name').textContent = e.name;
  $('era-desc').textContent = e.desc;
  const unlocked = POWERS.filter((p) => p.era === G.era).map((p) => p.name);
  const blds = BUILDINGS.filter((b) => b.era === G.era).map((b) => `${b.icon} ${b.name}`);
  $('era-unlock').innerHTML = (unlocked.length ? `New powers: <b>${unlocked.join(', ')}</b><br>` : '') + `New buildings: <b>${blds.join(', ')}</b><br>Towns can now spread over <b>${BASE_SIZE[G.era]}</b> hexes.`;
  $('era-wonder').innerHTML = (G.era > 0 ? `${WONDER_ICON[G.era - 1]} ${WONDERS[G.era - 1]} gift: <b>${PERKS[G.era - 1]}</b><br>` : '') + `Next wonder: <b>${WONDERS[G.era]}</b> (gift: ${PERKS[G.era]})`;
  document.body.style.setProperty('--era', e.color);
  // draft a blessing
  const pool = BOONS.slice(), pick = [];
  const nOpt = legacy.has('council') ? 4 : 3;
  while (G.era > 0 && pick.length < nOpt && pool.length) pick.push(pool.splice((rnd() * pool.length) | 0, 1)[0]);
  $('era-boons').innerHTML = pick.map((b) => `<button data-b="${b.id}"><i>${b.icon}</i><b>${b.name}${boon(b.id) ? ` <em>×${boon(b.id) + 1}</em>` : ''}</b><small>${b.fx}</small></button>`).join('');
  $('era-boons').hidden = $('boon-kick').hidden = !pick.length; $('era-ok').hidden = !!pick.length;
  $('era').hidden = false;
  if (G.era > 0) celebrate();
  buildPowers();
  updateHud();
}
$('era-ok').addEventListener('click', () => { $('era').hidden = true; G.mode = 'play'; });
$('era-boons').addEventListener('click', (e) => {
  const btn = e.target.closest('button'); if (!btn) return;
  const b = BOONS.find((x) => x.id === btn.dataset.b);
  (G.boons ||= []).push(b.id); computeFx();
  $('era').hidden = true; G.mode = 'play';
  floatText(null, `${b.icon} ${b.name}: ${b.fx}`, 'gold'); sfx.fanfare(); save();
});

// ------------------------------------------------------------------ input: drag turns the planet, pinch zooms, tap uses a power
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function pickVertex(cx, cy) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObject(planet, false)[0];
  if (!hit) return null;
  return triCell[hit.faceIndex];
}
const ptrs = new Map();
let press = null, gesture = null, repeatT = 0, tool = 'raise';
const cvs = renderer.domElement;
cvs.addEventListener('pointerdown', (e) => {
  try { cvs.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 1) press = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: false, repeating: false, multi: false };
  else if (press) press.multi = true;
  gesture = null; cam.fly = false;
});
cvs.addEventListener('pointermove', (e) => {
  const p = ptrs.get(e.pointerId);
  if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  if (ptrs.size === 1) {
    if (press && press.paint) {
      press.x = p.x; press.y = p.y;
      const v = pickVertex(p.x, p.y);
      if (v !== null && v !== press.lastV) { press.lastV = v; useAt(p.x, p.y); }
      return;
    }
    if (press && !press.moved && Math.hypot(p.x - press.x, p.y - press.y) < 10) return;
    if (press) press.moved = true;
    const k = (cam.dist / 16) * 0.0055;
    cam.vTheta = -dx * k; cam.vPhi = -dy * k;
    cam.theta += cam.vTheta; cam.phi += cam.vPhi;
    cam.vTheta *= 0.5; cam.vPhi *= 0.5;
  } else if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    if (gesture) cam.tDist = cam.dist = clamp(cam.dist * (gesture / dist), 7.6, 26);
    gesture = dist;
  }
});
function endPtr(e) {
  ptrs.delete(e.pointerId);
  if (ptrs.size < 2) gesture = null;
  if (!press || e.pointerId !== press.id) return;
  if (!press.moved && !press.repeating && !press.multi && performance.now() - press.t < 450 && G.mode === 'play') useAt(press.x, press.y);
  press = null;
  $('brush').hidden = true;
}
cvs.addEventListener('pointerup', endPtr);
cvs.addEventListener('pointercancel', (e) => { ptrs.delete(e.pointerId); press = null; gesture = null; $('brush').hidden = true; });
cvs.addEventListener('wheel', (e) => { e.preventDefault(); cam.tDist = clamp(cam.tDist * (e.deltaY > 0 ? 1.1 : 0.9), 7.6, 26); }, { passive: false });
function useAt(cx, cy) {
  const v = pickVertex(cx, cy);
  if (v === null) return;
  if (!press?.paint && collectWisp(v)) return;
  const isB = tool.startsWith('b:');
  const ok = tool === 'wonder' ? buildWonder(v) !== false : isB ? placeBuilding(tool.slice(2), v) : applyPower(tool, v);
  const p = isB ? { r: RANGE } : PW[tool] || { r: 0 };
  qa.setFromUnitVectors(new THREE.Vector3(0, 0, 1), DIRS[v]);
  cursor.quaternion.copy(qa);
  cursor.position.copy(DIRS[v]).multiplyScalar(radiusOf(v) + 0.04);
  cursor.scale.setScalar(p.r ? 0.22 + p.r * 0.38 : 0.2);
  cursor.material.color.set(ok ? 0xffffff : 0xff6b6b);
  cursor.visible = true; cursorT = 0.7;
  updateHud();
}
function pressRepeat(dt) {
  if (!press || press.moved || press.multi || !(tool === 'raise' || tool === 'lower' || tool === 'level')) return;
  if (performance.now() - press.t < 300) return;
  if (!press.paint) {
    // holding still turns the finger into a brush: drag to shape many hexes
    press.paint = true;
    const v = pickVertex(press.x, press.y);
    press.lastV = v; press.base = v !== null ? h[v] : 0;
    try { navigator.vibrate?.(12); } catch { /* not supported */ }
    $('brush').hidden = false;
  }
  press.repeating = true;
  repeatT -= dt;
  if (repeatT <= 0) { repeatT = 0.15; useAt(press.x, press.y); }
}

// ------------------------------------------------------------------ rendering per frame
let curTown = null;
function layoutSettlements(dt) {
  for (const tp of ALL_T) tp.n = 0;
  crowdSpots = [];
  let nf = 0;
  const smoke = [];
  let era = G.era;
  const put = (tp, v, scale, turn = 0) => {
    const n = tp.n++;
    placeIn(tp.body, n, v, 0, 0, YAW[v] + turn, scale, -0.002);
    tp.body.setColorAt(n, TINTS[(curTown && curTown.dist && era >= 1 ? hash((curTown.dist.get(v) ?? 0) * 7 + curTown.v) : hash(v * 5 + 3)) % TINTS.length]);
    if (tp.glow) tp.glow.setMatrixAt(n, dummy.matrix);
    if (era === 4 && tp.smoke.length && rnd() < dt * 0.5) for (const sp of tp.smoke) smoke.push(new THREE.Vector3(...sp).applyMatrix4(dummy.matrix));
  };
  for (const s of G.settlements) {
    curTown = s;
    s.grow = Math.min(1, s.grow + dt * 1.5);
    era = eraOf(s);
    placeIn(flags, nf, s.v, 0.12, 0.12, 0, 1.8, 0);
    flags.setColorAt(nf++, s.tribe ? FLAG_RED : FLAG_BLUE);
    if (crowdSpots.length < 80) crowdSpots.push({ v: s.v, n: 3 + s.level * 2 });
    put(centerT[`${era}-${s.level}`], s.v, 0.6 + 0.4 * (1 - Math.pow(1 - s.grow, 3)));
    for (const x of s.tiles || []) {
      // downtown near the centre, mixed streets further out, suburbs at the edge
      const ring = s.ring?.get(x) ?? 2, hx = hash(x) % 5;
      const h7 = hash(x * 3 + 1) % 7;
      const did = s.dist?.get(x) ?? 0, theme = hash(did * 31 + s.v) % 4;
      const THEMES = [[11, 6, 11, 2, 11, 4, 6], [5, 7, 11, 5, 11, 0, 7], [8, 10, 4, 11, 11, 6, 10], [9, 9, 11, 5, 0, 9, 11]];
      let k = tileKind[x] === 3 ? 3 : tileKind[x] === 6 ? 4 : era < 1 ? (ring <= 1 ? [0, 5, 5, 7, 8, 10, 0][h7] : ring === 2 ? [0, 1, 2, 5, 7, 9, 10][h7] : [6, 6, 1, 2, 6, 9, 6][h7])
        : did === 0 ? [11, 5, 5, 7, 11, 10, 5][h7] : THEMES[theme][h7];
      if (era >= 1 && s.plazas?.has(x) && tileKind[x] === 2) k = theme === 3 ? 7 : 8;
      if ((k === 7 || k === 8) && crowdSpots.length < 80) crowdSpots.push({ v: x, n: 5 + (hx % 4) });
      const tp = tileT[`${era}-${k}`];
      if (tp && tp.n < 700) put(tp, x, popIn(born.get(x)), (hash(x) % 6) * (Math.PI / 3));
    }
  }
  for (const tp of ALL_T) {
    for (const m of [tp.body, tp.glow]) if (m) { m.count = tp.n; m.visible = tp.n > 0; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  }
  flags.count = nf; flags.instanceMatrix.needsUpdate = true; if (flags.instanceColor) flags.instanceColor.needsUpdate = true;
  for (const p of smokers) if (rnd() < dt * 1.2) smoke.push(p);
  for (const p of smoke) emit(p, 0x4a4a50, 1, 0.22, 0.06, 2.2, -0.05);
}
const pColor = new THREE.Color();
function layoutPeople() {
  let n = 0;
  for (const w of G.walkers) {
    pColor.set(w.war === -2 ? 0xffc83a : w.war >= 0 ? (w.tribe ? 0xff3030 : 0x3a7aff) : w.tribe ? 0xc04a3a : PEOPLE_COL[G.era]);
    if (n >= 240) break;
    const a = DIRS[w.from], b = DIRS[w.to], tt = Math.min(1, w.t);
    const dir = a.clone().lerp(b, tt).normalize();
    const r = R + (h[w.from] * (1 - tt) + h[w.to] * tt) * STEP;
    const yaw = Math.atan2(b.x - a.x, b.z - a.z);
    placeOn(people, n, 0, Math.max(r, R + (G.seaVis + 0.5) * STEP), yaw, (w.war >= 0 ? 1.8 : w.war === -2 ? 1.5 : 1) + Math.min(1, Math.log10(1 + w.pop) * 0.4), dir);
    people.setColorAt(n++, pColor);
  }
  people.count = n;
  people.instanceMatrix.needsUpdate = true;
  if (people.instanceColor) people.instanceColor.needsUpdate = true;
}
const flights = [];
function layoutPlanes(dt) {
  if (G.era >= 5 && G.settlements.length > 2 && flights.length < Math.min(24, G.settlements.length) && rnd() < dt) {
    const a = G.settlements[(rnd() * G.settlements.length) | 0], b = G.settlements[(rnd() * G.settlements.length) | 0];
    if (a !== b) flights.push({ a: DIRS[a.v].clone(), b: DIRS[b.v].clone(), t: 0, dur: 6 + DIRS[a.v].distanceTo(DIRS[b.v]) * 10 });
  }
  let n = 0;
  for (let i = flights.length - 1; i >= 0; i--) {
    const f = flights[i];
    f.t += dt / f.dur;
    if (f.t >= 1 || G.era < 5) { flights.splice(i, 1); continue; }
    const alt = (k) => R + 0.6 + Math.sin(Math.PI * k) * 0.9;
    const p = f.a.clone().lerp(f.b, f.t).normalize(), q = f.a.clone().lerp(f.b, Math.min(1, f.t + 0.01)).normalize();
    dummy.position.copy(p).multiplyScalar(alt(f.t));
    dummy.up.copy(p);
    dummy.lookAt(q.multiplyScalar(alt(f.t + 0.01)));
    dummy.scale.setScalar(1.6);
    dummy.updateMatrix();
    planes.setMatrixAt(n++, dummy.matrix);
  }
  dummy.up.set(0, 1, 0);
  planes.count = n;
  planes.instanceMatrix.needsUpdate = true;
  let s = 0;
  if (G.era >= 6) for (let i = 0; i < 10; i++) {
    const ax = new THREE.Vector3(Math.sin(i * 2.3), Math.cos(i * 1.7), Math.sin(i * 0.9)).normalize();
    const p = new THREE.Vector3(ax.y, -ax.x, 0.3).normalize().applyAxisAngle(ax, t * (0.15 + i * 0.02)).multiplyScalar(R + 1.8 + (i % 3) * 0.3);
    dummy.position.copy(p); dummy.rotation.set(t * 0.3 + i, t * 0.2, 0); dummy.scale.setScalar(1.5); dummy.updateMatrix();
    sats.setMatrixAt(s++, dummy.matrix);
  }
  sats.count = s;
  sats.instanceMatrix.needsUpdate = true;
}
function layoutClouds() {
  let n = 0;
  const grey = clamp((90 - G.health) / 60, 0, 0.75);
  cloudMesh.material.color.setRGB(1 - grey * 0.5, 1 - grey * 0.52, 1 - grey * 0.55);
  cloudMesh.material.opacity = clamp((cam.dist - 10) / 7, 0.12, 0.9);
  for (const c of clouds) {
    const d = c.dir.clone().applyAxisAngle(UP, t * 0.02 * (0.6 + (c.i % 3) * 0.2));
    placeOn(cloudMesh, n++, 0, R + 1.1 + (c.i % 4) * 0.08, c.yaw, c.s, d);
  }
  cloudMesh.count = n;
  cloudMesh.instanceMatrix.needsUpdate = true;
}
function layoutGuides() {
  let nu = 0, nd = 0, nb = 0;
  if (G.mode === 'play' && SHAPERS.has(tool)) {
    // the ring of hexes around each town that still has room to spread: level them to its height
    const seen = new Set();
    for (const s of G.settlements) {
      if (s.tribe || s.tiles.length >= maxTiles(s)) continue;
      for (const c of [s.v, ...s.tiles]) for (const x of NBR[c]) {
        if (seen.has(x) || tileKind[x] || owner[x] >= 0 || h[x] === h[s.v] || lock[x]) continue;
        seen.add(x);
        const bob = 0.02 + Math.abs(Math.sin(t * 4 + x)) * 0.04;
        const lift = Math.max(0, (G.sea + 0.6 - h[x]) * STEP) + 0.01;
        if (h[x] < h[s.v] && nu < 600) placeIn(guideUp, nu++, x, 0, 0, YAW[x], 1, lift + bob * 0.3);
        else if (h[x] > h[s.v] && nd < 600) placeIn(guideDown, nd++, x, 0, 0, YAW[x], 1, 0.01 + bob * 0.3);
      }
    }
  }
  if (G.mode === 'play' && (tool.startsWith('b:') || tool === 'wonder') && buildSpotsDirty) {
    const okAt = tool === 'wonder' ? canWonderAt : canBuildAt;
    buildSpots.material.color.set(tool === "wonder" ? 0xffd040 : 0x7ad0ff);
    for (let v = 0; v < NV && nb < 1200; v++) if (okAt(v)) placeIn(buildSpots, nb++, v, 0, 0, YAW[v], 1, 0.01);
    buildSpots.count = nb; buildSpots.instanceMatrix.needsUpdate = true;
    buildSpotsDirty = false;
  } else if (!tool.startsWith('b:') && tool !== 'wonder') { buildSpots.count = 0; buildSpotsDirty = true; }
  guideUp.count = nu; guideDown.count = nd;
  guideUp.instanceMatrix.needsUpdate = guideDown.instanceMatrix.needsUpdate = true;
  const shaping = G.mode === 'play' && SHAPERS.has(tool);
  if (shaping && lockDirty) {
    let nl = 0;
    // only the outer edge of the protected zone: a clean red border
    for (let v = 0; v < NV && nl < 1500; v++) if (lock[v] && isLand(v) && NBR[v].some((x) => !lock[x])) placeIn(lockRings, nl++, v, 0, 0, YAW[v], 1, 0.012);
    lockRings.count = nl; lockRings.instanceMatrix.needsUpdate = true;
    lockDirty = false;
  } else if (!shaping) { lockRings.count = 0; lockDirty = true; }
}
let buildSpotsDirty = true;

// ------------------------------------------------------------------ floating texts over the world
const floaters = [];
function floatText(v, text, cls = '') {
  if (G.mode === 'menu') return;
  if (floaters.some((f) => f.t < 0.6 && f.el.textContent === text)) return;
  const el = document.createElement('div');
  el.className = `floater ${cls}`;
  el.textContent = text;
  $('floaters').appendChild(el);
  floaters.push({ el, p: v === null ? null : typeof v === 'number' ? posOf(v, 0.3) : v.clone(), t: 0, slot: v === null ? floaters.filter((f) => !f.p && f.t < 1.4).length : 0 });
  if (floaters.length > 12) { const f = floaters.shift(); f.el.remove(); }
}
function updateFloaters(dt) {
  const camDir = camera.position.clone().normalize();
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.t += dt;
    if (f.t > 1.8) { f.el.remove(); floaters.splice(i, 1); continue; }
    let x = innerWidth / 2, y = innerHeight * 0.42 + (f.slot % 4) * 38, vis = true;
    if (f.p) {
      tmpV.copy(f.p).project(camera);
      x = (tmpV.x * 0.5 + 0.5) * innerWidth; y = (-tmpV.y * 0.5 + 0.5) * innerHeight;
      vis = f.p.clone().normalize().dot(camDir) > 0.1 && tmpV.z < 1;
    }
    const k = f.t / 1.8, pop = Math.min(1, f.t * 6);
    f.el.style.opacity = vis ? String(Math.min(1, (1 - k) * 2.5)) : '0';
    f.el.style.transform = `translate(${x}px, ${y - k * 60}px) translate(-50%, -50%) scale(${0.6 + pop * 0.5 - (pop >= 1 ? 0.1 : 0)})`;
  }
}

// ------------------------------------------------------------------ UI
const ICON = { bolt: '⚡', quake: '💥', swamp: '🐸', volcano: '🌋', plague: '☠️', strike: '☄️', orbital: '🔆', level: '🪄', beacon: '🚩', war: '⚔️', raise: '⛰️', lower: '🕳️', rain: '🌧️', forest: '🌲', inspire: '💡', bless: '✨', cleanse: '🍃', terraform: '🏗️', deflect: '🛡️' };
let tab = 'powers';
function buildPowers() {
  if (tab === 'powers') {
    $('powers').innerHTML = POWERS.map((p) => {
      const locked = G.era < p.era;
      return `<button class="power${locked ? ' locked' : ''}${p.id === tool ? ' active' : ''}" data-p="${p.id}" aria-label="${p.name}"><i>${locked ? '🔒' : ICON[p.id]}</i><span>${p.name}</span><em>${locked ? ERAS[p.era].icon : `✦${p.cost}`}</em></button>`;
    }).join('');
  } else {
    // newest buildings first, then a peek at the next age
    const list = BUILDINGS.filter((b) => b.era <= G.era + 1).sort((a, b) => (a.era > G.era) - (b.era > G.era) || b.era - a.era);
    $('powers').innerHTML = list.map((b) => {
      const locked = G.era < b.era;
      return `<button class="power build${locked ? ' locked' : ''}${'b:' + b.id === tool ? ' active' : ''}" data-p="b:${b.id}" style="--c1:${ERAS[b.era].color}" aria-label="${b.name}"><i>${locked ? '🔒' : b.icon}</i><span>${b.short}</span><em>${locked ? ERAS[b.era].icon : `✦${bCost(b)}`}</em></button>`;
    }).join('');
  }
  for (const b of document.querySelectorAll('.power')) b.addEventListener('click', () => setTool(b.dataset.p));
  $('tab-powers').classList.toggle('on', tab === 'powers');
  $('tab-build').classList.toggle('on', tab === 'build');
}
$('tab-powers').addEventListener('click', () => { tab = 'powers'; buildPowers(); setTool('level'); });
$('tab-build').addEventListener('click', () => { tab = 'build'; buildPowers(); const first = BUILDINGS.filter((b) => b.era <= G.era).sort((a, b) => b.era - a.era)[0]; setTool('b:' + first.id); });
let hintTimer = 0;
const WONDER_TOOL = { era: 0, hint: '🏛️ Tap a golden hex to raise your wonder there. Towns within 4 hexes of it learn 20% faster, forever.' };
function setTool(id) {
  const isB = id.startsWith('b:');
  const p = id === 'wonder' ? WONDER_TOOL : isB ? BD[id.slice(2)] : PW[id];
  if (G.era < p.era) { toast(`${p.name} arrives in the ${ERAS[p.era].name}`); sfx.deny(); return; }
  tool = id;
  for (const b of document.querySelectorAll('.power')) b.classList.toggle('active', b.dataset.p === id);
  $('hint').classList.remove('dim'); clearTimeout(hintTimer); hintTimer = setTimeout(() => $('hint').classList.add('dim'), id === 'wonder' ? 9000 : 3500);
  $('hint').textContent = isB ? `${p.icon} ${p.name}: ${p.desc} Tap a blue hex near a town. Reaches ${RANGE} hexes.` : p.hint;
  buildSpotsDirty = true;
  sfx.click();
  layoutGuides(); renderLvl();
}
let toastTimer = 0, toastV = -1;
function toast(msg, v = -1) {
  const el = $('toast');
  el.textContent = msg; toastV = v;
  el.classList.toggle('go', v >= 0);
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3800);
}
$('toast').addEventListener('click', () => { if (toastV >= 0) flyTo(toastV, 11); });
const tips = {};
function tip(key, msg, force = false) { if (tips[key]) return; tips[key] = true; if (force || G.era === 0) setTimeout(() => toast(msg), 400); }
function yearStr() {
  const e = ERAS[G.era], f = clamp(G.know / needOf(G.era), 0, 1), y = Math.round(e.years[0] + (e.years[1] - e.years[0]) * f);
  return y < 0 ? `${fmt(-y)} BCE` : `${y} CE`;
}
const hudPrev = {};
function bump(el) { if (!el) return; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
function celebrate(n = 70) {
  $('flash').classList.remove('go'); void $('flash').offsetWidth; $('flash').classList.add('go');
  const box = $('confetti'), cols = ['#ffd27a', '#ff7a9a', '#7ad0ff', '#8affb0', '#c08aff', '#fff'];
  for (let i = 0; i < n; i++) {
    const c = document.createElement('i');
    c.style.left = `${rnd() * 100}%`; c.style.background = cols[i % cols.length];
    c.style.setProperty('--dx', `${(rnd() - 0.5) * 200}px`); c.style.setProperty('--rot', `${(rnd() - 0.5) * 1440}deg`);
    c.style.animationDuration = `${1.8 + rnd() * 1.6}s`; c.style.animationDelay = `${rnd() * 0.4}s`;
    box.appendChild(c); setTimeout(() => c.remove(), 4000);
  }
}
function updateHud() {
  const e = ERAS[G.era];
  if ($("lvl").hidden !== (tool !== "level" || G.mode !== "play")) renderLvl();
  $('era-chip').textContent = e.icon;
  $('era-label').textContent = e.name;
  $('year').textContent = yearStr();
  $('pop').textContent = fmt(totalPop());
  $('health').textContent = `${Math.round(G.health)}%`;
  $('health-fill').style.width = `${G.health}%`;
  $('health-fill').className = G.health > 70 ? '' : G.health > 40 ? 'mid' : 'no';
  $('mana').textContent = Math.floor(G.mana);
  $('mana-fill').style.height = `${Math.min(100, (G.mana / 700) * 100)}%`;
  const r = wonderReady(), f = clamp(G.know / needOf(G.era), 0, 1);
  $('goal-name').textContent = WONDERS[G.era];
  $('goal-ic').textContent = WONDER_ICON[G.era];
  $('medal').style.setProperty('--p', (f * 100).toFixed(1));
  $('goal-fill').style.width = `${f * 100}%`;
  $('goal-pct').textContent = r.know && r.mana && r.level ? 'BUILD' : `${Math.floor(f * 100)}%`;
  const chip = (id, ok, txt) => { const el = $(id); el.textContent = txt; if (el.classList.contains('ok') !== ok) { el.classList.toggle('ok', ok); if (ok) bump(el); } };
  chip('ch-know', r.know, '📜');
  chip('ch-mana', r.mana, '✦');
  chip('ch-size', r.level, '🏘️');
  const popNow = totalPop(0);
  if (popNow > (hudPrev.pop || 0) * 1.04 + 2) bump($('pop').parentElement);
  if (Math.floor(G.mana / 100) > Math.floor((hudPrev.mana || 0) / 100)) bump($('mana').closest('.orb'));
  hudPrev.pop = popNow; hudPrev.mana = G.mana;
  const rate = 0.8 + Math.sqrt(popNow) * 0.22 + worldFx[0].mana;
  $('rate').textContent = `+${rate.toFixed(1)}/s`;
  $('mana').closest('.orb').classList.toggle('poor', G.mana < 5);
  $('goal').classList.toggle('ready', r.know && r.mana && r.level);
  for (const b of document.querySelectorAll('.power')) { const id = b.dataset.p; b.classList.toggle('poor', G.mana < (id.startsWith('b:') ? bCost(BD[id.slice(2)]) : PW[id].cost)); }
  if (!$('goal-sheet').hidden) renderGoal();
  renderDiplo();
  updateMission();
}
function renderGoal() {
  const e = ERAS[G.era], r = wonderReady();
  const row = (ok, text) => `<li class="${ok ? 'ok' : ''}"><b>${ok ? '✓' : '·'}</b>${text}</li>`;
  $('gs-title').textContent = WONDERS[G.era];
  $('gs-ic').textContent = WONDER_ICON[G.era];
  $('gs-desc').textContent = WONDER_DESC[G.era] + ` Gift: ${PERKS[G.era]}.` + (G.era === 6 ? ' Building it wins the game.' : ` Building it begins the ${ERAS[G.era + 1].name}.`);
  $('gs-list').innerHTML = row(r.know, `Knowledge ${fmt(Math.min(G.know, needOf(G.era)))} / ${fmt(needOf(G.era))}`) + row(r.mana, `Inspiration ✦${fmt(Math.min(G.mana, wCost(G.era)))} / ${wCost(G.era)}${wCost(G.era) > e.cost ? ' (the Crimson built theirs first: +30%)' : ''}`) + row(r.level, `A town of ${REQ[G.era]} hexes (largest: ${r.best ? sizeOf(r.best) : 0}). Flatten land so it can spread, and build to give it room!`);
  $('gs-build').disabled = !(r.know && r.mana && r.level);
}
$('goal').addEventListener('click', () => { renderGoal(); $('goal-sheet').hidden = false; sfx.click(); });
$('gs-close').addEventListener('click', () => { $('goal-sheet').hidden = true; });
$('gs-build').addEventListener('click', () => buildWonder());
$('b-zen').addEventListener('click', () => { document.body.classList.toggle('zen'); sfx.click(); });
$('b-home').addEventListener('click', () => { const s = bestSettlement(); if (s) flyTo(s.v, 11); sfx.click(); });
$('b-menu').addEventListener('click', () => { $('opt-music').checked = store.get('aeons.music', true); $('opt-sfx').checked = store.get('aeons.sfx', true); $('opt-hq').checked = hq; $('my-boons').innerHTML = (G.boons || []).length || G.relics.length ? `Blessings: ${(G.boons || []).map((id) => BOONS.find((b) => b.id === id).icon).join(' ') || '–'}<br>Relics: ${G.relics.map((id) => RELICS.find((r) => r.id === id)?.icon || '').join(' ') || '–'}` : ''; $('pause').hidden = false; if (G.mode === 'play') G.mode = 'pause'; sfx.click(); });
$('pause-close').addEventListener('click', () => { $('pause').hidden = true; if (G.mode === 'pause') G.mode = 'play'; });
$('to-title').addEventListener('click', () => { save(); $('pause').hidden = true; showMenu(); });

function endGame(won, why = '') {
  if (G.mode === 'end') return;
  G.mode = 'end';
  store.del('aeons.save');
  const mins = G.elapsed / 60, stars = won ? (mins < 30 ? 3 : mins < 45 ? 2 : 1) : 0;
  $('end-title').textContent = won ? 'To the stars!' : 'Extinction';
  $('end').classList.toggle('lose', !won);
  $('end-stars').innerHTML = [1, 2, 3].map((k) => `<span class="${k <= stars ? 'on' : ''}">★</span>`).join('');
  $('end-text').textContent = won ? why || 'Your people leave their cradle world behind, carrying ten thousand years of history.' : why;
  const score = Math.round(G.era * 1000 + (won ? 3000 : 0) + stars * 1000 + G.stats.peak / 5 + G.stats.founded * 20 + (G.stats.captured || 0) * 150 + G.health * 10);
  const earned = Math.round(G.era * 6 + stars * 8 + (won ? 20 : 0) + G.wonders.filter((w) => !w.tribe).length * 2);
  const best = score > legacyData.best;
  legacyData.pts += earned; legacyData.worlds++; legacyData.best = Math.max(legacyData.best, score); saveLegacy();
  $('end-score').innerHTML = `<b>${fmt(score)}</b><span>${best ? '🏆 NEW BEST!' : `Best ${fmt(legacyData.best)}`}</span><em>+${earned} 🏛️ Legacy (${legacyData.pts} to spend)</em>`;
  $('end-score').classList.toggle('best', best);
  $('end-stats').innerHTML = [['Time', `${Math.floor(mins)}:${String(Math.floor(G.elapsed % 60)).padStart(2, '0')}`], ['Ages', `${G.era + (won ? 1 : 0)} / 7`], ['Peak population', fmt(G.stats.peak)], ['Settlements founded', G.stats.founded]]
    .map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
  $('end').hidden = false;
  if (won) { sfx.fanfare(); celebrate(120); } else sfx.deny();
}
$('end-again').addEventListener('click', () => { $('end').hidden = true; newWorld(); play(); });
$('end-legacy').addEventListener('click', () => { $('end').hidden = true; showMenu(); renderLegacy(); $('legacy').hidden = false; });

// ------------------------------------------------------------------ save / load
const pack = (a, off = 0) => { let s = ''; for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i] + 48 + off); return s; };
const unpack = (s, a, off = 0) => { for (let i = 0; i < a.length; i++) a[i] = (s.charCodeAt(i) || 48) - 48 - off; };
function save() {
  if (G.mode === 'end' || !G.started) return;
  store.set('aeons.save', {
    v: 1, seed: G.seed, era: G.era, know: G.know, mana: G.mana, health: G.health, sea: G.sea, elapsed: G.elapsed, stats: G.stats, tips,
    h: pack(h), tree: pack(tree), res: pack(res), beacon: G.beacon, diff: G.diff, q: G.q, qc: G.qc, relics: G.relics, boons: G.boons, behave: G.behave, graceAdd: G.graceAdd, best: G.best, relicCells: G.relicCells, firstWonders: G.firstWonders, eventT: G.eventT, seenEvents: G.seenEvents,
    settlements: G.settlements.map((s) => [s.v, Math.round(s.pop), s.tiles, s.tribe, s.name]), buildings: G.buildings.map((b) => [b.id, b.v, b.tribe]), rival: G.rival, walkers: G.walkers.filter((w) => w.war === -1).map((w) => [w.from, Math.round(w.pop), w.tribe]), wonders: G.wonders.map((w) => [w.era, w.v, w.tribe || 0, w.build || 0, w.hp ?? 100, w.max || 0]),
  });
}
function load() {
  const s = store.get('aeons.save', null);
  if (!s || s.v !== 1) return false;
  Object.assign(G, { seed: s.seed, era: s.era, know: s.know, mana: s.mana, health: s.health, sea: s.sea, seaVis: s.sea, elapsed: s.elapsed, stats: s.stats, started: true });
  Object.assign(tips, s.tips || {});
  unpack(s.h, h); unpack(s.tree, tree);
  if (s.res) unpack(s.res, res); else placeResources(s.seed);
  G.beacon = s.beacon ?? -1; G.diff = s.diff ?? 1; G.q = s.q ?? 0; G.qc = s.qc || { shape: 0, beacon: 0 }; G.relics = s.relics || []; G.boons = s.boons || []; G.behave = s.behave || 'settle'; G.graceAdd = s.graceAdd || 0; G.relicCells = s.relicCells || []; G.firstWonders = s.firstWonders || []; Object.assign(G, { golden: 0, goldenCD: 120, surge: 0, omen: null, omenT: 150, raidT: 150 }); raiders.length = 0; G.eventT = s.eventT ?? 120; G.seenEvents = s.seenEvents || [];
  rain.fill(0); burn.fill(0);
  G.settlements = []; G.walkers = []; G.wonders = s.wonders.map(([era, v, tribe, build, hp, max]) => ({ era, v, tribe: tribe || 0, build: build || 0, hp: hp ?? 100, max: max || 150 }));
  G.rival = Object.assign(newRival(), s.rival || {});
  const needRival = !s.rival;
  rebuildCrowd();
  G.buildings = (s.buildings || []).map(([id, v, tribe]) => ({ id, v, tribe: tribe || 0 }));
  for (const [v, pop, tiles, tribe, name] of s.settlements) { const st = newTown(v, pop, tiles || [], tribe || 0); if (name) st.name = name; st.grow = 1; G.settlements.push(st); }
  assignTiles(); computeFx();
  for (const [v, pop, tribe] of s.walkers) spawnWalker(v, pop, tribe || 0);
  if (needRival && G.settlements.length) spawnRival(bestSettlement(0).v);
  rebuildCrowd();
  return true;
}
function resetScene() {
  for (const st of storms) scene.remove(st.mesh);
  storms.length = 0;
  if (meteor) { scene.remove(meteor.mesh, meteor.ring); meteor = null; }
  flights.length = 0; parts.length = 0; launching = null;
  raiders.length = 0; volcanoes.length = 0; document.body.classList.remove('golden');
  terrainDirty = true; setDirty = true;
  layoutWonders();
  tab = 'powers';
  buildPowers();
  setTool('level');
  assignTiles(); computeFx(); layoutBuildings();
  document.body.style.setProperty('--era', ERAS[G.era].color);
  score?.setEra(G.era);
  const s = bestSettlement();
  if (s) { const sp = new THREE.Spherical().setFromVector3(DIRS[s.v]); cam.theta = cam.tTheta = sp.theta; cam.phi = cam.tPhi = sp.phi; }
  cam.dist = cam.tDist = 14;
  sunAng = Math.atan2(Math.cos(cam.theta), Math.sin(cam.theta)) - 0.5;
}
function newWorld() {
  const seed = (Date.now() % 100000) + 1;
  Object.assign(G, { seed, era: 0, know: 0, mana: 60, health: 100, sea: SEA0, seaVis: SEA0, elapsed: 0, started: true, diff: store.get('aeons.diff', 1), q: 0, qc: { shape: 0, beacon: 0 }, relics: [], boons: [], behave: 'settle', graceAdd: 0, relicCells: [], golden: 0, goldenCD: 120, surge: 0, omen: null, omenT: 100, raidT: 150, firstWonders: [], settlements: [], walkers: [], wonders: [], buildings: [], rival: newRival(), beacon: -1, eventT: 75, seenEvents: [], stats: { founded: 0, lost: 0, disasters: 0, peak: 0 } });
  for (const k of Object.keys(tips)) delete tips[k];
  disasterT = 70;
  const start = generate(seed);
  placeResources(seed);
  rebuildCrowd();
  found(start, 6);
  G.stats.founded = 0;
  spawnWalker(NBR[start][0], 3);
  spawnRival(start);
  // legacy gifts
  if (legacy.has('hoard')) G.mana += 150;
  if (legacy.has('heirloom')) G.relics.push(RELICS.filter((r) => r.id !== 'spear')[(rnd() * (RELICS.length - 1)) | 0].id);
  if (legacy.has('firstborn')) { const v2 = findSpot(start, 0, false); if (v2 !== null) { for (const [x] of bfs(v2, 1)) { setHeight(x, h[v2]); tree[x] = 0; } found(v2, 5); } }
  resetScene();
}
// the Crimson start far away, on the biggest land on the other side of the world
function spawnRival(start) {
  let rv = -1, rs = -1e9;
  for (let v = 0; v < NV; v += 3) {
    if (!(h[v] > SEA0) || Math.abs(DIRS[v].y) > 0.6 || DIRS[v].dot(DIRS[start]) > -0.2) continue;
    const sc = bfs(v, 3).filter(([x]) => h[x] > SEA0).length - DIRS[v].dot(DIRS[start]) * 12;
    if (sc > rs) { rs = sc; rv = v; }
  }
  if (rv < 0) rv = DIRS.reduce((b, d, v) => (d.dot(DIRS[start]) < DIRS[b].dot(DIRS[start]) ? v : b), 0);
  for (const [x] of bfs(rv, 2)) { setHeight(x, SEA0 + 2); tree[x] = 0; }
  found(rv, 6, 1);
}
function renderLegacy() {
  $('legacy-btn').textContent = `🏛️ Legacy · ${legacyData.pts}`;
  $('lg-pts').textContent = `${legacyData.pts} 🏛️ to spend · ${legacyData.worlds} worlds · best ${fmt(legacyData.best)}`;
  $('lg-list').innerHTML = LEGACY.map((l) => { const own = legacy.has(l.id); return `<button data-l="${l.id}" class="${own ? 'own' : legacyData.pts >= l.cost ? 'can' : ''}" ${own ? 'disabled' : ''}><i>${l.icon}</i><b>${l.name}</b><small>${l.fx}</small><em>${own ? '✓' : `${l.cost} 🏛️`}</em></button>`; }).join('');
}
$('legacy-btn').addEventListener('click', () => { renderLegacy(); $('legacy').hidden = false; sfx.click(); });
$('lg-close').addEventListener('click', () => { $('legacy').hidden = true; sfx.click(); });
$('lg-list').addEventListener('click', (e) => {
  const btn = e.target.closest('button'); if (!btn) return;
  const l = LEGACY.find((x) => x.id === btn.dataset.l);
  if (legacy.has(l.id) || legacyData.pts < l.cost) { sfx.deny(); return; }
  legacyData.pts -= l.cost; legacyData.owned.push(l.id); saveLegacy(); renderLegacy(); sfx.fanfare(); celebrate(30);
});
renderLegacy();
function renderDiff() { for (const b of document.querySelectorAll('.diffs button')) b.classList.toggle('on', +b.dataset.d === store.get('aeons.diff', 1)); }
for (const b of document.querySelectorAll('.diffs button')) b.addEventListener('click', () => { store.set('aeons.diff', +b.dataset.d); renderDiff(); sfx.click(); });
renderDiff();
function showMenu() {
  G.mode = 'menu';
  document.body.classList.add('in-menu');
  const s = store.get('aeons.save', null);
  $('continue').hidden = !s;
  if (s) $('continue').innerHTML = `Continue <small>${ERAS[s.era].icon} ${ERAS[s.era].name}</small>`;
  $('newworld').classList.toggle('stone', !!s);
  $('menu').hidden = false;
}
function play() {
  sfx.init();
  $('menu').hidden = true;
  document.body.classList.remove('in-menu');
  G.mode = 'play';
  cam.tDist = 14;
  sunAng = Math.atan2(Math.cos(cam.theta), Math.sin(cam.theta)) - 0.5;
  if (G.era === 0 && G.elapsed < 1) { cam.dist = 28; cam.tDist = 14; cam.slow = 3; showEra(); setTimeout(() => toast('Tap the glowing arrows with 🪄 Level: towns grow on flat hexes.'), 900); setTimeout(() => toast('🔴 Beyond the sea lives the Crimson tribe and their god. Only one people will survive, or reach the stars first.'), 9000); }
}
$('continue').addEventListener('click', () => { if (load()) resetScene(); play(); });
$('newworld').addEventListener('click', () => {
  if (store.get('aeons.save', null) && !confirm('Start a new world? Your current world will be lost.')) return;
  store.del('aeons.save');
  newWorld(); play();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); sfx.suspend(document.hidden); });
setInterval(() => { if (G.mode === 'play') save(); }, 20000);

// ------------------------------------------------------------------ sound
let score = null;
const sfx = (() => {
  let ac = null, master = null, musicOut = null, noise = null;
  const levels = () => { if (!ac) return; master.gain.value = store.get('aeons.sfx', true) ? 0.45 : 0; musicOut.gain.value = store.get('aeons.music', true) ? 1 : 0; };
  const init = () => {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.connect(ac.destination);
      musicOut = ac.createGain(); musicOut.connect(ac.destination);
      levels();
      noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      score = createScore(ac, musicOut);
      score.setEra(G.era);
      score.start();
    } catch { ac = null; }
  };
  const tone = (f0, f1, dur, type, vol, delay = 0) => {
    if (!ac) return;
    const t0 = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
  };
  const hiss = (dur, f, vol, type = 'lowpass') => {
    if (!ac) return;
    const t0 = ac.currentTime, s = ac.createBufferSource(); s.buffer = noise;
    const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f;
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    s.connect(fl).connect(g).connect(master); s.start(t0, Math.random()); s.stop(t0 + dur);
  };
  return {
    init,
    click: () => tone(880, 880, 0.04, 'sine', 0.05),
    deny: () => { tone(200, 150, 0.14, 'triangle', 0.08); const a = document.querySelector('.power.active'); if (a) { a.classList.remove('shake'); void a.offsetWidth; a.classList.add('shake'); } },
    raise: (k = 0) => { const f = 220 * 2 ** (k / 12); tone(f, f * 1.5, 0.1, 'triangle', 0.1); hiss(0.14, 700, 0.16); tone(70, 40, 0.18, 'sine', 0.18); },
    lower: (k = 0) => { const f = 260 * 2 ** (k / 12); tone(f, f * 0.6, 0.1, 'triangle', 0.1); hiss(0.18, 450, 0.2); tone(60, 35, 0.2, 'sine', 0.2); },
    power: () => { hiss(0.6, 2400, 0.15, 'bandpass'); [523, 784, 1047].forEach((f, i) => tone(f, f, 0.3, 'sine', 0.06, i * 0.06)); },
    found: () => [392, 523].forEach((f, i) => tone(f, f, 0.2, 'sine', 0.07, i * 0.08)),
    grow: () => [523, 659, 784].forEach((f, i) => tone(f, f, 0.18, 'sine', 0.05, i * 0.06)),
    pop: () => { tone(900 + Math.random() * 500, 300, 0.25, 'sine', 0.03); hiss(0.25, 3000, 0.05, 'highpass'); },
    alarm: () => [0, 0.25, 0.5].forEach((d) => tone(740, 560, 0.2, 'triangle', 0.06, d)),
    rumble: () => { hiss(1.6, 160, 0.7); tone(48, 30, 1.4, 'sine', 0.4); },
    boom: () => { hiss(1.4, 300, 0.9); tone(70, 30, 1.2, 'sawtooth', 0.25); },
    fanfare: () => [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.45, 'triangle', 0.09, i * 0.13)),
    music(on) { store.set('aeons.music', on); if (!score) return; levels(); },
    effects(on) { store.set('aeons.sfx', on); levels(); },
    suspend(on) { if (!ac) return; if (on) ac.suspend(); else ac.resume(); },
  };
})();
$('opt-music').addEventListener('change', (e) => { sfx.init(); sfx.music(e.target.checked); });
$('opt-sfx').addEventListener('change', (e) => { sfx.effects(e.target.checked); });
function setHq(on) {
  hq = on; store.set('aeons.hq', on);
  renderer.shadowMap.enabled = on; sun.castShadow = on;
  scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
}
$('opt-hq').addEventListener('change', (e) => { setHq(e.target.checked); store.set('aeons.autoq', false); });

// ------------------------------------------------------------------ loop
const clock = new THREE.Clock();
let t = 0, hudT = 0, guideT = 0, sunAng = 0.6;
const perf = { t: 0, frames: 0, done: false };
function watchPerf(raw) {
  if (perf.done || G.mode !== 'play') return;
  perf.t += raw; perf.frames++;
  if (perf.t < 6) return;
  const fps = perf.frames / perf.t;
  perf.done = true;
  if (fps < 28 && hq) { setHq(false); $('opt-hq').checked = false; toast('⚡ Switched to fast graphics for smoother play. You can change this in ⚙️.'); }
  else if (fps < 22 && renderer.getPixelRatio() > 1) { renderer.setPixelRatio(1); resize(); }
}
function frame() {
  const raw = clock.getDelta();
  const dt = Math.min(0.05, raw);
  if (store.get('aeons.autoq', true)) watchPerf(raw);
  t += dt;
  timeU.value = t;
  if (G.mode === 'play') { simulate(dt); pressRepeat(dt); updateShips(dt); }
  if (G.mode === 'launch') updateLaunch(dt);
  if (G.mode === 'menu') { cam.theta += dt * 0.06; cam.tDist = 23; }
  // the sun circles the planet: a day lasts two minutes
  sunAng += dt * (Math.PI * 2) / 150;
  sunDir.set(Math.cos(sunAng), 0.25, Math.sin(sunAng)).normalize();
  sun.position.copy(sunDir).multiplyScalar(30);
  // the light turns golden when the part of the world you look at is near dusk
  { const k = camera.position.clone().normalize().dot(sunDir), dusk = 1 - clamp(k / 0.55, 0, 1);
    sun.color.setRGB(1, 0.95 - dusk * 0.32, 0.86 - dusk * 0.5); sun.intensity = 2.6 + dusk * 0.4; }
  sunSprite.position.copy(sunDir).multiplyScalar(120);
  moonLight.position.copy(sunDir).multiplyScalar(-30);
  moon.position.set(Math.cos(t * 0.03) * 15, Math.sin(t * 0.03) * 4, Math.sin(t * 0.03) * 15);
  if (quakeT > 0) { quakeT -= dt; cam.shake = quakeT; } else if (G.mode !== 'launch') cam.shake = 0;
  updateCamera(dt);
  waterMat.uniforms.uCam.value.copy(camera.position);
  if (Math.abs(G.seaVis - G.sea) > 0.001) { G.seaVis += Math.sign(G.sea - G.seaVis) * Math.min(Math.abs(G.sea - G.seaVis), dt * 0.4); terrainDirty = true; }
  water.scale.setScalar(1 + ((G.seaVis + 0.5) * STEP) / R);
  if (setDirty) { setDirty = false; assignTiles(); }
  if (roadsDirty) layoutRoads();
  updateTraffic(dt);
  updateBoats(dt);
  if (terrainDirty) { terrainDirty = false; rebuildPlanet(); layoutBuildings(); for (const w of G.wonders) if (w.group) w.group.position.copy(DIRS[w.v]).multiplyScalar(radiusOf(w.v)); }
  atmoColor.set(0x5fa8ff).lerp(new THREE.Color(0xc89a6a), clamp((80 - G.health) / 80, 0, 0.8));
  layoutSettlements(dt);
  layoutPeople();
  layoutPlanes(dt);
  layoutClouds();
  guideT -= dt;
  if (guideT <= 0) { guideT = 0.05; layoutGuides(); }
  if (cursorT > 0) { cursorT -= dt; cursor.material.opacity = Math.max(0, cursorT * 1.6); if (cursorT <= 0) cursor.visible = false; }
  updateShootingStars(dt);
  updateDebris(dt);
  if (ffDirty) { ffDirty = false; seedFireflies(); }
  updateWisps(dt);
  updateParticles(dt);
  updateFloaters(dt);
  layoutResources();
  if (G.buildings.some((b) => b.t0 !== undefined && t - b.t0 < 0.9)) layoutBuildings();
  for (const a of auroras) a.rotation.y += dt * 0.02;
  hudT -= dt;
  if (hudT <= 0 && (G.mode === 'play' || G.mode === 'pause' || G.mode === 'event')) { hudT = 0.25; updateHud(); }
  if (hq) post.render(); else renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

resize();
if (!hq) setHq(false);
if (!load()) newWorld(); else resetScene();
showMenu();
requestAnimationFrame(frame);

// ------------------------------------------------------------------ version check
async function checkForUpdate() {
  try {
    const r = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    const { version } = await r.json();
    if (version && version !== APP_VERSION) $('update').hidden = false;
  } catch { /* offline: try again later */ }
}
$('update').addEventListener('click', () => { save(); location.reload(); });
checkForUpdate();
setInterval(checkForUpdate, 60000);

// Exposed for automated testing.
window.__aeons = { spawnRaid, raiders, offerRelic, updateOmen, night: (k = 1) => { sunAng = Math.atan2(Math.cos(cam.theta), Math.sin(cam.theta)) + Math.PI * k; }, floatText, res, lock, celebrate, guides: () => [guideUp.count, guideDown.count, tool, G.mode], G, h, tree, simulate, applyPower, buildWonder: (v) => buildWonder(v ?? autoWonderSpot(), true), endGame, layoutWonders, updateShips, autoWonderSpot, wonderReady, canWonderAt, raiseV, lowerV, bfs, NBR, declareWar, strength, sendBand, battle, updateRival, DIRS, placeBuilding, assignTiles, BUILDINGS, sizeOf, maxTiles, owner, tileKind, canBuildAt, flyTo, cam, newWorld, play, setTool, nextDisaster, get meteor() { return meteor; } };
