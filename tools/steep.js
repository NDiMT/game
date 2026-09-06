/* steep.js — σάρωση survSteep: κάθε πόσα χέρια το βουνό γίνεται μια βαθμίδα πιο απότομο
   (το rung ανεβαίνει +1 παραπάνω μετά από κάθε παίξιμο).
   Στόχος: κοντύτερο run από τα 73 χέρια, μικρότερο skill cliff από +1129%, μικρότερο
   spread από ×3,04 — χωρίς να πεθάνει η κορυφή (p50 σωστού παιξίματος).
   node tools/steep.js [N] [τιμές] */
const G = require("../site/raise/game.js");
const N = +process.argv[2] || 200;
const VALS = (process.argv[3] || "0,8,10,12,14,16,20").split(",").map(Number);
const pts = (S, o) => G.scoreOf(S, o.k, o.idx.map((i) => S.hand[i])).pts;
const cost = (k) => G.KINDS[k.kind].tier * 1e6 + k.size * 1e3 + k.rank;
function run(seed, pol) {
  const S = G.newRun(seed, [], "survival");
  for (let guard = 0; guard < 4000 && S.phase === "round"; guard++) {
    const all = G.candidates(S);
    if (!all.length) { if (G.canDiscardAny(S)) { const o = G.orphans(S); S.sel = (o.length ? o : S.hand.map((_, i) => i)).slice(0, 3); if (S.sel.length && G.discard(S)) continue; } break; }
    const up = all.filter((o) => G.climbs(S, o.k));
    let m = null, breathe = false;
    if (pol === "greedy") m = all.reduce((b, o) => (!b || pts(S, o) > pts(S, b) ? o : b), null);
    else if (up.length) m = up.reduce((b, o) => (cost(o.k) < (b ? cost(b.k) : Infinity) ? o : b), null);
    else if (G.discardsLeft(S) > 0 && G.canDiscardAny(S)) breathe = true;
    else m = all.reduce((b, o) => (!b || pts(S, o) > pts(S, b) ? o : b), null);
    if (breathe) { const o = G.orphans(S); S.sel = (o.length ? o : S.hand.map((_, i) => i)).slice(0, 2); if (S.sel.length && G.discard(S)) continue; m = all[0]; }
    if (!m) break;
    S.sel = m.idx.slice();
    const ev = G.play(S); if (!ev || ev.last) break;
  }
  G.finish(S);
  return { s: S.score, h: S.stats.plays, c: S.stats.maxChain };
}
const q = (a, f) => a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * f))];
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
console.log("survSteep · " + N + " runs ανά κελί, ίδια seeds\n");
console.log("steep  χέρια  αλυσίδα p50   p50 σωστό   headroom   spread p90/p10");
for (const v of VALS) {
  G.CFG.survSteep = v;
  const g = [], w = [];
  for (let i = 0; i < N; i++) { g.push(run("sv-" + i, "greedy")); w.push(run("sv-" + i, "cheap")); }
  const gs = q(g.map((x) => x.s), .5), ws = q(w.map((x) => x.s), .5);
  console.log(String(v).padStart(5) + mean(w.map((x) => x.h)).toFixed(0).padStart(7) +
    ("×" + q(w.map((x) => x.c), .5)).padStart(13) + String(ws).padStart(12) +
    ("+" + (100 * (ws / gs - 1)).toFixed(0) + "%").padStart(11) +
    ("×" + (q(w.map((x) => x.s), .9) / q(w.map((x) => x.s), .1)).toFixed(2)).padStart(17));
}
