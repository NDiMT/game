/* Μελέτη ροής: instrumented bot runs. node tools/study.js [N] [strategy]
   strategy: base | finisher (φθηνά για αλυσίδα, το πιο ακριβό στο τελευταίο παίξιμο) | bombfish (ψαρεύει καρέ) */
const G = require("../site/raise/game.js");
const N = +process.argv[2] || 150, STRAT = process.argv[3] || "base";
const ALL = G.CHARMS.map((c) => c.id);
const PRIO = ["ladder", "cheap", "lowroad", "mirror", "encore", "wind", "court", "loyal", "vault", "sleight", "thrift", "ember", "goldsmith", "summiteer",
  "pl", "m1", "cs", "di", "br", "wi", "m2", "m3", "m4", "m5", "m6", "th"];
const CARD_PR = { wild: 12.5, gold: 14.5, steel: 16.5, glass: 18.5 };

const st = { kinds: {}, bombs: 0, bombPts: 0, totalPts: 0, plays: 0, passes: 0, aces: 0, discards: 0, rounds: 0, maxChain: [], lost: new Array(30).fill(0), wins: 0,
  ratio: Array.from({ length: 30 }, () => []), score: Array.from({ length: 30 }, () => []), bought: {}, money: Array.from({ length: 30 }, () => []), keptSwaps: 0, deathCause: {}, bombRounds: 0, stuckEarly: 0, raises: 0, raiseWon: 0, aceRounds: 0 };

function rankGroups(S) { const g = {}; S.hand.forEach((c, i) => { if (!c.h && !G.isWild(c)) (g[c.r] = g[c.r] || []).push(i); }); return g; }
function discardStep(S) {
  let o = G.orphans(S);
  if (STRAT === "bombfish") { const g = rankGroups(S); o = S.hand.map((_, i) => i).filter((i) => { const c = S.hand[i]; return !c.h && !G.isWild(c) && c.r !== 14 && (g[c.r] || []).length < 2; }); }
  if (!o.length) o = S.hand.map((_, i) => i).filter((i) => !S.hand[i].h && S.hand[i].r !== 14 && !G.isWild(S.hand[i])).slice(0, 2);
  if (!o.length) return false;
  S.sel = o.slice(0, G.CFG.discardCards); return G.discard(S);
}
function playRound(S) {
  let bombThis = false;
  for (let guard = 0; guard < 200 && S.phase === "round"; guard++) {
    if (S.playsLeft <= 0) break;
    if (G.canRaise(S) && S.playsLeft >= 3 && S.discards >= 1) { G.raise(S); st.raises++; }
    let m = G.suggest(S);
    if (STRAT === "finisher" && S.playsLeft === 1) { let best = null, bp = -1; G.legalMoves(S).forEach((o) => { const p = G.scoreOf(S, o.k, o.idx.map((i) => S.hand[i])).pts; if (p > bp) { bp = p; best = o; } }); if (best) m = best; }
    if (STRAT === "bombfish" && m && !G.isBomb(m.k)) {
      /* μην παίζεις ζευγάρια/τρίο που μπορούν να γίνουν καρέ, αν έχεις discards για ψάρεμα */
      const g = rankGroups(S), all = G.legalMoves(S).filter((o) => !o.idx.some((i) => (g[S.hand[i].r] || []).length >= 2 && (g[S.hand[i].r] || []).length < 4));
      if (all.length) m = all.reduce((b, o) => (!b || o.k.rank < b.k.rank ? o : b), null); else if (S.discards > 0 && S.pile.length) { if (discardStep(S)) continue; }
    }
    if (m) { S.sel = m.idx.slice(); const ev = G.play(S); st.plays++; st.kinds[G.KINDS[ev.k.kind].id] = (st.kinds[G.KINDS[ev.k.kind].id] || 0) + 1; st.totalPts += ev.pts; if (ev.bomb) { st.bombs++; st.bombPts += ev.pts; bombThis = true; } continue; }
    if (S.rung) { const a = G.aceIndex(S); if (a >= 0) { S.sel = [a]; G.play(S); st.aces++; continue; } }
    if (S.discards > 0 && S.pile.length > 0 && discardStep(S)) { st.discards++; continue; }
    if (G.canPass(S)) { G.pass(S); st.passes++; continue; }
    break;
  }
  st.rounds++; if (bombThis) st.bombRounds++; if (S.phase === "round" && S.playsLeft > 0) st.stuckEarly++;
  if (S.raised && S.score >= S.raiseTarget) st.raiseWon++;
  st.maxChain.push(S.stats.maxChain);
  st.ratio[S.ante].push(S.score / G.target(S)); st.score[S.ante].push(S.score);
  if (S.phase === "round") G.finish(S);
}
function shop(S) {
  let again = true;
  while (again) { again = false;
    const opts = S.offers.map((o, i) => ({ o, i, pr: o.kind === "card" ? CARD_PR[o.card.e] : PRIO.indexOf(o.id), cost: G.offerCost(S, o) })).filter((x) => !x.o.bought && x.pr >= 0 && G.canBuy(S, x.i).ok).sort((a, b) => a.pr - b.pr);
    if (opts.length) { const o = opts[0].o; G.buy(S, opts[0].i); const id = o.kind === "card" ? "card:" + o.card.e : o.id; st.bought[id] = (st.bought[id] || 0) + 1; again = true; } }
  st.money[S.ante].push(S.money);
  const g = rankGroups(S);
  const swap = STRAT === "bombfish" ? S.hand.map((_, i) => i).filter((i) => { const c = S.hand[i]; return !G.isWild(c) && c.r !== 14 && (g[c.r] || []).length < 2; }) : G.orphans(S);
  swap.forEach((i) => G.toggleKeep(S, i)); st.keptSwaps += swap.length;
  /* συμβόλαιο: το πιο εύκολο από τις προσφορές */
  const CPREF = ["c_all", "c_noace", "c_nopass", "c_low", "c_pairs", "c_nodisc", "c_chain6", "c_stairs", "c_str3", "c_full", "c_bomb"];
  const co = (S.contractOffers || []).slice().sort((a, b) => CPREF.indexOf(a) - CPREF.indexOf(b))[0];
  if (co) G.chooseContract(S, co);
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
console.log(`per round: plays ${(st.plays / st.rounds).toFixed(2)} · passes ${(st.passes / st.rounds).toFixed(2)} · aces ${(st.aces / st.rounds).toFixed(2)} · discards ${(st.discards / st.rounds).toFixed(2)} · swaps at shop ${(st.keptSwaps / st.rounds).toFixed(2)} · max chain p50 ${q(st.maxChain, .5)} p90 ${q(st.maxChain, .9)}`);
console.log("score/target p50 by ante:", st.ratio.map((a) => a.length ? q(a, .5).toFixed(1) : "-").join(" "));
console.log("score/target p10 by ante:", st.ratio.map((a) => a.length ? q(a, .1).toFixed(2) : "-").join(" "));
console.log("score p50 by ante:", st.score.map((a) => a.length ? q(a, .5) : "-").join(" "));
console.log("score p25 by ante:", st.score.map((a) => a.length ? q(a, .25) : "-").join(" "));
console.log("chips after shop p50:", st.money.map((a) => a.length ? q(a, .5) : "-").join(" "));
console.log("bought:", Object.entries(st.bought).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + " " + v).join(" · "));
console.log(`rounds ended stuck with plays left: ${(100 * st.stuckEarly / st.rounds).toFixed(1)}% · raises ${st.raises} won ${st.raiseWon}`);
console.log("death by challenge:", JSON.stringify(st.deathCause));
