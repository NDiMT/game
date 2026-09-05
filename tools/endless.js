/* endless.js — πόσο βαθιά πάει το Endless, ανά ρυθμό στόχου και ανά ρυθμό ανταμοιβής.
   node tools/endless.js [N]   (env: CFG={"endlessStep":1.08})  */
const G = require("../site/raise/game.js");
const N = +process.argv[2] || 400;
const ALL = G.CHARMS.map((c) => c.id);
const PRIO = (process.env.PRIO || "patient,court,kingmaker,mirror,climber,encore,loyal,lowroad,sleight,wind,ember,scout,leap,summiteer,cheap,goldsmith,ladder,afterburner,wi,pl,th,m2,cs,m1,gt,di").split(",");
const pts = (S, o) => G.scoreOf(S, o.k, o.idx.map((i) => S.hand[i])).pts;
function discardStep(S) {
  let o = G.orphans(S);
  if (!o.length) o = S.hand.map((_, i) => i).filter((i) => !S.hand[i].h && S.hand[i].r !== 14 && !G.isWild(S.hand[i])).slice(0, 2);
  if (!o.length) return false;
  S.sel = o.slice(0, Math.min(3, o.length)); return G.discard(S);
}
function playRound(S) {
  const T = G.target(S);
  for (let g2 = 0; g2 < 300 && S.phase === "round"; g2++) {
    if (S.playsLeft < 1) break;
    const all = G.candidates(S);
    if (!all.length) { if (G.canDiscardAny(S) && discardStep(S)) continue; break; }
    const up = all.filter((o) => G.climbs(S, o.k)), pool = up.length ? up : all;
    const m = pool.reduce((b, o) => (!b || pts(S, o) > pts(S, b) ? o : b), null);
    if (!m) break;
    const need = Math.max(0, T - S.score), share = need / Math.max(1, S.playsLeft);
    if (S.playsLeft > 1 && pts(S, m) < 0.55 * share && G.canDiscardAny(S) && discardStep(S)) continue;
    S.sel = m.idx.slice();
    if (G.play(S).cleared) break;
  }
  if (S.phase === "round") G.finish(S);
}
function shop(S, everyAnte) {
  /* everyAnte: στο Endless κάθε ante πληρώνει, όχι μόνο κάθε 3ο. */
  if (everyAnte && S.endless && !G.picksLeft(S)) { S.pickUp = 1; S.offers = G.makeOffers(S); }
  while (G.picksLeft(S) > 0) {
    const list = S.offers.map((o, i) => ({ o, i })).filter((x) => !x.o.bought && G.canTake(S, x.i).ok);
    if (!list.length) break;
    G.take(S, list.slice().sort((a, b) => PRIO.indexOf(a.o.id) - PRIO.indexOf(b.o.id))[0].i);
  }
  G.nextAnte(S);
}
function run(seed, everyAnte) {
  const S = G.newRun(seed, ALL);
  for (;;) {
    playRound(S);
    if (S.phase === "lost") return S.ante + 1 >= G.TARGETS.length ? S.ante + 1 : 0;
    if (S.phase === "won") break;
    shop(S, everyAnte);
  }
  G.goEndless(S);
  for (;;) { shop(S, everyAnte); playRound(S); if (S.phase === "lost") return S.ante + 1; }
}
const q = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(p * (b.length - 1))] : NaN; };
const CASES = [[1.15, false], [1.15, true], [1.08, false], [1.08, true], [1.05, true]];
console.log("N " + N + " · endless depth past ante 50 (only runs that won)");
console.log("endlessStep".padEnd(13) + "reward".padEnd(12) + "n".padStart(5) + "p10".padStart(6) + "p50".padStart(6) + "p90".padStart(6) + "max".padStart(6));
CASES.forEach(([step, every]) => {
  G.CFG.endlessStep = step;
  const d = [];
  for (let s = 0; s < N; s++) { const r = run("st-" + s, every); if (r) d.push(r); }
  console.log(String(step).padEnd(13) + (every ? "every ante" : "every 3rd").padEnd(12) + String(d.length).padStart(5) +
    String(q(d, .1)).padStart(6) + String(q(d, .5)).padStart(6) + String(q(d, .9)).padStart(6) + String(Math.max.apply(null, d.concat([0]))).padStart(6));
});
