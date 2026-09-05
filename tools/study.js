/* Μελέτη ροής: instrumented bot runs. node tools/study.js [N] [strategy]
   strategy: base | finisher (φθηνά για αλυσίδα, το πιο ακριβό στο τελευταίο παίξιμο) | bombfish (ψαρεύει καρέ) */
const G = require("../site/raise/game.js");
const N = +process.argv[2] || 150, STRAT = process.argv[3] || "base", PLAYOUT = !!process.env.PLAYOUT;
const ALL = G.CHARMS.map((c) => c.id);
const PRIO = ["climber", "patient", "ladder", "lowroad", "mirror", "encore", "afterburner", "kingmaker", "court", "loyal", "sleight", "cheap", "wind", "ember", "goldsmith", "summiteer",
  "pl", "m1", "cs", "di", "wi", "m2", "th", "gt"];

const st = { kinds: {}, bombs: 0, bombPts: 0, totalPts: 0, plays: 0, breaks: 0, aces: 0, discards: 0, rounds: 0, maxChain: [], lost: new Array(G.TARGETS.length).fill(0), wins: 0,
  ratio: Array.from({ length: G.TARGETS.length }, () => []), score: Array.from({ length: G.TARGETS.length }, () => []), bought: {}, picks: Array.from({ length: G.TARGETS.length }, () => []), keptSwaps: 0, deathCause: {}, bombRounds: 0, stuckEarly: 0, aceRounds: 0, used: [] };

function rankGroups(S) { const g = {}; S.hand.forEach((c, i) => { if (!c.h && !G.isWild(c)) (g[c.r] = g[c.r] || []).push(i); }); return g; }
function discardStep(S) {
  let o = G.orphans(S);
  if (STRAT === "bombfish") { const g = rankGroups(S); o = S.hand.map((_, i) => i).filter((i) => { const c = S.hand[i]; return !c.h && !G.isWild(c) && c.r !== 14 && (g[c.r] || []).length < 2; }); }
  if (!o.length) o = S.hand.map((_, i) => i).filter((i) => !S.hand[i].h && S.hand[i].r !== 14 && !G.isWild(S.hand[i])).slice(0, 2);
  if (!o.length) return false;
  S.sel = o.slice(0, Math.min(3, o.length)); return G.discard(S);
}
function playRound(S) {
  let bombThis = false, done = false;
  for (let guard = 0; guard < 200 && S.phase === "round"; guard++) {
    if (S.playsLeft < 1) break;
    let m = G.suggest(S);
    if (STRAT === "finisher" && S.playsLeft < 2) { let best = null, bp = -1; G.candidates(S).forEach((o) => { const p = G.scoreOf(S, o.k, o.idx.map((i) => S.hand[i])).pts; if (p > bp) { bp = p; best = o; } }); if (best) m = best; }
    if (STRAT === "bombfish" && m && !G.isBomb(m.k)) {
      /* μην παίζεις ζευγάρια/τρίο που μπορούν να γίνουν καρέ, αν έχεις discards για ψάρεμα */
      const g = rankGroups(S), all = G.candidates(S).filter((o) => G.climbs(S, o.k) && !o.idx.some((i) => (g[S.hand[i].r] || []).length >= 2 && (g[S.hand[i].r] || []).length < 4));
      if (all.length) m = all.reduce((b, o) => (!b || o.k.rank < b.k.rank ? o : b), null); else if (G.discardsLeft(S) > 0 && S.pile.length) { if (discardStep(S)) continue; }
    }
    if (m) {
      const need = Math.max(0, G.target(S) - S.score), share = need / Math.max(1, S.playsLeft);
      if (!PLAYOUT && S.playsLeft > 1 && G.scoreOf(S, m.k, m.idx.map((i) => S.hand[i])).pts < 0.55 * share && G.canDiscardAny(S) && discardStep(S)) { st.discards++; continue; }
      S.sel = m.idx.slice(); const ev = G.play(S); st.plays++; if (ev.broke) st.breaks++; st.kinds[G.KINDS[ev.k.kind].id] = (st.kinds[G.KINDS[ev.k.kind].id] || 0) + 1; if (ev.k.kind === 9) st.aces++; st.totalPts += ev.pts; if (ev.bomb) { st.bombs++; st.bombPts += ev.pts; bombThis = true; }
      /* Φτάνεις τον στόχο, ο γύρος τελειώνει εκεί — όπως και στο παιχνίδι. */
      if (ev.cleared && !PLAYOUT) { done = true; break; }
      continue; }
    if (G.canDiscardAny(S) && discardStep(S)) { st.discards++; continue; }
    break;
  }
  const cleared = S.score >= G.target(S);
  if (cleared) st.used.push(S.playsMax - S.playsLeft);
  st.rounds++; if (bombThis) st.bombRounds++;
  /* «Κόλλησε»: τελείωσε ο γύρος χωρίς να πιάσει τον στόχο ενώ του έμεναν παιξίματα. */
  if (!cleared && !done && S.playsLeft >= 1) st.stuckEarly++;
  st.maxChain.push(S.stats.maxChain);
  st.ratio[S.ante].push(S.score / G.target(S)); st.score[S.ante].push(S.score);
  if (S.phase === "round") G.finish(S);
}
function shop(S) {
  if (!S.offers.length) { G.nextAnte(S); return; }
  /* Μία (ή δύο) επιλογές bonus, με προτεραιότητα από τη λίστα PRIO. */
  while (G.picksLeft(S) > 0) {
    const opts = S.offers.map((o, i) => ({ o, i, pr: PRIO.indexOf(o.id) })).filter((x) => !x.o.bought && x.pr >= 0 && G.canTake(S, x.i).ok).sort((a, b) => a.pr - b.pr);
    if (!opts.length) break;
    G.take(S, opts[0].i); st.bought[opts[0].o.id] = (st.bought[opts[0].o.id] || 0) + 1;
  }
  st.picks[S.ante].push(G.picksLeft(S));
  G.nextAnte(S);
}
for (let s = 0; s < N; s++) {
  const S = G.newRun("st-" + s, ALL);
  for (;;) {
    playRound(S);
    if (S.phase === "lost") { st.lost[S.ante]++; const k = S.chal || "plain"; st.deathCause[k] = (st.deathCause[k] || 0) + 1; break; }
    if (S.phase === "won") { st.wins++; break; }
    shop(S);
  }
}
const q = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(p * (b.length - 1))] : NaN; };
const mean = st.lost.reduce((a, n, i) => a + n * (i + 1), 0) / (N - st.wins) || 0;
console.log(`strategy ${STRAT} · runs ${N} · wins ${st.wins} · mean death ante ${mean.toFixed(1)}`);
console.log("deaths/ante:", st.lost.join(" "));
console.log("kinds played:", Object.entries(st.kinds).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + " " + (100 * v / st.plays).toFixed(0) + "%").join(" · "));
console.log(`bombs: ${st.bombs} in ${st.rounds} rounds (${(100 * st.bombRounds / st.rounds).toFixed(1)}% of rounds) · bomb share of all points ${(100 * st.bombPts / st.totalPts).toFixed(1)}%`);
console.log(`per round: plays ${(st.plays / st.rounds).toFixed(2)} · chain breaks ${(st.breaks / st.rounds).toFixed(2)} · aces ${(st.aces / st.rounds).toFixed(2)} · discards ${(st.discards / st.rounds).toFixed(2)} · max chain p50 ${q(st.maxChain, .5)} p90 ${q(st.maxChain, .9)}`);
console.log("score/target p50 by ante:", st.ratio.map((a) => a.length ? q(a, .5).toFixed(1) : "-").join(" "));
console.log("score/target p10 by ante:", st.ratio.map((a) => a.length ? q(a, .1).toFixed(2) : "-").join(" "));
console.log("score p50 by ante:", st.score.map((a) => a.length ? q(a, .5) : "-").join(" "));
console.log("score p25 by ante:", st.score.map((a) => a.length ? q(a, .25) : "-").join(" "));
console.log("unspent picks p50:", st.picks.map((a) => a.length ? q(a, .5) : "-").join(" "));
console.log("bought:", Object.entries(st.bought).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + " " + v).join(" · "));
console.log(`plays used to clear: p50 ${q(st.used, .5)} p90 ${q(st.used, .9)} · rounds ended stuck with plays left: ${(100 * st.stuckEarly / st.rounds).toFixed(1)}%`);
console.log("death by challenge:", JSON.stringify(st.deathCause));
