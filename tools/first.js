/* first.js — ΠΟΙΟΙ γύροι κλείνουν στο πρώτο παίξιμο.

   Ο κανόνας «κανένα χέρι δεν καθαρίζει ante μόνο του» φυλάγεται από ένα ποσοστό
   (9,66% τώρα, φρουρός 7,45%) που δεν λέει ΠΟΥ σπάει. Αυτό το εργαλείο σπάει το ποσοστό
   σε ante, σε είδος χεριού, και σε boss / κενό ante — δηλαδή δείχνει ποιον μοχλό να πιάσεις.

   node tools/first.js [runs] [maxAnte]
   Μοχλοί: BOMB= (bombMul) · CFG='{"...":...}' · TGT= (κλίμακα στόχων)
*/
const G = require("../site/raise/game.js");
const RUNS = +process.argv[2] || 150, MAXA = +process.argv[3] || 50;
const ALL = G.CHARMS.map((c) => c.id);
const PRIO = (process.env.PRIO || "patient,court,kingmaker,mirror,climber,encore,loyal,lowroad,sleight,wind,ember,scout,leap,summiteer,cheap,goldsmith,ladder,afterburner,wi,pl,th,m2,cs,m1,gt,di").split(",");
if (process.env.BOMB) G.CFG.bombMul = +process.env.BOMB;
if (process.env.CFG) Object.assign(G.CFG, JSON.parse(process.env.CFG));
if (process.env.TGT) { const s = +process.env.TGT; for (let a = 0; a < G.TARGETS.length; a++) G.TARGETS[a] = Math.round(G.TARGETS[a] * s); }

const q = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(p * (b.length - 1))] : NaN; };
const f2 = (x) => (isFinite(x) ? x.toFixed(2) : "-");

function discardStep(S) {
  let o = G.orphans(S);
  if (!o.length) o = S.hand.map((_, i) => i).filter((i) => !S.hand[i].h && S.hand[i].r !== 14 && !G.isWild(S.hand[i])).slice(0, 2);
  if (!o.length) return false;
  S.sel = o.slice(0, Math.min(3, o.length)); return G.discard(S);
}
const st = { rounds: 0, one: 0, byAnte: [], byKind: {}, kindAll: {}, boss: [0, 0], plain: [0, 0], bombOne: 0, r1: [] };
for (let a = 0; a < G.TARGETS.length + 4; a++) st.byAnte[a] = [0, 0];

function playRound(S) {
  const T = G.target(S); let cum = 0, first = null, n = 0, cleared1 = 0;
  for (let guard = 0; guard < 200 && S.phase === "round"; guard++) {
    if (S.playsLeft < 1) break;
    const all = G.candidates(S), up = all.filter((o) => G.climbs(S, o.k)), pool = up.length ? up : all;
    const m = pool.length ? pool.reduce((b, o) => (!b || G.scoreOf(S, o.k, o.idx.map((i) => S.hand[i])).pts > G.scoreOf(S, b.k, b.idx.map((i) => S.hand[i])).pts ? o : b), null) : null;
    if (m) {
      const need = Math.max(0, T - S.score), share = need / Math.max(1, S.playsLeft);
      if (S.playsLeft > 1 && G.scoreOf(S, m.k, m.idx.map((i) => S.hand[i])).pts < 0.55 * share && G.canDiscardAny(S) && discardStep(S)) continue;
      S.sel = m.idx.slice();
      const ev = G.play(S);
      if (ev && ev.k) {
        n++; cum += ev.pts;
        if (n === 1) { first = { id: G.KINDS[ev.k.kind].id, pts: ev.pts, bomb: !!ev.bomb, ratio: ev.pts / T }; if (cum >= T) cleared1 = 1; }
      }
      continue;
    }
    if (G.canDiscardAny(S) && discardStep(S)) continue;
    break;
  }
  if (!first) return;
  const a = S.ante;
  st.rounds++; st.one += cleared1;
  st.byAnte[a][0]++; st.byAnte[a][1] += cleared1;
  (st.kindAll[first.id] = st.kindAll[first.id] || 0), st.kindAll[first.id]++;
  st.byKind[first.id] = (st.byKind[first.id] || 0) + cleared1;
  if (S.chal) { st.boss[0]++; st.boss[1] += cleared1; } else { st.plain[0]++; st.plain[1] += cleared1; }
  if (cleared1 && first.bomb) st.bombOne++;
  st.r1.push(first.ratio);
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
const pct = (a, b) => (100 * a / Math.max(1, b)).toFixed(2) + "%";
/* Τυπικό σφάλμα διωνυμικού ποσοστού — ο φρουρός είναι μερικές δέκατες, άρα μετράει. */
const se = (a, b) => { const p = a / Math.max(1, b); return (100 * Math.sqrt(p * (1 - p) / Math.max(1, b))).toFixed(2); };
console.log("runs " + RUNS + " · bombMul " + G.CFG.bombMul + " · rounds " + st.rounds);
console.log("ΣΤΟΧΟΣ ΣΤΟ 1ο ΠΑΙΞΙΜΟ: " + st.one + "/" + st.rounds + " = " + pct(st.one, st.rounds) + " ±" + se(st.one, st.rounds) + " (φρουρός 7.45%)");
console.log("  boss antes " + pct(st.boss[1], st.boss[0]) + " (" + st.boss[0] + ") · κενά antes " + pct(st.plain[1], st.plain[0]) + " (" + st.plain[0] + ")");
console.log("  από αυτά με βόμβα: " + st.bombOne + "/" + st.one + " = " + pct(st.bombOne, st.one));
console.log("  1ο παίξιμο / στόχος: p50 " + f2(q(st.r1, .5)) + " p90 " + f2(q(st.r1, .9)) + " p99 " + f2(q(st.r1, .99)));
console.log("ανά είδος 1ου χεριού (καθάρισε / παίχτηκε):");
console.log("  " + Object.keys(st.kindAll).sort((a, b) => (st.byKind[b] || 0) / st.kindAll[b] - (st.byKind[a] || 0) / st.kindAll[a])
  .map((k) => k + " " + pct(st.byKind[k] || 0, st.kindAll[k]) + " (" + (st.byKind[k] || 0) + "/" + st.kindAll[k] + ")").join(" · "));
let l = "ανά ante: ";
for (let a = 0; a < MAXA; a++) if (st.byAnte[a][0] >= 8) l += (a + 1) + ":" + Math.round(100 * st.byAnte[a][1] / st.byAnte[a][0]) + " ";
console.log(l);
