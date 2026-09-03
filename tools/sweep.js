/* Σάρωση δυσκολίας v4 (Tichu combos, 30 antes). Bot: G.suggest (μακρύτερη αλυσίδα
   στο άνοιγμα, φθηνότερο χτύπημα μετά), discards ορφανά ×4, Άσος όταν κολλά,
   συντηρητικό Raise, charms πρώτα.   node tools/sweep.js [N] ['[["name",[targets],{cfg}]]'] */
const G = require("../site/raise/game.js");
const N = +process.argv[2] || 400;

const PRIO = ["ladder", "cheap", "lowroad", "mirror", "encore", "afterburner", "kingmaker", "wind", "court", "loyal", "vault", "sleight", "thrift", "ember", "goldsmith", "summiteer",
  "pl", "m1", "cs", "wi", "tip", "m2", "m3", "m6", "th"];
const CARD_PR = { wild: 12.5, gold: 14.5, steel: 16.5, glass: 18.5 };
const ALL_UNLOCKED = G.CHARMS.map((c) => c.id);

function discardOrphans(S) {
  let o = G.orphans(S);
  if (!o.length) o = S.hand.map((_, i) => i).filter((i) => !S.hand[i].h && S.hand[i].r !== 14 && !G.isWild(S.hand[i])).slice(0, 2);
  if (!o.length) return false;
  S.sel = o.slice(0, G.CFG.discardCards);
  return G.discard(S);
}
function playRound(S) {
  for (let guard = 0; guard < 200 && S.phase === "round"; guard++) {
    if (S.playsLeft <= 0) { G.finish(S); break; }
    if (G.canRaise(S) && S.playsLeft >= 3 && G.discardsLeft(S) >= 1) G.raise(S);
    const m = G.suggest(S);
    if (m) { S.sel = m.idx.slice(); G.play(S); continue; }
    if (S.rung) { const a = G.aceIndex(S); if (a >= 0) { S.sel = [a]; G.play(S); continue; } }
    if ((G.discardsLeft(S) > 0 || G.deadHand(S)) && S.pile.length > 0 && discardOrphans(S)) continue;
    if (G.canPass(S)) { G.pass(S); continue; }
    G.finish(S); break;
  }
  if (S.phase === "round") G.finish(S);
}
function shop(S) {
  let again = true;
  while (again) {
    again = false;
    const opts = S.offers.map((o, i) => ({ o, i, pr: o.kind === "card" ? CARD_PR[o.card.e] : PRIO.indexOf(o.id), cost: G.offerCost(S, o) }))
      .filter((x) => !x.o.bought && x.pr >= 0 && G.canBuy(S, x.i).ok).sort((a, b) => a.pr - b.pr);
    if (opts.length) { G.buy(S, opts[0].i); again = true; }
  }
  /* το χέρι μένει· πετά τα ορφανά (εκτός Άσων και wilds) */
  G.orphans(S).forEach((i) => G.toggleKeep(S, i));
  G.nextAnte(S);
}
function run(targets, opts) {
  G.TARGETS.splice(0, G.TARGETS.length, ...targets);
  Object.assign(G.CFG, opts || {});
  const lost = new Array(targets.length).fill(0); let wins = 0; const byChal = {}, seen = {}; const a1 = [];
  for (let s = 0; s < N; s++) {
    const S = G.newRun("sw-" + s, ALL_UNLOCKED);
    for (;;) {
      playRound(S);
      if (S.ante === 0) a1.push(S.score);
      if (S.chal) { seen[S.chal] = (seen[S.chal] || 0) + 1; if (S.phase === "lost") byChal[S.chal] = (byChal[S.chal] || 0) + 1; }
      if (S.phase === "lost") { lost[S.ante]++; break; }
      if (S.phase === "won") { wins++; break; }
      shop(S);
    }
  }
  a1.sort((a, b) => a - b);
  const q = (p) => a1[Math.floor(p * (a1.length - 1))];
  const mean = (lost.reduce((a, n, i) => a + n * (i + 1), 0) + wins * (targets.length + 1)) / N;
  const cd = Object.keys(seen).sort().map((k) => k.slice(0, 6) + " " + Math.round(100 * (byChal[k] || 0) / seen[k]) + "%").join(" ");
  return { wins: (100 * wins / N).toFixed(1) + "%", mean: mean.toFixed(2), lost: lost.join(" "), cd, a1: `p10 ${q(.1)} p50 ${q(.5)} p90 ${q(.9)}` };
}
/* Καμπύλη: ο λόγος ανεβαίνει γραμμικά από r0 (ante 1) σε r1 (ante n). */
const ramp = (start, r0, r1, n) => { const out = [start]; for (let i = 1; i < n; i++) out.push(out[i - 1] * (r0 + (r1 - r0) * (i - 1) / (n - 2))); return out.map((t) => (t < 300 ? Math.round(t / 5) * 5 : t < 3000 ? Math.round(t / 10) * 10 : Math.round(t / 50) * 50)); };
module.exports = { run, ramp };
const cases = process.argv[3] ? JSON.parse(process.argv[3]) : [
  ["ramp 60 1.12→1.30", ramp(60, 1.12, 1.30, 30), {}],
  ["ramp 60 1.15→1.32", ramp(60, 1.15, 1.32, 30), {}],
  ["ramp 70 1.15→1.35", ramp(70, 1.15, 1.35, 30), {}],
  ["ramp 80 1.18→1.38", ramp(80, 1.18, 1.38, 30), {}],
];
console.log("case                 wins   mean   lost per ante (30)                                                                      ante-1 bot score           challenge death rates");
for (const [name, T, opts] of cases) {
  const r = run(T, opts);
  console.log(`${name.padEnd(19)} ${r.wins.padStart(6)} ${r.mean.padStart(6)}   ${r.lost.padEnd(86)} ${r.a1.padEnd(26)} ${r.cd}`);
}
