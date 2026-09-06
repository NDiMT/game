/* steep2.js — 2Δ σάρωση survSteep × survWide. Πίεση (το rung ανεβαίνει μόνο του) κόντρα
   σε δύναμη (το χέρι μεγαλώνει στα ορόσημα).
   node tools/steep2.js [N] */
const G = require("../site/raise/game.js");
const N = +process.argv[2] || 150;
const STEEP = (process.env.STEEP || "0,6,8,10,12").split(",").map(Number);
const WIDE = (process.env.WIDE || "0,1,2").split(",").map(Number);
const pts = (S, o) => G.scoreOf(S, o.k, o.idx.map((i) => S.hand[i])).pts;
const cost = (k) => G.KINDS[k.kind].tier * 1e6 + k.size * 1e3 + k.rank;
function run(seed, pol) {
  const S = G.newRun(seed, [], "survival");
  let guard = 0;
  for (; guard < 4000 && S.phase === "round"; guard++) {
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
  return { s: S.score, h: S.stats.plays, cap: guard >= 3999 };
}
const q = (a, f) => a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * f))];
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
console.log("survSteep × survWide · " + N + " runs ανά κελί, ίδια seeds\n");
console.log("steep wide  χέρια    p50 σωστό  headroom   spread  ατέρμονα");
for (const st of STEEP) for (const w of WIDE) {
  G.CFG.survSteep = st; G.CFG.survWide = w;
  const g = [], c = [];
  for (let i = 0; i < N; i++) { g.push(run("sv-" + i, "greedy")); c.push(run("sv-" + i, "cheap")); }
  const gs = q(g.map((x) => x.s), .5), cs = q(c.map((x) => x.s), .5);
  console.log(String(st).padStart(5) + String(w).padStart(5) + mean(c.map((x) => x.h)).toFixed(0).padStart(7) +
    String(cs).padStart(13) + ("+" + (100 * (cs / gs - 1)).toFixed(0) + "%").padStart(10) +
    ("×" + (q(c.map((x) => x.s), .9) / q(c.map((x) => x.s), .1)).toFixed(2)).padStart(9) +
    String(c.filter((x) => x.cap).length).padStart(10));
}
