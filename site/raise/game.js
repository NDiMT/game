/* RAISE — καθαρή λογική παιχνιδιού (v5: Chips × Mult, προαιρετική αλυσίδα, discards ανά γύρο).
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
  /* Συνδυασμοί κατά Tichu. size = φύλλα. Βόμβες χτυπούν οτιδήποτε.
     Η ονομαστική σκάλα είναι ×6,6 από ζευγάρι σε στρέιτ φλας, με τη ΚΟΡΥΦΗ μαζεμένη:
     εκεί γεννιόταν το «ένα χέρι κάλυψε ολόκληρο το ante». Ήταν ×4 (τα ζευγάρια έπαιρναν
     τα πάντα) και μετά ×21 — που έσπασε αλλιώς: ένα τυχερό φουλ κάλυπτε ΟΛΟΚΛΗΡΟ το ante.
     Μετρημένο, το μεγαλύτερο χέρι ήταν 1,5× ο στόχος και ο γύρος τελείωνε στο 2ο παίξιμο.
     Στο Balatro ένα χέρι είναι κλάσμα του blind και θέλεις τρία-τέσσερα. Ο λόγος δύο άσοι
     προς δύο τριάρια μένει καρφωμένος στο ×1,44 — το φύλλο μετράει λίγο, το σχήμα αρκετά. */
  /* tier = σειρά ισχύος (ανώτερο χτυπάει κατώτερο). Το kind μένει σταθερό για τα saves. */
  /* Κάθε χέρι έχει Chips και Mult (όπως στο Balatro). cstep/mstep = ανά επιπλέον βήμα μήκους. */
  const KINDS = [null,
    { id: "pair", name: "Pair", short: "PAIR", chips: 25, mult: 3, size: 2, tier: 1 },
    { id: "trips", name: "Trips", short: "TRIPS", chips: 34, mult: 5, size: 3, tier: 3 },
    { id: "stairs", name: "Stairs", short: "STAIRS", chips: 36, mult: 5, cstep: 8, mstep: 1, min: 4, tier: 4 },
    { id: "straight", name: "Straight", short: "STR8", chips: 38, mult: 5, cstep: 7, mstep: 1, min: 5, tier: 5 },
    { id: "full", name: "Full House", short: "FULL", chips: 42, mult: 6, size: 5, tier: 6 },
    { id: "quads", name: "Quads", short: "QUADS", chips: 50, mult: 7, size: 4, bomb: true, tier: 7 },
    { id: "sflush", name: "Straight Flush", short: "SFLUSH", chips: 62, mult: 8, cstep: 8, mstep: 1, min: 5, bomb: true, tier: 8 },
    { id: "pairs", name: "Two Pair", short: "PAIRS", chips: 30, mult: 4, cstep: 8, mstep: 1, min: 4, tier: 2 },
    /* Ο μοναχικός άσος: το φθηνότερο χέρι και το πρώτο σκαλί κάθε αλυσίδας. */
    { id: "single", name: "Ace", short: "ACE", chips: 15, mult: 2, size: 1, tier: 0 },
  ];
  const BY_TIER = KINDS.slice(1).sort((a, b) => a.tier - b.tier);
  /* Ποια σχήματα πιάνει κάθε αναβάθμιση, και πόσο Mult δίνει. Μετρημένο: τα ζευγάρια είναι
     το 74% των χεριών, τα σχήματα το 15%, οι βόμβες το 1% — άρα το βήμα μεγαλώνει όσο πιο
     σπάνιο είναι το σχήμα, αλλιώς η προσφορά είναι νεκρή (Sets+ έβγαζε Δ +0,10 στα 60 runs). */
  const MULT_KIND = { m1: [1, 8], m2: [2, 3, 4, 5, 6, 7] };
  const MULT_STEP = { m1: 1, m2: 2 };
  /* Πόσα βήματα μήκους πάνω από το ελάχιστο: ζεύγη/σκάλες μετρούν ζευγάρια, κέντες φύλλα. */
  const kunits = (k) => (k.kind === 3 || k.kind === 8 ? k.size / 2 - 2 : k.kind === 4 || k.kind === 7 ? k.size - 5 : 0);
  const kchips = (k) => { const K = KINDS[k.kind]; return K.chips + (K.cstep || 0) * kunits(k); };
  const kmult = (k) => { const K = KINDS[k.kind]; return K.mult + (K.mstep || 0) * kunits(k); };
  /* Ονομαστική αξία του σχήματος (χωρίς φύλλα): για ταξινόμηση και για τον πίνακα πληρωμών. */
  const kbase = (k) => kchips(k) * kmult(k);
  const isBomb = (k) => !!k && !!KINDS[k.kind].bomb;
  /* 50 antes. Κάθε στόχος είναι το h(a)-ποσοστημόριο των σκορ όσων φτάνουν εκεί, με τον ρυθμό
     θανάτου h να πάει από 3% (ante 1) σε 20% (ante 50):
     `HAZ=12 H1=0.03 H30=0.20 node tools/tune.js 220 50`. */
  const TARGETS = [720, 850, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600, 3000, 3200, 3700, 4300, 4600, 5100, 5800, 5900, 6400, 7200, 7600, 8200, 9300, 9900, 11000, 12000, 13000, 14000, 15000, 16000, 17000, 20000, 21000, 22000, 25000, 26000, 28000, 30000, 32000, 34000, 37000, 39000, 41000, 45000, 48000, 49000, 56000, 62000, 67000];
  const CFG = {
    handSize: 8, plays: 5, discards: 2, jokers: 2,
    /* Η αλυσίδα ΠΟΛΛΑΠΛΑΣΙΑΖΕΙ το Mult του χεριού, δεν του προσθέτει.
       Ως πρόσθεση ευνοούσε δυσανάλογα τα μικρά χέρια: +6 Mult σε ζευγάρι (βάση 3) το τριπλασίαζε,
       στο φουλ (βάση 14) το ανέβαζε 43% — γι' αυτό το bot έπαιζε 69% ζευγάρια. Ως πολλαπλασιαστής
       δίνει σε όλους το ίδιο ποσοστό, οπότε αποφασίζει το σχήμα. Κάθε σκαλί: +35%. */
    chainStep: 0.22,
    /* Το πρώτο ανέβασμα μετράει ήδη ένα σκαλί: κάθε χέρι που ανεβαίνει παίρνει τουλάχιστον +1 Mult.
       Είναι το πάτωμα της αλυσίδας — μαζεύει την ουρά p10 χωρίς να πειράζει την κορυφή. */
    chainFloor: 1,
    /* Οροφή στο Mult που δίνει η αλυσίδα — δένει Climber/Tempo, που αλλιώς έτρεχαν ως +30. */
    chainStepCap: 8,
    /* Οροφή στο γινόμενο των ενισχυμένων φύλλων και στο γινόμενο charms/κανόνων ενός χεριού. */
    /* Οροφή στα ενισχυμένα φύλλα και στα charms. Χαμηλά επίτηδες: στο Balatro οι xMult
       ισχύουν σε ΚΑΘΕ χέρι· εδώ οι μεγάλοι πολλαπλασιαστές ήταν δεμένοι σε ένα παίξιμο
       (Encore, Mirror) και έφτιαχναν ακριβώς το «ένα φουλ καθαρίζει το ante». */
    enhCap: 3, hmCap: 3,
    /* ενισχύσεις: δεν αγοράζονται· «σκάνε» τυχαία σε φύλλα που τραβάς μέσα στον γύρο */
    enhChance: 0.06, enhWeights: { silver: 55, gold: 25, wild: 20 }, jokerCap: 4,
    /* Ρυθμός: κάθε 3η πίστα είναι challenge ΚΑΙ η μόνη που πληρώνει — ένα perk και ένα charm.
       Οι άλλες δύο περνούν χωρίς στάση: φτάνεις τον στόχο, συνεχίζεις. */
    rewardEvery: 3, offers: 3, chainCap: 6, lowCeiling: 4,
    /* Τέσσερις θέσεις, και τέλος. Με τόσο λίγες, το κάθε charm πρέπει να είναι στύλος του
       build — γι' αυτό όλα τα bonus ανέβηκαν μαζί με τα πλαφόν. */
    charmSlots: 4,
    chalTargetMul: 0.9, thinAirCap: 2, ruleChance: 0.75, highGroundRank: 8, shortHand: 7, richAirMul: 1.15, blindCount: 3, blindKeep: 1,
    maxBuy: { cs: 3, wi: 2, di: 2, pl: 1, gt: 1, m1: 20, m2: 20 },
  };

  const POOL = [
    { id: "m1", name: "Pairs +", desc: "Pairs and two pair: +1 Mult" },
    { id: "m2", name: "Big Hands +", desc: "Trips, stairs, straights, full houses and bombs: +2 Mult" },
    { id: "pl", name: "Extra Play", desc: "+1 play a round" },
    { id: "di", name: "Nimble Hands", desc: "+1 discard a round" },
    { id: "wi", name: "Wide Hand", desc: "Hold one more card" },
    { id: "cs", name: "Head Start", desc: "The chain starts a step higher" },
    { id: "th", name: "Cull", desc: "Drop the lowest rank from your deck, for good" },
    /* μόνο από τη μέση του run και μετά */
    { id: "gt", name: "Golden Touch", desc: "Every Ace in your deck turns Gold", min: 8 },
  ];
  const poolById = Object.fromEntries(POOL.map((o) => [o.id, o]));

  const ENH = {
    gold: { name: "Gold", desc: "Mult ×2 when played — they stack, up to ×3" },
    wild: { name: "Joker", desc: "Any rank, any suit — and an Ace" },
    silver: { name: "Silver", desc: "Mult ×1.5 when played — the common cousin of Gold" },
  };

  /* Charms: παθητικά εφέ. `lock` = συνθήκη ξεκλειδώματος (UI, lifetime stats). */
  const CHARMS = [
    { id: "climber", name: "Climber", glyph: "↑", desc: "Every chain step counts double" },
    { id: "patient", name: "Patient", glyph: "◷", desc: "+3 Mult for every discard you still hold" },
    { id: "ladder", name: "Ladder", glyph: "≡", desc: "Same hand exactly one rank higher: this hand scores two chain steps higher" },
    { id: "leap", name: "Overkill", glyph: "⤒", desc: "Same hand four ranks or more above the rung: Mult ×2" },
    { id: "lowroad", name: "Low Road", glyph: "2", desc: "Pairs of 2 to 6: Mult ×2, and +40 Chips" },
    { id: "court", name: "Court", glyph: "♛", desc: "A face card in the hand you play: +60 Chips" },
    { id: "loyal", name: "Loyalty", glyph: "♠", desc: "Same lead suit as your last play: a chain step higher, and +60 Chips on the way up" },
    { id: "cheap", name: "Slipstream", glyph: "~", desc: "A broken chain drops one step instead of resetting" },
    { id: "wind", name: "Second Wind", glyph: "∞", desc: "The first two breaks of the round keep everything" },
    { id: "sleight", name: "Sleight", glyph: "✂", desc: "+3 discards a round" },
    { id: "encore", name: "Encore", glyph: "⧗", desc: "Your last play of the round: Mult ×2" },
    { id: "mirror", name: "Mirror", glyph: "◐", desc: "First hand of the round: Mult ×2 and two chain steps" },
    { id: "scout", name: "Scout", glyph: "◉", desc: "See the next three cards — and your first discard each round is free" },
    { id: "kingmaker", name: "Kingmaker", glyph: "A", desc: "Every Ace in the hand you play: +45 Chips" },
    { id: "afterburner", name: "Afterburner", glyph: "»", desc: "The hand after a bomb: Mult ×2.5" },
    { id: "goldsmith", name: "Goldsmith", glyph: "★", desc: "Gold cards: Mult ×3", lock: { key: "gold", n: 3, text: "Play 3 Gold cards" } },
    { id: "summiteer", name: "Summiteer", glyph: "▲", desc: "Bombs: Mult ×2", lock: { key: "quads", n: 3, text: "Play 3 bombs" } },
    { id: "ember", name: "Ember", glyph: "✦", desc: "Chain ×4 and above: Mult ×1.8", lock: { key: "chain7", n: 1, text: "Reach chain ×6" } },
  ];
  const charmById = Object.fromEntries(CHARMS.map((c) => [c.id, c]));

  const CHALLENGES = [
    { id: "noace", name: "No Aces", desc: "Aces cannot be played at all — but you hold one more card. Jokers still work.", tell: "The Warden. No Ace leaves the cell.", tip: "They are dead weight — spend a discard and be rid of them." },
    { id: "short", name: "Short Hand", desc: "You hold seven cards — and get one more discard.", tell: "The Pickpocket. One card lighter.", tip: "Throw more, to find the shapes anyway." },
    { id: "blind", name: "Blind Deal", desc: "Three cards start face down, and one of the cards you draw stays down after every play. A discard turns them all up.", tell: "The Dealer. Face down, no questions.", tip: "A discard is how you look." },
    { id: "highground", name: "High Ground", desc: "Nothing under a pair of 8 climbs — all round.", tell: "The Bouncer. Small hands do not get in.", tip: "Lone Aces and low pairs still score, but the chain will not move." },
    { id: "onedisc", name: "One Discard", desc: "A single discard this round.", tell: "The Diver. One dive, no coming up.", tip: "Save it for a hand you truly cannot use." },
    { id: "thinair", name: "Thin Air", desc: "The chain caps at ×2.", tell: "The Altitude. The air runs out at ×2.", tip: "Big hands, not long chains." },
    { id: "richair", name: "Rich Air", desc: "Target ×1.15, and five offers instead of three.", tell: "The Patron. Asks more, gives more.", tip: "A harder round for a better pick." },
    { id: "nodiscard", name: "No Discards", desc: "No discards — but you hold one more card.", tell: "The Miser. What you hold is what you play.", tip: "A bigger hand instead of a second chance." },
    { id: "fewplays", name: "Four Plays", desc: "One play fewer.", tell: "The Clock. Four swings.", tip: "Every hand must count double." },
    { id: "sticky", name: "Sticky Rung", desc: "After every play the rung climbs two more ranks.", tell: "The Escalator. It climbs without you.", tip: "Jump kinds instead of ranks." },
    { id: "summit", name: "The Summit", desc: "A hand that does not climb scores nothing.", tell: "The Summit. One clean ascent.", tip: "Bring Aces and a bomb." },
  ];
  const chalById = Object.fromEntries(CHALLENGES.map((c) => [c.id, c]));
  /* Συμβόλαια: ένας προαιρετικός στόχος ανά γύρο, τυχαίος (seeded). pct = % του σκορ του γύρου. */
  /* Κανόνες τραπεζιού: ένας μικρός θετικός ή αρνητικός κανόνας στα antes χωρίς challenge. */
  const RULES = [
    { id: "r_red", name: "Red Night", desc: "Hands led by red cards: Mult ×1.5." },
    { id: "r_black", name: "Black Night", desc: "Hands led by black cards: Mult ×1.5." },
    { id: "r_head", name: "Running Start", desc: "The chain starts at ×2." },
    { id: "r_cap", name: "Low Ceiling", desc: "The chain caps at ×4." },
    { id: "r_pair0", name: "Cheap Pairs", desc: "Single pairs score no Chips — but still climb." },
    { id: "r_str2", name: "Runway", desc: "Plain straights: Mult ×2." },
    { id: "r_trips2", name: "Triplets", desc: "Trips: Mult ×2." },
    { id: "r_full2", name: "Open House", desc: "Full houses: Mult ×2." },
    { id: "r_low2", name: "Underdogs", desc: "Hands topped by a 6 or lower, bombs aside: Mult ×2." },
    { id: "r_gift", name: "Spare Card", desc: "One more discard this round." },
  ];
  const ruleById = Object.fromEntries(RULES.map((r) => [r.id, r]));
  const RANDOM_CHALLENGES = CHALLENGES.filter((c) => c.id !== "summit").map((c) => c.id);

  /* Τράπουλες: διαφορετικό ξεκίνημα. lock = επίτευγμα ζωής (best = καλύτερο ante). */
  const DECKS = [
    { id: "classic", name: "Classic", desc: "52 cards and two Jokers.", glyph: "♠" },
    { id: "wild", name: "Wild Deck", desc: "Four Jokers. Jokers pop up twice as often.", glyph: "★", lock: { key: "best", n: 10, text: "Clear ante 10" } },
    { id: "headless", name: "Headless", desc: "No Aces — only a Joker opens the rung. The chain starts two steps higher.", glyph: "♛", lock: { key: "best", n: 20, text: "Clear ante 20" } },
  ];
  const deckById = {}; DECKS.forEach((d) => { deckById[d.id] = d; });

  /* Συνέργειες: δύο charms μαζί ξεκλειδώνουν ένα τρίτο εφέ. */
  const SYNERGIES = [
    { id: "royal", a: "kingmaker", b: "loyal", name: "Royal Court", desc: "Aces are worth +90 Chips instead of +45." },
    { id: "reaction", a: "afterburner", b: "summiteer", name: "Chain Reaction", desc: "The hand after a bomb: Mult ×3.5 instead of ×2.5." },
    { id: "backstairs", a: "lowroad", b: "ladder", name: "Back Stairs", desc: "A tight step onto a low pair scores one more chain step — three in all." },
    { id: "lockstep", a: "ladder", b: "loyal", name: "Lockstep", desc: "Ladder and Loyalty together: one more step on top." },
    { id: "bookends", a: "encore", b: "mirror", name: "Bookends", desc: "A last hand of the same kind as your first: Mult ×3 instead of ×2." },
    { id: "tempo", a: "climber", b: "patient", name: "Tempo", desc: "Every chain step counts triple." },
    { id: "lungs", a: "cheap", b: "wind", name: "Deep Lungs", desc: "A broken chain never falls below ×3." },
    { id: "jewels", a: "court", b: "goldsmith", name: "Crown Jewels", desc: "A Gold face card adds +120 Chips instead of +60." },
  ];
  const synById = {}; SYNERGIES.forEach((s) => { synById[s.id] = s; });
  /* Ποιο «όνομα» φωνάζει η οθόνη όταν ένα χέρι αξίζει περισσότερα από ένα. */
  const TAG_ORDER = ["Bomb!", "Ladder to Heaven", "Ace", "Chain broken", "Overkill", "Long Run", "Staircase", "Mirror", "Tight Step", "Humble"];

  /* ============================== RNG ============================== */
  function hash(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return (h ^ (h >>> 16)) >>> 0; }
  function next(S) { S.rng = (S.rng + 0x6d2b79f5) | 0; let t = Math.imul(S.rng ^ (S.rng >>> 15), 1 | S.rng); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  function shuffle(S, a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(next(S) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  /* ============================== helpers ============================== */
  const has = (S, id) => S.charms.indexOf(id) >= 0;
  const chal = (S) => S.chal || null;
  const syn = (S, id) => { const s = synById[id]; return !!s && has(S, s.a) && has(S, s.b); };
  const activeSynergies = (S) => SYNERGIES.filter((s) => has(S, s.a) && has(S, s.b));
  /* Συνέργειες που θα ενεργοποιούσε το charm `id` με όσα ήδη κρατάς. */
  const synergyFor = (S, id) => SYNERGIES.filter((s) => (s.a === id && has(S, s.b)) || (s.b === id && has(S, s.a)));
  /* Στόχος πέρα από το 30 (Endless): ×1.15 ανά ante. */
  const tgtAt = (a) => (a < TARGETS.length ? TARGETS[a] : Math.round(TARGETS[TARGETS.length - 1] * Math.pow(1.15, a - TARGETS.length + 1)));
  const rule = (S) => (S.chal ? null : (S.rules && S.rules[S.ante]) || null);
  /* Κάθε 3η πίστα: challenge και ανταμοιβή μαζί — αλλά ΕΝΑ πράγμα, εναλλάξ.
     Σταθμός 1 perk, σταθμός 2 charm, σταθμός 3 perk… Ένα charm κάθε έξι πίστες, τρεις θέσεις:
     το build κλειδώνει νωρίς και μετά χτίζεις γύρω του με perks. */
  const isReward = (a) => a % CFG.rewardEvery === CFG.rewardEvery - 1;
  const rewardKind = (a) => (Math.floor(a / CFG.rewardEvery) % 2 === 0 ? "up" : "charm");
  const cmp = (a, b) => a.r - b.r || a.si - b.si;
  const isWild = (c) => !!c && c.e === "wild";
  const isAce = (c) => !!c && (c.r === 14 || isWild(c));
  const isFace = (c) => !!c && !isWild(c) && c.r >= 11 && c.r <= 13;
  /* No Aces: οι άσοι παγώνουν τελείως — δεν παίζονται ούτε μόνοι ούτε μέσα σε χέρι.
     Ο τζόκερ δεν είναι άσος εδώ: μένει μπαλαντέρ. */
  const frozen = (S, c) => chal(S) === "noace" && !isWild(c) && c.r === 14;

  function apply(S, id) {
    switch (id) {
      case "m1": case "m2": MULT_KIND[id].forEach((k) => { S.mult[k] += MULT_STEP[id]; }); break;
      case "pl": S.playsMax += 1; break;
      case "di": S.discMore = (S.discMore || 0) + 1; break;
      case "wi": S.handSize += 1; break;
      case "cs": S.chainStart += 1; break;
      case "gt": S.deck.concat(S.hand).forEach((c) => { if (c.r === 14 && !c.e) c.e = "gold"; }); break;
      case "th": {
        const ranks = S.deck.filter((c) => !isWild(c)).map((c) => c.r);
        if (!ranks.length) break;
        const lo = Math.min.apply(null, ranks);
        S.deck = S.deck.filter((c) => isWild(c) || c.r !== lo);
        /* «Για πάντα» σημαίνει και από το χέρι: αλλιώς κουβαλάς το κομμένο φύλλο από γύρο σε γύρο. */
        S.hand = S.hand.filter((c) => isWild(c) || c.r !== lo);
        S.removed.push(lo);
        break;
      }
    }
    S.bought[id] = (S.bought[id] || 0) + 1;
  }

  /* ============================== run ============================== */
  function newRun(seedStr, unlocked, deckId) {
    const seed = String(seedStr || "").trim() || String(Math.floor(Math.random() * 1e9));
    const D = deckById[deckId] || DECKS[0];
    const S = {
      v: 12, seed, rng: hash(seed) | 0, deckId: D.id, endless: false,
      ante: 0, phase: "round", offers: [], picks: 0, nOffers: CFG.offers,
      handSize: CFG.handSize, playsMax: CFG.plays, discMore: 0, chainStart: 0,
      hand: [],
      mult: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], removed: [], bought: {},
      deck: [], nextId: 1, charms: [], charmSlots: CFG.charmSlots,
      unlocked: (unlocked || []).slice(),
      chals: {}, rules: {},
      stats: { quads: 0, gold: 0, silver: 0, chain7: 0, maxChain: 0, plays: 0, aces: 0, breaks: 0 },
    };
    const topR = D.id === "headless" ? 13 : 14, jokers = D.id === "wild" ? 4 : CFG.jokers;
    for (let r = 2; r <= topR; r++) for (let si = 0; si < 4; si++) S.deck.push({ id: S.nextId++, r, si });
    for (let j = 0; j < jokers; j++) S.deck.push({ id: S.nextId++, r: 0, si: j % 4, e: "wild" });
    if (D.id === "headless") S.chainStart = 2;
    const pool = RANDOM_CHALLENGES.slice();
    for (let a = 0; a < TARGETS.length; a++) if (isReward(a)) S.chals[a] = pool.length ? pool.splice(Math.floor(next(S) * pool.length), 1)[0] : RANDOM_CHALLENGES[Math.floor(next(S) * RANDOM_CHALLENGES.length)];
    S.chals[TARGETS.length - 1] = "summit";
    for (let a = 1; a < TARGETS.length - 1; a++) if (!S.chals[a] && next(S) < CFG.ruleChance) S.rules[a] = RULES[Math.floor(next(S) * RULES.length)].id;
    S.rolled = {};
    startRound(S);
    return S;
  }
  /* Κάθε challenge ante παίρνει την ίδια έκπτωση· το Rich Air χτίζει πάνω σε αυτήν. */
  const target = (S) => Math.round(tgtAt(S.ante) * (chal(S) ? CFG.chalTargetMul : 1) * (chal(S) === "richair" ? CFG.richAirMul : 1));
  const roundHandSize = (S) => (chal(S) === "short" ? Math.min(CFG.shortHand, S.handSize) : chal(S) === "nodiscard" || chal(S) === "noace" ? S.handSize + 1 : S.handSize);
  const handCap = (S) => roundHandSize(S);

  /* Τυχαία ενίσχυση σε φύλλο που μόλις τράβηξες: μένει για πάντα (και στην τράπουλα). */
  function maybeEnhance(S, c) {
    if (c.e || isWild(c) || next(S) >= CFG.enhChance) return;
    const W = Object.assign({}, CFG.enhWeights);
    const jcap = S.deckId === "wild" ? CFG.jokerCap + 2 : CFG.jokerCap;
    if (S.deck.filter(isWild).length >= jcap) delete W.wild; else if (S.deckId === "wild") W.wild *= 2;
    const keys = Object.keys(W), tw = keys.reduce((a, k) => a + W[k], 0);
    let x = next(S) * tw, e = keys[0];
    for (const k of keys) { x -= W[k]; if (x <= 0) { e = k; break; } }
    c.e = e; c.x = e; if (e === "wild") c.r = 0;
    const d = S.deck.find((k) => k.id === c.id); if (d) { d.e = e; if (e === "wild") d.r = 0; }
    (S.enhNew = S.enhNew || []).push(e);
  }
  function draw(S, n, deal) {
    const drawn = [];
    while (n > 0) {
      if (!S.pile.length) break;
      const c = S.pile.pop(); c.n = true; if (!deal) maybeEnhance(S, c); S.hand.push(c); drawn.push(c); n--;
    }
    S.hand.sort(cmp);
    return drawn;
  }
  function startRound(S) {
    S.chal = S.chals[S.ante] || null;
    const n = roundHandSize(S);
    /* Το χέρι μένει από γύρο σε γύρο, χωρίς να διαλέγεις: τα «ορφανά» (φύλλα που δεν μπαίνουν
       σε κανέναν συνδυασμό) αντικαθίστανται μόνα τους. */
    const drop = new Set(S.hand.length > 1 ? orphans(S).map((i) => S.hand[i].id) : []);
    const kept = S.hand.filter((c) => c && !drop.has(c.id)).map((c) => Object.assign({}, c));
    const first = kept.slice(0, n), firstIds = new Set(first.map((c) => c.id));
    const rest = shuffle(S, S.deck.filter((c) => !firstIds.has(c.id)).map((c) => Object.assign({}, c)));
    S.pile = rest; S.discardPile = [];
    S.hand = first.map((c) => { const k = Object.assign({}, c); delete k.h; delete k.n; return k; });
    draw(S, n - S.hand.length, true);
    S.hand.forEach((c) => { delete c.n; });
    S.enhNew = [];
    if (chal(S) === "blind") {
      /* «Open cheap, then look» θέλει κάτι ανοιχτό να παίξεις: ξαναδιαλέγουμε ποια φύλλα
         είναι μπρούμυτα μέχρι τα φανερά να κάνουν έστω έναν συνδυασμό. */
      const nb = Math.min(CFG.blindCount, S.hand.length - 2);
      for (let t = 0; t < 12; t++) {
        S.hand.forEach((c) => { delete c.h; });
        shuffle(S, S.hand.map((_, i) => i)).slice(0, nb).forEach((i) => { S.hand[i].h = true; });
        if (candidates(S).length) break;
      }
    }
    S.sel = [];
    S.rung = null;
    S.chain = 0; S.score = 0; S.plays = 0; S.lastSuit = null; S.breaks = 0;
    S.rdisc = 0; S.rfree = 0; S.rbombs = 0; S.rkinds = {}; S.rmax = 0; S.firstK = null; S.lastK = null;
    S.chainBonus = rule(S) === "r_head" ? 1 : 0;
    /* Discards: σταθερός πόρος του γύρου, ξεχωριστός από τα plays. */
    S.discMax = discMaxOf(S);
    S.playsLeft = S.playsMax - (chal(S) === "fewplays" ? 1 : 0);
    S.played = []; S.log = [];
    S.phase = "round"; S.offers = [];
  }

  /* ============================== αξιολόγηση ============================== */
  const K = (kind, rank, size) => ({ kind, rank, size });
  /* Ταξινόμηση κατά Tichu. Wild = οποιοδήποτε φύλλο (γεμίζει κενά, επεκτείνει προς τα πάνω). */
  function classify(cs) {
    if (!cs || !cs.length) return null;
    /* Ένα φύλλο είναι χέρι μόνο αν είναι άσος (ή τζόκερ): το πρώτο σκαλί της αλυσίδας. */
    if (cs.length === 1) return isAce(cs[0]) ? K(9, 14, 1) : null;
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
    if (n >= 4 && n % 2 === 0 && n <= 8 && d <= n / 2 && maxC <= 2) take(K(8, d < n / 2 ? 14 : hi, n));
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
  /* Όλα τα χέρια παίζονται. Το «climbs» λέει μόνο αν συνεχίζει η αλυσίδα. */
  /* High Ground: ο φραγμός δεν είναι αρχικό rung (θα ίσχυε μόνο για το πρώτο χέρι) — είναι
     όρος που κρατά όλο τον γύρο. Μοναχικός άσος και μικρά ζευγάρια γράφουν, αλλά δεν ανεβάζουν. */
  const tooSmall = (S, k) => chal(S) === "highground" && (k.kind === 9 || (k.kind === 1 && k.rank < CFG.highGroundRank));
  const climbs = (S, k) => beats(k, S.rung) && !tooSmall(S, k);
  const sameShape = (a, b) => !!a && !!b && a.kind === b.kind && a.size === b.size;
  /* Το πλαφόν σε ένα σημείο, ώστε να μην το προσπερνά κανείς προσθέτοντας βήματα μετά. */
  function capPos(S, p) { p = Math.min(CFG.chainCap, p); return chal(S) === "thinair" ? Math.min(CFG.thinAirCap, p) : rule(S) === "r_cap" ? Math.min(CFG.lowCeiling, p) : p; }
  function chainPos(S) { return capPos(S, S.chain + 1 + S.chainStart + (S.chainBonus || 0)); }
  function leadSuit(cs) {
    const cnt = {}; cs.forEach((c) => { if (!isWild(c)) cnt[c.si] = (cnt[c.si] || 0) + 1; });
    let best = null; Object.keys(cnt).forEach((k) => { if (best == null || cnt[k] > cnt[best]) best = +k; });
    return best;
  }
  /* Πλήρης υπολογισμός πόντων ενός υποψήφιου χεριού — UI και bot βλέπουν το ίδιο.
     Chips × Mult, όπως στο Balatro:
       Chips = βάση σχήματος + αξία φύλλων + σταθερά μπόνους (Court, Kingmaker)
       Mult  = βάση σχήματος + αναβαθμίσεις + βήματα αλυσίδας, επί τους πολλαπλασιαστές (Gold, Silver, charms)
     Αξία φύλλων: 2–10 όσο γράφουν, J/Q/K 10, A 11, τζόκερ 10 — μετράει, χωρίς να κυριαρχεί. */
  const CHIPV = { 11: 10, 12: 10, 13: 10, 14: 11 };
  const cardChip = (c) => (isWild(c) ? 10 : CHIPV[c.r] || c.r);
  const cardChips = (cs) => cs.reduce((a, c) => a + cardChip(c), 0);
  const roundMult = (m) => Math.round(m * 10) / 10;
  function scoreOf(S, k, cs) {
    const notes = [], R = rule(S);
    let chips = kchips(k) + cardChips(cs);
    let mult = kmult(k) + (S.mult[k.kind] || 0);
    if (has(S, "court") && cs.some(isFace)) { const jw = syn(S, "jewels") && cs.some((c) => isFace(c) && c.e === "gold"); chips += jw ? 120 : 60; notes.push(jw ? "Crown Jewels +120" : "Court +60"); }
    if (has(S, "kingmaker")) { const na = cs.filter(isAce).length; if (na) { const per = syn(S, "royal") ? 90 : 45; chips += per * na; notes.push((syn(S, "royal") ? "Royal Court +" : "Kingmaker +") + per * na); } }
    /* Αλυσίδα: κάθε σκαλί πολλαπλασιάζει το Mult — μόνο αν το χέρι ανεβαίνει.
       Χέρι που δεν ανεβαίνει γράφει σκέτο chips × mult και σπάει την αλυσίδα. */
    const prev = S.rung, up = climbs(S, k);
    let pos = chainPos(S);
    const ladder = has(S, "ladder") && sameShape(k, prev) && k.rank === prev.rank + 1, loyal = has(S, "loyal") && S.lastSuit != null && leadSuit(cs) === S.lastSuit;
    if (up) {
      let steps = 0;
      if (ladder) { steps += 2; notes.push("Ladder +2 steps"); }
      if (ladder && syn(S, "backstairs") && k.kind === 1 && k.rank <= 6) { steps += 1; notes.push("Back Stairs +1 step"); }
      if (loyal) { steps += 1; chips += 60; notes.push("Loyalty +1 step, +60"); }
      if (ladder && loyal && syn(S, "lockstep")) { steps += 1; notes.push("Lockstep +1 step"); }
      pos = capPos(S, pos + steps);
    }
    /* Patient μπαίνει ΠΡΙΝ την αλυσίδα, ώστε να πολλαπλασιάζεται μαζί με το υπόλοιπο Mult. */
    if (has(S, "patient")) { const d = discardsLeft(S) * 3; if (d) { mult += d; notes.push("Patient +" + d + " Mult"); } }
    /* Climber μετράει κάθε σκαλί διπλό, το Tempo τριπλό — μέχρι την οροφή του chainStepCap. */
    const stepMult = syn(S, "tempo") ? 3 : has(S, "climber") ? 2 : 1;
    const steps = up ? Math.min(CFG.chainStepCap, Math.max(0, pos - 1 + CFG.chainFloor) * stepMult) : 0;
    const chainMul = 1 + CFG.chainStep * steps;
    if (steps) { mult = roundMult(mult * chainMul); notes.push("Chain ×" + pos + " · Mult ×" + roundMult(chainMul)); }
    /* Gold και Silver πολλαπλασιάζουν, ένα φύλλο τη φορά — όπως ακριβώς το λένε οι περιγραφές. */
    const golds = cs.filter((c) => c.e === "gold").length, silvers = cs.filter((c) => c.e === "silver").length;
    let factor = 1;
    if (golds) factor *= Math.pow(has(S, "goldsmith") ? 3 : 2, golds);
    if (silvers) factor *= Math.pow(1.5, silvers);
    if (factor > CFG.enhCap) factor = CFG.enhCap;
    factor = Math.round(factor * 100) / 100;
    if (factor > 1) notes.push((golds && silvers ? "Gold + Silver" : golds ? "Gold" : "Silver") + " ×" + factor);
    let hm = 1;
    if (has(S, "summiteer") && isBomb(k)) { hm *= 2; notes.push("Summiteer ×2"); }
    if (has(S, "leap") && sameShape(k, prev) && k.rank - prev.rank >= 4) { hm *= 2; notes.push("Overkill ×2"); }
    if (has(S, "lowroad") && k.kind === 1 && k.rank <= 6) { hm *= 2; chips += 40; notes.push("Low Road ×2, +40"); }
    if (has(S, "mirror") && S.plays === 0) { hm *= 2; notes.push("Mirror ×2"); }
    if (has(S, "ember") && pos >= 4) { hm *= 1.8; notes.push("Ember ×1.8"); }
    if (has(S, "encore") && S.playsLeft < 2) { const be = syn(S, "bookends") && S.firstK && S.firstK.kind === k.kind; hm *= be ? 3 : 2; notes.push(be ? "Bookends ×3" : "Encore ×2"); }
    if (has(S, "afterburner") && S.lastK && isBomb(S.lastK) && !isBomb(k)) { const cr = syn(S, "reaction"); hm *= cr ? 3.5 : 2.5; notes.push(cr ? "Chain Reaction ×3.5" : "Afterburner ×2.5"); }
    if (R === "r_red" || R === "r_black") { const ls = leadSuit(cs), red = ls === 1 || ls === 2; if (ls != null && (R === "r_red") === red) { hm *= 1.5; notes.push((R === "r_red" ? "Red" : "Black") + " Night ×1.5"); } }
    if ((R === "r_str2" && k.kind === 4) || (R === "r_trips2" && k.kind === 2) || (R === "r_full2" && k.kind === 5)) { hm *= 2; notes.push(ruleById[R].name + " ×2"); }
    if (R === "r_low2" && !isBomb(k) && k.rank <= 6) { hm *= 2; notes.push("Underdogs ×2"); }
    if (hm > CFG.hmCap) { hm = CFG.hmCap; notes.push("Stacked ×" + hm + " (cap)"); }
    /* Μηδενισμοί στο τέλος, ώστε «κανένα Chip» να σημαίνει πραγματικά κανένα. */
    if (R === "r_pair0" && k.kind === 1) { chips = 0; notes.push("Cheap Pairs · no chips"); }
    if (chal(S) === "summit" && !up) { chips = 0; notes.push("Summit · no climb, no score"); }
    const total = roundMult(mult * factor * hm);
    return { chips, mult: total, kchips: kchips(k), kmult: kmult(k), cards: cardChips(cs), pos, notes, pts: Math.round(chips * total) };
  }
  const selCards = (S) => S.sel.map((i) => S.hand[i]);
  function evalSel(S) {
    const cs = selCards(S);
    const k = classify(cs);
    if (!k || cs.some((c) => frozen(S, c))) return { k: null, legal: false, cs };
    const sc = scoreOf(S, k, cs);
    return Object.assign({ k, legal: true, up: climbs(S, k), cs }, sc);
  }
  /* "Pair 8" · "Stairs 3 to 6" · "Straight 7 to J" · "Str. Flush 5 to 9" */
  const PAIRS_NAME = { 4: "Two Pair", 6: "Three Pair", 8: "Four Pair" };
  function clabel(k) {
    if (k.kind === 9) return "Ace";
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
    const r = S.rung;
    if (chal(S) === "highground" && !r) return "Nothing under a pair of " + CFG.highGroundRank + " climbs · smaller hands still score";
    if (!r) return "Table is open · any hand starts the chain";
    const n = KINDS[r.kind].name.toLowerCase();
    const how = r.kind === 8 ? "more pairs" : r.kind === 3 || r.kind === 4 ? "a longer or higher " + n : "a higher " + n;
    return "To climb: " + how + ", or a better kind of hand";
  }

  /* ============================== κινήσεις ============================== */
  function candidates(S) {
    const bR = {}, W = [], vis = [];
    S.hand.forEach((c, i) => { if (c.h || frozen(S, c)) return; vis.push(i); if (isWild(c)) { W.push(i); return; } (bR[c.r] = bR[c.r] || []).push(i); });
    const out = [], rs = Object.keys(bR).map(Number).sort((a, b) => a - b), nw = W.length, wl = (n) => W.slice(0, n);
    /* Ο μοναχικός άσος παίζεται σαν κάθε άλλο χέρι — εκτός αν ο γύρος τον απαγορεύει. */
    vis.forEach((i) => { if (isAce(S.hand[i])) out.push([i]); });
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
  const legalMoves = candidates;
  const hasLegal = (S) => candidates(S).length > 0;
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
    const all = candidates(S);
    if (!all.length) return null;
    const up = all.filter((o) => climbs(S, o.k));
    if (S.rung && up.length) {
      const nb = up.filter((o) => !isBomb(o.k)), pool = nb.length ? nb : up;
      return pool.reduce((b, o) => (!b || costKey(o.k) < costKey(b.k) ? o : b), null);
    }
    /* Ανοιχτό τραπέζι: το σχήμα με τη μεγαλύτερη αλυσίδα μπροστά. Τίποτα δεν ανεβαίνει: το πιο παχύ. */
    if (S.rung) return all.reduce((b, o) => (!b || scoreOf(S, o.k, o.idx.map((i) => S.hand[i])).pts > scoreOf(S, b.k, b.idx.map((i) => S.hand[i])).pts ? o : b), null);
    let best = null, bk = -1;
    all.forEach((o) => {
      const len = isBomb(o.k) ? 1 : chainLen(S, o, all), pts = scoreOf(S, o.k, o.idx.map((i) => S.hand[i])).pts;
      const key = len * 1e6 + (len >= 2 ? (90000 - costKey(o.k)) : 0) + Math.min(9999, pts);
      if (key > bk) { bk = key; best = o; }
    });
    return best;
  }
  /* Ορφανά: φύλλα που δεν μπαίνουν σε κανέναν συνδυασμό (εκτός Άσων και Wild). */
  function orphans(S) {
    const inUse = new Set(); candidates(S).forEach((o) => o.idx.forEach((i) => inUse.add(i)));
    const o = S.hand.map((c, i) => i).filter((i) => { const c = S.hand[i]; return !c.h && !isWild(c) && (c.r !== 14 || frozen(S, c)) && !inUse.has(i); });
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
  function afterPlay(S, cs, ev) {
    S.stats.gold += cs.filter((c) => c.e === "gold").length;
    S.stats.silver += cs.filter((c) => c.e === "silver").length;
    reveal(S);
    const drawn = draw(S, handCap(S) - S.hand.length);
    /* Blind Deal: δύο από τα φύλλα που μόλις τράβηξες μένουν μπρούμυτα μέχρι το επόμενο παίξιμο. */
    if (chal(S) === "blind") drawn.slice(0, CFG.blindKeep).forEach((c) => { c.h = true; });
    ev.drawn = drawn.length;
    S.plays += 1; S.stats.plays += 1;
  }
  /* Καταγράφει την κορυφή της αλυσίδας. */
  function noteChain(S) {
    const pos = chainPos(S), fresh = pos > S.rmax;
    if (fresh) S.rmax = pos;
    if (pos > S.stats.maxChain) S.stats.maxChain = pos;
    if (pos >= CFG.chainCap) S.stats.chain7 = 1;
    return { pos, fresh };
  }
  function play(S) {
    if (S.phase !== "round") return null;
    const e = evalSel(S);
    if (S.playsLeft < 1) return null;
    if (!e.k) return null;
    const k = e.k, prev = S.rung, up = climbs(S, k), cs = removeSel(S, true);
    const tags = [];
    if (S.chain === 0 && k.kind === 1 && k.rank <= 3) tags.push("Humble");
    if (sameShape(k, prev) && k.rank === prev.rank + 1) tags.push("Tight Step");
    if (sameShape(k, prev) && k.rank - prev.rank >= 4) tags.push("Overkill");
    const bomb = isBomb(k);
    if (bomb) { tags.push("Bomb!"); S.stats.quads += 1; }
    if (k.kind === 9) { tags.push("Ace"); S.stats.aces += 1; }
    if (k.kind === 4 && k.size >= 7) tags.push("Long Run");
    if (k.kind === 3 && k.size >= 6) tags.push("Staircase");
    S.score += e.pts; S.playsLeft -= 1;
    S.lastSuit = leadSuit(cs);
    if (!S.firstK) S.firstK = k; S.lastK = k; S.rkinds[k.kind] = (S.rkinds[k.kind] || 0) + 1; if (bomb) S.rbombs += 1;
    /* Ανεβαίνεις → η αλυσίδα μεγαλώνει. Παίζεις κάτι χαμηλότερο → σπάει (ή χάνει το μισό με Slipstream). */
    let broke = 0;
    if (up) S.chain += 1;
    else {
      const was = chainPos(S);
      const keep = has(S, "wind") && S.breaks < 2;
      let np = keep ? was : has(S, "cheap") ? Math.max(1, was - 1) : 0;
      if (syn(S, "lungs")) np = Math.max(np, Math.min(was, 3));
      S.chain = Math.max(0, np - 1 - S.chainStart - (S.chainBonus || 0));
      S.breaks += 1; S.stats.breaks += 1; broke = was;
      tags.push("Chain broken");
    }
    if (has(S, "mirror") && S.plays === 0) { S.chain += 1; tags.push("Mirror"); }
    S.rung = bomb ? null : { kind: k.kind, rank: Math.min(14, k.rank + (chal(S) === "sticky" ? 2 : 0)), size: k.size };
    /* Το «Ladder to Heaven» βγαίνει μία φορά, όταν η αλυσίδα φτάσει πρώτη φορά στην οροφή. */
    { const n = noteChain(S); if (n.fresh && n.pos >= CFG.chainCap) tags.push("Ladder to Heaven"); }
    S.played = cs.slice();
    S.log.push({ t: clabel(k), c: e.chips + " × " + e.mult + (bomb ? " · table opens" : broke ? " · chain ×" + broke + " broken" : ""), p: e.pts, cls: broke ? "pass" : "" });
    tags.sort((a, b) => TAG_ORDER.indexOf(a) - TAG_ORDER.indexOf(b));
    const ev = { type: "play", k, pts: e.pts, pos: e.pos, chips: e.chips, mult: e.mult, notes: e.notes, tags, bomb, up, broke, cleared: S.score >= target(S) };
    afterPlay(S, cs, ev);
    return ev;
  }
  /* Discard: σταθερός αριθμός ανά γύρο, ξεχωριστός από τα plays (όπως στο Balatro).
     Βάση 2 · +1 ανά Nimble Hands · +3 με Sleight · +1 με Spare Card ή Short Hand. */
  function discMaxOf(S) {
    if (chal(S) === "nodiscard") return 0;
    if (chal(S) === "onedisc") return 1;
    return CFG.discards + (S.discMore || 0) + (has(S, "sleight") ? 3 : 0) + (rule(S) === "r_gift" ? 1 : 0) + (chal(S) === "short" ? 1 : 0);
  }
  const discardsLeft = (S) => Math.max(0, (S.discMax == null ? discMaxOf(S) : S.discMax) - (S.rdisc || 0));
  /* Χέρι χωρίς κανέναν συνδυασμό: το discard είναι δωρεάν, για να μη σε κλειδώνει η τράπουλα. */
  const deadHand = (S) => S.phase === "round" && S.hand.length > 0 && candidates(S).length === 0;
  const canDiscard = (S) => S.phase === "round" && chal(S) !== "nodiscard" && (deadHand(S) || freeScout(S) || discardsLeft(S) > 0) && S.sel.length > 0 && S.pile.length > 0;
  /* Scout: το πρώτο discard του γύρου δεν κοστίζει — μία φορά, όχι κάθε φορά. */
  const freeScout = (S) => has(S, "scout") && !S.rfree;
  function discard(S) {
    if (!canDiscard(S)) return false;
    const dead = deadHand(S) && discardsLeft(S) <= 0, scout = !dead && freeScout(S), free = dead || scout;
    const cs = removeSel(S, true);
    if (scout) S.rfree = 1;
    if (!free) S.rdisc += 1;
    reveal(S);   /* το discard είναι η αντίδραση στο Blind Deal: γυρίζει τα κρυφά φύλλα */
    const d = draw(S, handCap(S) - S.hand.length);
    S.log.push({ t: "Discard", c: cs.length + " out, " + d.length + " in", p: free ? "free" : discardsLeft(S) + " left", cls: "pass" });
    return true;
  }
  /* Κόλλησες όταν καμία κίνηση δεν αλλάζει τίποτα. */
  function stuck(S) {
    if (S.phase !== "round") return false;
    if (S.playsLeft < 1) return true;
    if (hasLegal(S)) return false;
    if (canDiscardAny(S)) return false;
    return true;
  }
  const canDiscardAny = (S) => chal(S) !== "nodiscard" && (discardsLeft(S) > 0 || deadHand(S) || freeScout(S)) && S.pile.length > 0 && S.hand.length > 0;
  function stuckReason(S) {
    if (S.playsLeft < 1) return "No plays left — the round is over.";
    if (hasLegal(S)) return "";
    if (canDiscardAny(S)) return deadHand(S) && discardsLeft(S) <= 0 ? "These cards make no hand at all, so this discard is free." : "These cards make no hand. Discard and draw — " + discardsLeft(S) + " discard" + (discardsLeft(S) === 1 ? "" : "s") + " left.";
    if (!S.pile.length) return "The pile is empty and nothing here makes a hand — the round is over.";
    return chal(S) === "nodiscard" ? "These cards make no hand, and this round has no discards — the round is over." : "These cards make no hand and there are no discards left — the round is over.";
  }
  function finish(S) {
    if (S.phase !== "round") return null;
    const T = target(S);
    if (S.score < T) { S.phase = "lost"; return { cleared: false }; }
    const ex = S.score - T, reward = isReward(S.ante), kind = rewardKind(S.ante);
    /* Ένα πράγμα ανά σταθμό. Το Rich Air δεν δίνει δεύτερο — δίνει περισσότερα να διαλέξεις. */
    S.pickUp = reward && kind === "up" ? 1 : 0;
    S.pickCharm = reward && kind === "charm" ? 1 : 0;
    S.nOffers = CFG.offers + (chal(S) === "richair" ? 2 : 0);
    if (S.ante === TARGETS.length - 1 && !S.endless) { S.phase = "won"; return { cleared: true, won: true, ex, reward }; }
    S.phase = "shop";
    if (S.endless) rollEndless(S, S.ante + 1);
    S.offers = reward ? makeOffers(S) : [];
    return { cleared: true, won: false, ex, reward };
  }

  /* ============================== κατάστημα ============================== */
  const charmAvailable = (S, c) => !has(S, c.id) && (!c.lock || S.unlocked.indexOf(c.id) >= 0);
  /* Ένα ταμείο: charms και αναβαθμίσεις μαζί, χωρίς τιμές. Διαλέγεις ένα και προχωράς. */
  /* Δύο διάδρομοι: perks και charms, ένα από κάθε έναν. Αν δεν χωράει charm (γεμάτες θέσεις
     ή τα έχεις όλα), η θέση του γίνεται δεύτερο perk — καμία επιλογή δεν πάει χαμένη. */
  function makeOffers(S) {
    const out = [], n = S.nOffers || CFG.offers;
    const up = POOL.filter((o) => (o.id !== "th" || S.removed.length < 5) && (!o.min || S.ante + 1 >= o.min) && (o.id !== "gt" || S.deck.concat(S.hand).some((c) => c.r === 14 && !c.e)) && (!CFG.maxBuy[o.id] || (S.bought[o.id] || 0) < CFG.maxBuy[o.id])).map((o) => o.id);
    const ch = S.charms.length < S.charmSlots ? CHARMS.filter((c) => charmAvailable(S, c)).map((c) => c.id) : [];
    const pull = (a) => a.splice(Math.floor(next(S) * a.length), 1)[0];
    /* Γεμάτες θέσεις ή τελείωσαν τα charms; Ο σταθμός πληρώνει perk — τα perks δεν αδειάζουν. */
    if (!ch.length && S.pickCharm) { S.pickUp += S.pickCharm; S.pickCharm = 0; }
    const kind = S.pickCharm ? "charm" : "up", pool = kind === "charm" ? ch : up;
    for (let i = 0; i < n && pool.length; i++) out.push({ kind, id: pull(pool), bought: false });
    return out;
  }
  const picksLeft = (S) => Math.max(0, S.pickUp || 0) + Math.max(0, S.pickCharm || 0);
  const laneLeft = (S, kind) => Math.max(0, (kind === "charm" ? S.pickCharm : S.pickUp) || 0);
  function canTake(S, i) {
    const o = S.offers[i];
    if (S.phase !== "shop" || !o || o.bought) return { ok: false, why: "gone" };
    if (o.kind === "charm" && S.charms.length >= S.charmSlots) return { ok: false, why: "full" };
    if (laneLeft(S, o.kind) <= 0) return { ok: false, why: "picks" };
    return { ok: true };
  }
  function take(S, i) {
    if (!canTake(S, i).ok) return false;
    const o = S.offers[i];
    if (o.kind === "charm") { S.charms.push(o.id); S.pickCharm -= 1; } else { apply(S, o.id); S.pickUp -= 1; }
    o.bought = true;
    return true;
  }
  function nextAnte(S) {
    if (S.phase !== "shop") return false;
    S.ante += 1;
    const a = S.ante;
    rollEndless(S, a);
    startRound(S);
    return true;
  }
  /* Μετά την κορυφή: συνέχεια χωρίς τέλος. Ανοίγει το κατάστημα του ante 30. */
  function goEndless(S) {
    if (S.phase !== "won") return false;
    S.endless = true; S.phase = "shop";
    rollEndless(S, S.ante + 1);
    /* Η Κορυφή δεν είναι σταθμός πληρωμής: χωρίς picks δεν βγαίνουν προσφορές. */
    S.offers = picksLeft(S) ? makeOffers(S) : [];
    return true;
  }
  /* Endless: το επόμενο ante κληρώνεται όσο είσαι ακόμη στο κατάστημα, ώστε η
     προεπισκόπηση (στόχος, boss) να λέει την αλήθεια. Idempotent. */
  function rollEndless(S, a) {
    S.rolled = S.rolled || {};
    if (a < TARGETS.length || S.rolled[a]) return;
    if (isReward(a)) S.chals[a] = RANDOM_CHALLENGES[Math.floor(next(S) * RANDOM_CHALLENGES.length)];
    else if (next(S) < CFG.ruleChance) S.rules[a] = RULES[Math.floor(next(S) * RULES.length)].id;
    S.rolled[a] = 1;
  }
  /* Σχεδόν: πόσο έλειψε και ποιο χέρι από το τελικό χέρι θα το έπιανε (για την οθόνη Busted). */
  function nearMiss(S) {
    const T = target(S), gap = T - S.score;
    if (gap <= 0) return null;
    const P = Object.assign({}, S, { phase: "round", playsLeft: 1 });
    let best = null;
    legalMoves(P).forEach((o) => { const sc = scoreOf(P, o.k, o.idx.map((i) => S.hand[i])); if (!best || sc.pts > best.pts) best = { k: o.k, idx: o.idx, pts: sc.pts }; });
    return { gap, close: gap <= Math.max(15, T * 0.12), T, best, enough: !!best && best.pts >= gap };
  }
  const upcoming = (S) => (S.chals[S.ante + 1] ? chalById[S.chals[S.ante + 1]] : null);
  const current = (S) => (S.chal ? chalById[S.chal] : null);
  const currentRule = (S) => (rule(S) ? ruleById[rule(S)] : null);
  const upcomingRule = (S) => { const a = S.ante + 1; return !S.chals[a] && S.rules && S.rules[a] ? ruleById[S.rules[a]] : null; };
  const nextTarget = (S) => { const a = S.ante + 1, id = S.chals[a]; if (a >= TARGETS.length && !S.endless) return null; return Math.round(tgtAt(a) * (id ? CFG.chalTargetMul : 1) * (id === "richair" ? CFG.richAirMul : 1)); };
  const peek = (S) => (has(S, "scout") && S.pile.length ? S.pile.slice(-3).reverse() : null);

  /* ============================== σειριοποίηση ============================== */
  const serialize = (S) => JSON.stringify(S);
  function restore(json) {
    try {
      const S = JSON.parse(json);
      if (!S || S.v !== 12) return null;
      /* Έλεγχος σχήματος, όχι μόνο έκδοσης: ένα save με λείπον πίνακα περνούσε και έσκαγε αργότερα. */
      const arrays = ["hand", "pile", "deck", "charms", "mult", "sel", "removed", "unlocked", "discardPile", "played", "log"];
      if (!arrays.every((k) => Array.isArray(S[k]))) return null;
      if (!S.hand.every(Boolean) || !S.chals || !S.rules || !S.bought || !S.stats) return null;
      return S;
    } catch (e) { return null; }
  }
  const todaySeed = (d) => { d = d || new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };

  return {
    SUITS, KINDS, BY_TIER, TARGETS, tgtAt, RULES, ruleById, CFG, POOL, DECKS, deckById, SYNERGIES, synById, syn, activeSynergies, synergyFor, goEndless, nearMiss, kbase, kchips, kmult, isBomb, sameShape, beats, poolById, ENH, CHARMS, charmById, CHALLENGES, chalById, rname,
    newRun, startRound, target, nextTarget, roundHandSize,
    classify, climbs, chainPos, scoreOf, cardChip, cardChips, evalSel, clabel, crange, beatText, isAce, isWild, isFace, leadSuit,
    candidates, legalMoves, hasLegal, suggest, orphans,
    toggle, reveal, play, discard, canDiscard, canDiscardAny, discardsLeft, discMaxOf, deadHand, handCap, stuck, stuckReason, finish,
    makeOffers, canTake, take, picksLeft, laneLeft, isReward, rewardKind, nextAnte, applyFree: apply, upcoming, current, currentRule, upcomingRule, peek, has,
    serialize, restore, todaySeed,
  };
});
