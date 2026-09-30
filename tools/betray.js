/* Πόσο τσιμπάει στην ΠΡΑΞΗ η διαφωνία των δύο σκαλών: χέρι που ανέβηκε σκαλί
   αλλά πλήρωσε λιγότερο από το rung που χτύπησε. node tools/betray.js [N] */
const G = require("../site/raise/game.js");
const N = +process.argv[2] || 150;
const ALL = G.CHARMS.map((c) => c.id);
const PRIO = (process.env.PRIO || "patient,court,kingmaker,mirror,climber,encore,loyal,lowroad,sleight,wind,ember,scout,leap,summiteer,cheap,goldsmith,ladder,afterburner,wi,pl,th,m2,cs,m1,gt,di").split(",");
let plays = 0, ups = 0, betray = 0, sum = 0, worst = null, forced = 0;
const rels = [], byPair = {};
for (let s = 0; s < N; s++) {
  const S = G.newRun("bt-" + s, ALL);
  for (;;) {
    let lastPts = null;
    for (let g = 0; g < 200 && S.phase === "round"; g++) {
      if (S.playsLeft < 1) break;
      const up = G.candidates(S).filter((o) => G.climbs(S, o.k));
      const pool = up.length ? up : G.candidates(S);
      if (!pool.length) { if (G.canDiscardAny(S)) { S.sel = (G.orphans(S).slice(0, 2)); if (G.discard(S)) continue; } break; }
      const m = pool.reduce((b, o) => (!b || G.scoreOf(S, o.k, o.idx.map((i) => S.hand[i])).pts > G.scoreOf(S, b.k, b.idx.map((i) => S.hand[i])).pts ? o : b), null);
      const climbing = G.climbs(S, m.k), rung = S.rung;
      const pts = G.scoreOf(S, m.k, m.idx.map((i) => S.hand[i])).pts;
      plays++;
      if (climbing) {
        ups++;
        if (rung && lastPts != null && pts < lastPts) {
          betray++; const rel = lastPts / pts; sum += rel; rels.push(rel);
          const key = G.KINDS[m.k.kind].short + " ← " + G.KINDS[rung.kind].short + " " + rung.size;
          byPair[key] = (byPair[key] || 0) + 1;
          if (!worst || rel > worst.rel) worst = { rel: rel, from: G.KINDS[rung.kind].short + " " + rung.size + " (" + lastPts + ")", to: G.KINDS[m.k.kind].short + " " + m.k.size + " (" + pts + ")" };
          /* Ήταν αναγκαστικό; Υπήρχε ανέβασμα που πλήρωνε >= lastPts; */
          if (!up.some((o) => G.scoreOf(S, o.k, o.idx.map((i) => S.hand[i])).pts >= lastPts)) forced++;
        }
      }
      S.sel = m.idx.slice();
      const ev = G.play(S);
      lastPts = climbing ? pts : null;
      if (ev.cleared) break;
    }
    if (S.phase === "round") G.finish(S);
    if (S.phase === "lost" || S.phase === "won") break;
    while (G.picksLeft(S) > 0) {
      const opts = S.offers.map((o, i) => ({ o, i, pr: PRIO.indexOf(o.id) })).filter((x) => !x.o.bought && x.pr >= 0 && G.canTake(S, x.i).ok).sort((a, b) => a.pr - b.pr);
      if (!opts.length) break;
      G.take(S, opts[0].i);
    }
    if (!G.nextAnte(S)) break;
  }
}
rels.sort((a, b) => a - b);
console.log("runs " + N + " · παιξίματα " + plays + " · ανεβάσματα " + ups);
console.log("ΠΡΟΔΟΣΙΕΣ: " + betray + " — " + (100 * betray / plays).toFixed(2) + "% των παιξιμάτων, " + (100 * betray / Math.max(1, ups)).toFixed(2) + "% των ανεβασμάτων");
if (betray) {
  console.log("  πτώση ×" + (sum / betray).toFixed(2) + " μέση · p50 ×" + rels[rels.length >> 1].toFixed(2) + " · p90 ×" + rels[Math.floor(rels.length * .9)].toFixed(2) + " · max ×" + rels[rels.length - 1].toFixed(2));
  console.log("  αναγκαστικές (κανένα ανέβασμα δεν πλήρωνε τόσο): " + forced + " / " + betray + " = " + (100 * forced / betray).toFixed(0) + "%");
  console.log("  χειρότερη: " + worst.from + " → " + worst.to);
  console.log("  ανά μετάβαση:");
  Object.keys(byPair).sort((a, b) => byPair[b] - byPair[a]).slice(0, 10).forEach((k) => console.log("    " + k.padEnd(22) + byPair[k]));
}
