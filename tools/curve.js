/* curve.js — σχήμα της καμπύλης δυσκολίας: πόσο πέφτει ο κίνδυνος στα boss antes και πόσο
   στα «κενά» antes, και τι γίνεται αν αλλάξω τους δύο πολλαπλασιαστές.
   node tools/curve.js [N] [plainMul] [chalTargetMul] [perChal?]
   Το plainMul πολλαπλασιάζει τους στόχους ΜΟΝΟ στα antes χωρίς challenge. */
const G = require("../site/raise/game.js");
const N = +process.argv[2] || 1000, PM = +process.argv[3] || 1, CM = process.argv[4] ? +process.argv[4] : G.CFG.chalTargetMul;
const PER = process.argv[5] ? JSON.parse(process.argv[5]) : null;
const ALL = G.CHARMS.map((c) => c.id);
const PRIO = (process.env.PRIO || "climber,patient,ladder,leap,scout,lowroad,mirror,encore,afterburner,kingmaker,court,loyal,sleight,cheap,wind,ember,goldsmith,summiteer,pl,m1,cs,di,wi,m2,th,gt").split(",");
if (process.env.T) { const t = JSON.parse(process.env.T); G.TARGETS.splice(0, G.TARGETS.length, ...t); }
if (process.env.CFG) Object.assign(G.CFG, JSON.parse(process.env.CFG));
G.CFG.chalTargetMul = CM;
/* Τα «κενά» antes είναι όσα δεν είναι reward antes· εκεί ανεβάζω τον στόχο. */
const L = G.TARGETS.length;
for (let a = 0; a < L; a++) if (!G.isReward(a) && a !== L - 1) G.TARGETS[a] = Math.round(G.TARGETS[a] * PM);
/* Προαιρετικά: πολλαπλασιαστής ανά challenge (patch στο target μέσω TARGETS δεν γίνεται —
   γίνεται με hook στο G.target, οπότε τον εφαρμόζω αλλάζοντας το chalTargetMul δυναμικά. */
const rawTarget = G.target;
const target = PER ? (S) => Math.round(rawTarget(S) * (PER[S.chal] || 1)) : rawTarget;
const pts = (S, o) => G.scoreOf(S, o.k, o.idx.map((i) => S.hand[i])).pts;
function discardStep(S) {
  let o = G.orphans(S);
  if (!o.length) o = S.hand.map((_, i) => i).filter((i) => !S.hand[i].h && S.hand[i].r !== 14 && !G.isWild(S.hand[i])).slice(0, 2);
  if (!o.length) return false;
  S.sel = o.slice(0, Math.min(3, o.length)); return G.discard(S);
}
function playRound(S) {
  const T = target(S);
  for (let g2 = 0; g2 < 300 && S.phase === "round"; g2++) {
    if (S.playsLeft < 1) break;
    const all = G.candidates(S);
    if (!all.length) { if (G.canDiscardAny(S) && discardStep(S)) continue; break; }
    const up = all.filter((o) => G.climbs(S, o.k));
    const m = (up.length ? up : all).reduce((b, o) => (!b || pts(S, o) > pts(S, b) ? o : b), null);
    if (!m) break;
    const need = Math.max(0, T - S.score), share = need / Math.max(1, S.playsLeft);
    if (S.playsLeft > 1 && pts(S, m) < 0.55 * share && G.canDiscardAny(S) && discardStep(S)) continue;
    S.sel = m.idx.slice(); G.play(S);
    if (S.score >= T) break;
  }
  if (S.score >= T) { if (S.phase === "round") { const t0 = G.target; S.__ok = 1; G.finish(S); void t0; } } else if (S.phase === "round") G.finish(S);
  return S.score >= T;
}
function shop(S) {
  while (G.picksLeft(S) > 0) {
    const list = S.offers.map((o, i) => ({ o, i })).filter((x) => !x.o.bought && G.canTake(S, x.i).ok);
    if (!list.length) break;
    G.take(S, list.slice().sort((a, b) => PRIO.indexOf(a.o.id) - PRIO.indexOf(b.o.id))[0].i);
  }
  G.nextAnte(S);
}
const st = { reach: new Array(L).fill(0), lost: new Array(L).fill(0), wins: 0, cs: 0, cd: 0, ps: 0, pd: 0, byC: {}, sC: {} };
for (let s = 0; s < N; s++) {
  const S = G.newRun("st-" + s, ALL);
  for (;;) {
    st.reach[S.ante]++;
    if (S.chal) { st.cs++; st.sC[S.chal] = (st.sC[S.chal] || 0) + 1; } else st.ps++;
    const ok = playRound(S);
    if (!ok) {
      st.lost[S.ante]++;
      if (S.chal) { st.cd++; st.byC[S.chal] = (st.byC[S.chal] || 0) + 1; } else st.pd++;
      break;
    }
    if (S.ante >= L - 1) { st.wins++; break; }
    if (S.phase === "round") G.finish(S);
    shop(S);
  }
}
const md = st.lost.reduce((a, n, i) => a + n * (i + 1), 0) / Math.max(1, N - st.wins);
console.log(`plainMul ${PM} · chalTargetMul ${CM} · N ${N} · wins ${st.wins} (${(100 * st.wins / N).toFixed(1)}%) · mean death ante ${md.toFixed(2)}`);
console.log(`  hazard: BOSS ${st.cd}/${st.cs} = ${(100 * st.cd / st.cs).toFixed(1)}%   PLAIN ${st.pd}/${st.ps} = ${(100 * st.pd / st.ps).toFixed(1)}%   ratio ${(st.cd / st.cs / (st.pd / st.ps)).toFixed(2)}×`);
console.log("  per challenge: " + Object.keys(st.sC).sort((a, b) => (st.byC[b] || 0) / st.sC[b] - (st.byC[a] || 0) / st.sC[a]).map((c) => c + " " + (100 * (st.byC[c] || 0) / st.sC[c]).toFixed(0) + "%").join(" · "));
console.log("  hazard/ante: " + st.reach.map((r, i) => (r ? Math.round(100 * st.lost[i] / r) : 0)).join(" "));
