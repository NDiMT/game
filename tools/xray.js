/* xray.js — μετρήσεις μηχανισμού: hazard challenge vs plain, leadSuit, chain off-by-one,
   enh caps, ροή ανταμοιβών, endless.  node tools/xray.js [N] [what] */
const G = require("../site/raise/game.js");
const N = +process.argv[2] || 600, WHAT = process.argv[3] || "all";
const ALL = G.CHARMS.map((c) => c.id);
const PRIO = (process.env.PRIO || "climber,patient,ladder,leap,scout,lowroad,mirror,encore,afterburner,kingmaker,court,loyal,sleight,cheap,wind,ember,goldsmith,summiteer,pl,m1,cs,di,wi,m2,th,gt").split(",");
if (process.env.CFG) Object.assign(G.CFG, JSON.parse(process.env.CFG));
const pts = (S, o) => G.scoreOf(S, o.k, o.idx.map((i) => S.hand[i])).pts;
function discardStep(S) {
  let o = G.orphans(S);
  if (!o.length) o = S.hand.map((_, i) => i).filter((i) => !S.hand[i].h && S.hand[i].r !== 14 && !G.isWild(S.hand[i])).slice(0, 2);
  if (!o.length) return false;
  S.sel = o.slice(0, Math.min(3, o.length)); return G.discard(S);
}
const M = {
  lead: { 0: 0, 1: 0, 2: 0, 3: 0 }, plays: 0,
  scoredPos: {}, notedPos: {},
  chalHaz: {}, chalSeen: {}, plainHaz: 0, plainSeen: 0,
  rewardAt: {}, kindAt: {}, offersAt: {},
  endlessDepth: [], endlessNoPick: 0,
  reach: new Array(120).fill(0), lost: new Array(120).fill(0),
};
function playRound(S, endless) {
  const T = G.target(S);
  for (let guard = 0; guard < 300 && S.phase === "round"; guard++) {
    if (S.playsLeft < 1) break;
    const all = G.candidates(S);
    if (!all.length) { if (G.canDiscardAny(S) && discardStep(S)) continue; break; }
    const up = all.filter((o) => G.climbs(S, o.k));
    const m = (up.length ? up : all).reduce((b, o) => (!b || pts(S, o) > pts(S, b) ? o : b), null);
    if (!m) break;
    const need = Math.max(0, T - S.score), share = need / Math.max(1, S.playsLeft);
    if (S.playsLeft > 1 && pts(S, m) < 0.55 * share && G.canDiscardAny(S) && discardStep(S)) continue;
    const cs = m.idx.map((i) => S.hand[i]);
    const ls = G.leadSuit(cs); if (ls != null) M.lead[ls]++;
    S.sel = m.idx.slice();
    const before = G.chainPos(S);
    const ev = G.play(S);
    M.plays++;
    M.scoredPos[ev.pos] = (M.scoredPos[ev.pos] || 0) + 1;
    M.notedPos[G.chainPos(S)] = (M.notedPos[G.chainPos(S)] || 0) + 1;
    void before;
    if (ev.cleared) break;
  }
  if (S.phase === "round") G.finish(S);
}
function shop(S) {
  const a = S.ante;
  if (S.offers.length) {
    M.offersAt[a] = (M.offersAt[a] || []).concat(S.offers.map((o) => o.id));
    M.kindAt[a] = S.offers[0].kind;
  }
  while (G.picksLeft(S) > 0) {
    const list = S.offers.map((o, i) => ({ o, i })).filter((x) => !x.o.bought && G.canTake(S, x.i).ok);
    if (!list.length) break;
    const ch = list.slice().sort((x, y) => PRIO.indexOf(x.o.id) - PRIO.indexOf(y.o.id))[0];
    G.take(S, ch.i); M.rewardAt[a] = (M.rewardAt[a] || {}); M.rewardAt[a][ch.o.id] = (M.rewardAt[a][ch.o.id] || 0) + 1;
  }
  G.nextAnte(S);
}
for (let s = 0; s < N; s++) {
  const S = G.newRun("st-" + s, ALL);
  for (;;) {
    M.reach[S.ante]++;
    if (S.chal) M.chalSeen[S.chal] = (M.chalSeen[S.chal] || 0) + 1; else M.plainSeen++;
    playRound(S);
    if (S.phase === "lost") {
      M.lost[S.ante]++;
      if (S.chal) M.chalHaz[S.chal] = (M.chalHaz[S.chal] || 0) + 1; else M.plainHaz++;
      break;
    }
    if (S.phase === "won") {
      /* Endless: συνέχισε μέχρι θανάτου */
      const off = S.offers ? S.offers.length : 0;
      G.goEndless(S);
      if (S.offers.length && G.picksLeft(S) === 0) M.endlessNoPick++;
      void off;
      for (;;) {
        shop(S);
        M.reach[S.ante]++;
        playRound(S, true);
        if (S.phase === "lost") { M.lost[S.ante]++; M.endlessDepth.push(S.ante + 1); break; }
      }
      break;
    }
    shop(S);
  }
}
const tot = M.lead[0] + M.lead[1] + M.lead[2] + M.lead[3];
console.log("=== leadSuit distribution over " + tot + " played hands (0=♠ 1=♥ 2=♦ 3=♣) ===");
console.log([0, 1, 2, 3].map((i) => i + ":" + (100 * M.lead[i] / tot).toFixed(1) + "%").join("  ") +
  "  → black(♠♣) " + (100 * (M.lead[0] + M.lead[3]) / tot).toFixed(1) + "%  red(♥♦) " + (100 * (M.lead[1] + M.lead[2]) / tot).toFixed(1) + "%");
console.log("\n=== chain position: SCORED (used for Mult) vs RECORDED by noteChain ===");
console.log("scored : " + Object.keys(M.scoredPos).sort((a, b) => a - b).map((k) => k + "×" + M.scoredPos[k]).join(" "));
console.log("noted  : " + Object.keys(M.notedPos).sort((a, b) => a - b).map((k) => k + "×" + M.notedPos[k]).join(" "));
console.log("\n=== hazard by challenge vs plain ante ===");
const wil = (k, n) => { if (!n) return [0, 0]; const p = k / n, z = 1.96, d = 1 + z * z / n; const c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d; return [c - h, c + h]; };
Object.keys(M.chalSeen).sort((a, b) => (M.chalHaz[b] || 0) / M.chalSeen[b] - (M.chalHaz[a] || 0) / M.chalSeen[a]).forEach((c) => {
  const [lo, hi] = wil(M.chalHaz[c] || 0, M.chalSeen[c]);
  console.log("  " + c.padEnd(12) + String(M.chalSeen[c]).padStart(6) + String(M.chalHaz[c] || 0).padStart(6) + (100 * (M.chalHaz[c] || 0) / M.chalSeen[c]).toFixed(1).padStart(7) + "%  [" + (100 * lo).toFixed(1) + "–" + (100 * hi).toFixed(1) + "]");
});
console.log("  " + "PLAIN".padEnd(12) + String(M.plainSeen).padStart(6) + String(M.plainHaz).padStart(6) + (100 * M.plainHaz / M.plainSeen).toFixed(1).padStart(7) + "%");
const cs = Object.values(M.chalSeen).reduce((a, b) => a + b, 0), cd = Object.values(M.chalHaz).reduce((a, b) => a + b, 0);
console.log("  ALL CHALLENGE antes " + cd + "/" + cs + " = " + (100 * cd / cs).toFixed(1) + "%  vs PLAIN " + (100 * M.plainHaz / M.plainSeen).toFixed(1) + "%");
console.log("\n=== what the shop offers, by ante (unique ids seen) ===");
Object.keys(M.offersAt).map(Number).sort((a, b) => a - b).forEach((a) => {
  const c = {}; M.offersAt[a].forEach((i) => { c[i] = (c[i] || 0) + 1; });
  const n = M.offersAt[a].length;
  console.log("  ante " + String(a + 1).padStart(2) + " (" + M.kindAt[a] + ") " + Object.entries(c).sort((x, y) => y[1] - x[1]).map(([k, v]) => k + " " + Math.round(100 * v / n) + "%").join(" · "));
});
console.log("\n=== endless ===");
const q = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(p * (b.length - 1))] : NaN; };
console.log("  runs that reached endless: " + M.endlessDepth.length + " · died at ante p10 " + q(M.endlessDepth, .1) + " p50 " + q(M.endlessDepth, .5) + " p90 " + q(M.endlessDepth, .9) + " max " + Math.max.apply(null, M.endlessDepth.concat([0])));
console.log("  endless entry shops with offers but ZERO picks available: " + M.endlessNoPick);
