/* degen.js — ψάχνει εκφυλισμένα builds: ένα σετ charms/perks χαρισμένο από την αρχή,
   παιγμένο με τη δική του πολιτική, ενάντια στον builder με τα ίδια δώρα.
   node tools/degen.js [N] */
const G = require("../site/raise/game.js");
const N = +process.argv[2] || 400;
const ALL = G.CHARMS.map((c) => c.id);
const PRIO = (process.env.PRIO || "patient,court,kingmaker,mirror,climber,encore,loyal,lowroad,sleight,wind,ember,scout,leap,summiteer,cheap,goldsmith,ladder,afterburner,wi,pl,th,m2,cs,m1,gt,di").split(",");
const pts = (S, o) => G.scoreOf(S, o.k, o.idx.map((i) => S.hand[i])).pts;
const costKey = (k) => G.KINDS[k.kind].tier * 10000 + k.size * 100 + k.rank;
function discardStep(S) {
  let o = G.orphans(S);
  if (!o.length) o = S.hand.map((_, i) => i).filter((i) => !S.hand[i].h && S.hand[i].r !== 14 && !G.isWild(S.hand[i])).slice(0, 2);
  if (!o.length) return false;
  S.sel = o.slice(0, Math.min(3, o.length)); return G.discard(S);
}
/* pol: builder = μεγαλύτερο σχήμα που ανεβαίνει (η βάση της βαθμονόμησης)
        hoard   = ποτέ discard, το φθηνότερο που ανεβαίνει (κρατά το Patient γεμάτο)
        hoardbig= ποτέ discard, το μεγαλύτερο που ανεβαίνει */
function playRound(S, pol) {
  const T = G.target(S);
  for (let g2 = 0; g2 < 300 && S.phase === "round"; g2++) {
    if (S.playsLeft < 1) break;
    const all = G.candidates(S);
    if (!all.length) { if (G.canDiscardAny(S) && discardStep(S)) continue; break; }
    const up = all.filter((o) => G.climbs(S, o.k)), pool = up.length ? up : all;
    let m;
    if (pol === "hoard") {
      const need = Math.max(0, T - S.score), share = need / Math.max(1, S.playsLeft);
      const ok = pool.filter((o) => pts(S, o) >= share);
      m = (ok.length ? ok : pool).reduce((b, o) => (!b || (ok.length ? costKey(o.k) < costKey(b.k) : pts(S, o) > pts(S, b)) ? o : b), null);
    } else m = pool.reduce((b, o) => (!b || pts(S, o) > pts(S, b) ? o : b), null);
    if (!m) break;
    if (pol === "builder") {
      const need = Math.max(0, T - S.score), share = need / Math.max(1, S.playsLeft);
      if (S.playsLeft > 1 && pts(S, m) < 0.55 * share && G.canDiscardAny(S) && discardStep(S)) continue;
    }
    S.sel = m.idx.slice();
    if (G.play(S).cleared) break;
  }
  if (S.phase === "round") G.finish(S);
}
function run(seed, build, pol) {
  const S = G.newRun(seed, ALL);
  if (build) {
    (build.charms || []).forEach((c) => S.charms.push(c));
    S.charmSlots = Math.max(S.charmSlots, S.charms.length);
    (build.perks || []).forEach((p) => G.applyFree(S, p));
    G.startRound(S);
  }
  for (;;) {
    playRound(S, pol);
    if (S.phase === "lost") return S.ante + 1;
    if (S.phase === "won") return G.TARGETS.length + 1;
    while (G.picksLeft(S) > 0) {
      const list = S.offers.map((o, i) => ({ o, i })).filter((x) => !x.o.bought && G.canTake(S, x.i).ok);
      if (!list.length) break;
      G.take(S, list.slice().sort((a, b) => PRIO.indexOf(a.o.id) - PRIO.indexOf(b.o.id))[0].i);
    }
    G.nextAnte(S);
  }
}
const seeds = Array.from({ length: N }, (_, i) => "dg-" + i);
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const BUILDS = [
  ["none", null],
  ["patient", { charms: ["patient"] }],
  ["patient+sleight", { charms: ["patient", "sleight"] }],
  ["patient+sleight+lowroad", { charms: ["patient", "sleight", "lowroad"] }],
  ["patient+sleight+lowroad+climber", { charms: ["patient", "sleight", "lowroad", "climber"] }],
  ["court+kingmaker", { charms: ["court", "kingmaker"] }],
];
console.log("N " + N + " · mean death ante (ceiling 51) · wins in brackets");
console.log("build".padEnd(34) + "builder".padStart(16) + "hoard".padStart(16) + "hoardbig".padStart(16));
BUILDS.forEach(([nm, b]) => {
  const cell = (pol) => { const v = seeds.map((s) => run(s, b, pol)); return mean(v).toFixed(2) + " [" + v.filter((x) => x > G.TARGETS.length).length + "]"; };
  console.log(nm.padEnd(34) + cell("builder").padStart(16) + cell("hoard").padStart(16) + cell("hoardbig").padStart(16));
});
