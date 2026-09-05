/* Πού γεννιέται η διασπορά του σκορ.

   node tools/variance.js [N] [strategy]   κατανομή σκορ ανά ante + ανάλυση Mult + counterfactuals
   node tools/variance.js hands            πίνακας: τι ποσοστό του στόχου πληρώνει κάθε σχήμα

   Το κάθε παίξιμο αποσυντίθεται σε
       pts = chips × (base + upgrades + patient) × chain × enh × charms/rules
   και ξαναϋπολογίζεται με έναν όρο κάθε φορά ουδετεροποιημένο. Ο όρος που, όταν φύγει,
   μαζεύει περισσότερο το p90/p10 του γύρου, είναι ο πραγματικός οδηγός της διασποράς. */
const G = require("../site/raise/game.js");
const MODE = process.argv[2] === "hands" ? "hands" : "runs";
const N = +process.argv[2] || 40, STRAT = process.argv[3] || "finisher";
const ALL = G.CHARMS.map((c) => c.id);
/* Σειρά επιλογής, ταξινομημένη κατά ΜΕΤΡΗΜΕΝΗ οριακή αξία (tools/audit2.js).
   Η παλιά σειρά έβαζε το m1 δεύτερο ανάμεσα στα perks· επειδή το m1 έχει maxBuy 20 ρουφούσε
   κάθε επιλογή και το bot δεν έπαιρνε ποτέ Wide Hand ή Cull. Μετρημένο (tools/prio.js 800,
   ίδια seeds, ίδια πολιτική παιξίματος): μέσο ante θανάτου 19,23 → 32,01 · νίκες 9/800 → 267/800. */
const PRIO = (process.env.PRIO || "patient,court,kingmaker,mirror,climber,encore,loyal,lowroad,sleight,wind,ember,scout,leap,summiteer,cheap,goldsmith,ladder,afterburner,wi,pl,th,m2,cs,m1,gt,di").split(",");

const q = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(p * (b.length - 1))] : NaN; };
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const sdlog = (a) => { const l = a.filter((x) => x > 0).map(Math.log); if (l.length < 2) return NaN; const m = mean(l); return Math.sqrt(mean(l.map((x) => (x - m) * (x - m)))); };
const f1 = (x) => (isFinite(x) ? x.toFixed(1) : "-");
const f2 = (x) => (isFinite(x) ? x.toFixed(2) : "-");

/* ---------- 1. πίνακας σχημάτων ---------- */
function handsTable() {
  const card = (r, si) => ({ id: r * 10 + si, r, si });
  const cases = [
    ["Pair 8", [card(8, 0), card(8, 1)]],
    ["Pair A", [card(14, 0), card(14, 1)]],
    ["Pair 3", [card(3, 0), card(3, 1)]],
    ["Two Pair 9", [card(9, 0), card(9, 1), card(5, 0), card(5, 1)]],
    ["Trips 9", [card(9, 0), card(9, 1), card(9, 2)]],
    ["Stairs 4-5", [card(4, 0), card(4, 1), card(5, 0), card(5, 1)]],
    ["Straight 5-9", [card(5, 0), card(6, 1), card(7, 2), card(8, 3), card(9, 0)]],
    ["Full House 9", [card(9, 0), card(9, 1), card(9, 2), card(4, 0), card(4, 1)]],
    ["Quads 9", [card(9, 0), card(9, 1), card(9, 2), card(9, 3)]],
    ["Str.Flush 5-9", [card(5, 0), card(6, 0), card(7, 0), card(8, 0), card(9, 0)]],
  ];
  const S = G.newRun("hands-table", []);
  S.chal = null; S.rules = {}; S.charms = []; S.rung = null;
  /* ante 1 = ο πρώτος γύρος = TARGETS[0] */
  const antes = [1, 5, 10];
  const chains = [0, 4];
  let head = "hand".padEnd(15);
  antes.forEach((a) => chains.forEach((c) => { head += ("a" + a + (c ? " ×" + (c + 1) : " 1st")).padStart(10); }));
  console.log(head);
  cases.forEach(([name, cs]) => {
    const k = G.classify(cs);
    let line = name.padEnd(15);
    antes.forEach((a) => chains.forEach((c) => {
      S.ante = a - 1; S.chain = c; S.rung = null;
      const sc = G.scoreOf(S, k, cs);
      const T = G.tgtAt(a - 1);
      line += (Math.round(100 * sc.pts / T) + "%").padStart(10);
    }));
    console.log(line);
  });
  console.log("");
  console.log("targets: " + antes.map((a) => "a" + a + " " + G.tgtAt(a - 1)).join(" · "));
  console.log("Ace pair / 3 pair ratio: " + f2(G.scoreOf(S, G.classify(cases[1][1]), cases[1][1]).pts / G.scoreOf(S, G.classify(cases[2][1]), cases[2][1]).pts));
  /* πλήρης γύρος: 5 παιξίματα σε ανεβαίνουσα αλυσίδα, μεσαία χέρια */
  const round = [
    ["Pair 5", [card(5, 0), card(5, 1)]],
    ["Pair 9", [card(9, 0), card(9, 1)]],
    ["Pair K", [card(13, 0), card(13, 1)]],
    ["Trips 7", [card(7, 0), card(7, 1), card(7, 2)]],
    ["Full House 10", [card(10, 0), card(10, 1), card(10, 2), card(6, 0), card(6, 1)]],
  ];
  [1, 5, 10].forEach((a) => {
    S.ante = a - 1; S.chain = 0; S.rung = null;
    let tot = 0; const bits = [];
    round.forEach(([nm, cs], i) => {
      const k = G.classify(cs); S.chain = i;
      const sc = G.scoreOf(S, k, cs); tot += sc.pts; bits.push(nm + " " + sc.pts);
    });
    console.log("solid 5-play round a" + a + ": " + tot + " vs target " + G.tgtAt(a - 1) + " = ×" + f2(tot / G.tgtAt(a - 1)) + "  [" + bits.join(" · ") + "]");
  });
}

/* ---------- 2. instrumented runs ---------- */
/* Η αλυσίδα ΔΕΝ προσθέτει πια Mult — το πολλαπλασιάζει. Τα regex είχαν μείνει στο παλιό
   μοντέλο («Chain ×N · +X Mult», «Gold + Glass»), οπότε chain=0 και enh=1 ΠΑΝΤΑ και όλη η
   αλυσίδα κρυβόταν μέσα στο υπόλοιπο `hm`: η στήλη fixChain δεν πάγωνε τίποτα. */
function parts(S, ev, cs) {
  const k = ev.k, base = G.kmult(k), up = S.mult[k.kind] || 0;
  let chain = 1, patient = 0, enh = 1;
  (ev.notes || []).forEach((n) => {
    let m;
    if ((m = /^Chain ×\d+ · Mult ×([\d.]+)$/.exec(n))) chain = +m[1];
    else if ((m = /^Patient \+([\d.]+) Mult$/.exec(n))) patient = +m[1];
    else if ((m = /^(?:Gold|Silver|Gold \+ Silver) ×([\d.]+)$/.exec(n))) enh = +m[1];
  });
  const add = base + up + patient;
  const hm = add * chain * enh > 0 ? ev.mult / (add * chain * enh) : 1;
  return { chips: ev.chips, base, up, chain, patient, add, enh, hm: Math.round(hm * 1000) / 1000, kchips: G.kchips(k), cards: G.cardChips(cs || []) };
}
/* Counterfactual: ο όρος παίρνει την τυπική του τιμή (διάμεσο) αντί για τη δική του.
   Έτσι μετριέται η διασπορά που ΠΡΟΣΘΕΤΕΙ ο όρος, όχι το επίπεδο που αφαιρεί. */
const VKEYS = ["act", "fixChain", "fixEnh", "fixCharm", "fixUp", "fixKind", "fixCards", "noChain"];
function variants(p, M) {
  const extra = p.chips - p.kchips - p.cards;
  const mk = (add, chips, chain, enh, hm) => chips * add * chain * enh * hm;
  return {
    act: mk(p.add, p.chips, p.chain, p.enh, p.hm),
    fixChain: mk(p.add, p.chips, M.chain, p.enh, p.hm),
    fixEnh: mk(p.add, p.chips, p.chain, M.enh, p.hm),
    fixCharm: mk(p.add, p.chips, p.chain, p.enh, M.hm),
    fixUp: mk(p.add - p.up + M.up, p.chips, p.chain, p.enh, p.hm),
    fixKind: mk(p.add - p.base + M.base, p.cards + M.kchips + extra, p.chain, p.enh, p.hm),
    fixCards: mk(p.add, p.kchips + M.cards + extra, p.chain, p.enh, p.hm),
    noChain: mk(p.add, p.chips, 1, p.enh, p.hm),
  };
}

const st = {
  score: Array.from({ length: 34 }, () => []), ratio: Array.from({ length: 34 }, () => []),
  rounds: [],
  plays: [], parts: [], lost: new Array(34).fill(0), wins: 0, nplays: 0,
};

function rankGroups(S) { const g = {}; S.hand.forEach((c, i) => { if (!c.h && !G.isWild(c)) (g[c.r] = g[c.r] || []).push(i); }); return g; }
function discardStep(S) {
  let o = G.orphans(S);
  if (!o.length) o = S.hand.map((_, i) => i).filter((i) => !S.hand[i].h && S.hand[i].r !== 14 && !G.isWild(S.hand[i])).slice(0, 2);
  if (!o.length) return false;
  S.sel = o.slice(0, Math.min(3, o.length)); return G.discard(S);
}
function playRound(S) {
  const pp = [];
  let n = 0;
  for (let guard = 0; guard < 200 && S.phase === "round"; guard++) {
    if (S.playsLeft < 1) break;
    let m = G.suggest(S);
    if (STRAT === "finisher" && S.playsLeft < 2) { let best = null, bp = -1; G.candidates(S).forEach((o) => { const p = G.scoreOf(S, o.k, o.idx.map((i) => S.hand[i])).pts; if (p > bp) { bp = p; best = o; } }); if (best) m = best; }
    if (m) {
      S.sel = m.idx.slice();
      const before = S.mult.slice(), cs = m.idx.map((i) => S.hand[i]);
      const ev = G.play(S);
      if (ev && ev.k) {
        const p = parts({ mult: before }, ev, cs);
        pp.push(p); st.parts.push(p); n++; st.nplays++;
      }
      continue;
    }
    if (G.canDiscardAny(S) && discardStep(S)) continue;
    break;
  }
  st.plays.push(n);
  const a = S.ante;
  st.score[a].push(S.score); st.ratio[a].push(S.score / G.target(S));
  st.rounds.push({ a, pp });
  if (S.phase === "round") G.finish(S);
}
function shop(S) {
  if (!S.offers.length) { G.nextAnte(S); return; }
  while (G.picksLeft(S) > 0) {
    const opts = S.offers.map((o, i) => ({ o, i, pr: PRIO.indexOf(o.id) })).filter((x) => !x.o.bought && x.pr >= 0 && G.canTake(S, x.i).ok).sort((a, b) => a.pr - b.pr);
    if (!opts.length) break;
    G.take(S, opts[0].i);
  }
  G.nextAnte(S);
}

function runs() {
  for (let s = 0; s < N; s++) {
    const S = G.newRun("st-" + s, ALL);
    for (;;) {
      playRound(S);
      if (S.phase === "lost") { st.lost[S.ante]++; break; }
      if (S.phase === "won") { st.wins++; break; }
      shop(S);
    }
  }
  const T = G.TARGETS.length;
  console.log(`runs ${N} · strategy ${STRAT} · wins ${st.wins} · plays/round ${f2(mean(st.plays))}`);
  console.log("");
  console.log("ROUND SCORE ANA ANTE (p10 p25 p50 p75 p90) και λόγος προς στόχο");
  console.log("ante  n   target      p10      p25      p50      p75      p90   p10/T  p50/T  p90/T  p90/p10");
  for (let a = 0; a < Math.min(T, 30); a++) {
    const A = st.score[a]; if (A.length < 4) continue;
    const tg = G.tgtAt(a);
    console.log(
      String(a + 1).padStart(4) + String(A.length).padStart(4) + String(tg).padStart(9) +
      [q(A, .1), q(A, .25), q(A, .5), q(A, .75), q(A, .9)].map((x) => String(Math.round(x)).padStart(9)).join("") +
      f2(q(A, .1) / tg).padStart(8) + f2(q(A, .5) / tg).padStart(7) + f2(q(A, .9) / tg).padStart(7) +
      f1(q(A, .9) / Math.max(1, q(A, .1))).padStart(9));
  }
  console.log("");
  const P0 = st.parts;
  const M = { chain: q(P0.map((p) => p.chain), .5), enh: q(P0.map((p) => p.enh), .5), hm: q(P0.map((p) => p.hm), .5),
    up: q(P0.map((p) => p.up), .5), base: q(P0.map((p) => p.base), .5), kchips: q(P0.map((p) => p.kchips), .5), cards: q(P0.map((p) => p.cards), .5) };
  console.log("ΔΙΑΣΠΟΡΑ: κάθε όρος καθηλωμένος στην τυπική του τιμή (antes 1-12, ln-κανονικοποίηση ανά ante)");
  console.log("  τυπικές τιμές: chain " + M.chain + " · enh " + M.enh + " · charms " + M.hm + " · upgrades " + M.up + " · base " + M.base + " · kchips " + M.kchips + " · cards " + M.cards);
  console.log("variant      sd(ln)   Δsd%  p90/p10   p50/p10   p50");
  const tot = {}; VKEYS.forEach((k) => { tot[k] = []; });
  for (let a = 1; a <= 12; a++) {
    const rs = st.rounds.filter((r) => r.a === a && r.pp.length);
    if (rs.length < 4) continue;
    const sums = rs.map((r) => { const o = {}; VKEYS.forEach((k) => { o[k] = 0; }); r.pp.forEach((p) => { const v = variants(p, M); VKEYS.forEach((k) => { o[k] += v[k]; }); }); return o; });
    const med = q(sums.map((o) => o.act), .5) || 1;
    VKEYS.forEach((k) => sums.forEach((o) => { if (o[k] > 0) tot[k].push(o[k] / med); }));
  }
  const base = sdlog(tot.act);
  VKEYS.forEach((key) => {
    const A = tot[key], sd = sdlog(A);
    console.log(key.padEnd(12) + f2(sd).padStart(7) + f1(100 * (sd - base) / base).padStart(7) +
      f1(q(A, .9) / Math.max(1e-9, q(A, .1))).padStart(9) + f2(q(A, .5) / Math.max(1e-9, q(A, .1))).padStart(10) + f2(q(A, .5)).padStart(6));
  });
  console.log("  plays/round p10 " + q(st.plays, .1) + " p50 " + q(st.plays, .5) + " p90 " + q(st.plays, .9));
  /* Σωρευτικά: κάθε όρος προστίθεται στους προηγούμενους καθηλωμένους. Ό,τι μένει είναι τύχη τραπουλας. */
  console.log("");
  console.log("ΣΩΡΕΥΤΙΚΑ (καθηλώνω έναν όρο κάθε φορά επιπλέον)");
  const STACK = [["+enh", ["fixEnh"]], ["+charms", ["fixEnh", "fixCharm"]], ["+kind", ["fixEnh", "fixCharm", "fixKind"]],
    ["+chain", ["fixEnh", "fixCharm", "fixKind", "fixChain"]], ["+upg", ["fixEnh", "fixCharm", "fixKind", "fixChain", "fixUp"]],
    ["+cards", ["fixEnh", "fixCharm", "fixKind", "fixChain", "fixUp", "fixCards"]]];
  const stack = (lo, hi) => STACK.forEach(([nm, keys]) => {
    let all = [];
    for (let a = lo; a <= hi; a++) {
      const rs = st.rounds.filter((r) => r.a === a && r.pp.length);
      if (rs.length < 4) continue;
      const sums = rs.map((r) => r.pp.reduce((x, p0) => {
        const p = Object.assign({}, p0);
        if (keys.indexOf("fixEnh") >= 0) p.enh = M.enh;
        if (keys.indexOf("fixCharm") >= 0) p.hm = M.hm;
        if (keys.indexOf("fixKind") >= 0) { p.add = p.add - p.base + M.base; p.chips = p.chips - p.kchips + M.kchips; }
        if (keys.indexOf("fixChain") >= 0) p.chain = M.chain;
        if (keys.indexOf("fixUp") >= 0) p.add = p.add - p.up + M.up;
        if (keys.indexOf("fixCards") >= 0) p.chips = p.chips - p.cards + M.cards;
        return x + p.chips * p.add * p.chain * p.enh * p.hm;
      }, 0));
      const med = q(sums, .5) || 1;
      sums.forEach((x) => { if (x > 0) all.push(x / med); });
    }
    console.log(nm.padEnd(12) + f2(sdlog(all)).padStart(7) + f1(q(all, .9) / Math.max(1e-9, q(all, .1))).padStart(16) + f2(q(all, .5) / Math.max(1e-9, q(all, .1))).padStart(10));
  });
  console.log("  antes 1-4:   variant  sd(ln)  p90/p10  p50/p10"); stack(1, 4);
  console.log("  antes 5-12:"); stack(5, 12);
  console.log("  antes 13-22:"); stack(13, 22);
  /* Τι διαφέρει ένας κακός γύρος από έναν μέτριο, στα πρώτα antes */
  console.log("");
  console.log("ANTES 1-4: κάτω δεκατημόριο vs διάμεσος vs πάνω δεκατημόριο");
  const early = st.rounds.filter((r) => r.a <= 3 && r.pp.length);
  const byAnte = {};
  early.forEach((r) => { (byAnte[r.a] = byAnte[r.a] || []).push(r); });
  const buckets = { low: [], mid: [], high: [] };
  Object.values(byAnte).forEach((rs) => {
    const withS = rs.map((r) => ({ r, s: r.pp.reduce((x, p) => x + p.chips * p.add * p.chain * p.enh * p.hm, 0) })).sort((a, b) => a.s - b.s);
    const n = withS.length;
    withS.forEach((o, i) => { const f = i / (n - 1 || 1); buckets[f <= 0.2 ? "low" : f >= 0.8 ? "high" : "mid"].push(o); });
  });
  console.log("bucket   n   score  plays  chips/play  chainAdd/play  baseMult/play  maxChainAdd  bigHands");
  ["low", "mid", "high"].forEach((b) => {
    const B = buckets[b], pl = B.map((o) => o.r.pp.length);
    const flat = B.reduce((a, o) => a.concat(o.r.pp), []);
    const big = mean(B.map((o) => o.r.pp.filter((p) => p.base >= 6).length));
    console.log(b.padEnd(8) + String(B.length).padStart(3) + String(Math.round(mean(B.map((o) => o.s)))).padStart(8) +
      f1(mean(pl)).padStart(7) + f1(mean(flat.map((p) => p.chips))).padStart(12) + f1(mean(flat.map((p) => p.chain))).padStart(15) +
      f1(mean(flat.map((p) => p.base + p.up))).padStart(15) + f1(mean(B.map((o) => Math.max.apply(null, o.r.pp.map((p) => p.chain))))).padStart(13) + f1(big).padStart(10));
  });
  console.log("");
  console.log("ΑΠΟ ΠΟΥ ΕΡΧΕΤΑΙ ΤΟ MULT (μέσος όρος ανά παίξιμο, " + st.nplays + " παιξίματα)");
  const P = st.parts;
  const sum = (f) => mean(P.map(f));
  console.log("  additive: base " + f2(sum((p) => p.base)) + " · upgrades " + f2(sum((p) => p.up)) +
    " · patient " + f2(sum((p) => p.patient)) + " = " + f2(sum((p) => p.add)));
  console.log("  shares:   base " + f2(100 * sum((p) => p.base / p.add)) + "% · upgrades " + f2(100 * sum((p) => p.up / p.add)) +
    "% · patient " + f2(100 * sum((p) => p.patient / p.add)) + "%");
  console.log("  chain mult: mean " + f2(sum((p) => p.chain)) + " (p50 " + f2(q(P.map((p) => p.chain), .5)) + " p90 " + f2(q(P.map((p) => p.chain), .9)) + " max " + f2(Math.max.apply(null, P.map((p) => p.chain))) + ")");
  console.log("  multiplicative: enh mean " + f2(sum((p) => p.enh)) + " (p50 " + f2(q(P.map((p) => p.enh), .5)) + " p90 " + f2(q(P.map((p) => p.enh), .9)) + " max " + f1(Math.max.apply(null, P.map((p) => p.enh))) + ")" +
    " · charms/rules mean " + f2(sum((p) => p.hm)) + " (p50 " + f2(q(P.map((p) => p.hm), .5)) + " p90 " + f2(q(P.map((p) => p.hm), .9)) + " max " + f1(Math.max.apply(null, P.map((p) => p.hm))) + ")");
  console.log("  total mult: p10 " + f1(q(P.map((p) => p.add * p.chain * p.enh * p.hm), .1)) + " p50 " + f1(q(P.map((p) => p.add * p.chain * p.enh * p.hm), .5)) +
    " p90 " + f1(q(P.map((p) => p.add * p.chain * p.enh * p.hm), .9)) + " p99 " + f1(q(P.map((p) => p.add * p.chain * p.enh * p.hm), .99)));
  console.log("  chips:      p10 " + f1(q(P.map((p) => p.chips), .1)) + " p50 " + f1(q(P.map((p) => p.chips), .5)) + " p90 " + f1(q(P.map((p) => p.chips), .9)));

  console.log("");
  console.log("deaths/ante: " + st.lost.slice(0, 30).join(" "));
  const md = st.lost.reduce((x, n2, i) => x + n2 * (i + 1), 0) / Math.max(1, N - st.wins);
  console.log("mean death ante " + f1(md) + " · wins " + st.wins);
}

if (MODE === "hands") handsTable(); else runs();
