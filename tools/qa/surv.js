/* Survival: breath accounting, termination, reshuffle fidelity, done flag */
const { G, survRun } = require("./bot.js");
const N = +process.argv[2] || 300;
const CFG = G.CFG;
let bad = [];
const note = (seed, msg) => { bad.push(seed + ": " + msg); };

let stats = { hands: [], scores: [], overspend: 0, neg: 0, noTerm: 0, dupes: 0, lost: 0 };

for (let i = 0; i < N; i++) {
  const seed = "s" + i;
  const S = G.newRun(seed, [], "survival");
  const startDeckIds = S.deck.map((c) => c.id).sort((a, b) => a - b);
  let steps = 0, guard = 0;
  const budgetSeen = [];
  while (S.phase === "round" && guard++ < 4000) {
    if (G.stuck(S)) break;
    // invariants each step
    const dl = G.discardsLeft(S);
    const budget = CFG.survDiscards + (S.discMore || 0) + (S.survEarned || 0) + (S.survBomb || 0);   /* οι βόμβες δίνουν ανάσα */
    if (S.discMax !== budget) note(seed, "discMax " + S.discMax + " != budget " + budget);
    if (S.rdisc > budget) { stats.overspend++; note(seed, "rdisc " + S.rdisc + " > budget " + budget); break; }
    if (dl < 0) { stats.neg++; note(seed, "discardsLeft negative"); break; }
    // card conservation: hand + pile + deck-consistency
    const ids = S.hand.map((c) => c.id).concat(S.pile.map((c) => c.id));
    const set = new Set(ids);
    if (set.size !== ids.length) { stats.dupes++; note(seed, "duplicate card ids across hand+pile"); break; }
    for (const c of S.hand) if (!S.deck.some((d) => d.id === c.id)) note(seed, "hand card " + c.id + " not in deck");
    const s = G.suggest(S);
    if (s === null) {
      let o = G.orphans(S);
      if (!o.length) o = S.hand.map((_, i2) => i2).filter((i2) => !G.isWild(S.hand[i2])).slice(0, 3);
      if (!o.length) o = [0];
      S.sel = o.slice(0, 3);
      if (!G.discard(S)) {
        const all = G.candidates(S);
        if (!all.length) break;
        S.sel = all[0].idx.slice();
        if (!G.play(S)) break;
      }
    } else {
      S.sel = s.idx.slice();
      if (!G.play(S)) { note(seed, "play() null on suggested move"); break; }
    }
    steps++;
  }
  if (guard >= 4000) { stats.noTerm++; note(seed, "did not terminate in 4000 steps, score=" + S.score + " earned=" + (S.survEarned || 0) + " rdisc=" + S.rdisc); }
  // deck identity preserved after all reshuffles
  const endDeckIds = S.deck.map((c) => c.id).sort((a, b) => a - b);
  if (JSON.stringify(startDeckIds) !== JSON.stringify(endDeckIds)) note(seed, "deck ids changed over the run");
  const r = G.finish(S);
  if (S.phase !== "lost") note(seed, "finish did not end survival, phase=" + S.phase);
  stats.hands.push(S.stats.plays);
  stats.scores.push(S.score);
  // final: rdisc <= budget
  const budget = CFG.survDiscards + (S.discMore || 0) + (S.survEarned || 0) + (S.survBomb || 0);   /* οι βόμβες δίνουν ανάσα */
  if (S.rdisc > budget) note(seed, "FINAL rdisc " + S.rdisc + " > budget " + budget);
}
const q = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length * p)]; };
console.log("runs", N, "p50 hands", q(stats.hands, .5), "max hands", Math.max(...stats.hands), "p50 score", q(stats.scores, .5));
console.log("overspend", stats.overspend, "neg", stats.neg, "noTerm", stats.noTerm, "dupes", stats.dupes);
console.log("violations:", bad.length);
bad.slice(0, 30).forEach((b) => console.log("  " + b));
