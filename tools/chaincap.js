/* chaincap.js — ΔΕΝΕΙ το `chainCap` στο Classic/Wild;

   Μετρήθηκε ΝΕΚΡΟ γράμμα πριν μπει το `chainCarry` (6, 8, 10 ταυτόσημα), γιατί η αλυσίδα
   μηδενιζόταν σε κάθε πίστα και ο διάμεσος γύρος δεν έφτανε ποτέ το ×6. Με τη μεταφορά της
   αλυσίδας από πίστα σε πίστα η υπόθεση αλλάζει, οπότε ξαναμετριέται από την αρχή:
   κατανομή θέσης αλυσίδας ανά παίξιμο, και ποσοστό παιξιμάτων όπου το `capPos` ΚΟΒΕΙ.

   node tools/chaincap.js [runs] [maxAnte]
*/
const G = require("../site/raise/game.js");
const RUNS = +process.argv[2] || 200, MAXA = +process.argv[3] || G.TARGETS.length;
const ALL = G.CHARMS.map((c) => c.id);
const PRIO = (process.env.PRIO || "patient,court,kingmaker,mirror,climber,encore,loyal,lowroad,sleight,wind,ember,scout,leap,summiteer,cheap,goldsmith,ladder,afterburner,wi,pl,th,m2,cs,m1,gt,di").split(",");
const q = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(p * (b.length - 1))] : NaN; };
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);

function discardStep(S) {
  let o = G.orphans(S);
  if (!o.length) o = S.hand.map((_, i) => i).filter((i) => !S.hand[i].h && S.hand[i].r !== 14 && !G.isWild(S.hand[i])).slice(0, 2);
  if (!o.length) return false;
  S.sel = o.slice(0, Math.min(3, o.length)); return G.discard(S);
}
/* Η ΑΚΟΠΗ θέση: ό,τι θα έδειχνε το chainPos αν δεν υπήρχε καμία οροφή. */
const rawPos = (S) => S.chain + 1 + S.chainStart + (S.chainBonus || 0);

const st = { pos: [], raw: [], clip: 0, n: 0, byAnte: {}, atCap: 0, over: [] };
function playRound(S) {
  const T = G.target(S);
  for (let guard = 0; guard < 200 && S.phase === "round"; guard++) {
    if (S.playsLeft < 1) break;
    const all = G.candidates(S), up = all.filter((o) => G.climbs(S, o.k)), pool = up.length ? up : all;
    const best = (list) => (list.length ? list.reduce((b, o) => (!b || G.scoreOf(S, o.k, o.idx.map((i) => S.hand[i])).pts > G.scoreOf(S, b.k, b.idx.map((i) => S.hand[i])).pts ? o : b), null) : null);
    const m = pool.length ? best(pool) : null;
    if (m) {
      const need = Math.max(0, T - S.score), share = need / Math.max(1, S.playsLeft);
      if (S.playsLeft > 1 && G.scoreOf(S, m.k, m.idx.map((i) => S.hand[i])).pts < 0.55 * share && G.canDiscardAny(S) && discardStep(S)) continue;
      /* ΠΡΙΝ το παίξιμο: τι αλυσίδα πληρώνεται τώρα, κομμένη και ακοπή. */
      const p = G.chainPos(S), r = rawPos(S);
      st.n++; st.pos.push(p); st.raw.push(r);
      if (r > p) { st.clip++; st.over.push(r - p); }
      if (p >= G.CFG.chainCap) st.atCap++;
      (st.byAnte[S.ante] = st.byAnte[S.ante] || []).push(p);
      S.sel = m.idx.slice(); G.play(S);
      continue;
    }
    if (G.canDiscardAny(S) && discardStep(S)) continue;
    break;
  }
  if (S.phase === "round") G.finish(S);
}
function shop(S) {
  if (!S.offers.length) { G.nextAnte(S); return; }
  while (G.picksLeft(S) > 0) {
    const opts = S.offers.map((o, i) => ({ o, i, pr: PRIO.indexOf(o.id) })).filter((x) => !x.o.bought && x.pr >= 0 && G.canTake(S, x.i).ok).sort((a, b) => a.pr - b.pr);
    if (!opts.length) break;
    G.take(S, opts[0].i);
  }
  G.nextAnte(S);
}
for (let s = 0; s < RUNS; s++) {
  const S = G.newRun("st-" + s, ALL);
  for (;;) {
    playRound(S);
    if (S.phase === "lost" || S.phase === "won") break;
    if (S.ante >= MAXA - 1) break;
    shop(S);
  }
}
const hist = {};
st.pos.forEach((p) => { hist[p] = (hist[p] || 0) + 1; });
console.log("runs " + RUNS + " · παιξίματα " + st.n + " · chainCap " + G.CFG.chainCap + " · chainCarry " + G.CFG.chainCarry);
console.log("θέση αλυσίδας (κομμένη):  p50 ×" + q(st.pos, .5) + "  p90 ×" + q(st.pos, .9) + "  μέση ×" + mean(st.pos).toFixed(2));
console.log("θέση αλυσίδας (ΑΚΟΠΗ):    p50 ×" + q(st.raw, .5) + "  p90 ×" + q(st.raw, .9) + "  μέση ×" + mean(st.raw).toFixed(2) + "  max ×" + Math.max.apply(null, st.raw));
console.log("παιξίματα ΣΤΗΝ οροφή:     " + (100 * st.atCap / st.n).toFixed(2) + "%");
console.log("παιξίματα που ΚΟΒΟΝΤΑΙ:   " + (100 * st.clip / st.n).toFixed(2) + "%  (μέσο χαμένο σκαλί " + (st.over.length ? mean(st.over).toFixed(2) : "0") + ", max " + (st.over.length ? Math.max.apply(null, st.over) : 0) + ")");
console.log("ιστόγραμμα: " + Object.keys(hist).map(Number).sort((a, b) => a - b).map((k) => "×" + k + " " + (100 * hist[k] / st.n).toFixed(1) + "%").join(" · "));
const as = Object.keys(st.byAnte).map(Number).sort((a, b) => a - b);
console.log("διάμεση θέση ανά ante: " + as.filter((a) => a % 5 === 0 && st.byAnte[a].length >= 20).map((a) => (a + 1) + ":×" + q(st.byAnte[a], .5)).join(" "));
