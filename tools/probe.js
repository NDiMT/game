/* probe.js — πολλαπλές πολιτικές παιξίματος + επιλογής, με hazard ανά ante.
   node tools/probe.js [N] [policy] [pickPolicy]
   policies: builder | cheap | greedy | bomb | rush | twopair | hoard
   pick: prio | random | none | <charmId>  */
const G = require("../site/raise/game.js");
const N = +process.argv[2] || 300, POL = process.argv[3] || "builder", PICK = process.argv[4] || "prio";
const ALL = G.CHARMS.map((c) => c.id);
const PRIO = (process.env.PRIO || "climber,patient,ladder,leap,scout,lowroad,mirror,encore,afterburner,kingmaker,court,loyal,sleight,cheap,wind,ember,goldsmith,summiteer,pl,m1,cs,di,wi,m2,th,gt").split(",");
const pts = (S, o) => G.scoreOf(S, o.k, o.idx.map((i) => S.hand[i])).pts;
const costKey = (k) => G.KINDS[k.kind].tier * 10000 + k.size * 100 + k.rank;

function discardStep(S, aggressive) {
  let o = G.orphans(S);
  if (!o.length && aggressive) {
    const g = {}; S.hand.forEach((c, i) => { if (!c.h && !G.isWild(c)) (g[c.r] = g[c.r] || []).push(i); });
    o = S.hand.map((_, i) => i).filter((i) => { const c = S.hand[i]; return !c.h && !G.isWild(c) && c.r !== 14 && (g[c.r] || []).length < 2; });
  }
  if (!o.length) o = S.hand.map((_, i) => i).filter((i) => !S.hand[i].h && S.hand[i].r !== 14 && !G.isWild(S.hand[i])).slice(0, 2);
  if (!o.length) return false;
  S.sel = o.slice(0, Math.min(3, o.length)); return G.discard(S);
}
function pickMove(S) {
  const all = G.candidates(S); if (!all.length) return null;
  const up = all.filter((o) => G.climbs(S, o.k));
  switch (POL) {
    case "greedy": return all.reduce((b, o) => (!b || pts(S, o) > pts(S, b) ? o : b), null);
    case "cheap": { const p = up.length ? up : all; return p.reduce((b, o) => (!b || costKey(o.k) < costKey(b.k) ? o : b), null); }
    case "bomb": {
      const b = all.filter((o) => G.isBomb(o.k)); if (b.length) return b.reduce((x, o) => (!x || pts(S, o) > pts(S, x) ? o : x), null);
      const p = up.length ? up : all; return p.reduce((x, o) => (!x || pts(S, o) > pts(S, x) ? o : x), null);
    }
    case "twopair": {
      const t = (up.length ? up : all).filter((o) => o.k.kind === 8 || o.k.kind === 1);
      const p = t.length ? t : (up.length ? up : all); return p.reduce((b, o) => (!b || pts(S, o) > pts(S, b) ? o : b), null);
    }
    default: { const p = up.length ? up : all; return p.reduce((b, o) => (!b || pts(S, o) > pts(S, b) ? o : b), null); }
  }
}
function playRound(S, st) {
  const T = G.target(S);
  for (let guard = 0; guard < 300 && S.phase === "round"; guard++) {
    if (S.playsLeft < 1) break;
    const m = pickMove(S);
    if (m) {
      const need = Math.max(0, T - S.score), share = need / Math.max(1, S.playsLeft);
      const thr = POL === "hoard" ? 0 : POL === "rush" ? 0 : 0.55;
      if (POL !== "rush" && S.playsLeft > 1 && pts(S, m) < thr * share && G.canDiscardAny(S) && discardStep(S, POL === "bomb" || POL === "hoard")) { st.disc++; continue; }
      S.sel = m.idx.slice(); const ev = G.play(S); st.plays++;
      st.kpts[G.KINDS[ev.k.kind].id] = (st.kpts[G.KINDS[ev.k.kind].id] || 0) + ev.pts; st.tot += ev.pts;
      st.big.push(ev.pts / T);
      if (ev.cleared) break;
      continue;
    }
    if (G.canDiscardAny(S) && discardStep(S, true)) { st.disc++; continue; }
    break;
  }
  st.sc[S.ante].push(S.score / T);
  if (S.phase === "round") G.finish(S);
}
function shop(S, st) {
  if (!S.offers.length) { G.nextAnte(S); return; }
  while (G.picksLeft(S) > 0) {
    /* Προσοχή: indexOf === -1 ταξινομείται ΠΡΩΤΟ, οπότε ένα id εκτός λίστας θα προτιμιόταν.
       Φιλτράρουμε ρητά — έτσι μια PRIO χωρίς leap/scout πραγματικά τα αγνοεί. */
    const list = S.offers.map((o, i) => ({ o, i })).filter((x) => !x.o.bought && PRIO.indexOf(x.o.id) >= 0 && G.canTake(S, x.i).ok);
    if (!list.length) break;
    let ch;
    if (PICK === "none") break;
    else if (PICK === "random") ch = list[Math.floor(Math.random() * list.length)];
    else if (PICK !== "prio") ch = list.find((x) => x.o.id === PICK) || list.slice().sort((a, b) => PRIO.indexOf(a.o.id) - PRIO.indexOf(b.o.id))[0];
    else ch = list.slice().sort((a, b) => PRIO.indexOf(a.o.id) - PRIO.indexOf(b.o.id))[0];
    if (!ch) break;
    G.take(S, ch.i); st.bought[ch.o.id] = (st.bought[ch.o.id] || 0) + 1;
  }
  st.unspent += G.picksLeft(S);
  G.nextAnte(S);
}
const L = G.TARGETS.length;
const st = { reach: new Array(L + 1).fill(0), lost: new Array(L + 1).fill(0), wins: 0, plays: 0, disc: 0, rounds: 0,
  sc: Array.from({ length: L + 1 }, () => []), kpts: {}, tot: 0, big: [], bought: {}, unspent: 0 };
for (let s = 0; s < N; s++) {
  const S = G.newRun("st-" + s, ALL);
  for (;;) {
    st.reach[S.ante]++; st.rounds++;
    playRound(S, st);
    if (S.phase === "lost") { st.lost[S.ante]++; break; }
    if (S.phase === "won") { st.wins++; break; }
    shop(S, st);
  }
}
const q = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(p * (b.length - 1))] : NaN; };
const meanDeath = st.lost.reduce((a, n, i) => a + n * (i + 1), 0) / Math.max(1, N - st.wins);
console.log(`policy ${POL} · pick ${PICK} · N ${N} · wins ${st.wins} (${(100 * st.wins / N).toFixed(1)}%) · mean death ante ${meanDeath.toFixed(2)} · plays/round ${(st.plays / st.rounds).toFixed(2)} · disc/round ${(st.disc / st.rounds).toFixed(2)} · unspent picks ${st.unspent}`);
console.log("share of POINTS: " + Object.entries(st.kpts).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + " " + (100 * v / st.tot).toFixed(0) + "%").join(" · "));
let l1 = "hazard%:", l2 = "reach  :", l3 = "p50/T  :";
for (let a = 0; a < L; a++) { const r = st.reach[a]; l1 += " " + (r ? Math.round(100 * st.lost[a] / r) : 0); l2 += " " + r; l3 += " " + (st.sc[a].length ? q(st.sc[a], .5).toFixed(2) : "-"); }
console.log(l1); console.log(l2); console.log(l3);
console.log("maxPlay/T p50 " + q(st.big, .5).toFixed(2) + " p90 " + q(st.big, .9).toFixed(2));
console.log("bought: " + Object.entries(st.bought).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + " " + v).join(" · "));
