/* decide.js — «είναι κάθε γύρος πραγματική απόφαση;»
   Για κάθε παίξιμο μετρά τη ΔΟΜΗ της επιλογής, όχι το αποτέλεσμα:
     opts   = διακριτά χέρια (dedupe ανά kind/size/rank) — πόσο μεγάλο είναι το μενού
     climbs = πόσα από αυτά ανεβαίνουν
     kinds  = πόσα ΔΙΑΦΟΡΕΤΙΚΑ είδη χεριού ανεβαίνουν (η ουσιαστική επιλογή)
     forced = 1 αν υπάρχει ≤1 ανέβασμα (καμία απόφαση)
     tension= 1 αν το ΑΚΡΙΒΟΤΕΡΟ ανέβασμα ΔΕΝ είναι το φθηνότερο (δηλ. υπάρχει δίλημμα
              «πληρώσου τώρα ή κράτα το rung χαμηλά»)
     edge   = pts(καλύτερο) / pts(δεύτερο) στα ανεβάσματα — πόσο κοστίζει το λάθος
     breath = 1 αν τίποτα δεν ανεβαίνει (η απόφαση της ανάσας, μόνο Survival)
   Bucketed ανά ante (Classic) ή ανά δεκάδα χεριών (Survival), για να φανεί αν η μέση
   του run είναι η ίδια απόφαση ξανά και ξανά.

   node tools/decide.js [N] [run|surv]
*/
const G = require("../site/raise/game.js");
const N = +process.argv[2] || 60, MODE = process.argv[3] || "run";
const ALL = G.CHARMS.map((c) => c.id);
const PRIO = (process.env.PRIO || "patient,court,kingmaker,mirror,climber,encore,loyal,lowroad,sleight,wind,ember,scout,leap,summiteer,cheap,goldsmith,ladder,afterburner,wi,pl,th,m2,cs,m1,gt,di").split(",");
const pts = (S, o) => G.scoreOf(S, o.k, o.idx.map((i) => S.hand[i])).pts;
const cost = (k) => G.KINDS[k.kind].tier * 1e6 + k.size * 1e3 + k.rank;
const key = (k) => k.kind + "/" + k.size + "/" + k.rank;

function snap(S) {
  const all = G.candidates(S);
  const seen = {}, uniq = [];
  all.forEach((o) => { const q = key(o.k); if (!seen[q]) { seen[q] = 1; uniq.push(o); } });
  const up = uniq.filter((o) => G.climbs(S, o.k));
  const kinds = new Set(up.map((o) => o.k.kind)).size;
  const v = up.map((o) => pts(S, o)).sort((a, b) => b - a);
  const cheapest = up.reduce((b, o) => (!b || cost(o.k) < cost(b.k) ? o : b), null);
  const dearest = up.reduce((b, o) => (!b || pts(S, o) > pts(S, b) ? o : b), null);
  return {
    opts: uniq.length, climbs: up.length, kinds,
    forced: up.length <= 1 ? 1 : 0,
    tension: up.length > 1 && cheapest && dearest && key(cheapest.k) !== key(dearest.k) ? 1 : 0,
    edge: v.length > 1 ? v[0] / Math.max(1, v[1]) : NaN,
    breath: up.length === 0 ? 1 : 0,
  };
}
function discardStep(S) {
  let o = G.orphans(S);
  if (!o.length) o = S.hand.map((_, i) => i).filter((i) => !S.hand[i].h && S.hand[i].r !== 14 && !G.isWild(S.hand[i])).slice(0, 2);
  if (!o.length) return false;
  S.sel = o.slice(0, Math.min(3, o.length)); return G.discard(S);
}
const B = {};
function bucket(b, s) {
  const x = B[b] = B[b] || { n: 0, opts: 0, climbs: 0, kinds: 0, forced: 0, tension: 0, edge: [], breath: 0 };
  x.n++; x.opts += s.opts; x.climbs += s.climbs; x.kinds += s.kinds; x.forced += s.forced; x.tension += s.tension; x.breath += s.breath;
  if (isFinite(s.edge)) x.edge.push(s.edge);
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
      bucket(Math.min(9, Math.floor(S.ante / 5)) * 5, snap(S));
      S.sel = m.idx.slice();
      if (G.play(S).cleared) break;
    }
    if (S.phase === "round") G.finish(S);
    if (S.phase === "lost" || S.phase === "won") break;
    while (G.picksLeft(S) > 0) {
      const opts = S.offers.map((o, i) => ({ o, i, pr: PRIO.indexOf(o.id) })).filter((x) => !x.o.bought && x.pr >= 0 && G.canTake(S, x.i).ok).sort((a, b) => a.pr - b.pr);
      if (!opts.length) break;
      G.take(S, opts[0].i);
    }
    G.nextAnte(S);
  }
}
function surv(seed) {
  const S = G.newRun(seed, [], "survival");
  let h = 0;
  for (let guard = 0; guard < 4000 && S.phase === "round"; guard++) {
    const all = G.candidates(S);
    if (!all.length) { if (G.canDiscardAny(S)) { const o = G.orphans(S); S.sel = (o.length ? o : S.hand.map((_, i) => i)).slice(0, 3); if (S.sel.length && G.discard(S)) continue; } break; }
    bucket(Math.min(7, Math.floor(h / 10)) * 10, snap(S));
    const up = all.filter((o) => G.climbs(S, o.k));
    let m = null, breathe = false;
    if (up.length) m = up.reduce((b, o) => (cost(o.k) < (b ? cost(b.k) : Infinity) ? o : b), null);
    else if (G.discardsLeft(S) > 0 && G.canDiscardAny(S)) breathe = true;
    else m = all.reduce((b, o) => (!b || pts(S, o) > pts(S, b) ? o : b), null);
    if (breathe) { const o = G.orphans(S); S.sel = (o.length ? o : S.hand.map((_, i) => i)).slice(0, 2); if (S.sel.length && G.discard(S)) continue; m = all[0]; }
    if (!m) break;
    S.sel = m.idx.slice(); h++;
    const ev = G.play(S); if (!ev || ev.last) break;
  }
  G.finish(S);
}
for (let i = 0; i < N; i++) (MODE === "surv" ? surv : classic)("dc-" + i);
const q = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(p * (b.length - 1))] : NaN; };
console.log((MODE === "surv" ? "Survival · ανά δεκάδα χεριών" : "Classic · ανά πεντάδα antes") + " · " + N + " runs\n");
console.log((MODE === "surv" ? "χέρια" : "antes").padEnd(8) + "n".padStart(7) + "opts".padStart(8) + "climbs".padStart(8) + "kinds".padStart(7) + "forced".padStart(8) + "tension".padStart(9) + "edge p50".padStart(10) + "breath".padStart(8));
Object.keys(B).map(Number).sort((a, b) => a - b).forEach((k) => {
  const x = B[k], lab = MODE === "surv" ? k + 1 + "-" + (k + 10) : k + 1 + "-" + (k + 5);
  console.log(lab.padEnd(8) + String(x.n).padStart(7) + (x.opts / x.n).toFixed(1).padStart(8) + (x.climbs / x.n).toFixed(1).padStart(8) +
    (x.kinds / x.n).toFixed(2).padStart(7) + ((100 * x.forced / x.n).toFixed(0) + "%").padStart(8) + ((100 * x.tension / x.n).toFixed(0) + "%").padStart(9) +
    ("×" + q(x.edge, .5).toFixed(2)).padStart(10) + ((100 * x.breath / x.n).toFixed(0) + "%").padStart(8));
});
