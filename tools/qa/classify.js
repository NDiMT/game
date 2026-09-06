/* Ανεξάρτητος ελεγκτής του classify(): πόκερ ώς 5 φύλλα, με τζόκερ.
   Ο «μάντης» δεν ξαναγράφει τη λογική του παιχνιδιού — απαριθμεί: για κάθε τζόκερ δοκιμάζει
   ΚΑΘΕ φύλλο (13 βαθμίδες × 4 χρώματα) και κρατά το καλύτερο αποτέλεσμα ενός αυστηρού,
   γραμμένου-από-την-αρχή αξιολογητή πόκερ. Αν οι δύο διαφωνήσουν, φταίει το ένα από τα δύο.
   node tools/qa/classify.js [N] */
const G = require("../../site/raise/game.js");
const N = +process.argv[2] || 60000;

/* --- αξιολογητής χωρίς μπαλαντέρ: γυρίζει {tier, rank} ή null --- */
function evalPlain(cs) {
  const n = cs.length;
  if (!n || n > 5) return null;
  const by = {}; cs.forEach((c) => { by[c.r] = (by[c.r] || 0) + 1; });
  const ranks = Object.keys(by).map(Number).sort((a, b) => a - b);
  const cnt = ranks.map((r) => by[r]).sort((a, b) => b - a);
  const hi = ranks[ranks.length - 1];
  const suited = cs.every((c) => c.si === cs[0].si);
  const run5 = n === 5 && ranks.length === 5 && hi - ranks[0] === 4;
  if (n === 1) return null;   /* κάτω από ζευγάρι δεν υπάρχει χέρι */
  if (n === 2) return cnt[0] === 2 ? { tier: 1, rank: hi } : null;
  if (n === 3) return cnt[0] === 3 ? { tier: 3, rank: hi } : null;
  if (n === 4) {
    if (cnt[0] === 4) return { tier: 7, rank: hi };
    if (cnt[0] === 2 && cnt[1] === 2) return { tier: 2, rank: hi };
    return null;
  }
  if (run5 && suited) return { tier: 8, rank: hi };
  if (cnt[0] === 3 && cnt[1] === 2) return { tier: 6, rank: ranks.find((r) => by[r] === 3) };
  if (suited) return { tier: 5, rank: hi };
  if (run5) return { tier: 4, rank: hi };
  return null;
}
const better = (a, b) => !b || a.tier > b.tier || (a.tier === b.tier && a.rank > b.rank);

/* --- μάντης με μπαλαντέρ: απαρίθμηση --- */
function oracle(cs) {
  const wilds = [], fixed = [];
  cs.forEach((c) => (G.isWild(c) ? wilds : fixed).push(c));
  if (!wilds.length) return evalPlain(cs);
  let best = null;
  const assign = [];
  (function go(i) {
    if (i === wilds.length) {
      const r = evalPlain(fixed.concat(assign));
      if (r && better(r, best)) best = r;
      return;
    }
    for (let r = 2; r <= 14; r++) for (let si = 0; si < 4; si++) { assign.push({ r, si }); go(i + 1); assign.pop(); }
  })(0);
  return best;
}

const TIER = G.KINDS.slice(1).reduce((m, k) => { m[G.KINDS.indexOf(k)] = k.tier; return m; }, {});
let bad = 0, tested = 0, wildTested = 0;
function check(cs, tag) {
  tested++;
  const mine = G.classify(cs), want = oracle(cs);
  const mt = mine ? { tier: TIER[mine.kind], rank: mine.rank } : null;
  const same = (!mt && !want) || (mt && want && mt.tier === want.tier && mt.rank === want.rank);
  if (!same && bad < 12) {
    console.log("ΔΙΑΦΩΝΙΑ " + tag + ": " + cs.map((c) => (G.isWild(c) ? "★" : G.rname(c.r) + G.SUITS[c.si].s)).join(" ") +
      " → δικό μας " + (mine ? G.clabel(mine) + " (tier " + mt.tier + ", rank " + mt.rank + ")" : "—") +
      " · μάντης " + (want ? "tier " + want.tier + ", rank " + want.rank : "—"));
  }
  if (!same) bad++;
}

/* τυχαία χέρια 1–5 φύλλων, ώς 2 τζόκερ (η απαρίθμηση είναι 52^w) */
let id = 0;
for (let i = 0; i < N; i++) {
  const n = 1 + Math.floor(Math.random() * 5);   /* περιλαμβάνει και μονά, που πρέπει να απορρίπτονται */
  const w = Math.random() < 0.25 ? (Math.random() < 0.7 ? 1 : 2) : 0;
  const cs = [];
  for (let j = 0; j < n; j++) {
    if (j < w) { cs.push({ id: ++id, r: 0, si: 0, e: "wild" }); continue; }
    cs.push({ id: ++id, r: 2 + Math.floor(Math.random() * 13), si: Math.floor(Math.random() * 4) });
  }
  if (w) wildTested++;
  check(cs, "τυχαίο");
}
/* στοχευμένα: κάθε τύπος, καθαρός */
const c = (r, si) => ({ id: ++id, r, si });
const W = () => ({ id: ++id, r: 0, si: 0, e: "wild" });
[
  [[c(9, 0)], "μονό (άκυρο)"], [[c(14, 2)], "μονός άσος (άκυρο)"],
  [[c(9, 0), c(9, 1)], "pair"], [[c(9, 0), c(9, 1), c(4, 2), c(4, 3)], "two pair"],
  [[c(7, 0), c(7, 1), c(7, 2)], "trips"], [[c(7, 0), c(7, 1), c(7, 2), c(7, 3)], "quads"],
  [[c(7, 0), c(7, 1), c(7, 2), c(4, 0), c(4, 1)], "full"],
  [[c(5, 0), c(6, 1), c(7, 2), c(8, 3), c(9, 0)], "straight"],
  [[c(2, 1), c(5, 1), c(9, 1), c(12, 1), c(14, 1)], "flush"],
  [[c(5, 1), c(6, 1), c(7, 1), c(8, 1), c(9, 1)], "sflush"],
  [[c(10, 3), c(11, 3), c(12, 3), c(13, 3), c(14, 3)], "royal"],
  [[c(14, 0), c(2, 1), c(3, 2), c(4, 3), c(5, 0)], "wheel (δεν μετράει)"],
  [[W(), c(9, 1)], "★+9"], [[W(), W(), c(9, 1)], "★★+9"],
  [[W(), c(5, 1), c(6, 1), c(8, 1), c(9, 1)], "★ κέντα ίδιου χρώματος"],
  [[c(3, 0), c(3, 1), c(3, 2), W(), c(8, 0)], "τριάδα+★+σκουπίδι"],
  [[c(2, 0), c(7, 1), c(9, 2), c(11, 3), c(13, 0)], "τίποτα"],
].forEach(([cs, tag]) => check(cs, tag));

console.log("χέρια που ελέγχθηκαν: " + tested + " (με τζόκερ: " + wildTested + ")");
console.log("διαφωνίες: " + bad);
