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
    const opts = S.offers.map((o, i) => ({ o, i, pr: PRIO.indexOf(o.id), cost: G.poolById[o.id].cost }))
      .filter((x) => !x.o.bought && x.cost <= S.money).sort((a, b) => a.pr - b.pr);
    if (opts.length) { G.buy(S, opts[0].i); again = true; }
  }
  G.nextAnte(S);
}
function run(targets, base, per, offers, chisel0) {
  G.TARGETS.splice(0, G.TARGETS.length, ...targets);
  G.CFG.rewardBase = base; G.CFG.rewardPer = per; G.CFG.offers = offers || 3; G.CFG.chisel0 = chisel0 || 0;
  const lost = new Array(targets.length).fill(0); let wins = 0;
  for (let s = 0; s < N; s++) {
    const S = G.newRun("sw-" + s);
    for (;;) {
      playRound(S);
      if (S.phase === "lost") { lost[S.ante]++; break; }
      if (S.phase === "won") { wins++; break; }
      shop(S);
    }
  }
  // μέσο ante που φτάνει (won = 9)
  const mean = (lost.reduce((a, n, i) => a + n * (i + 1), 0) + wins * 9) / N;
  return { wins: (100 * wins / N).toFixed(0) + "%", meanAnte: mean.toFixed(2), lost: lost.join(" ") };
}
const D=[100,135,195,280,400,570,810,1150], E=[100,140,205,300,440,640,930,1350], F=[100,145,215,320,470,700,1030,1500];
const cases = [
  ["D ×1.42  $10/80  ch1 ", D, 10, 80, 4, 1],
  ["D ×1.42  $12/60  ch1 ", D, 12, 60, 4, 1],
  ["E ×1.46  $10/80  ch1 ", E, 10, 80, 4, 1],
  ["E ×1.46  $12/60  ch1 ", E, 12, 60, 4, 1],
  ["F ×1.48  $12/60  ch1 ", F, 12, 60, 4, 1],
  ["F ×1.48  $14/50  ch1 ", F, 14, 50, 4, 1],
];
console.log("case                    wins  meanAnte  lost-at-ante 1..8");
for (const [name, t, b, p, of, ch] of cases) {
  const r = run(t, b, p, of, ch);
  console.log(`${name}  ${r.wins.padStart(4)}  ${r.meanAnte.padStart(8)}  ${r.lost}`);
}
