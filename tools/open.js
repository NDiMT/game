/* open.js — ΤΟ ΑΝΟΙΓΜΑ: «κανένα ανέβασμα» χωρισμένο από «κακή μοιρασιά».

   Το tools/decide.js δείχνει 32% «breath» (τίποτα δεν ανεβαίνει) στα antes 1-5, αλλά τα
   βάζει όλα σε έναν κουβά. Δύο τελείως διαφορετικά πράγματα κρύβονται μέσα:

     ΝΕΚΡΟ ΧΕΡΙ   — δεν υπάρχει ΚΑΝΕΝΑΣ συνδυασμός στο χέρι (candidates 0). Αυτό είναι η
                    μοιρασιά, και το πληρώνει το discard.
     ΚΛΕΙΣΤΗ ΣΚΑΛΑ — υπάρχουν χέρια, αλλά κανένα δεν χτυπά το rung. Αυτό ΔΕΝ είναι μοιρασιά:
                    το έφτιαξε το προηγούμενο παίξιμό σου.

   Και τα δύο ανά ΠΑΙΞΙΜΟ μέσα στον γύρο, γιατί στο 1ο παίξιμο το rung είναι κενό — άρα
   εκεί «δεν ανεβαίνει τίποτα» μπορεί να σημαίνει ΜΟΝΟ νεκρό χέρι.

   node tools/open.js [runs] [maxAnte]
*/
const G = require("../site/raise/game.js");
const RUNS = +process.argv[2] || 150, MAXA = +process.argv[3] || 50;
const ALL = G.CHARMS.map((c) => c.id);
const PRIO = (process.env.PRIO || "patient,court,kingmaker,mirror,climber,encore,loyal,lowroad,sleight,wind,ember,scout,leap,summiteer,cheap,goldsmith,ladder,afterburner,wi,pl,th,m2,cs,m1,gt,di").split(",");
if (process.env.CFG) Object.assign(G.CFG, JSON.parse(process.env.CFG));

const pct = (a, b) => (100 * a / Math.max(1, b)).toFixed(1) + "%";
const q = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(p * (b.length - 1))] : NaN; };
const f2 = (x) => (isFinite(x) ? x.toFixed(2) : "-");

/* ανά (bucket antes) × (index παιξίματος) */
const B = {};
function bucket(ab, pi) { const k = ab + "|" + pi; return (B[k] = B[k] || { n: 0, dead: 0, blocked: 0, cands: 0, ups: 0 }); }
/* το ΜΟΙΡΑΣΜΕΝΟ χέρι στην αρχή του γύρου, πριν παιχτεί οτιδήποτε */
const D = {};
function deal(ab) { return (D[ab] = D[ab] || { n: 0, dead: 0, kinds: {}, best: [] }); }

function discardStep(S) {
  let o = G.orphans(S);
  if (!o.length) o = S.hand.map((_, i) => i).filter((i) => !S.hand[i].h && S.hand[i].r !== 14 && !G.isWild(S.hand[i])).slice(0, 2);
  if (!o.length) return false;
  S.sel = o.slice(0, Math.min(3, o.length)); return G.discard(S);
}
function playRound(S) {
  const ab = Math.min(9, Math.floor(S.ante / 5)) * 5;
  const T = G.target(S);
  { /* η μοιρασιά, πριν από κάθε απόφαση */
    const d = deal(ab), all = G.candidates(S);
    d.n++;
    if (!all.length) d.dead++;
    else {
      const b = all.reduce((x, o) => (!x || G.scoreOf(S, o.k, o.idx.map((i) => S.hand[i])).pts > G.scoreOf(S, x.k, x.idx.map((i) => S.hand[i])).pts ? o : x), null);
      const id = G.KINDS[b.k.kind].id; d.kinds[id] = (d.kinds[id] || 0) + 1;
      d.best.push(G.scoreOf(S, b.k, b.idx.map((i) => S.hand[i])).pts / T);
    }
  }
  let pi = 0;
  for (let guard = 0; guard < 200 && S.phase === "round"; guard++) {
    if (S.playsLeft < 1) break;
    const all = G.candidates(S), up = all.filter((o) => G.climbs(S, o.k));
    const x = bucket(ab, Math.min(5, pi));
    x.n++; x.cands += all.length; x.ups += up.length;
    if (!all.length) x.dead++; else if (!up.length) x.blocked++;
    const pool = up.length ? up : all;
    const m = pool.length ? pool.reduce((b, o) => (!b || G.scoreOf(S, o.k, o.idx.map((i) => S.hand[i])).pts > G.scoreOf(S, b.k, b.idx.map((i) => S.hand[i])).pts ? o : b), null) : null;
    if (m) {
      const need = Math.max(0, T - S.score), share = need / Math.max(1, S.playsLeft);
      if (S.playsLeft > 1 && G.scoreOf(S, m.k, m.idx.map((i) => S.hand[i])).pts < 0.55 * share && G.canDiscardAny(S) && discardStep(S)) continue;
      S.sel = m.idx.slice(); G.play(S); pi++;
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
console.log("runs " + RUNS + " · handSize " + G.CFG.handSize + "\n");
console.log("Η ΜΟΙΡΑΣΙΑ στην αρχή του γύρου");
console.log("antes".padEnd(8) + "n".padStart(7) + "νεκρό χέρι".padStart(12) + "  καλύτερο/στόχο p10/p50" + "   καλύτερο σχήμα");
Object.keys(D).map(Number).sort((a, b) => a - b).forEach((k) => {
  const d = D[k];
  console.log((k + 1 + "-" + (k + 5)).padEnd(8) + String(d.n).padStart(7) + pct(d.dead, d.n).padStart(12) +
    ("  " + f2(q(d.best, .1)) + " / " + f2(q(d.best, .5))).padStart(24) + "   " +
    Object.entries(d.kinds).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([x, v]) => x + " " + pct(v, d.n)).join(" · "));
});
console.log("\nΑΝΑ ΠΑΙΞΙΜΟ ΜΕΣΑ ΣΤΟΝ ΓΥΡΟ — «τίποτα δεν ανεβαίνει» χωρισμένο στα δύο");
console.log("antes".padEnd(8) + "play".padStart(5) + "n".padStart(7) + "νεκρό".padStart(8) + "κλειστή σκάλα".padStart(15) + "σύνολο".padStart(9) + "χέρια".padStart(8) + "ανεβ.".padStart(8));
Object.keys(B).sort((a, b) => { const [x1, y1] = a.split("|").map(Number), [x2, y2] = b.split("|").map(Number); return x1 - x2 || y1 - y2; }).forEach((k) => {
  const [ab, pi] = k.split("|").map(Number), x = B[k];
  if (x.n < 20 || ab > 14) return;
  console.log((ab + 1 + "-" + (ab + 5)).padEnd(8) + String(pi + 1).padStart(5) + String(x.n).padStart(7) + pct(x.dead, x.n).padStart(8) +
    pct(x.blocked, x.n).padStart(15) + pct(x.dead + x.blocked, x.n).padStart(9) + (x.cands / x.n).toFixed(1).padStart(8) + (x.ups / x.n).toFixed(1).padStart(8));
});
{
  let n = 0, dead = 0, blocked = 0;
  Object.keys(B).forEach((k) => { const ab = +k.split("|")[0]; if (ab > 4) return; const x = B[k]; n += x.n; dead += x.dead; blocked += x.blocked; });
  console.log("\nantes 1-5, ΟΛΑ τα παιξίματα: τίποτα δεν ανεβαίνει " + pct(dead + blocked, n) +
    " = νεκρό χέρι " + pct(dead, n) + " + κλειστή σκάλα " + pct(blocked, n) + "  (n " + n + ")");
}
