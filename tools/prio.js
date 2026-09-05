/* prio.js — πόσο αξίζει η ΣΕΙΡΑ ΕΠΙΛΟΓΗΣ. Ίδια πολιτική παιξίματος (builder),
   μόνο η λίστα προτεραιότητας αλλάζει. node tools/prio.js [N] */
const G = require("../site/raise/game.js");
const N = +process.argv[2] || 500;
const ALL = G.CHARMS.map((c) => c.id);
const LISTS = {
  /* αυτό που χρησιμοποιούν σήμερα study.js / tune.js (χωρίς leap/scout) */
  shipped: ["climber", "patient", "ladder", "lowroad", "mirror", "encore", "afterburner", "kingmaker", "court", "loyal", "sleight", "cheap", "wind", "ember", "goldsmith", "summiteer",
    "pl", "m1", "cs", "di", "wi", "m2", "th", "gt"],
  /* ίδιο, αλλά με leap/scout μέσα ώστε καμία προσφορά να μη μένει αζήτητη */
  shippedFull: ["climber", "patient", "ladder", "leap", "scout", "lowroad", "mirror", "encore", "afterburner", "kingmaker", "court", "loyal", "sleight", "cheap", "wind", "ember", "goldsmith", "summiteer",
    "pl", "m1", "cs", "di", "wi", "m2", "th", "gt"],
  /* σειρά από τη μετρημένη οριακή αξία (audit2) */
  measured: ["patient", "court", "kingmaker", "mirror", "climber", "encore", "loyal", "lowroad", "sleight", "wind", "ember", "scout", "leap", "summiteer", "cheap", "goldsmith", "ladder", "afterburner",
    "wi", "pl", "th", "m2", "cs", "m1", "gt", "di"],
  /* μόνο η σειρά των perks αλλάζει, τα charms μένουν όπως στο shipped */
  perksFixed: ["climber", "patient", "ladder", "leap", "scout", "lowroad", "mirror", "encore", "afterburner", "kingmaker", "court", "loyal", "sleight", "cheap", "wind", "ember", "goldsmith", "summiteer",
    "wi", "pl", "th", "m2", "cs", "m1", "gt", "di"],
  /* μόνο η σειρά των charms αλλάζει */
  charmsFixed: ["patient", "court", "kingmaker", "mirror", "climber", "encore", "loyal", "lowroad", "sleight", "wind", "ember", "scout", "leap", "summiteer", "cheap", "goldsmith", "ladder", "afterburner",
    "pl", "m1", "cs", "di", "wi", "m2", "th", "gt"],
};
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
    const up = all.filter((o) => G.climbs(S, o.k));
    const m = (up.length ? up : all).reduce((b, o) => (!b || pts(S, o) > pts(S, b) ? o : b), null);
    if (!m) break;
    const need = Math.max(0, T - S.score), share = need / Math.max(1, S.playsLeft);
    if (S.playsLeft > 1 && pts(S, m) < 0.55 * share && G.canDiscardAny(S) && discardStep(S)) continue;
    S.sel = m.idx.slice();
    if (G.play(S).cleared) break;
  }
  if (S.phase === "round") G.finish(S);
}
function run(seed, P) {
  const S = G.newRun(seed, ALL);
  for (;;) {
    playRound(S);
    if (S.phase === "lost") return S.ante + 1;
    if (S.phase === "won") return G.TARGETS.length + 1;
    while (G.picksLeft(S) > 0) {
      const list = S.offers.map((o, i) => ({ o, i })).filter((x) => !x.o.bought && P.indexOf(x.o.id) >= 0 && G.canTake(S, x.i).ok);
      if (!list.length) break;
      G.take(S, list.slice().sort((a, b) => P.indexOf(a.o.id) - P.indexOf(b.o.id))[0].i);
    }
    G.nextAnte(S);
  }
}
const names = Object.keys(LISTS), res = {};
names.forEach((n) => { res[n] = []; });
for (let s = 0; s < N; s++) names.forEach((n) => res[n].push(run("st-" + s, LISTS[n])));
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const base = res.shipped;
console.log("N " + N + " · policy = builder for all · paired seeds · base = shipped PRIO");
console.log("prio list".padEnd(14) + "mean death".padStart(11) + "Δ".padStart(8) + "±SE".padStart(7) + "  wins  unspent-offer runs");
names.forEach((n) => {
  const d = res[n].map((x, i) => x - base[i]), m = mean(d);
  const sd = Math.sqrt(mean(d.map((x) => (x - m) * (x - m))));
  console.log(n.padEnd(14) + mean(res[n]).toFixed(2).padStart(11) + (m >= 0 ? "+" : "") + m.toFixed(2).padStart(7) + (sd / Math.sqrt(N)).toFixed(2).padStart(7) +
    String(res[n].filter((x) => x > G.TARGETS.length).length).padStart(6));
});
