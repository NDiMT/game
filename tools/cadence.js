/* cadence.js — ο ΡΥΘΜΟΣ ΑΝΤΑΜΟΙΒΗΣ, όχι η αξία της. Πόσα charms έχει στ' αλήθεια στο χέρι
   του ο παίκτης όταν πεθαίνει, πόσοι πεθαίνουν με ΚΑΝΕΝΑ, και πόσες από τις 5 θέσεις
   γεμίζουν ποτέ.  node tools/cadence.js [N] [mode]
   mode: cur | swap (charm πρώτο) | both (charm ΚΑΙ perk σε κάθε σταθμό) | every2 (σταθμός ανά 2)
*/
const G = require("../site/raise/game.js");
const N = +process.argv[2] || 200, MODE = process.argv[3] || "cur";
const ALL = G.CHARMS.map((c) => c.id);
const PRIO = (process.env.PRIO || "patient,court,kingmaker,mirror,climber,encore,loyal,lowroad,sleight,wind,ember,scout,leap,summiteer,cheap,goldsmith,ladder,afterburner,wi,pl,th,m2,cs,m1,gt,di").split(",");
const pts = (S, o) => G.scoreOf(S, o.k, o.idx.map((i) => S.hand[i])).pts;
if (MODE === "every2") G.CFG.rewardEvery = 2;
/* Ο ρυθμός εφαρμόζεται στο finish(): εδώ τον ξαναγράφουμε από έξω, πάνω στο S. */
function grant(S) {
  const a = S.ante, R = G.CFG.rewardEvery;
  const station = a >= G.TARGETS.length || a % R === R - 1;
  if (!station) { S.pickUp = 0; S.pickCharm = 0; return; }
  const alt = Math.floor(a / R) % 2 === 0;
  if (MODE === "both") { S.pickUp = 1; S.pickCharm = 1; }
  else if (MODE === "swap" || MODE === "every2") { S.pickUp = alt ? 0 : 1; S.pickCharm = alt ? 1 : 0; }
  else { S.pickUp = alt ? 1 : 0; S.pickCharm = alt ? 0 : 1; }
  S.offers = G.makeOffers(S);
}
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
const rows = [];
for (let i = 0; i < N; i++) {
  const S = G.newRun("cd-" + i, ALL);
  const firstCharm = [];
  for (;;) {
    playRound(S);
    if (S.phase === "lost" || S.phase === "won") break;
    grant(S);
    while (G.picksLeft(S) > 0) {
      const opts = S.offers.map((o, i2) => ({ o, i: i2, pr: PRIO.indexOf(o.id) })).filter((x) => !x.o.bought && x.pr >= 0 && G.canTake(S, x.i).ok).sort((a, b) => a.pr - b.pr);
      if (!opts.length) break;
      const before = S.charms.length;
      G.take(S, opts[0].i);
      if (S.charms.length > before) firstCharm.push(S.ante + 1);
    }
    if (!G.nextAnte(S)) break;
  }
  rows.push({ ante: S.ante + 1, won: S.phase === "won", charms: S.charms.length, perks: Object.values(S.bought).reduce((a, b) => a + b, 0), first: firstCharm[0] || 99, all: firstCharm });
}
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const q = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(p * (b.length - 1))]; };
const died = rows.filter((r) => !r.won);
console.log("ρυθμός « " + MODE + " » · " + N + " runs · rewardEvery=" + G.CFG.rewardEvery);
console.log("  μέσο ante θανάτου " + mean(died.map((r) => r.ante)).toFixed(2) + " · νίκες " + rows.filter((r) => r.won).length);
console.log("  charms στο χέρι στο τέλος: p10 " + q(rows.map((r) => r.charms), .1) + " p50 " + q(rows.map((r) => r.charms), .5) + " p90 " + q(rows.map((r) => r.charms), .9) + " · μέσος " + mean(rows.map((r) => r.charms)).toFixed(2) + " από " + G.CFG.charmSlots + " θέσεις");
console.log("  runs που τελείωσαν με ΚΑΝΕΝΑ charm: " + (100 * rows.filter((r) => r.charms === 0).length / N).toFixed(0) + "%  · με 1: " + (100 * rows.filter((r) => r.charms === 1).length / N).toFixed(0) + "%  · με ≥3: " + (100 * rows.filter((r) => r.charms >= 3).length / N).toFixed(0) + "%");
console.log("  ante του 1ου charm: p50 " + q(rows.map((r) => r.first), .5) + " (99 = ποτέ) · perks p50 " + q(rows.map((r) => r.perks), .5));
const fill = [];
for (let k = 1; k <= G.CFG.charmSlots; k++) fill.push(k + ": " + (100 * rows.filter((r) => r.charms >= k).length / N).toFixed(0) + "%");
console.log("  θέσεις που γέμισαν ποτέ · " + fill.join(" · "));
