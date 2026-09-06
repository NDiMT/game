/* rung.js — τι σχέση έχει το χέρι που παίζεται με το rung; Από αυτό ζουν (ή πεθαίνουν)
   τα charms που είναι δεμένα στο rung: Ladder (+1 βαθμός), Overkill (ίδιο σχήμα +4),
   Loyalty (ίδιο χρώμα). node tools/rung.js [N] [run|surv] */
const G = require("../site/raise/game.js");
const N = +process.argv[2] || 80, MODE = process.argv[3] || "run";
const ALL = G.CHARMS.map((c) => c.id);
const pts = (S, o) => G.scoreOf(S, o.k, o.idx.map((i) => S.hand[i])).pts;
const cost = (k) => G.KINDS[k.kind].tier * 1e6 + k.size * 1e3 + k.rank;
const M = { n: 0, noRung: 0, sameKind: 0, sameShape: 0, gap: {}, gapSame: {}, kindJump: {} };
function discardStep(S) {
  let o = G.orphans(S);
  if (!o.length) o = S.hand.map((_, i) => i).filter((i) => !S.hand[i].h && S.hand[i].r !== 14 && !G.isWild(S.hand[i])).slice(0, 2);
  if (!o.length) return false;
  S.sel = o.slice(0, Math.min(3, o.length)); return G.discard(S);
}
function note(S, k) {
  const r = S.rung; M.n++;
  if (!r) { M.noRung++; return; }
  const g = k.rank - r.rank;
  const b = g <= -1 ? "≤-1" : g >= 6 ? "≥6" : String(g);
  M.gap[b] = (M.gap[b] || 0) + 1;
  if (k.kind === r.kind) { M.sameKind++; if (k.size === r.size) { M.sameShape++; M.gapSame[b] = (M.gapSame[b] || 0) + 1; } }
  const j = G.KINDS[k.kind].tier - G.KINDS[r.kind].tier;
  M.kindJump[j] = (M.kindJump[j] || 0) + 1;
}
function classic(seed) {
  const S = G.newRun(seed, ALL);
  for (;;) {
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
      note(S, m.k); S.sel = m.idx.slice();
      if (G.play(S).cleared) break;
    }
    if (S.phase === "round") G.finish(S);
    if (S.phase === "lost" || S.phase === "won") break;
    S.pickUp = 0; S.pickCharm = 0; S.offers = [];
    G.nextAnte(S);
  }
}
function surv(seed) {
  const S = G.newRun(seed, [], "survival");
  for (let guard = 0; guard < 4000 && S.phase === "round"; guard++) {
    const all = G.candidates(S);
    if (!all.length) { if (G.canDiscardAny(S)) { const o = G.orphans(S); S.sel = (o.length ? o : S.hand.map((_, i) => i)).slice(0, 3); if (S.sel.length && G.discard(S)) continue; } break; }
    const up = all.filter((o) => G.climbs(S, o.k));
    let m = null, breathe = false;
    if (up.length) m = up.reduce((b, o) => (cost(o.k) < (b ? cost(b.k) : Infinity) ? o : b), null);
    else if (G.discardsLeft(S) > 0 && G.canDiscardAny(S)) breathe = true;
    else m = all.reduce((b, o) => (!b || pts(S, o) > pts(S, b) ? o : b), null);
    if (breathe) { const o = G.orphans(S); S.sel = (o.length ? o : S.hand.map((_, i) => i)).slice(0, 2); if (S.sel.length && G.discard(S)) continue; m = all[0]; }
    if (!m) break;
    note(S, m.k); S.sel = m.idx.slice();
    const ev = G.play(S); if (!ev || ev.last) break;
  }
  G.finish(S);
}
for (let i = 0; i < N; i++) (MODE === "surv" ? surv : classic)("rg-" + i);
const pc = (x) => (100 * x / M.n).toFixed(1) + "%";
console.log(MODE + " · " + M.n + " παιξίματα");
console.log("τραπέζι ανοιχτό (χωρίς rung): " + pc(M.noRung) + " · ίδιο είδος με το rung: " + pc(M.sameKind) + " · ίδιο είδος ΚΑΙ μήκος: " + pc(M.sameShape));
const ord = ["≤-1", "0", "1", "2", "3", "4", "5", "≥6"];
console.log("\nδιαφορά αξίας από το rung (όλα τα χέρια με rung):");
ord.forEach((k) => { if (M.gap[k]) console.log("  " + k.padStart(4) + " " + pc(M.gap[k]).padStart(7) + "   ίδιο σχήμα: " + pc(M.gapSame[k] || 0)); });
console.log("\nάλμα tier (kind του χεριού − kind του rung):");
Object.keys(M.kindJump).map(Number).sort((a, b) => a - b).forEach((j) => console.log("  " + String(j).padStart(3) + " " + pc(M.kindJump[j])));
