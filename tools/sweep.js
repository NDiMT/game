/* Σάρωση δυσκολίας v3. Bot: cheapest legal climb, discards ορφανά, Άσος όταν
   κολλά, συντηρητικό Raise, bank όταν το ρίσκο ανεβαίνει, charms πρώτα.
   node tools/sweep.js */
const G = require("../site/raise/game.js");
const N = +process.argv[2] || 400;

const PRIO = ["ladder", "cheap", "lowroad", "mirror", "encore", "wind", "court", "loyal", "vault", "sleight", "thrift", "ember", "goldsmith", "summiteer",
  "pl", "m1", "cs", "di", "br", "wi", "ch", "m2", "m3", "m4", "m5", "m6", "th"];
const CARD_PR = { wild: 12.5, gold: 14.5, steel: 16.5, glass: 18.5 };
const ALL_UNLOCKED = G.CHARMS.map((c) => c.id);

function discardOrphans(S) {
  let o = G.orphans(S);
  if (!o.length) o = S.hand.map((_, i) => i).filter((i) => !S.hand[i].h).slice(0, 2);
  S.sel = o.slice(0, 3);
  return G.discard(S);
}
function playRound(S) {
  for (let guard = 0; guard < 200 && S.phase === "round"; guard++) {
    if (S.playsLeft <= 0) { G.finish(S); break; }
    if (G.canRaise(S) && S.playsLeft >= 3 && S.discards >= 1) G.raise(S);
    const m = G.cheapest(S);
    if (m) { S.sel = m.idx.slice(); G.play(S); continue; }
    if (S.rung) { const a = G.aceIndex(S); if (a >= 0) { S.sel = [a]; G.play(S); continue; } }
    if (S.discards > 0 && S.pile.length > 0 && discardOrphans(S)) continue;
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
const geo = (start, r, n) => Array.from({ length: n }, (_, i) => Math.round(start * Math.pow(r, i) / 10) * 10);
const cases = process.argv[3] ? JSON.parse(process.argv[3]) : [
  ["geo 120 ×1.34", geo(120, 1.34, 12), {}],
  ["geo 150 ×1.36", geo(150, 1.36, 12), {}],
  ["geo 150 ×1.42", geo(150, 1.42, 12), {}],
  ["geo 180 ×1.40", geo(180, 1.40, 12), {}],
  ["geo 180 ×1.46", geo(180, 1.46, 12), {}],
];
console.log("case             wins   mean   lost per ante (12)                        ante-1 bot score           challenge death rates");
for (const [name, T, opts] of cases) {
  const r = run(T, opts);
  console.log(`${name.padEnd(15)} ${r.wins.padStart(6)} ${r.mean.padStart(6)}   ${r.lost.padEnd(42)} ${r.a1.padEnd(26)} ${r.cd}`);
}
