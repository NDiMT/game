/* paired.js — ζευγαρωμένη σύγκριση δύο ρυθμίσεων CFG πάνω στα ΙΔΙΑ seeds και την ΙΔΙΑ
   πολιτική. Ό,τι μένει είναι η ρύθμιση. Το σπίτι μετρά έτσι κάθε οριακή αλλαγή.

     A='{"charmFirst":0}' B='{"charmFirst":1}' node tools/paired.js 300
     A='{"patientCap":9}' B='{"patientCap":6}' GRANT=patient node tools/paired.js 300
     A='{"survSteep":0}' B='{"survSteep":12}' MODE=surv node tools/paired.js 200

   GRANT=<charmId>  χαρίζει το charm από την αρχή (για να μετρηθεί ΤΟΥ ΙΔΙΟΥ η ρύθμιση)
   MODE=surv        Survival: συγκρίνει σκορ και χέρια αντί για ante θανάτου
*/
const G = require("../site/raise/game.js");
const N = +process.argv[2] || 300;
const A = JSON.parse(process.env.A || "{}"), B = JSON.parse(process.env.B || "{}");
const GRANT = process.env.GRANT || "", MODE = process.env.MODE || "run";
const ALL = G.CHARMS.map((c) => c.id);
const PRIO = (process.env.PRIO || "patient,court,kingmaker,mirror,climber,encore,loyal,lowroad,sleight,wind,ember,scout,leap,summiteer,cheap,goldsmith,ladder,afterburner,wi,pl,th,m2,cs,m1,gt,di").split(",");
const pts = (S, o) => G.scoreOf(S, o.k, o.idx.map((i) => S.hand[i])).pts;
const cost = (k) => G.KINDS[k.kind].tier * 1e6 + k.size * 1e3 + k.rank;
function discardStep(S) {
  let o = G.orphans(S);
  if (!o.length) o = S.hand.map((_, i) => i).filter((i) => !S.hand[i].h && S.hand[i].r !== 14 && !G.isWild(S.hand[i])).slice(0, 2);
  if (!o.length) return false;
  S.sel = o.slice(0, Math.min(3, o.length)); return G.discard(S);
}
function classic(seed) {
  const S = G.newRun(seed, ALL);
  if (GRANT) { S.charms.push(GRANT); G.startRound(S); }
  for (;;) {
    const T = G.target(S);
    for (let g = 0; g < 300 && S.phase === "round"; g++) {
      if (S.playsLeft < 1) break;
      const all = G.candidates(S);
      if (!all.length) { if (G.canDiscardAny(S) && discardStep(S)) continue; break; }
      const up = all.filter((o) => G.climbs(S, o.k));
      const m = (up.length ? up : all).reduce((b, o) => (!b || pts(S, o) > pts(S, b) ? o : b), null);
      if (!m) break;
      const need = Math.max(0, T - S.score), share = need / Math.max(1, S.playsLeft);
      if (S.playsLeft > 1 && pts(S, m) < 0.55 * share && G.canDiscardAny(S) && discardStep(S)) continue;
      S.sel = m.idx.slice(); if (G.play(S).cleared) break;
    }
    if (S.phase === "round") G.finish(S);
    if (S.phase === "lost") return { x: S.ante + 1, c: S.charms.length, won: 0 };
    if (S.phase === "won") return { x: G.TARGETS.length + 1, c: S.charms.length, won: 1 };
    while (G.picksLeft(S) > 0) {
      const o = S.offers.map((of, i) => ({ o: of, i, pr: PRIO.indexOf(of.id) })).filter((x) => !x.o.bought && x.pr >= 0 && G.canTake(S, x.i).ok).sort((a, b) => a.pr - b.pr);
      if (!o.length) break;
      G.take(S, o[0].i);
    }
    G.nextAnte(S);
  }
}
function surv(seed) {
  const S = G.newRun(seed, [], "survival");
  if (GRANT) { S.charms.push(GRANT); S.charmSlots = 1; }
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
    S.sel = m.idx.slice();
    const ev = G.play(S); if (!ev || ev.last) break;
  }
  G.finish(S);
  return { x: S.score, c: S.stats.plays, won: 0 };
}
const runOne = MODE === "surv" ? surv : classic;
const seeds = Array.from({ length: N }, (_, i) => "pd-" + i);
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const q = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(p * (b.length - 1))]; };
const save = Object.assign({}, G.CFG);
const go = (cfg) => { Object.assign(G.CFG, save, cfg); return seeds.map(runOne); };
const a = go(A), b = go(B);
Object.assign(G.CFG, save);
const d = b.map((x, i) => x.x - a[i].x), m = mean(d), sd = Math.sqrt(mean(d.map((x) => (x - m) * (x - m))));
const lbl = MODE === "surv" ? "σκορ" : "τελικό ante";
const line = (tag, v) => console.log(tag + " μέσο " + lbl + " " + mean(v.map((x) => x.x)).toFixed(MODE === "surv" ? 0 : 2) +
  " · p50 " + q(v.map((x) => x.x), .5) + (MODE === "surv" ? " · χέρια " + mean(v.map((x) => x.c)).toFixed(1) : " · νίκες " + v.filter((x) => x.won).length + " · charms p50 " + q(v.map((x) => x.c), .5) + " · 0 charms " + (100 * v.filter((x) => x.c === 0).length / N).toFixed(0) + "%"));
console.log(N + " ζευγαρωμένα runs" + (GRANT ? " · χαρισμένο charm: " + GRANT : "") + " · mode " + MODE);
line("A " + JSON.stringify(A) + "  →", a);
line("B " + JSON.stringify(B) + "  →", b);
console.log("ζευγαρωμένο Δ " + (m >= 0 ? "+" : "") + m.toFixed(2) + " ±" + (1.96 * sd / Math.sqrt(N)).toFixed(2) + " (95%)" +
  (MODE === "surv" ? "  ·  λόγος διαμέσων ×" + (q(b.map((x) => x.x), .5) / q(a.map((x) => x.x), .5)).toFixed(2) : ""));
