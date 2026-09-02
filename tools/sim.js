/* Headless προσομοίωση του RAISE: ένα απλό bot παίζει N seeds και
   μετράμε πόσα antes φτάνει. Πρώτη ανάγνωση της καμπύλης δυσκολίας.
   node tools/sim.js [N] */
const G = require("../site/raise/game.js");
const N = +process.argv[2] || 300;

const PRIO = ["m1", "cs", "de", "wi", "ch", "br", "m2", "m3", "m4", "m5", "m6", "th"];
function tryChisel(S) {
  if (S.chisel <= 0) return false;
  const cnt = {}; S.hand.forEach((c) => { cnt[c.r] = (cnt[c.r] || 0) + 1; });
  const orphans = S.hand.map((c, i) => ({ c, i })).filter((x) => cnt[x.c.r] === 1);
  return orphans.length >= 2 && G.chisel(S, orphans[0].i, orphans[1].c.r);
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
  // αγοράζει με τις προτεραιότητες που μαθαίνει γρήγορα ένας άνθρωπος
  let bought = true;
  while (bought) {
    bought = false;
    const order = S.offers.map((o, i) => ({ o, i, pr: PRIO.indexOf(o.id), cost: G.poolById[o.id].cost }))
      .filter((x) => !x.o.bought && x.cost <= S.money).sort((a, b) => a.pr - b.pr);
    if (order.length) { G.buy(S, order[0].i); bought = true; }
  }
  G.nextAnte(S);
}

const reached = new Array(G.TARGETS.length + 1).fill(0);
let wins = 0, scores = [];
for (let s = 0; s < N; s++) {
  const S = G.newRun("sim-" + s);
  while (true) {
    playRound(S);
    if (S.ante === 0) scores.push(S.score);
    if (S.phase === "lost") { reached[S.ante]++; break; }
    if (S.phase === "won") { wins++; reached[G.TARGETS.length]++; break; }
    shop(S);
  }
}
scores.sort((a, b) => a - b);
const q = (p) => scores[Math.floor(p * (scores.length - 1))];
console.log(`seeds: ${N}   wins: ${wins} (${(100 * wins / N).toFixed(1)}%)`);
console.log(`ante-1 score (bot, no upgrades): p10 ${q(.1)}  p50 ${q(.5)}  p90 ${q(.9)}  target ${G.TARGETS[0]}`);
console.log("lost at ante  →  runs");
reached.forEach((n, i) => {
  if (i === G.TARGETS.length) return;
  const bar = "█".repeat(Math.round(60 * n / N));
  console.log(`  ${String(i + 1).padStart(2)} (${String(G.TARGETS[i]).padStart(4)})  ${String(n).padStart(4)}  ${bar}`);
});
console.log(`  won          ${String(wins).padStart(4)}  ${"█".repeat(Math.round(60 * wins / N))}`);
