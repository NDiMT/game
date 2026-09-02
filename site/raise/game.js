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
    { name: "Ζεύγος", short: "ΖΕΥ", base: 10, size: 2 },
    { name: "Τριάδα", short: "ΤΡΙ", base: 25, size: 3 },
    { name: "Κέντα", short: "ΚΕΝ", base: 40, size: 5 },
    { name: "Χρώμα", short: "ΧΡΩ", base: 60, size: 5 },
    { name: "Φουλ", short: "ΦΟΥΛ", base: 80, size: 5 },
    { name: "Καρέ", short: "ΚΑΡΕ", base: 120, size: 4 },
  ];
  /* Βαθμονομημένο με tools/sweep.js: άπληστο bot με Σμίλη κερδίζει ~23%,
     θάνατοι ομοιόμορφοι από το ante 2 ως το 8 — κανένας γκρεμός. */
  const TARGETS = [100, 145, 215, 320, 470, 700, 1030, 1500];
  /* Οικονομία: ρυθμίζεται από το tools/sim.js για βαθμονόμηση. */
  const CFG = {
    rewardBase: 12, rewardPer: 60,
    offers: 4,
    /* Το πρώτο χέρι του run ξαναμοιράζεται μέχρι να καθαρίζει τον στόχο με
       απλό, άπληστο παίξιμο. Onboarding: κανείς δεν πεθαίνει στο ante 1
       από νεκρό χέρι. Από το ante 2 και μετά, τα ορφανά είναι το παιχνίδι. */
    firstHandFloor: 1.0,
    firstHandTries: 40,
    chisel0: 1, // Σμίλες με τις οποίες ξεκινά το run — το εργαλείο που διδάσκει το παιχνίδι
  };
  const HAND_BASE = 15;
  const BREATHS_BASE = 3;

  /* Οι αναβαθμίσεις είναι δεδομένα, όχι συναρτήσεις, ώστε το state να
     σειριοποιείται ακέραιο. Το `apply` τις εφαρμόζει. */
  const POOL = [
    { id: "m1", name: "Ζεύγη ×2", desc: "Η βάση των ζευγαριών ανεβαίνει ένα βήμα.", cost: 5 },
    { id: "m2", name: "Τριάδες ×2", desc: "Η βάση των τριάδων ανεβαίνει ένα βήμα.", cost: 7 },
    { id: "m3", name: "Κέντες ×2", desc: "Η βάση των κεντών ανεβαίνει ένα βήμα.", cost: 8 },
    { id: "m4", name: "Χρώματα ×2", desc: "Η βάση των χρωμάτων ανεβαίνει ένα βήμα.", cost: 9 },
    { id: "m5", name: "Φουλ ×2", desc: "Η βάση των φουλ ανεβαίνει ένα βήμα.", cost: 10 },
    { id: "m6", name: "Καρέ ×2", desc: "Η βάση των καρέ ανεβαίνει ένα βήμα.", cost: 10 },
    { id: "br", name: "Ανάση", desc: "+1 Ανάση σε κάθε γύρο.", cost: 6 },
    { id: "ch", name: "Σμίλη", desc: "+1 χρήση ανά γύρο: αλλάζεις την αξία ενός φύλλου. Σβήνει ορφανά.", cost: 7 },
    { id: "de", name: "Κατέβασμα", desc: "+1 χρήση ανά γύρο: μηδενίζεις το Σκαλί χωρίς να σπάσεις την Αλυσίδα.", cost: 11 },
    { id: "wi", name: "Πλατύ χέρι", desc: "+1 φύλλο στο χέρι κάθε γύρο.", cost: 8 },
    { id: "cs", name: "Ενίσχυση Αλυσίδας", desc: "Η Αλυσίδα ξεκινά ένα σκαλί ψηλότερα.", cost: 12 },
    { id: "th", name: "Καθαριστής", desc: "Αφαιρεί μόνιμα τη χαμηλότερη αξία από την τράπουλα. Πυκνώνει τα χέρια.", cost: 7 },
  ];
  const poolById = Object.fromEntries(POOL.map((o) => [o.id, o]));

  function apply(S, id) {
    switch (id) {
      case "m1": case "m2": case "m3": case "m4": case "m5": case "m6":
        S.mult[+id[1]] += 1; break;
      case "br": S.breathsMax += 1; break;
      case "ch": S.chiselMax += 1; break;
      case "de": S.descendMax += 1; break;
      case "wi": S.handSize += 1; break;
      case "cs": S.chainStart += 1; break;
      case "th":
        for (let r = 2; r <= 14; r++) if (!S.removed.includes(r)) { S.removed.push(r); break; }
        break;
    }
    S.bought[id] = (S.bought[id] || 0) + 1;
  }

  /* ---------- RNG (σειριοποιήσιμη κατάσταση) ---------- */
  function hash(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return (h ^ (h >>> 16)) >>> 0;
  }
  function next(S) {
    // mulberry32 πάνω στο S.rng, ώστε να αποθηκεύεται μαζί με το run
    S.rng = (S.rng + 0x6d2b79f5) | 0;
    let t = Math.imul(S.rng ^ (S.rng >>> 15), 1 | S.rng);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /* ---------- run / γύρος ---------- */
  function newRun(seedStr) {
    const seed = String(seedStr || "").trim() || String(Math.floor(Math.random() * 1e9));
    const S = {
      v: 1, seed, rng: hash(seed) | 0,
      ante: 0, money: 0,
      handSize: HAND_BASE, breathsMax: BREATHS_BASE, chiselMax: CFG.chisel0, descendMax: 0, chainStart: 0,
      mult: [0, 1, 1, 1, 1, 1, 1], removed: [], bought: {},
      phase: "round", // round | shop | lost | won
      offers: [],
    };
    startRound(S);
    return S;
  }

  const cmp = (a, b) => a.r - b.r || a.si - b.si;
  const target = (S) => TARGETS[S.ante];

  function deal(S) {
    const d = [];
    for (let r = 2; r <= 14; r++) {
      if (S.removed.includes(r)) continue;
      for (let si = 0; si < 4; si++) d.push({ r, si });
    }
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(next(S) * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d.slice(0, S.handSize).sort(cmp);
  }
  /* Άπληστο σκορ ενός χεριού: φθηνότερη νόμιμη ανάβαση, πάσο όταν κολλάει. */
  function greedyScore(S, hand) {
    const T = Object.assign({}, S, { hand: hand.slice(), sel: [], rung: null, chain: 0, score: 0,
      breaths: S.breathsMax, descend: S.descendMax, played: [], log: [], phase: "round" });
    for (let guard = 0; guard < 60; guard++) {
      const m = cheapest(T);
      if (m) { T.sel = m.idx.slice(); play(T); if (!T.hand.length) break; continue; }
      if (T.rung && T.breaths > 0) { pass(T); continue; }
      break;
    }
    return T.score;
  }
  function startRound(S) {
    let hand = deal(S);
    if (S.ante === 0 && CFG.firstHandFloor > 0) {
      for (let t = 0; t < CFG.firstHandTries; t++) {
        if (greedyScore(S, hand) >= target(S) * CFG.firstHandFloor) break;
        hand = deal(S);
      }
    }
    S.hand = hand;
    S.sel = [];
    S.rung = null;
    S.chain = 0;
    S.score = 0;
    S.breaths = S.breathsMax;
    S.chisel = S.chiselMax;
    S.descend = S.descendMax;
    S.played = [];
    S.log = [];
    S.phase = "round";
    S.offers = [];
  }

  /* ---------- αξιολόγηση χεριού ---------- */
  function classify(cs) {
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
      if (Object.keys(bS).length === 1) return { tier: 4, rank: hi }; // κέντα-χρώμα = χρώμα
      if (co.length === 5) {
        const rs = co.map((c) => c[0]).sort((a, b) => a - b);
        if (rs[4] - rs[0] === 4) return { tier: 3, rank: hi };
      }
    }
    return null;
  }
  function isLegal(S, k) {
    if (!k) return false;
    if (!S.rung) return true;
    return k.tier > S.rung.tier || (k.tier === S.rung.tier && k.rank > S.rung.rank);
  }
  const chainPos = (S) => S.chain + 1 + S.chainStart;
  const cbase = (S, k) => TIERS[k.tier].base * S.mult[k.tier];
  const cscore = (S, k) => cbase(S, k) * chainPos(S);
  const clabel = (k) => TIERS[k.tier].name + " " + rname(k.rank);
  const selection = (S) => classify(S.sel.map((i) => S.hand[i]));

  /* ---------- υποψήφιες κινήσεις ---------- */
  function candidates(S) {
    const out = [], bR = {}, bS = {};
    S.hand.forEach((c, i) => { (bR[c.r] = bR[c.r] || []).push(i); (bS[c.si] = bS[c.si] || []).push(i); });
    const rs = Object.keys(bR).map(Number).sort((a, b) => a - b);
    rs.forEach((r) => {
      const g = bR[r];
      if (g.length >= 2) out.push(g.slice(0, 2));
      if (g.length >= 3) out.push(g.slice(0, 3));
      if (g.length >= 4) out.push(g.slice(0, 4));
    });
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
    return out.map((idx) => ({ idx, k: classify(idx.map((i) => S.hand[i])) })).filter((o) => o.k);
  }
  const legalMoves = (S) => candidates(S).filter((o) => isLegal(S, o.k));
  const hasLegal = (S) => legalMoves(S).length > 0;
  /* Η φθηνότερη νόμιμη ανάβαση κρατά την κλίμακα ανοιχτή. */
  function cheapest(S) {
    let b = null;
    legalMoves(S).forEach((o) => {
      const key = o.k.tier * 10000 + o.k.rank * 100 + o.idx.length;
      if (!b || key < b.key) b = { idx: o.idx, k: o.k, key };
    });
    return b;
  }

  /* ---------- ενέργειες: επιστρέφουν ένα event για το UI ---------- */
  function toggle(S, i) {
    if (S.phase !== "round") return false;
    const at = S.sel.indexOf(i);
    if (at >= 0) S.sel.splice(at, 1);
    else if (S.sel.length < 5) S.sel.push(i);
    else return false;
    return true;
  }
  function play(S) {
    const k = selection(S);
    if (!k || !isLegal(S, k) || S.phase !== "round") return null;
    const pos = chainPos(S), pts = cscore(S, k), cs = S.sel.map((i) => S.hand[i]);
    S.score += pts; S.chain += 1; S.rung = { tier: k.tier, rank: k.rank };
    S.played = cs.slice();
    S.log.push({ t: clabel(k), c: cbase(S, k) + " × " + pos, p: pts });
    S.hand = S.hand.filter((_, i) => !S.sel.includes(i));
    S.sel = [];
    const ev = { type: "play", k, pts, pos, emptied: false, bonus: 0 };
    if (S.hand.length === 0) {
      ev.emptied = true;
      ev.bonus = Math.round(S.score * 0.5);
      S.score += ev.bonus;
      S.log.push({ t: "Άδειασμα χεριού", c: "+50%", p: ev.bonus, cls: "bonus" });
    }
    return ev;
  }
  function pass(S) {
    if (S.phase !== "round" || S.breaths <= 0 || !S.rung) return false;
    S.breaths -= 1; S.rung = null; S.chain = 0; S.sel = []; S.played = [];
    S.log.push({ t: "Πάσο", c: "σκαλί 0 · αλυσίδα 0", p: "−1", cls: "pass" });
    return true;
  }
  function descend(S) {
    if (S.phase !== "round" || S.descend <= 0 || !S.rung) return false;
    S.descend -= 1; S.rung = null; S.sel = [];
    S.log.push({ t: "Κατέβασμα", c: "αλυσίδα ×" + chainPos(S), p: "", cls: "bonus" });
    return true;
  }
  function chisel(S, i, nr) {
    if (S.phase !== "round" || S.chisel <= 0 || !S.hand[i] || nr < 2 || nr > 14) return false;
    const old = S.hand[i].r;
    S.hand[i] = { r: nr, si: S.hand[i].si };
    S.hand.sort(cmp);
    S.chisel -= 1; S.sel = [];
    S.log.push({ t: "Σμίλη", c: rname(old) + " → " + rname(nr), p: "", cls: "bonus" });
    return true;
  }
  /* Ο γύρος έχει κολλήσει όταν δεν υπάρχει νόμιμη κίνηση και κανένα
     εργαλείο δεν αλλάζει αυτό — Πάσο και Κατέβασμα βοηθούν μόνο με Σκαλί. */
  function stuck(S) {
    if (S.phase !== "round" || hasLegal(S)) return false;
    if (S.rung && (S.descend > 0 || S.breaths > 0)) return false;
    return true;
  }
  function stuckReason(S) {
    if (!S.rung) return "Κανένα νόμιμο χέρι με αυτά τα φύλλα. Ο γύρος κλείνει — τα ορφανά έμειναν αδιαμέλιστα.";
    if (S.descend > 0) return "Κανένα νόμιμο χέρι. Κατέβα για να μηδενίσεις το Σκαλί χωρίς να σπάσεις την Αλυσίδα.";
    if (S.breaths > 0) return "Κανένα νόμιμο χέρι. Πάσο για να μηδενίσεις το Σκαλί — κοστίζει Ανάση.";
    return "Κανένα νόμιμο χέρι και καμία Ανάση. Ο γύρος κλείνει.";
  }
  function finish(S) {
    if (S.phase !== "round") return null;
    const cleared = S.score >= target(S);
    if (!cleared) { S.phase = "lost"; return { cleared: false }; }
    const ex = S.score - target(S), earn = CFG.rewardBase + Math.floor(ex / CFG.rewardPer);
    S.money += earn;
    if (S.ante === TARGETS.length - 1) { S.phase = "won"; return { cleared: true, won: true, ex, earn }; }
    S.phase = "shop";
    S.offers = pick3(S);
    return { cleared: true, won: false, ex, earn };
  }
  function pick3(S) {
    const p = POOL.filter((o) => o.id !== "th" || S.removed.length < 5).map((o) => o.id);
    const out = [];
    while (out.length < CFG.offers && p.length) out.push(p.splice(Math.floor(next(S) * p.length), 1)[0]);
    return out.map((id) => ({ id, bought: false }));
  }
  function buy(S, i) {
    const o = S.offers[i];
    if (S.phase !== "shop" || !o || o.bought) return false;
    const item = poolById[o.id];
    if (item.cost > S.money) return false;
    S.money -= item.cost;
    apply(S, o.id);
    o.bought = true;
    return true;
  }
  function nextAnte(S) {
    if (S.phase !== "shop") return false;
    S.ante += 1;
    startRound(S);
    return true;
  }

  /* ---------- σειριοποίηση ---------- */
  const serialize = (S) => JSON.stringify(S);
  function restore(json) {
    try {
      const S = JSON.parse(json);
      if (!S || S.v !== 1 || !Array.isArray(S.hand)) return null;
      return S;
    } catch (e) { return null; }
  }
  const todaySeed = (d) => {
    d = d || new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  };

  return {
    SUITS, TIERS, TARGETS, CFG, POOL, poolById, rname,
    newRun, startRound, target,
    classify, isLegal, chainPos, cbase, cscore, clabel, selection,
    candidates, legalMoves, hasLegal, cheapest,
    toggle, play, pass, descend, chisel, stuck, stuckReason, finish, buy, nextAnte,
    serialize, restore, todaySeed,
  };
});
