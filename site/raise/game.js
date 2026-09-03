/* RAISE — καθαρή λογική παιχνιδιού (v4: Tichu combinations, 30 antes, charms, discards).
   Χωρίς DOM. Browser: window.RAISE · Node: module.exports. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RAISE = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ============================== σταθερές ============================== */
  const SUITS = [{ s: "♠", red: false }, { s: "♥", red: true }, { s: "♦", red: true }, { s: "♣", red: false }];
  const RN = { 11: "J", 12: "Q", 13: "K", 14: "A" };
  const rname = (r) => RN[r] || String(r);
  /* Συνδυασμοί κατά Tichu. size = φύλλα. Βόμβες χτυπούν οτιδήποτε. */
  /* tier = σειρά ισχύος (ανώτερο χτυπάει κατώτερο). Το kind μένει σταθερό για τα saves. */
  const KINDS = [null,
    { id: "pair", name: "Pair", short: "PAIR", base: 10, size: 2, tier: 1 },
    { id: "trips", name: "Trips", short: "TRIPS", base: 25, size: 3, tier: 3 },
    { id: "stairs", name: "Stairs", short: "STAIRS", base: 40, step: 35, min: 4, tier: 4 },
    { id: "straight", name: "Straight", short: "STR8", base: 40, min: 5, table: [40, 60, 85, 115, 150, 190, 235, 285, 340], tier: 5 },
    { id: "full", name: "Full House", short: "FULL", base: 80, size: 5, tier: 6 },
    { id: "quads", name: "Quads", short: "QUADS", base: 1000, size: 4, bomb: true, tier: 7 },
    { id: "sflush", name: "Straight Flush", short: "SFLUSH", base: 1000, step: 250, min: 5, bomb: true, tier: 8 },
    { id: "pairs", name: "Two Pair", short: "PAIRS", base: 20, step: 20, min: 4, tier: 2 },
  ];
  const BY_TIER = KINDS.slice(1).sort((a, b) => a.tier - b.tier);
  const MULT_KIND = { m1: [1, 8], m2: [2], m3: [4], m4: [3], m5: [5], m6: [6, 7] };
  function kbase(k) {
    const K = KINDS[k.kind];
    if (k.kind === 4) return K.table[Math.min(K.table.length - 1, k.size - 5)];
    if (k.kind === 3) return K.base + K.step * (k.size / 2 - 2);
    if (k.kind === 7) return K.base + K.step * (k.size - 5);
    if (k.kind === 8) return K.base + K.step * (k.size / 2 - 2);
    return K.base;
  }
  const isBomb = (k) => !!k && !!KINDS[k.kind].bomb;
  /* 30 antes. Βαθμονομείται από tools/sweep.js. */
  const TARGETS = [105, 120, 145, 185, 240, 310, 370, 450, 560, 710, 870, 1060, 1230, 1470, 1690, 2050, 2510, 3050, 3700, 4650, 5300, 6150, 7300, 8300, 9850, 11550, 13450, 15200, 17450, 19800];
  const CFG = {
    handSize: 8, plays: 5, breaths: 2, discards: 5, discardCards: 4, chisel0: 0, jokers: 2,
    rewardBase: 8, rewardFrac: 0.25, rewardCap: 6,
    offersUp: 2, offersCard: 1, offersCharm: 2, rerollCost: 3, rerollStep: 2,
    charmSlots: 5,
    challengeAntes: [3, 8, 13, 18, 23],
    chalTargetMul: 0.75, thinAirCap: 4, ruleChance: 0.75, perfectChips: 3, highGroundRank: 5, shortHand: 7, richAirMul: 1.1, blindCount: 4,
    raiseMul: 2.0, raisePayout: 2, gamblerMul: 2.4,
    priceStep: 0.5,
    maxBuy: { cs: 2, br: 2, wi: 2, di: 3, pl: 2, m1: 3, m2: 3, m3: 3, m4: 3, m5: 3, m6: 3 },
  };

  const POOL = [
    { id: "m1", name: "Pairs +", desc: "Pairs pay one step more.", cost: 5 },
    { id: "m2", name: "Trips +", desc: "Trips pay one step more.", cost: 7 },
    { id: "m3", name: "Straights +", desc: "Straights pay one step more.", cost: 8 },
    { id: "m4", name: "Stairs +", desc: "Stairs pay one step more.", cost: 8 },
    { id: "m5", name: "Full Houses +", desc: "Full houses pay one step more.", cost: 10 },
    { id: "m6", name: "Bombs +", desc: "Bombs pay 1000 more.", cost: 10 },
    { id: "pl", name: "Extra Play", desc: "+1 play per round.", cost: 12 },
    { id: "br", name: "Breath", desc: "+1 pass per round.", cost: 7 },
    { id: "di", name: "Discards", desc: "+2 discards for the rest of the run.", cost: 8 },
    { id: "wi", name: "Wide Hand", desc: "Hold one more card.", cost: 9 },
    { id: "cs", name: "Head Start", desc: "The chain starts one step higher.", cost: 12 },
    { id: "th", name: "Cull", desc: "Remove the lowest rank from the deck. For good.", cost: 7 },
  ];
  const poolById = Object.fromEntries(POOL.map((o) => [o.id, o]));

  const ENH = {
    gold: { name: "Gold", desc: "Base ×2 when played.", cost: 6, w: 35 },
    glass: { name: "Glass", desc: "Base ×3. Shatters after one play.", cost: 5, w: 30 },
    wild: { name: "Joker", desc: "Any rank, any suit. Also an Ace.", cost: 9, w: 15 },
    steel: { name: "Steel", desc: "+15 base when played. Always back in your hand next round.", cost: 8, w: 20 },
  };

  /* Charms: παθητικά εφέ. `lock` = συνθήκη ξεκλειδώματος (UI, lifetime stats). */
  const CHARMS = [
    { id: "ladder", name: "Ladder", glyph: "≡", desc: "Tight step — same hand, exactly one rank up: +1 chain.", cost: 8 },
    { id: "leap", name: "Overkill", glyph: "⤒", desc: "Beat the rung by four ranks or more: the hand pays ×1.5.", cost: 8 },
    { id: "lowroad", name: "Low Road", glyph: "2", desc: "Pairs of 2 to 6 pay ×2.", cost: 6 },
    { id: "court", name: "Court", glyph: "♛", desc: "Hands with a face card: +20 base.", cost: 7 },
    { id: "loyal", name: "Loyalty", glyph: "♠", desc: "Same lead suit as your last play: +1 chain.", cost: 9 },
    { id: "cheap", name: "Cheap Breath", glyph: "½", desc: "Pass keeps the whole chain.", cost: 10 },
    { id: "wind", name: "Second Wind", glyph: "∞", desc: "The first pass each round costs no breath.", cost: 9 },
    { id: "sleight", name: "Sleight", glyph: "✂", desc: "Gain a discard at the start of every round.", cost: 7 },
    { id: "encore", name: "Encore", glyph: "⧗", desc: "Your last play of the round pays ×2.", cost: 9 },
    { id: "mirror", name: "Mirror", glyph: "◐", desc: "The first hand of each round pays ×2.", cost: 9 },
    { id: "vault", name: "Vault", glyph: "◎", desc: "Interest: +1 chip per 5 held at ante end, up to 5.", cost: 6 },
    { id: "thrift", name: "Thrift", glyph: "−", desc: "Everything in the shop costs 2 less.", cost: 7 },
    { id: "scout", name: "Scout", glyph: "◉", desc: "See the next card of the pile.", cost: 5 },
    { id: "goldsmith", name: "Goldsmith", glyph: "★", desc: "Gold cards pay ×3.", cost: 8, lock: { key: "gold", n: 3, text: "Play 3 Gold cards" } },
    { id: "glassblower", name: "Glassblower", glyph: "◇", desc: "Glass survives half the time.", cost: 8, lock: { key: "glass", n: 5, text: "Shatter 5 Glass cards" } },
    { id: "summiteer", name: "Summiteer", glyph: "▲", desc: "Bombs pay ×1.5.", cost: 10, lock: { key: "quads", n: 3, text: "Play 3 bombs" } },
    { id: "gambler", name: "Gambler", glyph: "⚄", desc: "Raise pays ×3 — but the target is ×2.4.", cost: 8, lock: { key: "raiseWon", n: 3, text: "Win 3 Raises" } },
    { id: "ember", name: "Ember", glyph: "✦", desc: "Chain ×5 and above: hands pay +50%.", cost: 11, lock: { key: "chain7", n: 1, text: "Reach chain ×7" } },
  ];
  const charmById = Object.fromEntries(CHARMS.map((c) => [c.id, c]));

  const CHALLENGES = [
    { id: "nopass", name: "No Pass", desc: "Passing is off. Aces still reset." },
    { id: "short", name: "Short Hand", desc: "You hold seven cards." },
    { id: "blind", name: "Blind Deal", desc: "Four cards start face down. Your first play turns them." },
    { id: "highground", name: "High Ground", desc: "The rung starts at Pair 5." },
    { id: "onebreath", name: "One Breath", desc: "A single pass this round." },
    { id: "thinair", name: "Thin Air", desc: "The chain caps at ×4." },
    { id: "richair", name: "Rich Air", desc: "Target ×1.1. Payout ×2." },
    { id: "nodiscard", name: "No Discards", desc: "Discarding is off this round." },
    { id: "fewplays", name: "Four Plays", desc: "One play fewer. Gain a discard." },
    { id: "sticky", name: "Sticky Rung", desc: "After every play the rung climbs one more rank." },
    { id: "summit", name: "The Summit", desc: "No Pass. Only an Ace resets. One clean ascent." },
  ];
  const chalById = Object.fromEntries(CHALLENGES.map((c) => [c.id, c]));
  /* Συμβόλαια: προαιρετικός στόχος γύρου, επιλογή στο κατάστημα. pct = % του σκορ, flat = πόντοι. */
  const CONTRACTS = [
    { id: "c_nopass", name: "Steady Hands", desc: "Don't pass this round.", pct: 30, avoid: true },
    { id: "c_nodisc", name: "No Waste", desc: "Don't discard this round.", pct: 40, avoid: true },
    { id: "c_noace", name: "Hold the Ace", desc: "Don't play a lone Ace.", pct: 25, avoid: true },
    { id: "c_full", name: "Big Finish", desc: "End the round on a full house.", pct: 50 },
    { id: "c_str3", name: "Runner", desc: "Play three straights.", flat: 300 },
    { id: "c_chain6", name: "High Wire", desc: "Reach chain ×6.", pct: 40 },
    { id: "c_all", name: "Full Effort", desc: "Use every play.", pct: 20 },
    { id: "c_bomb", name: "Detonate", desc: "Play a bomb.", flat: 500 },
    { id: "c_low", name: "Humble Start", desc: "Open with a pair of 2, 3 or 4.", pct: 25 },
    { id: "c_stairs", name: "Staircase", desc: "Play stairs.", flat: 200 },
    { id: "c_pairs", name: "Collector", desc: "Play two, three or four pairs.", flat: 150 },
  ];
  const contractById = Object.fromEntries(CONTRACTS.map((c) => [c.id, c]));
  /* Κανόνες τραπεζιού: ένας μικρός θετικός ή αρνητικός κανόνας στα antes χωρίς challenge. */
  const RULES = [
    { id: "r_red", name: "Red Night", desc: "Hands led by red cards pay ×1.5." },
    { id: "r_black", name: "Black Night", desc: "Hands led by black cards pay ×1.5." },
    { id: "r_head", name: "Running Start", desc: "The chain starts at ×2." },
    { id: "r_cap", name: "Low Ceiling", desc: "The chain caps at ×5." },
    { id: "r_pair0", name: "Cheap Pairs", desc: "Single pairs pay nothing — but still climb." },
    { id: "r_str2", name: "Runway", desc: "Straights pay ×2." },
    { id: "r_trips2", name: "Triplets", desc: "Trips pay ×2." },
    { id: "r_full2", name: "Open House", desc: "Full houses pay ×2." },
    { id: "r_low2", name: "Underdogs", desc: "Hands topped by a 6 or lower pay ×2." },
    { id: "r_gift", name: "Spare Card", desc: "One free discard this round." },
  ];
  const ruleById = Object.fromEntries(RULES.map((r) => [r.id, r]));
  const RANDOM_CHALLENGES = CHALLENGES.filter((c) => c.id !== "summit").map((c) => c.id);
  const TAG_ORDER = ["Bomb!", "Ladder to Heaven", "Royal", "Four Horsemen", "Ace in the Hole", "Overkill", "Long Run", "Staircase", "Shatter", "Tight Step", "Humble"];

  /* ============================== RNG ============================== */
  function hash(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return (h ^ (h >>> 16)) >>> 0; }
  function next(S) { S.rng = (S.rng + 0x6d2b79f5) | 0; let t = Math.imul(S.rng ^ (S.rng >>> 15), 1 | S.rng); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  function shuffle(S, a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(next(S) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  /* ============================== helpers ============================== */
  const has = (S, id) => S.charms.indexOf(id) >= 0;
  const chal = (S) => S.chal || null;
  const rule = (S) => (S.chal ? null : (S.rules && S.rules[S.ante]) || null);
  const cmp = (a, b) => a.r - b.r || a.si - b.si;
  const isWild = (c) => !!c && c.e === "wild";
  const isAce = (c) => !!c && (c.r === 14 || isWild(c));
  const isFace = (c) => !!c && !isWild(c) && c.r >= 11 && c.r <= 13;

  function apply(S, id) {
    switch (id) {
      case "m1": case "m2": case "m3": case "m4": case "m5": case "m6": MULT_KIND[id].forEach((k) => { S.mult[k] += 1; }); break;
      case "br": S.breathsMax += 1; break;
      case "pl": S.playsMax += 1; break;
      case "di": S.discards += 2; break;
      case "ch": S.chiselMax += 1; break;
      case "wi": S.handSize += 1; break;
      case "cs": S.chainStart += 1; break;
      case "th": {
        const ranks = S.deck.filter((c) => !isWild(c)).map((c) => c.r);
        if (!ranks.length) break;
        const lo = Math.min.apply(null, ranks);
        S.deck = S.deck.filter((c) => isWild(c) || c.r !== lo);
        S.removed.push(lo);
        break;
      }
    }
    S.bought[id] = (S.bought[id] || 0) + 1;
  }

  /* ============================== run ============================== */
  function newRun(seedStr, unlocked) {
    const seed = String(seedStr || "").trim() || String(Math.floor(Math.random() * 1e9));
    const S = {
      v: 4, seed, rng: hash(seed) | 0,
      ante: 0, money: 0, phase: "round", offers: [], rerolls: 0,
      handSize: CFG.handSize, playsMax: CFG.plays, breathsMax: CFG.breaths, discards: CFG.discards, chiselMax: CFG.chisel0, chainStart: 0,
      keep: [], hand: [],
      mult: [0, 1, 1, 1, 1, 1, 1, 1, 1], removed: [], bought: {},
      deck: [], nextId: 1, charms: [], charmSlots: CFG.charmSlots,
      unlocked: (unlocked || []).slice(),
      chals: {}, rules: {}, contract: null, contractOffers: [],
      stats: { quads: 0, gold: 0, glass: 0, raiseWon: 0, chain7: 0, maxChain: 0, plays: 0, aces: 0 },
    };
    for (let r = 2; r <= 14; r++) for (let si = 0; si < 4; si++) S.deck.push({ id: S.nextId++, r, si });
    for (let j = 0; j < CFG.jokers; j++) S.deck.push({ id: S.nextId++, r: 0, si: j % 4, e: "wild" });
    const pool = RANDOM_CHALLENGES.slice();
    CFG.challengeAntes.forEach((a) => { S.chals[a] = pool.splice(Math.floor(next(S) * pool.length), 1)[0]; });
    S.chals[TARGETS.length - 1] = "summit";
    for (let a = 1; a < TARGETS.length - 1; a++) if (!S.chals[a] && next(S) < CFG.ruleChance) S.rules[a] = RULES[Math.floor(next(S) * RULES.length)].id;
    startRound(S);
    return S;
  }
  const target = (S) => Math.round(TARGETS[S.ante] * (chal(S) === "richair" ? CFG.richAirMul : 1) * (chal(S) && chal(S) !== "richair" ? CFG.chalTargetMul : 1));
  const goal = (S) => (S.raised ? S.raiseTarget : target(S));
  const roundHandSize = (S) => (chal(S) === "short" ? Math.min(CFG.shortHand, S.handSize) : S.handSize);

  function draw(S, n) {
    const drawn = [];
    while (n > 0) {
      if (!S.pile.length) break;
      const c = S.pile.pop(); c.n = true; S.hand.push(c); drawn.push(c); n--;
    }
    S.hand.sort(cmp);
    return drawn;
  }
  function startRound(S) {
    S.chal = S.chals[S.ante] || null;
    const n = roundHandSize(S);
    /* Το χέρι μένει από γύρο σε γύρο· στο κατάστημα διαλέγεις ποια φύλλα φεύγουν. */
    /* Steel φύλλα γυρίζουν πάντα στο χέρι, έστω κι αν παίχτηκαν· μετά τα κρατημένα. */
    const steel = S.deck.filter((c) => c.e === "steel").map((c) => Object.assign({}, c));
    const kept = (S.keep || []).map((i) => S.hand[i]).filter((c) => c && c.e !== "steel");
    const first = steel.concat(kept).slice(0, n), firstIds = new Set(first.map((c) => c.id));
    const rest = shuffle(S, S.deck.filter((c) => !firstIds.has(c.id)).map((c) => Object.assign({}, c)));
    S.pile = rest; S.discardPile = []; S.keep = [];
    S.hand = first.map((c) => { const k = Object.assign({}, c); delete k.h; delete k.n; return k; });
    draw(S, n - S.hand.length);
    S.hand.forEach((c) => { delete c.n; });
    if (chal(S) === "blind") {
      const idx = shuffle(S, S.hand.map((_, i) => i));
      idx.slice(0, Math.min(CFG.blindCount, S.hand.length - 2)).forEach((i) => { S.hand[i].h = true; });
    }
    S.sel = [];
    S.rung = chal(S) === "highground" ? { kind: 1, rank: CFG.highGroundRank, size: 2 } : null;
    S.chain = 0; S.score = 0; S.plays = 0; S.lastSuit = null; S.passes = 0;
    S.rdisc = 0; S.races = 0; S.rbombs = 0; S.rkinds = {}; S.rmax = 0; S.firstK = null; S.lastK = null;
    S.chainBonus = rule(S) === "r_head" ? 1 : 0;
    if (rule(S) === "r_gift") S.discards += 1;
    S.playsLeft = S.playsMax - (chal(S) === "fewplays" ? 1 : 0);
    S.breaths = chal(S) === "onebreath" ? 1 : S.breathsMax;
    /* Τα discards είναι πόρος όλου του run· ο γύρος μόνο προσθέτει. */
    if (S.ante > 0 || S.plays > 0) S.discards += (chal(S) === "fewplays" ? 1 : 0) + (has(S, "sleight") ? 1 : 0);
    S.chisel = S.chiselMax;
    S.played = []; S.log = [];
    S.phase = "round"; S.offers = []; S.rerolls = 0;
    S.raised = false; S.raiseTarget = 0;
  }

  /* ============================== αξιολόγηση ============================== */
  const K = (kind, rank, size) => ({ kind, rank, size });
  /* Ταξινόμηση κατά Tichu. Wild = οποιοδήποτε φύλλο (γεμίζει κενά, επεκτείνει προς τα πάνω). */
  function classify(cs) {
    if (!cs || cs.length < 2) return null;
    const n = cs.length, F = cs.filter((c) => !isWild(c)), w = n - F.length;
    if (!F.length) return n === 2 ? K(1, 14, 2) : n === 3 ? K(2, 14, 3) : n === 4 ? K(6, 14, 4) : n >= 5 ? K(4, 14, n) : null;
    const bR = {}; F.forEach((c) => { bR[c.r] = (bR[c.r] || 0) + 1; });
    const ranks = Object.keys(bR).map(Number).sort((x, y) => x - y), d = ranks.length, lo = ranks[0], hi = ranks[d - 1], span = hi - lo + 1;
    const maxC = Math.max.apply(null, ranks.map((r) => bR[r]));
    let best = null;
    const take = (k) => { if (!best || kbase(k) > kbase(best) || (kbase(k) === kbase(best) && k.rank > best.rank)) best = k; };
    if (d === 1) {
      if (n === 2) take(K(1, lo, 2)); else if (n === 3) take(K(2, lo, 3)); else if (n === 4) take(K(6, lo, 4));
      else if (n === 5) { if (bR[lo] === 3) take(K(5, lo, 5)); else if (bR[lo] <= 2 && w >= 3) take(K(5, 14, 5)); }
    }
    if (n >= 4 && n % 2 === 0 && n <= 8 && d === n / 2 && maxC <= 2) take(K(8, hi, n));
    if (n === 5 && d === 2) {
      const a = hi, b = lo;
      if (bR[a] <= 3 && bR[b] <= 2) take(K(5, a, 5)); else if (bR[b] <= 3 && bR[a] <= 2) take(K(5, b, 5));
    }
    if (n >= 5 && maxC === 1 && span <= n && span - d <= w) {
      const top = Math.min(14, hi + (n - span));
      if (top - n + 1 >= 2) take(K(F.every((c) => c.si === F[0].si) ? 7 : 4, top, n));
    }
    if (n >= 4 && n % 2 === 0 && maxC <= 2) {
      const p = n / 2;
      if (span <= p) { const top = Math.min(14, hi + (p - span)); if (top - p + 1 >= 2) take(K(3, top, n)); }
    }
    return best;
  }
  /* Υβρίδιο: ανώτερος τύπος χτυπάει κατώτερο (Pair < Trips < Stairs < Straight < Full < Quads < Str.Flush).
     Στον ίδιο τύπο, Tichu: ίδιο μήκος και ψηλότερη αξία — ή μακρύτερη κέντα / σκάλα. */
  function beats(k, r) {
    if (!k) return false;
    if (!r) return true;
    if (k.kind !== r.kind) return KINDS[k.kind].tier > KINDS[r.kind].tier;
    if (k.size !== r.size) return k.size > r.size;
    return k.rank > r.rank;
  }
  const isLegal = (S, k) => beats(k, S.rung);
  const sameShape = (a, b) => !!a && !!b && a.kind === b.kind && a.size === b.size;
  function chainPos(S) { const p = S.chain + 1 + S.chainStart + (S.chainBonus || 0); return chal(S) === "thinair" ? Math.min(CFG.thinAirCap, p) : rule(S) === "r_cap" ? Math.min(5, p) : p; }
  function leadSuit(cs) {
    const cnt = {}; cs.forEach((c) => { if (!isWild(c)) cnt[c.si] = (cnt[c.si] || 0) + 1; });
    let best = null; Object.keys(cnt).forEach((k) => { if (best == null || cnt[k] > cnt[best]) best = +k; });
    return best;
  }
  /* Πλήρης υπολογισμός πόντων ενός υποψήφιου χεριού — UI και bot βλέπουν το ίδιο. */
  function scoreOf(S, k, cs) {
    let base = kbase(k) * S.mult[k.kind];
    const notes = [], R = rule(S);
    if (R === "r_pair0" && k.kind === 1) { base = 0; notes.push("Cheap Pairs"); }
    if (has(S, "court") && cs.some(isFace)) { base += 20; notes.push("Court +20"); }
    const steels = cs.filter((c) => c.e === "steel").length;
    if (steels) { base += 15 * steels; notes.push("Steel +" + 15 * steels); }
    const golds = cs.filter((c) => c.e === "gold").length, glass = cs.filter((c) => c.e === "glass").length;
    const factor = 1 + golds * (has(S, "goldsmith") ? 2 : 1) + 2 * glass;
    /* Βόμβα: σταθεροί πόντοι, χωρίς πολλαπλασιαστή αλυσίδας. */
    let pos = isBomb(k) ? 1 : chainPos(S);
    const prev = S.rung;
    if (has(S, "ladder") && sameShape(k, prev) && k.rank === prev.rank + 1) { pos += 1; notes.push("Ladder +1"); }
    if (has(S, "loyal") && S.lastSuit != null && leadSuit(cs) === S.lastSuit) { pos += 1; notes.push("Loyalty +1"); }
    if (has(S, "summiteer") && isBomb(k)) { notes.push("Summiteer ×1.5"); }
    let hm = 1;
    if (has(S, "summiteer") && isBomb(k)) hm *= 1.5;
    if (has(S, "leap") && sameShape(k, prev) && k.rank - prev.rank >= 4) { hm *= 1.5; notes.push("Overkill ×1.5"); }
    if (has(S, "lowroad") && k.kind === 1 && k.rank <= 6) { hm *= 2; notes.push("Low Road ×2"); }
    if (has(S, "mirror") && S.plays === 0) { hm *= 2; notes.push("Mirror ×2"); }
    if (has(S, "ember") && pos >= 5) { hm *= 1.5; notes.push("Ember +50%"); }
    if (has(S, "encore") && S.playsLeft === 1) { hm *= 2; notes.push("Encore ×2"); }
    if (R === "r_red" || R === "r_black") { const ls = leadSuit(cs), red = ls === 1 || ls === 2; if (ls != null && (R === "r_red") === red) { hm *= 1.5; notes.push((R === "r_red" ? "Red" : "Black") + " Night ×1.5"); } }
    if ((R === "r_str2" && k.kind === 4) || (R === "r_trips2" && k.kind === 2) || (R === "r_full2" && k.kind === 5)) { hm *= 2; notes.push(ruleById[R].name + " ×2"); }
    if (R === "r_low2" && !isBomb(k) && k.rank <= 6) { hm *= 2; notes.push("Underdogs ×2"); }
    return { base, factor, pos, hm, pts: Math.round(base * factor * pos * hm), notes };
  }
  const selCards = (S) => S.sel.map((i) => S.hand[i]);
  function evalSel(S) {
    const cs = selCards(S);
    if (cs.length === 1 && isAce(cs[0]) && S.rung) return { ace: true, legal: true, cs, k: null };
    const k = classify(cs);
    if (!k) return { k: null, legal: false, cs };
    const legal = isLegal(S, k), sc = scoreOf(S, k, cs);
    return Object.assign({ k, legal, cs }, sc);
  }
  /* "Pair 8" · "Stairs 3 to 6" · "Straight 7 to J" · "Str. Flush 5 to 9" */
  const PAIRS_NAME = { 4: "Two Pair", 6: "Three Pair", 8: "Four Pair" };
  function clabel(k) {
    if (k.kind === 8) return PAIRS_NAME[k.size] + " " + rname(k.rank);
    if (k.kind === 3) return "Stairs " + k.size / 2 + " to " + rname(k.rank);
    if (k.kind === 4) return "Straight " + k.size + " to " + rname(k.rank);
    if (k.kind === 7) return "Str. Flush " + k.size + " to " + rname(k.rank);
    return KINDS[k.kind].name + " " + rname(k.rank);
  }
  /* Οι βαθμίδες που καλύπτει: "4·5·6" για σκάλες, "7…J" για κέντες. */
  function crange(k) {
    if (k.kind === 3) { const p = k.size / 2, out = []; for (let r = k.rank - p + 1; r <= k.rank; r++) out.push(rname(r) + rname(r)); return out.join(" "); }
    if (k.kind === 4 || k.kind === 7) return rname(k.rank - k.size + 1) + "…" + rname(k.rank);
    return "";
  }
  /* Τι χρειάζεται για να χτυπηθεί το rung. */
  function beatText(S) {
    const r = S.rung; if (!r) return "any hand opens";
    if (r.kind === 8) return "higher hand · or more pairs, or higher";
    return "higher hand · or " + KINDS[r.kind].name.toLowerCase() + (r.kind === 3 || r.kind === 4 ? " longer or higher" : " higher");
  }

  /* ============================== κινήσεις ============================== */
  function candidates(S) {
    const bR = {}, W = [], vis = [];
    S.hand.forEach((c, i) => { if (c.h) return; vis.push(i); if (isWild(c)) { W.push(i); return; } (bR[c.r] = bR[c.r] || []).push(i); });
    const out = [], rs = Object.keys(bR).map(Number).sort((a, b) => a - b), nw = W.length, wl = (n) => W.slice(0, n);
    rs.forEach((r) => { const g = bR[r]; [2, 3, 4].forEach((tot) => { for (let use = 0; use <= Math.min(nw, tot - 1); use++) if (g.length >= tot - use) out.push(g.slice(0, tot - use).concat(wl(use))); }); });
    for (let n = 2; n <= Math.min(4, nw); n++) out.push(wl(n));
    /* 2–4 ζευγάρια σε οποιεσδήποτε βαθμίδες (wilds γεμίζουν) */
    (function pairsets(start, acc, need) {
      if (acc.length >= 2 && need <= nw) out.push(acc.reduce((a, r) => a.concat(bR[r].slice(0, 2)), []).concat(wl(need)));
      if (acc.length === 4) return;
      for (let i = start; i < rs.length; i++) pairsets(i + 1, acc.concat([rs[i]]), need + Math.max(0, 2 - bR[rs[i]].length));
    })(0, [], 0);
    rs.forEach((t) => rs.forEach((p) => {
      if (t === p) return;
      const nt = Math.max(0, 3 - bR[t].length), np = Math.max(0, 2 - bR[p].length);
      if (nt + np <= nw) out.push(bR[t].slice(0, 3).concat(bR[p].slice(0, 2), wl(nt + np)));
    }));
    const maxL = Math.min(vis.length, 13);
    for (let L = 5; L <= maxL; L++) for (let s = 2; s + L - 1 <= 14; s++) {
      let need = 0; const pk = [];
      for (let r = s; r < s + L; r++) { if (bR[r]) pk.push(bR[r][0]); else need++; }
      if (need <= nw && pk.length) out.push(pk.concat(wl(need)));
      for (let si = 0; si < 4; si++) {
        let need2 = 0; const pk2 = [];
        for (let r = s; r < s + L; r++) { const j = bR[r] ? bR[r].find((i) => S.hand[i].si === si) : undefined; if (j !== undefined) pk2.push(j); else need2++; }
        if (need2 <= nw && pk2.length >= 3) out.push(pk2.concat(wl(need2)));
      }
    }
    for (let p = 2; 2 * p <= vis.length; p++) for (let s = 2; s + p - 1 <= 14; s++) {
      let need = 0; const pk = [];
      for (let r = s; r < s + p; r++) { const g = bR[r] || []; pk.push.apply(pk, g.slice(0, 2)); need += 2 - Math.min(2, g.length); }
      if (need <= nw && pk.length) out.push(pk.concat(wl(need)));
    }
    const seen = new Set();
    return out.filter((idx) => { const key = idx.slice().sort((a, b) => a - b).join(","); if (seen.has(key)) return false; seen.add(key); return true; })
      .map((idx) => ({ idx, k: classify(idx.map((i) => S.hand[i])) })).filter((o) => o.k);
  }
  const legalMoves = (S) => candidates(S).filter((o) => isLegal(S, o.k));
  const hasLegal = (S) => legalMoves(S).length > 0;
  /* Πόσα σκαλιά ανεβαίνει άπληστα από εδώ με ξένα φύλλα, παίρνοντας κάθε φορά το φθηνότερο που χτυπάει. */
  const costKey = (k) => KINDS[k.kind].tier * 10000 + k.size * 100 + k.rank;
  function chainLen(S, c, all) {
    const used = new Set(c.idx); let cur = c.k, len = 1;
    for (;;) {
      let nx = null;
      all.forEach((o) => { if (!beats(o.k, cur) || isBomb(o.k) || o.idx.some((i) => used.has(i))) return; if (!nx || costKey(o.k) < costKey(nx.k)) nx = o; });
      if (!nx) break;
      nx.idx.forEach((i) => used.add(i)); cur = nx.k; len++;
    }
    return len;
  }
  /* Πρόταση: με rung, το φθηνότερο που χτυπάει (βόμβες τελευταίες). Ανοιχτό: το σχήμα με τη
     μεγαλύτερη αλυσίδα στο χέρι, αλλιώς το πιο ακριβό. */
  function suggest(S) {
    const all = candidates(S), legal = all.filter((o) => isLegal(S, o.k));
    if (!legal.length) return null;
    if (S.rung) {
      const nb = legal.filter((o) => !isBomb(o.k)), pool = nb.length ? nb : legal;
      return pool.reduce((b, o) => (!b || costKey(o.k) < costKey(b.k) ? o : b), null);
    }
    let best = null, bk = -1;
    legal.forEach((o) => {
      const len = isBomb(o.k) ? 1 : chainLen(S, o, all), pts = scoreOf(S, o.k, o.idx.map((i) => S.hand[i])).pts;
      const key = len * 1e6 + (len >= 2 ? (90000 - costKey(o.k)) : 0) + Math.min(9999, pts);
      if (key > bk) { bk = key; best = o; }
    });
    return best;
  }
  const cheapest = suggest;
  const aceIndex = (S) => S.hand.findIndex((c) => !c.h && isAce(c));
  /* Ορφανά: φύλλα που δεν μπαίνουν σε κανέναν συνδυασμό (εκτός Άσων και Wild). */
  function orphans(S) {
    const inUse = new Set(); candidates(S).forEach((o) => o.idx.forEach((i) => inUse.add(i)));
    const o = S.hand.map((c, i) => i).filter((i) => { const c = S.hand[i]; return !c.h && !isWild(c) && c.r !== 14 && !inUse.has(i); });
    return o.sort((a, b) => S.hand[a].r - S.hand[b].r);
  }

  /* ============================== ενέργειες ============================== */
  const reveal = (S) => { S.hand.forEach((c) => { if (c.h) delete c.h; }); };
  function toggle(S, i) {
    if (S.phase !== "round" || !S.hand[i] || S.hand[i].h) return false;
    const at = S.sel.indexOf(i);
    if (at >= 0) S.sel.splice(at, 1); else S.sel.push(i);
    return true;
  }
  function removeSel(S, toDiscard) {
    const cs = selCards(S);
    S.hand = S.hand.filter((_, i) => !S.sel.includes(i));
    S.sel = [];
    cs.forEach((c) => { delete c.n; if (toDiscard) S.discardPile.push(c); });
    return cs;
  }
  function shatter(S, cs) {
    let n = 0;
    cs.forEach((c) => {
      if (c.e !== "glass") return;
      if (has(S, "glassblower") && next(S) < 0.5) return;
      S.deck = S.deck.filter((d) => d.id !== c.id); n++;
    });
    if (n) S.stats.glass += n;
    return n;
  }
  function afterPlay(S, cs, ev) {
    ev.shattered = shatter(S, cs);
    if (ev.shattered) ev.tags.push("Shatter");
    S.stats.gold += cs.filter((c) => c.e === "gold").length;
    reveal(S);
    ev.drawn = draw(S, roundHandSize(S) - S.hand.length).length;
    S.plays += 1; S.stats.plays += 1;
  }
  function play(S) {
    if (S.phase !== "round") return null;
    const e = evalSel(S);
    if (!e.ace && S.playsLeft <= 0) return null;
    if (e.ace) {
      const cs = removeSel(S, false);
      S.played = cs.slice(); S.rung = null; S.stats.aces += 1; S.races += 1;
      S.log.push({ t: "Ace in the Hole", c: "rung reset · chain ×" + chainPos(S) + " kept", p: "", cls: "bonus" });
      const ev = { type: "ace", pts: 0, tags: ["Ace in the Hole"] };
      afterPlay(S, cs, ev);
      return ev;
    }
    if (!e.k || !e.legal) return null;
    const k = e.k, prev = S.rung, cs = removeSel(S, true);
    const tags = [];
    if (S.chain === 0 && k.kind === 1 && k.rank <= 3) tags.push("Humble");
    if (sameShape(k, prev) && k.rank === prev.rank + 1) tags.push("Tight Step");
    if (sameShape(k, prev) && k.rank - prev.rank >= 4) tags.push("Overkill");
    const bomb = isBomb(k);
    if (bomb) { tags.push("Bomb!"); S.stats.quads += 1; }
    if (k.kind === 4 && k.size >= 7) tags.push("Long Run");
    if (k.kind === 3 && k.size >= 6) tags.push("Staircase");
    S.score += e.pts; S.playsLeft -= 1;
    S.lastSuit = leadSuit(cs);
    if (!S.firstK) S.firstK = k; S.lastK = k; S.rkinds[k.kind] = (S.rkinds[k.kind] || 0) + 1; if (bomb) S.rbombs += 1;
    /* Η βόμβα σκάει: 1000 σταθερά, το τραπέζι ανοίγει, η αλυσίδα συνεχίζει κανονικά. */
    S.chain += 1;
    S.rung = bomb ? null : { kind: k.kind, rank: Math.min(14, k.rank + (chal(S) === "sticky" ? 1 : 0)), size: k.size };
    { const pos = chainPos(S); if (pos > S.rmax) S.rmax = pos;
      if (pos > S.stats.maxChain) S.stats.maxChain = pos;
      if (pos >= 7) { S.stats.chain7 = 1; if (pos === 7) tags.push("Ladder to Heaven"); } }
    S.played = cs.slice();
    S.log.push({ t: clabel(k), c: e.base + (e.factor > 1 ? "×" + e.factor : "") + " × " + e.pos + (e.hm !== 1 ? " ×" + e.hm : "") + (bomb ? " · table opens" : ""), p: e.pts });
    tags.sort((a, b) => TAG_ORDER.indexOf(a) - TAG_ORDER.indexOf(b));
    const ev = { type: "play", k, pts: e.pts, pos: e.pos, notes: e.notes, tags, bomb };
    afterPlay(S, cs, ev);
    return ev;
  }
  const canDiscard = (S) => S.phase === "round" && chal(S) !== "nodiscard" && S.discards > 0 && S.sel.length > 0 && S.sel.length <= CFG.discardCards && S.pile.length > 0;
  function discard(S) {
    if (!canDiscard(S)) return false;
    const cs = removeSel(S, true);
    S.discards -= 1; S.rdisc += 1;
    const d = draw(S, roundHandSize(S) - S.hand.length);
    S.log.push({ t: "Discard", c: cs.length + " out, " + d.length + " in", p: "", cls: "pass" });
    return true;
  }
  const canPass = (S) => S.phase === "round" && !!S.rung && chal(S) !== "nopass" && chal(S) !== "summit" && (S.breaths > 0 || (has(S, "wind") && S.passes === 0));
  function pass(S) {
    if (!canPass(S)) return false;
    const free = has(S, "wind") && S.passes === 0;
    if (!free) S.breaths -= 1;
    S.passes += 1;
    const was = chainPos(S);
    /* Το Pass κρατά τη μισή αλυσίδα (στρογγυλά πάνω)· με Cheap Breath ολόκληρη. */
    const np = has(S, "cheap") ? was : Math.max(1, Math.ceil(was / 2));
    S.chain = Math.max(0, np - 1 - S.chainStart);
    S.rung = null; S.sel = []; S.played = [];
    S.log.push({ t: "Pass", c: (free ? "free · " : "") + "chain ×" + was + " → ×" + chainPos(S), p: free ? "" : "−1", cls: "pass" });
    return true;
  }
  function chisel(S, i, nr) {
    if (S.phase !== "round" || S.chisel <= 0 || !S.hand[i] || S.hand[i].h || isWild(S.hand[i]) || nr < 2 || nr > 14) return false;
    const old = S.hand[i].r;
    S.hand[i] = Object.assign({}, S.hand[i], { r: nr }); S.hand.sort(cmp);
    S.chisel -= 1; S.sel = [];
    S.log.push({ t: "Chisel", c: rname(old) + " → " + rname(nr), p: "", cls: "bonus" });
    return true;
  }
  const canRaise = (S) => S.phase === "round" && !S.raised && S.score >= target(S) && S.playsLeft > 0;
  function raise(S) {
    if (!canRaise(S)) return false;
    const mul = has(S, "gambler") ? CFG.gamblerMul : CFG.raiseMul;
    S.raised = true; S.raiseTarget = Math.round(target(S) * mul);
    S.log.push({ t: "Raise", c: "target → " + S.raiseTarget, p: "", cls: "bonus" });
    return true;
  }
  /* Κατάσταση συμβολαίου: ok (ισχύει ακόμη), done (πέτυχε), broken, pending. */
  function contractStatus(S) {
    const id = S.contract; if (!id) return null;
    const k = S.rkinds || {};
    switch (id) {
      case "c_nopass": return S.passes > 0 ? "broken" : "ok";
      case "c_nodisc": return (S.rdisc || 0) > 0 ? "broken" : "ok";
      case "c_noace": return (S.races || 0) > 0 ? "broken" : "ok";
      case "c_full": return S.lastK && S.lastK.kind === 5 ? (S.playsLeft === 0 ? "done" : "ok") : "pending";
      case "c_str3": return (k[4] || 0) >= 3 ? "done" : "pending";
      case "c_chain6": return (S.rmax || 0) >= 6 ? "done" : "pending";
      case "c_all": return S.playsLeft === 0 ? "done" : "pending";
      case "c_bomb": return (S.rbombs || 0) > 0 ? "done" : "pending";
      case "c_low": return !S.firstK ? "pending" : S.firstK.kind === 1 && S.firstK.rank <= 4 ? "done" : "broken";
      case "c_stairs": return (k[3] || 0) >= 1 ? "done" : "pending";
      case "c_pairs": return (k[8] || 0) >= 1 ? "done" : "pending";
    }
    return null;
  }
  const contractMet = (S) => { const st = contractStatus(S); if (!st) return false; if (S.contract === "c_full") return !!(S.lastK && S.lastK.kind === 5); if (S.contract === "c_all") return S.playsLeft === 0; return st === "done" || st === "ok"; };
  const contractBonus = (S) => { const c = contractById[S.contract]; if (!c) return 0; return c.pct ? Math.round(S.score * c.pct / 100) : c.flat; };
  function chooseContract(S, id) { if (S.phase !== "shop") return false; if (id && S.contractOffers.indexOf(id) < 0) return false; S.contract = id || null; return true; }
  /* Κόλλησες όταν καμία κίνηση δεν αλλάζει τίποτα. */
  const over = (S) => S.phase === "round" && S.playsLeft <= 0;
  function stuck(S) {
    if (S.phase !== "round") return false;
    if (S.playsLeft <= 0) return true;
    if (hasLegal(S)) return false;
    if (chal(S) !== "nodiscard" && S.discards > 0 && S.pile.length > 0 && S.hand.length) return false;
    if (S.rung && (canPass(S) || aceIndex(S) >= 0)) return false;
    return true;
  }
  function stuckReason(S) {
    if (S.playsLeft <= 0) return "No plays left. Round over.";
    if (!S.rung) return S.pile.length ? "No hand in these cards and no discards left. Round over." : "The pile is dry and nothing climbs. Round over.";
    if (aceIndex(S) >= 0) return "Nothing climbs. An Ace alone resets the rung and keeps the chain.";
    if (canPass(S)) return "Nothing climbs. Pass to reset — costs a breath, keeps half the chain.";
    if (chal(S) !== "nodiscard" && S.discards > 0 && S.pile.length) return "Nothing climbs. Discard and draw.";
    if (chal(S) === "nodiscard") return "Nothing climbs, and discarding is off. Round over.";
    if (chal(S) === "summit" || chal(S) === "nopass") return "Nothing climbs, and passing is off. Round over.";
    return "Nothing climbs, no breaths, no discards left. Round over.";
  }
  function finish(S) {
    if (S.phase !== "round") return null;
    const T = target(S);
    let contract = null;
    if (S.contract) {
      const c = contractById[S.contract], met = contractMet(S), bonus = met ? contractBonus(S) : 0;
      if (bonus) { S.score += bonus; S.log.push({ t: "Contract · " + c.name, c: c.pct ? "+" + c.pct + "%" : "", p: bonus, cls: "bonus" }); }
      contract = { id: c.id, name: c.name, met, bonus };
    }
    const perfect = S.passes === 0 && (S.rdisc || 0) === 0 && S.playsLeft === 0;
    if (S.score < T) { S.phase = "lost"; return { cleared: false, contract }; }
    const ex = S.score - T;
    let earn = (CFG.rewardBase + Math.min(CFG.rewardCap, Math.floor(ex / Math.max(1, T * CFG.rewardFrac)))) * (chal(S) === "richair" ? 2 : 1), raiseResult = null;
    if (S.raised) {
      if (S.score >= S.raiseTarget) { earn *= has(S, "gambler") ? 3 : CFG.raisePayout; raiseResult = "won"; S.stats.raiseWon += 1; S.log.push({ t: "Raise won", c: "", p: "+" + earn, cls: "bonus" }); }
      else { earn = 0; raiseResult = "lost"; S.log.push({ t: "Raise lost", c: "payout ×0", p: "", cls: "pass" }); }
    }
    let interest = 0;
    if (has(S, "vault")) { interest = Math.min(5, Math.floor(S.money / 5)); }
    const perfectChips = perfect ? CFG.perfectChips : 0;
    S.money += earn + interest + perfectChips;
    if (S.ante === TARGETS.length - 1) { S.phase = "won"; return { cleared: true, won: true, ex, earn, interest, raiseResult, contract, perfect, perfectChips }; }
    S.phase = "shop"; S.rerolls = 0;
    S.keep = S.hand.map((_, i) => i);
    S.offers = makeOffers(S);
    S.contract = null;
    const pool = CONTRACTS.map((c) => c.id); S.contractOffers = [];
    for (let i = 0; i < 2 && pool.length; i++) S.contractOffers.push(pool.splice(Math.floor(next(S) * pool.length), 1)[0]);
    return { cleared: true, won: false, ex, earn, interest, raiseResult, contract, perfect, perfectChips };
  }

  /* ============================== κατάστημα ============================== */
  const charmAvailable = (S, c) => !has(S, c.id) && (!c.lock || S.unlocked.indexOf(c.id) >= 0);
  function makeOffers(S) {
    const out = [];
    const up = POOL.filter((o) => (o.id !== "th" || S.removed.length < 5) && (!CFG.maxBuy[o.id] || (S.bought[o.id] || 0) < CFG.maxBuy[o.id])).map((o) => o.id);
    for (let i = 0; i < CFG.offersUp && up.length; i++) out.push({ kind: "up", id: up.splice(Math.floor(next(S) * up.length), 1)[0], bought: false });
    const keys = Object.keys(ENH), tw = keys.reduce((a, k) => a + ENH[k].w, 0);
    for (let i = 0; i < CFG.offersCard; i++) {
      let x = next(S) * tw, e = keys[0];
      for (const k of keys) { x -= ENH[k].w; if (x <= 0) { e = k; break; } }
      out.push({ kind: "card", card: { r: 2 + Math.floor(next(S) * 13), si: Math.floor(next(S) * 4), e }, bought: false });
    }
    const ch = CHARMS.filter((c) => charmAvailable(S, c)).map((c) => c.id);
    for (let i = 0; i < CFG.offersCharm && ch.length; i++) out.push({ kind: "charm", id: ch.splice(Math.floor(next(S) * ch.length), 1)[0], bought: false });
    return out;
  }
  function offerCost(S, o) {
    let c;
    if (o.kind === "card") c = ENH[o.card.e].cost;
    else if (o.kind === "charm") c = charmById[o.id].cost;
    else { const n = (S.bought && S.bought[o.id]) || 0; c = Math.round(poolById[o.id].cost * (1 + CFG.priceStep * n)); }
    if (has(S, "thrift")) c = Math.max(1, c - 2);
    return c;
  }
  const rerollCost = (S) => Math.max(1, CFG.rerollCost + CFG.rerollStep * S.rerolls - (has(S, "thrift") ? 2 : 0));
  function reroll(S) {
    if (S.phase !== "shop" || S.money < rerollCost(S)) return false;
    S.money -= rerollCost(S); S.rerolls += 1;
    S.offers = makeOffers(S);
    return true;
  }
  function canBuy(S, i) {
    const o = S.offers[i];
    if (S.phase !== "shop" || !o || o.bought) return { ok: false, why: "gone" };
    if (offerCost(S, o) > S.money) return { ok: false, why: "chips" };
    if (o.kind === "charm" && S.charms.length >= S.charmSlots) return { ok: false, why: "full" };
    return { ok: true };
  }
  function buy(S, i) {
    if (!canBuy(S, i).ok) return false;
    const o = S.offers[i];
    S.money -= offerCost(S, o);
    if (o.kind === "card") S.deck.push(Object.assign({ id: S.nextId++ }, o.card));
    else if (o.kind === "charm") S.charms.push(o.id);
    else apply(S, o.id);
    o.bought = true;
    return true;
  }
  function sell(S, idx) {
    if (S.phase !== "shop" || !S.charms[idx]) return false;
    const c = charmById[S.charms[idx]];
    S.money += Math.ceil(c.cost / 2);
    S.charms.splice(idx, 1);
    return true;
  }
  /* Στο κατάστημα: κάθε φύλλο είναι κρατημένο εξ ορισμού· το πάτημα το βγάζει (θα αντικατασταθεί). */
  function toggleKeep(S, i) {
    if (S.phase !== "shop" || !S.hand[i]) return false;
    S.keep = S.keep || [];
    const at = S.keep.indexOf(i);
    if (at >= 0) S.keep.splice(at, 1); else S.keep.push(i);
    return true;
  }
  function nextAnte(S) { if (S.phase !== "shop") return false; S.ante += 1; startRound(S); return true; }
  const upcoming = (S) => (S.chals[S.ante + 1] ? chalById[S.chals[S.ante + 1]] : null);
  const current = (S) => (S.chal ? chalById[S.chal] : null);
  const currentRule = (S) => (rule(S) ? ruleById[rule(S)] : null);
  const upcomingRule = (S) => { const a = S.ante + 1; return !S.chals[a] && S.rules && S.rules[a] ? ruleById[S.rules[a]] : null; };
  const nextTarget = (S) => { const a = S.ante + 1, id = S.chals[a]; if (a >= TARGETS.length) return null; return Math.round(TARGETS[a] * (id === "richair" ? CFG.richAirMul : id ? CFG.chalTargetMul : 1)); };
  const peek = (S) => (has(S, "scout") && S.pile.length ? S.pile[S.pile.length - 1] : null);

  /* ============================== σειριοποίηση ============================== */
  const serialize = (S) => JSON.stringify(S);
  function restore(json) { try { const S = JSON.parse(json); if (!S || S.v !== 4 || !Array.isArray(S.hand) || !Array.isArray(S.pile)) return null; return S; } catch (e) { return null; } }
  const todaySeed = (d) => { d = d || new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };

  return {
    SUITS, KINDS, BY_TIER, TARGETS, CONTRACTS, contractById, RULES, ruleById, CFG, POOL, kbase, isBomb, sameShape, beats, poolById, ENH, CHARMS, charmById, CHALLENGES, chalById, rname,
    newRun, startRound, target, goal, nextTarget, roundHandSize,
    classify, isLegal, chainPos, scoreOf, evalSel, clabel, crange, beatText, isAce, isWild, isFace, leadSuit, over,
    candidates, legalMoves, hasLegal, cheapest, suggest, aceIndex, orphans,
    toggle, reveal, play, discard, canDiscard, pass, canPass, raise, canRaise, chisel, stuck, stuckReason, finish,
    makeOffers, offerCost, rerollCost, reroll, canBuy, buy, sell, toggleKeep, nextAnte, upcoming, current, currentRule, upcomingRule, peek, has,
    contractStatus, contractMet, contractBonus, chooseContract,
    serialize, restore, todaySeed,
  };
});
