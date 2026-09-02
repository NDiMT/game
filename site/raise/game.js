/* RAISE — καθαρή λογική παιχνιδιού. Χωρίς DOM, χωρίς side effects.
   Τρέχει στον browser (window.RAISE) και σε Node (module.exports). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RAISE = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------- σταθερές ---------- */
  const SUITS = [
    { s: "♠", red: false },
    { s: "♥", red: true },
    { s: "♦", red: true },
    { s: "♣", red: false },
  ];
  const RN = { 11: "J", 12: "Q", 13: "K", 14: "A" };
  const rname = (r) => RN[r] || String(r);

  const TIERS = [
    null,
    { name: "Pair", short: "PAIR", base: 10, size: 2 },
    { name: "Trips", short: "TRIPS", base: 25, size: 3 },
    { name: "Straight", short: "STR8", base: 40, size: 5 },
    { name: "Flush", short: "FLUSH", base: 60, size: 5 },
    { name: "Full House", short: "FULL", base: 80, size: 5 },
    { name: "Quads", short: "QUADS", base: 120, size: 4 },
  ];
  /* Βαθμονομημένο με tools/sweep.js — βλ. README. */
  const TARGETS = [100, 145, 215, 320, 470, 700, 1030, 1500];
  const CFG = {
    rewardBase: 12, rewardPer: 60,
    offers: 3,        // αναβαθμίσεις στο κατάστημα
    cardOffers: 2,    // ενισχυμένα φύλλα στο κατάστημα
    firstHandFloor: 1.0, firstHandTries: 40,
    chisel0: 1,
    challengeAntes: [2, 5],  // 0-indexed: ante 3 και 6
    /* ένταση των challenges — βαθμονομείται από το sweep */
    chalTargetMul: 0.85,  // στόχος σε challenge ante: το twist είναι η δυσκολία, όχι ο αριθμός
    thinAirCap: 4,
    highGroundRank: 10,
    shortHand: 14,
    richAirMul: 1.15,
    blindCount: 7,
  };
  const HAND_BASE = 15;
  const BREATHS_BASE = 3;

  const POOL = [
    { id: "m1", name: "Pairs +", desc: "Pairs pay one step more.", cost: 5 },
    { id: "m2", name: "Trips +", desc: "Trips pay one step more.", cost: 7 },
    { id: "m3", name: "Straights +", desc: "Straights pay one step more.", cost: 8 },
    { id: "m4", name: "Flushes +", desc: "Flushes pay one step more.", cost: 9 },
    { id: "m5", name: "Full Houses +", desc: "Full houses pay one step more.", cost: 10 },
    { id: "m6", name: "Quads +", desc: "Quads pay one step more.", cost: 10 },
    { id: "br", name: "Breath", desc: "+1 pass per round.", cost: 6 },
    { id: "ch", name: "Chisel", desc: "+1 per round: rewrite a card's rank.", cost: 7 },
    { id: "de", name: "Step Down", desc: "+1 per round: reset the rung, keep the chain.", cost: 11 },
    { id: "wi", name: "Wide Hand", desc: "+1 card every round.", cost: 8 },
    { id: "cs", name: "Head Start", desc: "The chain starts at ×2.", cost: 12 },
    { id: "th", name: "Cull", desc: "Remove the lowest rank from the deck. For good.", cost: 7 },
  ];
  const poolById = Object.fromEntries(POOL.map((o) => [o.id, o]));

  /* Ενισχύσεις φύλλων: ζουν στην τράπουλα, όχι στο χέρι. */
  const ENH = {
    gold:  { name: "Gold",  desc: "Base ×2 when played.",               cost: 6, w: 35 },
    glass: { name: "Glass", desc: "Base ×3. Shatters after one play.",  cost: 5, w: 30 },
    wild:  { name: "Wild",  desc: "Any rank, any suit. Also an Ace.",   cost: 9, w: 15 },
    steel: { name: "Steel", desc: "Dealt into every hand.",             cost: 8, w: 20 },
  };

  /* Challenges: κάθε ένα είναι σημαία που διαβάζει η λογική. */
  const CHALLENGES = [
    { id: "nopass",     name: "No Pass",          desc: "Passing is off. Step Down and Aces still reset." },
    { id: "short",      name: "Short Hand",       desc: "One card fewer this round." },
    { id: "blind",      name: "Blind Deal",       desc: "Seven cards start face down. Your first play turns them." },
    { id: "highground", name: "High Ground",      desc: "The rung starts at Pair K." },
    { id: "onebreath",  name: "One Breath",       desc: "A single pass this round." },
    { id: "thinair",    name: "Thin Air",         desc: "The chain caps at ×3." },
    { id: "richair",    name: "Rich Air",         desc: "Target ×1.15. Payout ×2." },
  ];
  const chalById = Object.fromEntries(CHALLENGES.map((c) => [c.id, c]));

  /* Ονόματα χεριών, από το πιο σπάνιο στο πιο κοινό. */
  const TAG_ORDER = ["Clean Sheet", "Ladder to Heaven", "Four Horsemen", "Royal", "Ace in the Hole", "Leap", "Shatter", "Tight Step", "Humble"];

  function apply(S, id) {
    switch (id) {
      case "m1": case "m2": case "m3": case "m4": case "m5": case "m6":
        S.mult[+id[1]] += 1; break;
      case "br": S.breathsMax += 1; break;
      case "ch": S.chiselMax += 1; break;
      case "de": S.descendMax += 1; break;
      case "wi": S.handSize += 1; break;
      case "cs": S.chainStart += 1; break;
      case "th": {
        const ranks = S.deck.filter((c) => c.e !== "wild").map((c) => c.r);
        if (!ranks.length) break;
        const lo = Math.min.apply(null, ranks);
        S.deck = S.deck.filter((c) => c.e === "wild" || c.r !== lo);
        S.removed.push(lo);
        break;
      }
    }
    S.bought[id] = (S.bought[id] || 0) + 1;
  }

  /* ---------- RNG ---------- */
  function hash(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return (h ^ (h >>> 16)) >>> 0;
  }
  function next(S) {
    S.rng = (S.rng + 0x6d2b79f5) | 0;
    let t = Math.imul(S.rng ^ (S.rng >>> 15), 1 | S.rng);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /* ---------- run ---------- */
  function newRun(seedStr) {
    const seed = String(seedStr || "").trim() || String(Math.floor(Math.random() * 1e9));
    const S = {
      v: 2, seed, rng: hash(seed) | 0,
      ante: 0, money: 0,
      handSize: HAND_BASE, breathsMax: BREATHS_BASE, chiselMax: CFG.chisel0, descendMax: 0, chainStart: 0,
      mult: [0, 1, 1, 1, 1, 1, 1], removed: [], bought: {},
      deck: [], nextId: 1, chals: {},
      phase: "round", offers: [],
    };
    for (let r = 2; r <= 14; r++) for (let si = 0; si < 4; si++) S.deck.push({ id: S.nextId++, r, si });
    // ένα challenge ανά προγραμματισμένο ante, χωρίς επανάληψη
    const pool = CHALLENGES.map((c) => c.id);
    CFG.challengeAntes.forEach((a) => { S.chals[a] = pool.splice(Math.floor(next(S) * pool.length), 1)[0]; });
    startRound(S);
    return S;
  }

  const cmp = (a, b) => a.r - b.r || a.si - b.si;
  const chal = (S) => S.chal || null;
  const target = (S) => Math.round(TARGETS[S.ante] * (chal(S) === "richair" ? CFG.richAirMul : 1) * (chal(S) && chal(S) !== "richair" ? CFG.chalTargetMul : 1));
  const roundHandSize = (S) => (chal(S) === "short" ? Math.min(CFG.shortHand, S.handSize) : S.handSize);

  function deal(S, n) {
    const steel = S.deck.filter((c) => c.e === "steel");
    const rest = S.deck.filter((c) => c.e !== "steel").slice();
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(next(S) * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    return steel.slice(0, n).concat(rest.slice(0, Math.max(0, n - steel.length)))
      .map((c) => Object.assign({}, c)).sort(cmp);
  }
  function greedyScore(S, hand) {
    const T = Object.assign({}, S, { hand: hand.slice(), sel: [], rung: null, chain: 0, score: 0,
      breaths: S.breathsMax, descend: S.descendMax, played: [], log: [], phase: "round", deck: S.deck.slice() });
    for (let guard = 0; guard < 60; guard++) {
      const m = cheapest(T);
      if (m) { T.sel = m.idx.slice(); play(T); if (!T.hand.length) break; continue; }
      if (T.rung && T.breaths > 0) { pass(T); continue; }
      break;
    }
    return T.score;
  }
  function startRound(S) {
    S.chal = S.chals[S.ante] || null;
    const n = roundHandSize(S);
    let hand = deal(S, n);
    if (S.ante === 0 && CFG.firstHandFloor > 0) {
      for (let t = 0; t < CFG.firstHandTries; t++) {
        if (greedyScore(S, hand) >= target(S) * CFG.firstHandFloor) break;
        hand = deal(S, n);
      }
    }
    if (chal(S) === "blind") {
      const idx = hand.map((_, i) => i);
      for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(next(S) * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
      idx.slice(0, Math.min(CFG.blindCount, hand.length - 4)).forEach((i) => { hand[i].h = true; });
    }
    S.hand = hand;
    S.sel = [];
    S.rung = chal(S) === "highground" ? { tier: 1, rank: CFG.highGroundRank } : null;
    S.chain = 0;
    S.score = 0;
    S.breaths = chal(S) === "onebreath" ? 1 : S.breathsMax;
    S.chisel = S.chiselMax;
    S.descend = S.descendMax;
    S.played = [];
    S.log = [];
    S.phase = "round";
    S.offers = [];
  }

  /* ---------- αξιολόγηση ---------- */
  function classifyPlain(cs) {
    if (!cs || cs.length < 2) return null;
    const bR = {}, bS = {};
    cs.forEach((c) => { (bR[c.r] = bR[c.r] || []).push(c); (bS[c.si] = bS[c.si] || []).push(c); });
    const co = Object.keys(bR).map((r) => [+r, bR[r].length]);
    const n = cs.length;
    if (n === 2 && co.length === 1) return { tier: 1, rank: co[0][0] };
    if (n === 3 && co.length === 1) return { tier: 2, rank: co[0][0] };
    if (n === 4 && co.length === 1) return { tier: 6, rank: co[0][0] };
    if (n === 5) {
      if (co.length === 2) {
        const t = co.find((c) => c[1] === 3), p = co.find((c) => c[1] === 2);
        if (t && p) return { tier: 5, rank: t[0] };
      }
      const hi = Math.max.apply(null, cs.map((c) => c.r));
      if (Object.keys(bS).length === 1) return { tier: 4, rank: hi };
      if (co.length === 5) {
        const rs = co.map((c) => c[0]).sort((a, b) => a - b);
        if (rs[4] - rs[0] === 4) return { tier: 3, rank: hi };
      }
    }
    return null;
  }
  const isWild = (c) => c && c.e === "wild";
  const kKey = (k) => (k ? k.tier * 100 + k.rank : -1);
  /* Wilds: δοκιμάζουμε κάθε ανάθεση αξίας/χρώματος και κρατάμε την καλύτερη. */
  function classify(cs) {
    if (!cs || cs.length < 2) return null;
    const wild = cs.filter(isWild), fixed = cs.filter((c) => !isWild(c));
    if (!wild.length) return classifyPlain(cs);
    if (!fixed.length) {
      const n = cs.length;
      return n === 2 ? { tier: 1, rank: 14 } : n === 3 ? { tier: 2, rank: 14 } : n === 4 ? { tier: 6, rank: 14 } : n === 5 ? { tier: 5, rank: 14 } : null;
    }
    // οι αξίες που έχουν νόημα: υπάρχουσες, γειτονικές για κέντες, και ο άσος
    const ranks = new Set([14]);
    fixed.forEach((c) => { for (let d = -4; d <= 4; d++) { const r = c.r + d; if (r >= 2 && r <= 14) ranks.add(r); } });
    const suits = [...new Set(fixed.map((c) => c.si))];
    const opts = [];
    ranks.forEach((r) => suits.forEach((si) => opts.push({ r, si })));
    let best = null;
    (function rec(i, acc) {
      if (i === wild.length) {
        const k = classifyPlain(fixed.concat(acc));
        if (kKey(k) > kKey(best)) best = k;
        return;
      }
      for (const o of opts) rec(i + 1, acc.concat([o]));
    })(0, []);
    return best;
  }
  function isLegal(S, k) {
    if (!k) return false;
    if (!S.rung) return true;
    return k.tier > S.rung.tier || (k.tier === S.rung.tier && k.rank > S.rung.rank);
  }
  function chainPos(S) {
    const p = S.chain + 1 + S.chainStart;
    return chal(S) === "thinair" ? Math.min(CFG.thinAirCap, p) : p;
  }
  const cbase = (S, k) => TIERS[k.tier].base * S.mult[k.tier];
  const factor = (cs) => 1 + cs.filter((c) => c.e === "gold").length + 2 * cs.filter((c) => c.e === "glass").length;
  const clabel = (k) => TIERS[k.tier].name + " " + rname(k.rank);
  const isAce = (c) => c && (c.r === 14 || isWild(c));
  const selCards = (S) => S.sel.map((i) => S.hand[i]);

  /* Τι σημαίνει η τρέχουσα επιλογή — ένα αντικείμενο για UI και bot. */
  function evalSel(S) {
    const cs = selCards(S);
    if (cs.length === 1 && isAce(cs[0]) && S.rung) return { ace: true, legal: true, cs, k: null };
    const k = classify(cs);
    if (!k) return { k: null, legal: false, cs };
    const legal = isLegal(S, k), base = cbase(S, k), f = factor(cs), pos = chainPos(S);
    return { k, legal, cs, base, factor: f, pos, pts: base * f * pos };
  }
  const selection = (S) => evalSel(S).k;
  const cscore = (S, k, cs) => cbase(S, k) * factor(cs || []) * chainPos(S);

  /* ---------- υποψήφιες κινήσεις ---------- */
  function candidates(S) {
    const out = [], bR = {}, bS = {}, W = [];
    S.hand.forEach((c, i) => {
      if (c.h) return;
      if (isWild(c)) { W.push(i); return; }
      (bR[c.r] = bR[c.r] || []).push(i); (bS[c.si] = bS[c.si] || []).push(i);
    });
    const rs = Object.keys(bR).map(Number).sort((a, b) => a - b);
    rs.forEach((r) => {
      const g = bR[r];
      [2, 3, 4].forEach((total) => {
        for (let use = 0; use <= Math.min(W.length, total - 1); use++) {
          if (g.length >= total - use) out.push(g.slice(0, total - use).concat(W.slice(0, use)));
        }
      });
    });
    if (W.length >= 2) out.push(W.slice(0, 2));
    rs.forEach((t) => {
      if (bR[t].length < 3) return;
      rs.forEach((p) => { if (p !== t && bR[p].length >= 2) out.push(bR[t].slice(0, 3).concat(bR[p].slice(0, 2))); });
    });
    Object.keys(bS).forEach((si) => {
      const g = bS[si];
      if (g.length >= 5) out.push(g.slice().sort((a, b) => S.hand[b].r - S.hand[a].r).slice(0, 5));
    });
    for (let st = 2; st <= 10; st++) {
      let ok = true, pk = [];
      for (let r = st; r < st + 5; r++) { if (!bR[r]) { ok = false; break; } pk.push(bR[r][0]); }
      if (ok) out.push(pk);
    }
    const seen = new Set();
    return out.filter((idx) => { const key = idx.slice().sort().join(","); if (seen.has(key)) return false; seen.add(key); return true; })
      .map((idx) => ({ idx, k: classify(idx.map((i) => S.hand[i])) })).filter((o) => o.k);
  }
  const legalMoves = (S) => candidates(S).filter((o) => isLegal(S, o.k));
  const hasLegal = (S) => legalMoves(S).length > 0;
  function cheapest(S) {
    let b = null;
    legalMoves(S).forEach((o) => {
      const key = o.k.tier * 10000 + o.k.rank * 100 + o.idx.length;
      if (!b || key < b.key) b = { idx: o.idx, k: o.k, key };
    });
    return b;
  }
  const aceIndex = (S) => S.hand.findIndex((c) => !c.h && isAce(c));

  /* ---------- ενέργειες ---------- */
  const reveal = (S) => { S.hand.forEach((c) => { if (c.h) delete c.h; }); };
  function toggle(S, i) {
    if (S.phase !== "round" || !S.hand[i] || S.hand[i].h) return false;
    const at = S.sel.indexOf(i);
    if (at >= 0) S.sel.splice(at, 1);
    else if (S.sel.length < 5) S.sel.push(i);
    else return false;
    return true;
  }
  function shatter(S, cs) {
    const glass = cs.filter((c) => c.e === "glass");
    if (glass.length) { const ids = new Set(glass.map((c) => c.id)); S.deck = S.deck.filter((d) => !ids.has(d.id)); }
    return glass.length;
  }
  function removeSel(S) { S.hand = S.hand.filter((_, i) => !S.sel.includes(i)); S.sel = []; }
  function clearBonus(S, ev) {
    if (S.hand.length) return;
    ev.emptied = true;
    ev.bonus = Math.round(S.score * 0.5);
    S.score += ev.bonus;
    S.log.push({ t: "Clean Sheet", c: "+50%", p: ev.bonus, cls: "bonus" });
    ev.tags.unshift("Clean Sheet");
  }
  function play(S) {
    if (S.phase !== "round") return null;
    const e = evalSel(S);
    if (e.ace) {
      const cs = e.cs, kept = chainPos(S);
      S.rung = null; S.played = cs.slice();
      const sh = shatter(S, cs);
      removeSel(S); reveal(S);
      S.log.push({ t: "Ace in the Hole", c: "rung reset · chain ×" + kept + " kept", p: "", cls: "bonus" });
      const ev = { type: "ace", pts: 0, tags: ["Ace in the Hole"], shattered: sh, emptied: false, bonus: 0 };
      if (sh) ev.tags.push("Shatter");
      clearBonus(S, ev);
      return ev;
    }
    if (!e.k || !e.legal) return null;
    const k = e.k, cs = e.cs, prev = S.rung, pos = e.pos, pts = e.pts;
    const tags = [];
    if (S.chain === 0 && k.tier === 1 && k.rank <= 3) tags.push("Humble");
    if (prev && k.tier === prev.tier && k.rank === prev.rank + 1) tags.push("Tight Step");
    if (prev && k.tier - prev.tier >= 2) tags.push("Leap");
    if (k.tier === 6) tags.push("Four Horsemen");
    if (k.tier === 4 && cs.some(isAce)) tags.push("Royal");
    S.score += pts; S.chain += 1; S.rung = { tier: k.tier, rank: k.rank };
    if (S.chain + S.chainStart === 7) tags.push("Ladder to Heaven");
    S.played = cs.slice();
    const sh = shatter(S, cs);
    if (sh) tags.push("Shatter");
    S.log.push({ t: clabel(k), c: e.base + (e.factor > 1 ? " × " + e.factor : "") + " × " + pos, p: pts });
    removeSel(S); reveal(S);
    tags.sort((a, b) => TAG_ORDER.indexOf(a) - TAG_ORDER.indexOf(b));
    const ev = { type: "play", k, pts, pos, tags, shattered: sh, emptied: false, bonus: 0 };
    clearBonus(S, ev);
    return ev;
  }
  function pass(S) {
    if (S.phase !== "round" || S.breaths <= 0 || !S.rung || chal(S) === "nopass") return false;
    S.breaths -= 1; S.rung = null; S.chain = 0; S.sel = []; S.played = [];
    S.log.push({ t: "Pass", c: "rung reset · chain reset", p: "−1", cls: "pass" });
    return true;
  }
  function descend(S) {
    if (S.phase !== "round" || S.descend <= 0 || !S.rung) return false;
    S.descend -= 1; S.rung = null; S.sel = [];
    S.log.push({ t: "Step Down", c: "chain ×" + chainPos(S) + " kept", p: "", cls: "bonus" });
    return true;
  }
  function chisel(S, i, nr) {
    if (S.phase !== "round" || S.chisel <= 0 || !S.hand[i] || S.hand[i].h || isWild(S.hand[i]) || nr < 2 || nr > 14) return false;
    const old = S.hand[i].r;
    S.hand[i] = Object.assign({}, S.hand[i], { r: nr });
    S.hand.sort(cmp);
    S.chisel -= 1; S.sel = [];
    S.log.push({ t: "Chisel", c: rname(old) + " → " + rname(nr), p: "", cls: "bonus" });
    return true;
  }
  const canPass = (S) => S.phase === "round" && S.breaths > 0 && !!S.rung && chal(S) !== "nopass";
  function stuck(S) {
    if (S.phase !== "round" || hasLegal(S)) return false;
    if (S.rung && (S.descend > 0 || canPass(S) || aceIndex(S) >= 0)) return false;
    return true;
  }
  function stuckReason(S) {
    if (!S.rung) return "No hand left in these cards. Round over.";
    if (aceIndex(S) >= 0) return "Nothing climbs. An Ace alone resets the rung — chain kept.";
    if (S.descend > 0) return "Nothing climbs. Step Down keeps your chain.";
    if (canPass(S)) return "Nothing climbs. Pass to reset — costs a breath.";
    if (chal(S) === "nopass") return "Nothing climbs, and passing is off. Round over.";
    return "Nothing climbs, no breaths left. Round over.";
  }
  function finish(S) {
    if (S.phase !== "round") return null;
    const T = target(S);
    if (S.score < T) { S.phase = "lost"; return { cleared: false }; }
    const ex = S.score - T;
    const earn = (CFG.rewardBase + Math.floor(ex / CFG.rewardPer)) * (chal(S) === "richair" ? 2 : 1);
    S.money += earn;
    if (S.ante === TARGETS.length - 1) { S.phase = "won"; return { cleared: true, won: true, ex, earn }; }
    S.phase = "shop";
    S.offers = makeOffers(S);
    return { cleared: true, won: false, ex, earn };
  }
  function makeOffers(S) {
    const p = POOL.filter((o) => o.id !== "th" || S.removed.length < 5).map((o) => o.id);
    const out = [];
    while (out.length < CFG.offers && p.length) out.push({ kind: "up", id: p.splice(Math.floor(next(S) * p.length), 1)[0], bought: false });
    const keys = Object.keys(ENH), tw = keys.reduce((a, k) => a + ENH[k].w, 0);
    for (let i = 0; i < CFG.cardOffers; i++) {
      let x = next(S) * tw, e = keys[0];
      for (const k of keys) { x -= ENH[k].w; if (x <= 0) { e = k; break; } }
      out.push({ kind: "card", card: { r: 2 + Math.floor(next(S) * 13), si: Math.floor(next(S) * 4), e }, bought: false });
    }
    return out;
  }
  const offerCost = (o) => (o.kind === "card" ? ENH[o.card.e].cost : poolById[o.id].cost);
  function buy(S, i) {
    const o = S.offers[i];
    if (S.phase !== "shop" || !o || o.bought || offerCost(o) > S.money) return false;
    S.money -= offerCost(o);
    if (o.kind === "card") S.deck.push(Object.assign({ id: S.nextId++ }, o.card));
    else apply(S, o.id);
    o.bought = true;
    return true;
  }
  function nextAnte(S) {
    if (S.phase !== "shop") return false;
    S.ante += 1;
    startRound(S);
    return true;
  }
  const upcoming = (S) => (S.chals[S.ante + 1] ? chalById[S.chals[S.ante + 1]] : null);
  const current = (S) => (S.chal ? chalById[S.chal] : null);

  /* ---------- σειριοποίηση ---------- */
  const serialize = (S) => JSON.stringify(S);
  function restore(json) {
    try {
      const S = JSON.parse(json);
      if (!S || S.v !== 2 || !Array.isArray(S.hand) || !Array.isArray(S.deck)) return null;
      return S;
    } catch (e) { return null; }
  }
  const todaySeed = (d) => {
    d = d || new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  };

  return {
    SUITS, TIERS, TARGETS, CFG, POOL, poolById, ENH, CHALLENGES, chalById, rname,
    newRun, startRound, target, roundHandSize,
    classify, isLegal, chainPos, cbase, factor, cscore, clabel, evalSel, selection, isAce, isWild,
    candidates, legalMoves, hasLegal, cheapest, aceIndex,
    toggle, reveal, play, pass, canPass, descend, chisel, stuck, stuckReason, finish, buy, offerCost, nextAnte, upcoming, current,
    serialize, restore, todaySeed,
  };
});
