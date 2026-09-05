/* bench.js — αξία build ΣΕ ΠΟΝΤΟΥΣ, όχι σε ante θανάτου (που έχει ταβάνι στο 51 και
   συνθλίβει κάθε σύγκριση ζεύγους). Το run τρέχει «αθάνατο» ως το ante A με τα ίδια seeds,
   και μετράμε τον διάμεσο λόγο σκορ/στόχο του γύρου εκεί, χωρίς πρόωρο τερματισμό.
   node tools/bench.js [N] [ante] */
const G = require("../site/raise/game.js");
const N = +process.argv[2] || 300, A = +process.argv[3] || 20;
const ALL = G.CHARMS.map((c) => c.id);
if (process.env.CFG) Object.assign(G.CFG, JSON.parse(process.env.CFG));
const pts = (S, o) => G.scoreOf(S, o.k, o.idx.map((i) => S.hand[i])).pts;
function discardStep(S) {
  let o = G.orphans(S);
  if (!o.length) o = S.hand.map((_, i) => i).filter((i) => !S.hand[i].h && S.hand[i].r !== 14 && !G.isWild(S.hand[i])).slice(0, 2);
  if (!o.length) return false;
  S.sel = o.slice(0, Math.min(3, o.length)); return G.discard(S);
}
/* ΧΩΡΙΣ πρόωρο σταμάτημα: παίζουμε και τα 5 plays, ώστε το σκορ να μετράει δύναμη. */
function playRound(S) {
  const T = G.target(S);
  for (let g2 = 0; g2 < 300 && S.phase === "round"; g2++) {
    if (S.playsLeft < 1) break;
    const all = G.candidates(S);
    if (!all.length) { if (G.canDiscardAny(S) && discardStep(S)) continue; break; }
    const up = all.filter((o) => G.climbs(S, o.k)), pool = up.length ? up : all;
    const m = pool.reduce((b, o) => (!b || pts(S, o) > pts(S, b) ? o : b), null);
    if (!m) break;
    const need = Math.max(0, T - S.score), share = need / Math.max(1, S.playsLeft);
    if (S.playsLeft > 1 && pts(S, m) < 0.55 * share && G.canDiscardAny(S) && discardStep(S)) continue;
    S.sel = m.idx.slice(); G.play(S);
  }
  return S.score / T;
}
function run(seed, build) {
  const S = G.newRun(seed, ALL);
  (build.charms || []).forEach((c) => S.charms.push(c));
  S.charmSlots = Math.max(S.charmSlots, S.charms.length);
  (build.perks || []).forEach((p) => G.applyFree(S, p));
  G.startRound(S);
  let r = 0;
  for (let a = 0; a < A; a++) {
    r = playRound(S);
    if (S.phase === "round") G.finish(S);
    S.phase = "shop"; S.offers = []; S.pickUp = 0; S.pickCharm = 0;
    G.nextAnte(S);
  }
  return r;
}
const seeds = Array.from({ length: N }, (_, i) => "bn-" + i);
const q = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(p * (b.length - 1))] : NaN; };
const geo = (a) => Math.exp(a.filter((x) => x > 0).reduce((x, y) => x + Math.log(y), 0) / a.filter((x) => x > 0).length);
const cache = {};
const val = (nm, b) => { if (!cache[nm]) cache[nm] = seeds.map((s) => run(s, b)); return cache[nm]; };
const base = val("-", {});
console.log("N " + N + " · ante " + A + " · χωρίς επιλογές, μόνο το χαρισμένο build · median score/target");
console.log("build".padEnd(30) + "p50".padStart(7) + "geo".padStart(7) + "×base".padStart(8));
function row(nm, b) { const v = val(nm, b); console.log(nm.padEnd(30) + q(v, .5).toFixed(2).padStart(7) + geo(v).toFixed(2).padStart(7) + (geo(v) / geo(base)).toFixed(2).padStart(8)); }
row("-", {});
const singles = ["patient", "climber", "sleight", "lowroad", "encore", "mirror", "kingmaker", "loyal", "court", "goldsmith", "ladder", "afterburner", "summiteer", "ember", "cheap", "wind", "leap", "scout"];
singles.forEach((c) => row(c, { charms: [c] }));
console.log("--- ζεύγη (σε παρένθεση η προβλεπόμενη πολλαπλασιαστική τιμή) ---");
const PAIRS = [["climber", "patient"], ["patient", "sleight"], ["encore", "mirror"], ["kingmaker", "loyal"],
  ["afterburner", "summiteer"], ["lowroad", "ladder"], ["ladder", "loyal"], ["cheap", "wind"], ["court", "goldsmith"], ["patient", "lowroad"]];
PAIRS.forEach(([a, b]) => {
  const nm = a + "+" + b;
  const v = val(nm, { charms: [a, b] });
  const pred = (geo(val(a, { charms: [a] })) / geo(base)) * (geo(val(b, { charms: [b] })) / geo(base));
  const got = geo(v) / geo(base);
  const isSyn = G.SYNERGIES.some((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
  console.log(((isSyn ? "* " : "  ") + nm).padEnd(30) + q(v, .5).toFixed(2).padStart(7) + geo(v).toFixed(2).padStart(7) + got.toFixed(2).padStart(8) + "   pred " + pred.toFixed(2) + "   Δ " + (got - pred >= 0 ? "+" : "") + (got - pred).toFixed(2));
});
