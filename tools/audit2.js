/* audit2.js — σαν το audit.js αλλά χωρίς τα δύο confounds του:
   1) το audit χαρίζει charm ΚΑΙ +1 θέση (S.charmSlots += 1) → μετρά charm + θέση μαζί
   2) τα perks δίνονται 2 φορές, τα charms 1 → οι δύο στήλες δεν συγκρίνονται
   Εδώ: charm χωρίς extra slot, perk ×1, και η καθαρή αξία μιας θέσης μόνη της.
   node tools/audit2.js [N] [charms|perks|slots|all] */
const G = require("../site/raise/game.js");
const N = +process.argv[2] || 400, WHAT = process.argv[3] || "all";
const ALL = G.CHARMS.map((c) => c.id);
const PRIO = (process.env.PRIO || "patient,court,kingmaker,mirror,climber,encore,loyal,lowroad,sleight,wind,ember,scout,leap,summiteer,cheap,goldsmith,ladder,afterburner,wi,pl,th,m2,cs,m1,gt,di").split(",");
const pts = (S, o) => G.scoreOf(S, o.k, o.idx.map((i) => S.hand[i])).pts;
function discardStep(S) {
  let o = G.orphans(S);
  if (!o.length) o = S.hand.map((_, i) => i).filter((i) => !S.hand[i].h && S.hand[i].r !== 14 && !G.isWild(S.hand[i])).slice(0, 2);
  if (!o.length) return false;
  S.sel = o.slice(0, Math.min(3, o.length)); return G.discard(S);
}
function playRound(S) {
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
    S.sel = m.idx.slice();
    if (G.play(S).cleared) break;
  }
  if (S.phase === "round") G.finish(S);
}
function shop(S) {
  while (G.picksLeft(S) > 0) {
    const list = S.offers.map((o, i) => ({ o, i })).filter((x) => !x.o.bought && G.canTake(S, x.i).ok);
    if (!list.length) break;
    G.take(S, list.slice().sort((a, b) => PRIO.indexOf(a.o.id) - PRIO.indexOf(b.o.id))[0].i);
  }
  G.nextAnte(S);
}
function run(seed, grant) {
  const S = G.newRun(seed, ALL);
  if (grant) {
    if (grant.charm) S.charms.push(grant.charm);
    if (grant.slots) S.charmSlots += grant.slots;
    if (grant.perk) for (let i = 0; i < (grant.n || 1); i++) G.applyFree(S, grant.perk);
    G.startRound(S);
  }
  for (;;) {
    playRound(S);
    if (S.phase === "lost") return S.ante + 1;
    if (S.phase === "won") return G.TARGETS.length + 1;
    shop(S);
  }
}
const seeds = Array.from({ length: N }, (_, i) => "au-" + i);
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const base = seeds.map((s) => run(s, null));
const bm = mean(base);
console.log("baseline · " + N + " runs · mean death ante " + bm.toFixed(2));
function table(title, rows) {
  console.log("\n" + title);
  console.log("item".padEnd(16) + "mean".padStart(7) + "Δ".padStart(8) + "±SE".padStart(7));
  rows.sort((a, b) => b.d - a.d).forEach((r) => console.log(r.id.padEnd(16) + r.m.toFixed(2).padStart(7) + (r.d >= 0 ? "+" : "") + r.d.toFixed(2).padStart(7) + r.se.toFixed(2).padStart(7)));
}
const paired = (id, grant) => {
  const v = seeds.map((s) => run(s, grant));
  const d = v.map((x, i) => x - base[i]), m = mean(d);
  const sd = Math.sqrt(mean(d.map((x) => (x - m) * (x - m))));
  return { id, m: mean(v), d: m, se: sd / Math.sqrt(N) };
};
if (WHAT === "slots" || WHAT === "all") table("SLOTS ONLY (no charm given)", [paired("+1 slot", { slots: 1 }), paired("+2 slots", { slots: 2 })]);
if (WHAT === "charms" || WHAT === "all") table("CHARMS · one free charm, NO extra slot", G.CHARMS.map((c) => paired(c.id, { charm: c.id })));
if (WHAT === "perks" || WHAT === "all") table("PERKS · ONE copy", G.POOL.map((o) => paired(o.id, { perk: o.id, n: 1 })));
if (WHAT === "stack" || WHAT === "all") table("STACKS", [paired("th x5", { perk: "th", n: 5 }), paired("wi x2", { perk: "wi", n: 2 }), paired("cs x3", { perk: "cs", n: 3 }), paired("m1 x5", { perk: "m1", n: 5 }), paired("m2 x5", { perk: "m2", n: 5 }), paired("di x2", { perk: "di", n: 2 })]);
