/* rounds.js — ΤΟ ΣΧΗΜΑ ΤΟΥ ΓΥΡΟΥ, όχι μόνο ο ρυθμός θανάτου.

   Το tune.js απαντά «πόσο συχνά πεθαίνει ο παίκτης». Αυτό απαντά «πόσα από τα παιξίματα
   του γύρου παίζονται πραγματικά» — δηλαδή αν ο γύρος είναι πέντε αποφάσεις ή τρεις με
   δύο νεκρές. Ίδιο bot, ίδια seeds (`st-N`) και ίδια πολιτική με το tune.js, ώστε τα
   νούμερα να συγκρίνονται απευθείας.

   Ο γύρος παίζεται ΜΕΧΡΙ ΤΕΛΟΥΣ (και μετά τον στόχο), αλλιώς δεν φαίνεται πόσο περισσεύει.
   Το `clear@play` είναι το παίξιμο στο οποίο το ΑΘΡΟΙΣΤΙΚΟ σκορ περνά τον στόχο.

   node tools/rounds.js [runs] [maxAnte] ['[["name",{cfg},tgtScale], ...]']
   Μοχλοί ανά κελί: οτιδήποτε του CFG, συν `tgt` (κλίμακα σε όλους τους στόχους)
   και `targets` (πίνακας στη θέση του TARGETS).

   Παράδειγμα:
     node tools/rounds.js 150 50 '[["base",{},1],["4 plays",{"plays":4},0.8]]'
*/
const G = require("../site/raise/game.js");
const RUNS = +process.argv[2] || 150, MAXA = +process.argv[3] || 50;
const ALL = G.CHARMS.map((c) => c.id);
const PRIO = (process.env.PRIO || "patient,court,kingmaker,mirror,climber,encore,loyal,lowroad,sleight,wind,ember,scout,leap,summiteer,cheap,goldsmith,ladder,afterburner,wi,pl,th,m2,cs,m1,gt,di").split(",");

const q = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(p * (b.length - 1))] : NaN; };
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) * (x - m)))); };
const f1 = (x) => (isFinite(x) ? x.toFixed(1) : "-");
const f2 = (x) => (isFinite(x) ? x.toFixed(2) : "-");

const BASE_CFG = JSON.parse(JSON.stringify(G.CFG));
const BASE_TGT = G.TARGETS.slice();
const KIND_KEYS = G.KINDS.filter(Boolean).map((k) => k.id);
const BASE_KINDS = {}; G.KINDS.filter(Boolean).forEach((k) => { BASE_KINDS[k.id] = { chips: k.chips, mult: k.mult, cstep: k.cstep }; });

function discardStep(S) {
  let o = G.orphans(S);
  if (!o.length) o = S.hand.map((_, i) => i).filter((i) => !S.hand[i].h && S.hand[i].r !== 14 && !G.isWild(S.hand[i])).slice(0, 2);
  if (!o.length) return false;
  S.sel = o.slice(0, Math.min(3, o.length)); return G.discard(S);
}
/* Πολιτικές. Το bot του tune.js είναι ΜΥΩΠΙΚΟ: διαλέγει το μεγαλύτερο σχήμα που ανεβαίνει
   ΤΩΡΑ, άρα δεν μπορεί ποτέ να «χτίσει αλυσίδα και να την εξαργυρώσει». Χωρίς δεύτερη
   πολιτική, κάθε μέτρηση για την αξία της αλυσίδας μετρά μόνο τον μύωπα.
     builder = το μεγαλύτερο ανέβασμα (η βάση, ίδια με tune.js)
     ramp    = το ΦΘΗΝΟΤΕΡΟ ανέβασμα ώσπου να μείνει ένα play, μετά το μεγαλύτερο χέρι
     finish  = builder, αλλά στο τελευταίο play το μεγαλύτερο χέρι ανεξαρτήτως ανεβάσματος */
const POL = process.env.POL || "builder";
const cost = (k) => G.KINDS[k.kind].tier * 1e6 + k.size * 1e3 + k.rank;
function playRound(S, st) {
  const T = G.target(S); let cum = 0, cross = 0, n = 0;
  const per = [];
  for (let guard = 0; guard < 200 && S.phase === "round"; guard++) {
    if (S.playsLeft < 1) break;
    const all = G.candidates(S), up = all.filter((o) => G.climbs(S, o.k)), pool = up.length ? up : all;
    const best = (list) => (list.length ? list.reduce((b, o) => (!b || G.scoreOf(S, o.k, o.idx.map((i) => S.hand[i])).pts > G.scoreOf(S, b.k, b.idx.map((i) => S.hand[i])).pts ? o : b), null) : null);
    let m = pool.length ? best(pool) : null;
    if (POL === "ramp" && S.playsLeft > 1 && up.length) m = up.reduce((b, o) => (cost(o.k) < (b ? cost(b.k) : Infinity) ? o : b), null);
    if ((POL === "ramp" || POL === "finish") && S.playsLeft < 2 && all.length) m = best(all);
    if (m) {
      const need = Math.max(0, T - S.score), share = need / Math.max(1, S.playsLeft);
      if (S.playsLeft > 1 && G.scoreOf(S, m.k, m.idx.map((i) => S.hand[i])).pts < 0.55 * share && G.canDiscardAny(S) && discardStep(S)) continue;
      S.sel = m.idx.slice();
      const ev = G.play(S);
      if (ev && ev.k) { n++; cum += ev.pts; per.push(ev.pts); if (!cross && cum >= T) cross = n; }
      continue;
    }
    if (G.canDiscardAny(S) && discardStep(S)) continue;
    break;
  }
  st.plays.push(n);
  st.ratio.push(S.score / T);
  st.cross.push(cross || 99);
  st.cleared.push(cross ? 1 : 0);
  st.maxPlay.push(S.score > 0 ? Math.max.apply(null, per) / T : 0);
  /* Πόσο πληρώνει το κάθε παίξιμο ως μερίδιο του ΓΥΡΟΥ: δείχνει πόσο πίσω κάθεται το βάρος. */
  if (S.score > 0) per.forEach((p, i) => { (st.byIdx[i] = st.byIdx[i] || []).push(p / S.score); });
  st.obs.push({ run: S.seed, a: S.ante, s: S.score });
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
/* Η κλίμακα στόχων μπορεί να είναι αριθμός (όλα τα antes) ή {all, plain, boss}: οι δύο
   σειρές — boss antes και κενά antes — έχουν χωριστό επίπεδο εξ αρχής (chalTargetMul), και
   η μέτρηση δείχνει ότι σπάνε αλλιώς, οπότε πρέπει να μπορούν να κινηθούν χωριστά. */
function cell(name, cfg, tgt) {
  Object.assign(G.CFG, JSON.parse(JSON.stringify(BASE_CFG)));
  G.TARGETS.splice(0, G.TARGETS.length, ...((cfg && cfg.targets) || BASE_TGT));
  /* Η σκάλα πληρωμών ξαναγράφεται ανά κελί: {"kinds":{"full":[42,6],"quads":[50,7,0]}} */
  KIND_KEYS.forEach((id) => Object.assign(G.KINDS.find((k) => k && k.id === id), BASE_KINDS[id]));
  Object.keys((cfg && cfg.kinds) || {}).forEach((id) => { const [c, m, cs] = cfg.kinds[id]; const o = { chips: c, mult: m }; if (cs != null) o.cstep = cs; Object.assign(G.KINDS.find((k) => k && k.id === id), o); });
  Object.keys(cfg || {}).forEach((k) => { if (k !== "targets" && k !== "kinds") G.CFG[k] = cfg[k]; });
  const sc = typeof tgt === "object" && tgt ? tgt : { all: tgt || 1 };
  const L = G.TARGETS.length;
  for (let a = 0; a < L; a++) {
    const boss = G.isReward(a) || a === L - 1;
    const m = (sc.all || 1) * (boss ? (sc.boss || 1) : (sc.plain || 1));
    if (m !== 1) G.TARGETS[a] = Math.round(G.TARGETS[a] * m);
  }
  const st = { plays: [], ratio: [], cross: [], cleared: [], maxPlay: [], byIdx: [], obs: [], lost: 0, wins: 0, deaths: [] };
  for (let s = 0; s < RUNS; s++) {
    const S = G.newRun("st-" + s, ALL);
    for (;;) {
      playRound(S, st);
      if (S.phase === "lost") { st.lost++; st.deaths.push(S.ante + 1); break; }
      if (S.phase === "won") { st.wins++; break; }
      if (S.ante >= MAXA - 1) break;
      shop(S);
    }
  }
  const cr = st.cross.filter((x) => x < 99);
  const P = G.CFG.plays;
  /* «Χρησιμοποιήθηκε όλος ο γύρος»: ο στόχος έπεσε στο τελευταίο ή προτελευταίο παίξιμο. */
  const late = cr.filter((x) => x >= P - 1).length / Math.max(1, cr.length);
  const one = st.cross.filter((x) => x === 1).length / st.cross.length;
  /* διασπορά: between-run vs within-run, στα ίδια bucket με το tune.js */
  const med = {}; st.obs.forEach((o) => { (med[o.a] = med[o.a] || []).push(o.s); });
  const O = st.obs.filter((o) => o.s > 0 && med[o.a].length >= 8).map((o) => ({ run: o.run, r: Math.log(o.s / q(med[o.a], .5)) }));
  const byRun = {}; O.forEach((o) => { (byRun[o.run] = byRun[o.run] || []).push(o.r); });
  const runEff = Object.keys(byRun).filter((k) => byRun[k].length >= 3).map((k) => mean(byRun[k]));
  const resid = []; Object.keys(byRun).forEach((k) => { if (byRun[k].length < 3) return; const m = mean(byRun[k]); byRun[k].forEach((x) => resid.push(x - m)); });
  return {
    name, death: mean(st.deaths), wins: st.wins, one: 100 * one,
    crossP50: q(cr, .5), crossMean: mean(cr), crossP90: q(cr, .9), late: 100 * late,
    ratio: mean(st.ratio), plays: mean(st.plays), maxPlay: q(st.maxPlay, .5),
    sdTot: sd(O.map((o) => o.r)), sdRun: sd(runEff), sdIn: sd(resid),
    byIdx: st.byIdx.map((a) => mean(a)),
  };
}
const cases = process.argv[4] ? JSON.parse(process.argv[4]) : [["base", {}, 1]];
console.log("runs " + RUNS + " · antes 1-" + MAXA + " · policy " + POL + " · ο γύρος παίζεται ΜΕΧΡΙ ΤΕΛΟΥΣ");
console.log("cell                   death  wins   1st%  clear@play p50/mean/p90  late%  plays  round/T  maxPlay/T  sd(ln) tot/run/in");
for (const c of cases) {
  const r = cell(c[0], c[1] || {}, c[2] == null ? 1 : c[2]);
  console.log(r.name.padEnd(22) + f1(r.death).padStart(6) + String(r.wins).padStart(6) + f2(r.one).padStart(7) +
    (f1(r.crossP50) + " / " + f2(r.crossMean) + " / " + f1(r.crossP90)).padStart(24) + f1(r.late).padStart(7) +
    f2(r.plays).padStart(7) + f2(r.ratio).padStart(9) + f2(r.maxPlay).padStart(11) +
    ("  " + f2(r.sdTot) + " / " + f2(r.sdRun) + " / " + f2(r.sdIn)).padStart(20) +
    "   share/play " + r.byIdx.map((x) => f2(x)).join(" "));
}
