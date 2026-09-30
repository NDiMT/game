/* Καθαρή οριακή αξία κάθε συνέργειας: ΙΔΙΑ seeds, ΙΔΙΑ δύο charms στο χέρι,
   μία φορά με τη συνέργεια ενεργή και μία με S.noSyn. Ό,τι μένει είναι η συνέργεια.
   node tools/synergy.js [N] */
const G = require("../site/raise/game.js");
const N = +process.argv[2] || 300;
const PRIO = (process.env.PRIO || "wi,pl,th,m2,cs,m1,gt,di").split(",");
const pts = (S, o) => G.scoreOf(S, o.k, o.idx.map((i) => S.hand[i])).pts;

function discardStep(S) {
  let o = G.orphans(S);
  if (!o.length) o = S.hand.map((_, i) => i).filter((i) => !S.hand[i].h && S.hand[i].r !== 14 && !G.isWild(S.hand[i])).slice(0, 2);
  if (!o.length) return false;
  S.sel = o.slice(0, Math.min(3, o.length)); return G.discard(S);
}
function run(seed, charms, noSyn) {
  const S = G.newRun(seed, []);
  S.noSyn = noSyn;
  S.charms = charms.slice();
  S.charmSlots = Math.max(S.charmSlots || 0, charms.length);
  let total = 0;
  for (;;) {
    const T = G.target(S);
    for (let g = 0; g < 300 && S.phase === "round"; g++) {
      if (S.playsLeft < 1) break;
      const all = G.candidates(S);
      if (!all.length) { if (G.canDiscardAny(S) && discardStep(S)) continue; break; }
      const up = all.filter((o) => G.climbs(S, o.k));
      const m = (up.length ? up : all).reduce((b, o) => (!b || pts(S, o) > pts(S, b) ? o : b), null);
      if (!m) break;
      const need = Math.max(0, T - S.score), share = need / Math.max(1, S.playsLeft);
      if (S.playsLeft > 1 && pts(S, m) < 0.55 * share && G.canDiscardAny(S) && discardStep(S)) continue;
      S.sel = m.idx.slice();
      const ev = G.play(S); total += ev.pts;
      if (ev.cleared) break;
    }
    if (S.phase === "round") G.finish(S);
    if (S.phase === "lost" || S.phase === "won") break;
    while (G.picksLeft(S) > 0) {
      const opts = S.offers.map((o, i) => ({ o, i, pr: PRIO.indexOf(o.id) })).filter((x) => !x.o.bought && x.pr >= 0 && G.canTake(S, x.i).ok).sort((a, b) => a.pr - b.pr);
      if (!opts.length) break;
      G.take(S, opts[0].i);
    }
    S.charms = charms.slice();          /* κρατά ΜΟΝΟ τα δύο υπό μέτρηση */
    if (!G.nextAnte(S)) break;
  }
  return { ante: S.ante, score: total, won: S.phase === "won" };
}
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
function ci(d) { const m = mean(d), v = mean(d.map((x) => (x - m) * (x - m))); return { m: m, se: 1.96 * Math.sqrt(v / d.length) }; }

console.log("συνέργειες · " + N + " ζευγαρωμένα runs το καθένα (ίδια seeds, ίδια charms, μόνο η συνέργεια αλλάζει)\n");
console.log("συνέργεια        charms                  Δ ante        Δ ln(score)      ετυμηγορία");
const rows = [];
for (const s of G.SYNERGIES) {
  const dA = [], dL = [];
  for (let i = 0; i < N; i++) {
    const seed = "sy-" + s.id + "-" + i;
    const on = run(seed, [s.a, s.b], false), off = run(seed, [s.a, s.b], true);
    dA.push(on.ante - off.ante);
    dL.push(Math.log(Math.max(1, on.score)) - Math.log(Math.max(1, off.score)));
  }
  const A = ci(dA), L = ci(dL);
  const live = Math.abs(A.m) > A.se || Math.abs(L.m) > L.se;
  rows.push({ s: s, A: A, L: L, live: live });
  console.log("  " + s.id.padEnd(12) + (s.a + "+" + s.b).padEnd(24) +
    (A.m >= 0 ? "+" : "") + A.m.toFixed(2) + " ±" + A.se.toFixed(2) + "   " +
    ((L.m >= 0 ? "+" : "") + (100 * L.m).toFixed(1) + "% ±" + (100 * L.se).toFixed(1) + "%").padEnd(18) +
    (live ? "ζωντανή" : "ΝΕΚΡΗ"));
}
console.log("\nνεκρές: " + rows.filter((r) => !r.live).map((r) => r.s.id).join(", "));
