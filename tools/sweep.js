/* Σάρωση καμπυλών δυσκολίας. node tools/sweep.js */
const G = require("../site/raise/game.js");
const N = 400;
// Ο αγοραστής προτιμά ό,τι μαθαίνει γρήγορα ένας άνθρωπος: πολλαπλασιαστή
// ζευγαριών, ενίσχυση αλυσίδας, πλατύ χέρι, κατέβασμα, σμίλη, ανάσα.
const PRIO = ["m1", "cs", "de", "wi", "ch", "br", "m2", "m3", "m4", "m5", "m6", "th"];
function tryChisel(S) {
  if (S.chisel <= 0) return false;
  const cnt = {}; S.hand.forEach((c) => { cnt[c.r] = (cnt[c.r] || 0) + 1; });
  const orphans = S.hand.map((c, i) => ({ c, i })).filter((x) => cnt[x.c.r] === 1);
  if (orphans.length < 2) return false;
  // κάνε το χαμηλότερο ορφανό ίδιο με το επόμενο ορφανό
  return G.chisel(S, orphans[0].i, orphans[1].c.r);
}
function playRound(S) {
  while (S.phase === "round") {
    const m = G.cheapest(S);
    if (m) { S.sel = m.idx.slice(); G.play(S); continue; }
    if (!S.rung && tryChisel(S)) continue;
    if (S.rung) { const a = G.aceIndex(S); if (a >= 0) { S.sel = [a]; G.play(S); continue; } }
    if (G.stuck(S)) { G.finish(S); break; }
    if (S.rung && S.descend > 0) { G.descend(S); continue; }
    if (S.rung && S.breaths > 0) { G.pass(S); continue; }
    G.finish(S); break;
  }
}
function shop(S) {
  let again = true;
  while (again) {
    again = false;
    const CARD_PR = { wild: 2.5, gold: 3.5, steel: 5.5, glass: 7.5 };
    const opts = S.offers.map((o, i) => ({ o, i, pr: o.kind === "card" ? CARD_PR[o.card.e] : PRIO.indexOf(o.id), cost: G.offerCost(o) }))
      .filter((x) => !x.o.bought && x.cost <= S.money).sort((a, b) => a.pr - b.pr);
    if (opts.length) { G.buy(S, opts[0].i); again = true; }
  }
  G.nextAnte(S);
}
function run(targets, base, per, offers, chisel0, opts) {
  G.TARGETS.splice(0, G.TARGETS.length, ...targets);
  G.CFG.rewardBase = base; G.CFG.rewardPer = per; G.CFG.offers = offers || 3; G.CFG.chisel0 = chisel0 || 0;
  Object.assign(G.CFG, { chalTargetMul: 0.85, thinAirCap: 4, highGroundRank: 10, shortHand: 14, richAirMul: 1.15, blindCount: 7 }, opts || {});
  const lost = new Array(targets.length).fill(0); let wins = 0;
  const byChal = {}; const seenChal = {};
  for (let s = 0; s < N; s++) {
    const S = G.newRun("sw-" + s);
    for (;;) {
      playRound(S);
      if (S.chal) { seenChal[S.chal] = (seenChal[S.chal] || 0) + 1; if (S.phase === "lost") byChal[S.chal] = (byChal[S.chal] || 0) + 1; }
      if (S.phase === "lost") { lost[S.ante]++; break; }
      if (S.phase === "won") { wins++; break; }
      shop(S);
    }
  }
  const mean = (lost.reduce((a, n, i) => a + n * (i + 1), 0) + wins * 9) / N;
  const cd = Object.keys(seenChal).sort().map((k) => k + " " + Math.round(100 * (byChal[k] || 0) / seenChal[k]) + "%").join("  ");
  return { wins: (100 * wins / N).toFixed(0) + "%", meanAnte: mean.toFixed(2), lost: lost.join(" "), cd };
}
const F=[100,145,215,320,470,700,1030,1500];
const cases = [
  ["final defaults   ", {}],
];
console.log("case                wins  meanAnte  lost 1..8                    death rate when challenge hit");
for (const [name, opts] of cases) {
  const r = run(F, 12, 60, 3, 1, opts);
  console.log(`${name}  ${r.wins.padStart(4)}  ${r.meanAnte.padStart(8)}  ${r.lost.padEnd(28)}  ${r.cd}`);
}
