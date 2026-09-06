/* Βαθμονόμηση Survival: ατέλειωτη τράπουλα, μόνο ανεβάσματα, ανάσες από ορόσημα σκορ.
   node tools/surv.js [N]            → τρέχουσες σταθερές, τρεις πολιτικές
   SWEEP=1 node tools/surv.js [N]    → σάρωση survDiscards × survStep × survGrow */
const G = require("../site/raise/game.js");
const N = +process.argv[2] || 200;
const pts = (S, o) => G.scoreOf(S, o.k, o.idx.map((i) => S.hand[i])).pts;
const cost = (k) => G.KINDS[k.kind].tier * 1e6 + k.size * 1e3 + k.rank;

/* greedy = πάντα το ακριβότερο ανέβασμα · cheap = το φθηνότερο (κρατά το rung χαμηλά)
   sharp  = cheap, αλλά το τελευταίο ανέβασμα (χωρίς ανάσα να ξοδέψεις) το ακριβότερο */
function run(seed, pol) {
  const S = G.newRun(seed, [], "survival");
  let breaths = 0, guard = 0;
  for (; guard < 4000 && S.phase === "round"; guard++) {
    const up = G.candidates(S).filter((o) => G.climbs(S, o.k));
    if (up.length) {
      const last = pol === "sharp" && G.discardsLeft(S) === 0;
      const m = pol === "hint" ? G.suggest(S) : (pol === "greedy" || last)
        ? up.reduce((b, o) => (!b || pts(S, o) > pts(S, b) ? o : b), null)
        : up.reduce((b, o) => (cost(o.k) < (b ? cost(b.k) : Infinity) ? o : b), null);
      S.sel = m.idx.slice();
      const ev = G.play(S);
      if (!ev) break;
      if (ev.breaths) breaths += ev.breaths;
      continue;
    }
    if (G.canDiscardAny(S) && G.discardsLeft(S) > 0) {
      const o = G.orphans(S);
      S.sel = (o.length ? o : S.hand.map((_, i) => i)).slice(0, 2);
      if (S.sel.length && G.discard(S)) continue;
    }
    break;
  }
  G.finish(S);
  return { s: S.score, h: S.stats.plays, c: S.stats.maxChain, b: breaths, d: S.rdisc, cap: guard >= 4000 };
}
const q = (a, f) => a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * f))];
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

function table(label) {
  const rows = ["greedy", "cheap", "sharp", "hint"].map((pol) => {
    const o = []; for (let i = 0; i < N; i++) o.push(run("sv-" + i, pol));
    const sc = o.map((x) => x.s);
    return { pol, p10: q(sc, .1), p50: q(sc, .5), p90: q(sc, .9), h: mean(o.map((x) => x.h)), c: q(o.map((x) => x.c), .5), b: mean(o.map((x) => x.b)), runaway: o.filter((x) => x.cap).length };
  });
  const base = rows[0].p50;
  console.log(label);
  console.log("  πολιτική    p10      p50      p90    χέρια  αλυσίδα  ανάσες  headroom  ατέρμονα");
  rows.forEach((r) => console.log("  " + r.pol.padEnd(9) + String(r.p10).padStart(7) + String(r.p50).padStart(9) + String(r.p90).padStart(9) +
    r.h.toFixed(0).padStart(7) + ("×" + r.c).padStart(9) + r.b.toFixed(1).padStart(8) +
    ("+" + (100 * (r.p50 / base - 1)).toFixed(0) + "%").padStart(10) + String(r.runaway).padStart(10)));
  const best = rows[2];
  console.log("  spread p90/p10 ×" + (best.p90 / best.p10).toFixed(2));
  return rows;
}

if (!process.env.SWEEP) { table("Survival · " + N + " runs · " + JSON.stringify({ d: G.CFG.survDiscards, step: G.CFG.survStep, grow: G.CFG.survGrow })); }
else {
  console.log("σάρωση · " + N + " runs ανά κελί · στόχος: 30-60 χέρια, headroom >60%, κανένα ατέρμονο\n");
  console.log("start  step   grow | χέρια  p50 σωστό  headroom  ανάσες(κερδ.)  spread  ατέρμονα");
  const DS = (process.env.DS || '4,5,6').split(',').map(Number), ST = (process.env.ST || '1200,1500,2000').split(',').map(Number), GR = (process.env.GR || '1.8,2.0,2.2').split(',').map(Number);
  for (const d of DS) for (const step of ST) for (const grow of GR) {
    G.CFG.survDiscards = d; G.CFG.survStep = step; G.CFG.survGrow = grow;
    const g = [], w = [];
    for (let i = 0; i < N; i++) { g.push(run("sv-" + i, "greedy")); w.push(run("sv-" + i, "sharp")); }
    const gs = q(g.map((x) => x.s), .5), ws = q(w.map((x) => x.s), .5);
    console.log(String(d).padStart(5) + String(step).padStart(7) + String(grow).padStart(7) + " | " +
      mean(w.map((x) => x.h)).toFixed(0).padStart(5) + String(ws).padStart(11) +
      ("+" + (100 * (ws / gs - 1)).toFixed(0) + "%").padStart(10) +
      mean(w.map((x) => x.b)).toFixed(1).padStart(15) +
      ("×" + (q(w.map((x) => x.s), .9) / q(w.map((x) => x.s), .1)).toFixed(2)).padStart(8) +
      ("  ↓×" + (ws / q(w.map((x) => x.s), .1)).toFixed(2) + " ↑×" + (q(w.map((x) => x.s), .9) / ws).toFixed(2)).padStart(16) +
      String(w.filter((x) => x.cap).length).padStart(6));
  }
}
