/* Γρήγορος πάγκος βαθμονόμησης: τρέχει το bot μέχρι ένα ante και δείχνει τα τρία νούμερα
   που ορίζουν τον γύρο — διάμεσος / στόχος, p10 / στόχος, και σε ποιο play καθαρίζει.

   node tools/tune.js [runs] [maxAnte] [variant]

   Το `variant` είναι ένα κλειδί από το VARIANTS: αλλάζει CFG / KINDS / TARGETS πριν τρέξει,
   ώστε να συγκρίνονται ρυθμίσεις χωρίς να ξαναγράφεται το game.js. */
const G = require("../site/raise/game.js");
const RUNS = +process.argv[2] || 60, MAXA = +process.argv[3] || 12, VAR = process.argv[4] || "current";
const ALL = G.CHARMS.map((c) => c.id);
/* Σειρά επιλογής. Η παλιά ήταν μετρημένα κακή: το m1 έχει maxBuy 20, οπότε ρουφούσε κάθε
   μεταγενέστερη επιλογή και το bot δεν έπαιρνε ΠΟΤΕ Wide Hand ή Cull· και έλειπαν τα leap/scout,
   που φιλτράρονταν έξω από το `pr >= 0`. Μετρημένο (tools/prio.js 800, ίδια seeds, ίδια πολιτική
   παιξίματος): μέσο ante θανάτου 19,23 → 32,01 και νίκες 9/800 → 267/800 μόνο από τη σειρά.
   Βαθμονόμηση πάνω στην παλιά σειρά σήμαινε βαθμονόμηση πάνω σε παίκτη που ψωνίζει λάθος. */
const PRIO = (process.env.PRIO || "patient,court,kingmaker,mirror,climber,encore,loyal,lowroad,sleight,wind,ember,scout,leap,summiteer,cheap,goldsmith,ladder,afterburner,wi,pl,th,m2,cs,m1,gt,di").split(",");

const kind = (id) => G.KINDS.find((k) => k && k.id === id);
const setK = (id, o) => Object.assign(kind(id), o);

const VARIANTS = {
  current: () => {},
  /* Α: μόνο οι οροφές — δένουν Climber/Tempo, Gold/Glass και το στοίβαγμα των charms. */
  caps: () => { G.CFG.chainAddCap = 7; G.CFG.enhCap = 4; G.CFG.hmCap = 4; },
  /* Β: οροφές + πάτωμα αλυσίδας (το πρώτο ανέβασμα μετράει ήδη ένα σκαλί) + χαμηλότερη οροφή θέσης */
  floor: () => { VARIANTS.caps(); G.CFG.chainFloor = 1; G.CFG.chainCap = 6; G.CFG.chainAddCap = 6; },
  /* Γ: + συμπιεσμένη σκάλα σχημάτων */
  ladder: () => {
    VARIANTS.floor();
    setK("straight", { mult: 3 }); setK("full", { chips: 60, mult: 3 });
    setK("quads", { chips: 70, mult: 4 }); setK("sflush", { chips: 80, mult: 4, cstep: 20 });
  },
  /* Δ: όπως το Γ αλλά με πιο ήπια συμπίεση σχημάτων */
  ladder2: () => {
    VARIANTS.floor();
    setK("full", { chips: 62, mult: 4 }); setK("quads", { chips: 70, mult: 4 }); setK("sflush", { chips: 85, mult: 5, cstep: 22 });
  },
};
/* Σκάλες σχημάτων προς δοκιμή: [chips, mult, cstep] ανά είδος. */
const LADDERS = {
  L0: null,
  /* ήπια: κόβει μόνο την κορυφή */
  L1: { straight: [55, 3, 15], full: [62, 4, 0], quads: [70, 4, 0], sflush: [85, 5, 22] },
  /* μεσαία: μαζεύει και τη μέση */
  L2: { pairs: [40, 2, 13], trips: [44, 3, 0], stairs: [48, 3, 17], straight: [50, 3, 13], full: [56, 3, 0], quads: [64, 4, 0], sflush: [74, 4, 18] },
  /* σφιχτή */
  L3: { pairs: [38, 2, 11], trips: [42, 3, 0], stairs: [44, 3, 15], straight: [46, 3, 11], full: [50, 3, 0], quads: [58, 4, 0], sflush: [66, 4, 16] },
  /* L4/L5: τα chips του σχήματος σχεδόν επίπεδα — η διαφορά μένει στο Mult και στα φύλλα */
  L4: { pairs: [33, 2, 8], trips: [34, 3, 0], stairs: [36, 3, 10], straight: [37, 4, 8], full: [40, 4, 0], quads: [44, 5, 0], sflush: [50, 6, 12] },
  L5: { pairs: [32, 2, 6], trips: [32, 3, 0], stairs: [33, 3, 7], straight: [34, 3, 6], full: [35, 4, 0], quads: [38, 4, 0], sflush: [42, 5, 8] },
  /* F*: πλήρεις υποψήφιες σκάλες — το σταθερό Mult είναι ήδη μέσα στους αριθμούς */
  F1: { pair: [30, 4, 0], pairs: [36, 4, 10], trips: [38, 5, 0], stairs: [40, 5, 12], straight: [42, 6, 10], full: [46, 6, 0], quads: [52, 7, 0], sflush: [60, 8, 15] },
  F2: { pair: [30, 3, 0], pairs: [38, 3, 12], trips: [42, 4, 0], stairs: [45, 4, 14], straight: [48, 5, 12], full: [54, 5, 0], quads: [62, 6, 0], sflush: [72, 7, 18] },
  F3: { pair: [30, 5, 0], pairs: [34, 5, 9], trips: [36, 6, 0], stairs: [38, 6, 10], straight: [39, 7, 9], full: [42, 7, 0], quads: [46, 8, 0], sflush: [52, 9, 12] },
};
function applyLadder(name) {
  const L = LADDERS[name]; if (!L) return;
  Object.keys(L).forEach((id) => { const [c, m, cs] = L[id]; const o = { chips: c, mult: m }; if (cs) o.cstep = cs; setK(id, o); });
}
if (process.env.TUNE) {
  const cfg = JSON.parse(process.env.TUNE);
  Object.keys(cfg).forEach((k) => { if (k === "ladder") applyLadder(cfg[k]); else G.CFG[k] = cfg[k]; });
}
if (!VARIANTS[VAR]) { console.error("unknown variant " + VAR + " — one of " + Object.keys(VARIANTS).join(", ")); process.exit(1); }
VARIANTS[VAR]();

const q = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(p * (b.length - 1))] : NaN; };
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const f1 = (x) => (isFinite(x) ? x.toFixed(1) : "-");
const f2 = (x) => (isFinite(x) ? x.toFixed(2) : "-");

let st;
function reset() { st = { score: [], ratio: [], cross: [], big: [], plays: [], lost: new Array(G.TARGETS.length + 4).fill(0), maxChain: [], wins: 0, obs: [] }; for (let a = 0; a < G.TARGETS.length + 4; a++) { st.score[a] = []; st.ratio[a] = []; st.cross[a] = []; st.big[a] = []; } }
reset();

function discardStep(S) {
  let o = G.orphans(S);
  if (!o.length) o = S.hand.map((_, i) => i).filter((i) => !S.hand[i].h && S.hand[i].r !== 14 && !G.isWild(S.hand[i])).slice(0, 2);
  if (!o.length) return false;
  S.sel = o.slice(0, Math.min(3, o.length)); return G.discard(S);
}
function playRound(S) {
  const T = G.target(S); let cum = 0, cross = 0, n = 0, big = 0;
  for (let guard = 0; guard < 200 && S.phase === "round"; guard++) {
    if (S.playsLeft < 1) break;
    /* Βαθμονόμηση πάνω στο ΣΩΣΤΟ παίξιμο: το μεγαλύτερο σχήμα που ανεβαίνει, όχι το φθηνότερο.
       Μετρημένο: αυτή η πολιτική κάνει 35 νίκες/60 εκεί που το σπαμ ζευγαριών κάνει 0. */
    let m = G.suggest(S);
    { const all = G.candidates(S), up = all.filter((o) => G.climbs(S, o.k)), pool = up.length ? up : all;
      if (pool.length) m = pool.reduce((b, o) => (!b || G.scoreOf(S, o.k, o.idx.map((i) => S.hand[i])).pts > G.scoreOf(S, b.k, b.idx.map((i) => S.hand[i])).pts ? o : b), null); }
    if (m) {
      const need = Math.max(0, T - S.score), share = need / Math.max(1, S.playsLeft);
      if (S.playsLeft > 1 && G.scoreOf(S, m.k, m.idx.map((i) => S.hand[i])).pts < 0.55 * share && G.canDiscardAny(S) && discardStep(S)) continue;
      S.sel = m.idx.slice();
      const ev = G.play(S);
      if (ev && ev.k) { n++; cum += ev.pts; if (ev.pts > big) big = ev.pts; if (!cross && cum >= T) cross = n; }
      continue;
    }
    if (G.canDiscardAny(S) && discardStep(S)) continue;
    break;
  }
  const a = S.ante;
  st.score[a].push(S.score); st.ratio[a].push(S.score / T); st.cross[a].push(cross || 99); st.big[a].push(big / T); st.plays.push(n);
  st.obs.push({ run: S.seed, a, s: S.score, plays: S.playsMax, mult: S.mult.slice(), ch: S.charms.length });
  st.maxChain.push(S.stats.maxChain);
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
/* immortal: ο γύρος που χάθηκε συνεχίζει σαν να καθάρισε, με μία επιλογή. Έτσι η καμπύλη
   ισχύος μετριέται χωρίς survivor bias — αλλιώς στα ψηλά antes μένουν μόνο τα τυχερά runs. */
function sweepRuns(immortal) {
  reset();
  for (let s = 0; s < RUNS; s++) {
    const S = G.newRun("st-" + s, ALL);
    for (;;) {
      playRound(S);
      if (S.phase === "lost") {
        if (!immortal) { st.lost[S.ante]++; break; }
        S.phase = "shop"; S.pickUp = G.isReward(S.ante) ? 1 : 0; S.pickCharm = G.isReward(S.ante) ? 1 : 0; S.nOffers = G.CFG.offers; S.offers = G.makeOffers(S);
      }
      if (S.phase === "won") { st.wins++; break; }
      if (S.ante >= MAXA - 1) break;
      shop(S);
    }
  }
}
/* Στόχοι από τη μέτρηση: ο διάμεσος σε λόγο r(a), αλλά ποτέ πάνω από p10/0.92 στα πρώτα antes. */
function fitTargets() {
  const R1 = +(process.env.R1 || 1.8), R30 = +(process.env.R30 || 1.1);
  const r = (a) => R1 * Math.pow(R30 / R1, Math.min(1, a / (G.TARGETS.length - 1)));
  const raw = [];
  for (let a = 0; a < G.TARGETS.length; a++) {
    const A = st.score[a];
    if (A.length < 8) { raw.push(null); continue; }
    raw.push(q(A, .5) / r(a));
  }
  /* Εξομάλυνση: γεωμετρικός μέσος σε παράθυρο 5, μετά μονοτονία και στρογγύλεμα. */
  const out = [];
  for (let a = 0; a < raw.length; a++) {
    const w = [];
    for (let j = Math.max(0, a - 2); j <= Math.min(raw.length - 1, a + 2); j++) if (raw[j]) w.push(Math.log(raw[j] / Math.pow(gr, j - a)));
    out.push(w.length ? Math.exp(mean(w)) : null);
  }
  /* κενά (antes που δεν έφτασε το bot): γεωμετρική προέκταση με τον τελευταίο ρυθμό */
  let last = null, lastI = -1;
  for (let a = 0; a < out.length; a++) if (out[a]) { last = out[a]; lastI = a; }
  for (let a = 0; a < out.length; a++) if (!out[a]) out[a] = a < lastI ? null : last * Math.pow(gr, a - lastI);
  const nice = (x) => { const e = Math.pow(10, Math.floor(Math.log10(x)) - 1); return Math.round(x / e) * e; };
  const fin = out.map((x) => (x ? nice(x) : null));
  for (let a = 1; a < fin.length; a++) if (fin[a] && fin[a - 1] && fin[a] <= fin[a - 1]) fin[a] = nice(fin[a - 1] * 1.06);
  return fin;
}
const gr = 1.15;
sweepRuns();
/* Δεύτερος τρόπος: οι στόχοι βγαίνουν από τον ΡΥΘΜΟ ΘΑΝΑΤΟΥ που θέλουμε ανά ante.
   T[a] = το h(a)-ποσοστημόριο των σκορ όσων έφτασαν εκεί — άρα h(a) πεθαίνει, εξ ορισμού.
   Με h από 2% (ante 1) σε 22% (ante 30): μέσος θάνατος ~16, νίκες ~6%. */
if (process.env.HAZ) {
  const H1 = +(process.env.H1 || 0.02), H30 = +(process.env.H30 || 0.22);
  const haz = (a) => H1 * Math.pow(H30 / H1, a / (G.TARGETS.length - 1));
  const nice = (x) => { const e = Math.pow(10, Math.floor(Math.log10(x)) - 1); return Math.round(x / e) * e; };
  for (let it = 0; it < +process.env.HAZ; it++) {
    sweepRuns(false);
    const t = [];
    /* ΛΟΓΟΣ, όχι σκορ. Ο έλεγχος του παιχνιδιού είναι score >= round(T × chalTargetMul ×
       richAir), οπότε βάζοντας T = το h-ποσοστημόριο του ΣΚΟΡ άφηνες τα boss antes 11% πιο
       φτηνά απ' ό,τι νόμιζες. Στον λόγο score/target ο πολλαπλασιαστής φεύγει μόνος του. */
    for (let a = 0; a < G.TARGETS.length; a++) {
      const A = st.ratio[a];
      t.push(A.length >= 10 ? G.TARGETS[a] * q(A, haz(a)) : null);
    }
    /* Εξομάλυνση σε log — ΧΩΡΙΣΤΑ για boss antes και για κενά antes. Με ενιαίο παράθυρο ±2 το
       φιλτράρισμα ανακάτευε τις δύο σειρές και έσβηνε τη διαφορά τους: τα boss έπαιρναν στόχο
       φτιαγμένο για κενό ante και σκότωναν 9,7% έναντι 3,6%. */
    const cls = (a) => (G.isReward(a) || a === G.TARGETS.length - 1 ? 1 : 0);
    const sm = t.map((x, a) => {
      const w = [];
      for (let j = Math.max(0, a - 6); j <= Math.min(t.length - 1, a + 6); j++) if (t[j] && cls(j) === cls(a)) w.push(Math.log(t[j] / Math.pow(gr, j - a)));
      return w.length ? Math.exp(mean(w)) : null;
    });
    let last = null, lastI = -1;
    sm.forEach((x, a) => { if (x) { last = x; lastI = a; } });
    for (let a = 0; a < sm.length; a++) if (!sm[a] && a > lastI) sm[a] = last * Math.pow(gr, a - lastI);
    const fin = sm.map((x) => (x ? nice(x) : null));
    /* Μονοτονία ΜΕΣΑ στην κάθε σειρά (boss με boss, κενά με κενά): οι δύο σειρές έχουν
       διαφορετικό επίπεδο, οπότε καθολική μονοτονία θα τις ισοπέδωνε ξανά. */
    for (let a = 1; a < fin.length; a++) { const p = a - 3; if (p >= 0 && fin[a] && fin[p] && fin[a] <= fin[p]) fin[a] = nice(fin[p] * 1.16); }
    /* ήπια κίνηση προς τον νέο στόχο, για να μην ταλαντώνεται */
    fin.forEach((x, a) => { if (x) G.TARGETS[a] = nice(Math.exp(0.35 * Math.log(G.TARGETS[a]) + 0.65 * Math.log(x))); });
  }
  sweepRuns(false);
  console.log("TARGETS = [" + G.TARGETS.join(", ") + "]");
}
if (process.env.FIT) {
  for (let it = 0; it < +process.env.FIT; it++) {
    sweepRuns(true);
    const t = fitTargets();
    t.forEach((x, a) => { if (x) G.TARGETS[a] = x; });
  }
  sweepRuns(false);
  console.log("TARGETS = [" + G.TARGETS.join(", ") + "]");
}
console.log("variant " + VAR + " · runs " + RUNS + " · antes 1-" + MAXA + " · plays/round " + f2(mean(st.plays)) +
  " · max chain p50 " + q(st.maxChain, .5) + " p90 " + q(st.maxChain, .9));
console.log("ante  n  target     p10     p50     p90  p10/T  p50/T  p90/T  p50/p10  clear@play  maxPlay/T  died");
let acc10 = [], acc50 = [], accR = [];
for (let a = 0; a < MAXA; a++) {
  const A = st.score[a]; if (A.length < 4) continue;
  const T = G.tgtAt(a), p10 = q(A, .1), p50 = q(A, .5), p90 = q(A, .9);
  acc10.push(p10 / T); acc50.push(p50 / T); accR.push(p50 / p10);
  const cr = st.cross[a].filter((x) => x < 99);
  console.log(String(a + 1).padStart(4) + String(A.length).padStart(3) + String(T).padStart(8) +
    [p10, p50, p90].map((x) => String(Math.round(x)).padStart(8)).join("") +
    f2(p10 / T).padStart(7) + f2(p50 / T).padStart(7) + f2(p90 / T).padStart(7) + f2(p50 / p10).padStart(9) +
    f1(q(cr, .5)).padStart(12) + f2(q(st.big[a], .5)).padStart(11) + String(st.lost[a]).padStart(6));
}
console.log("mean p50/T " + f2(mean(acc50)) + " · mean p10/T " + f2(mean(acc10)) + " · mean p50/p10 " + f2(mean(accR)) +
  " · deaths " + st.lost.reduce((x, y) => x + y, 0) + "/" + RUNS + " · wins " + st.wins +
  " · mean death ante " + f1(st.lost.reduce((x, n, i) => x + n * (i + 1), 0) / Math.max(1, RUNS - st.wins)));
console.log("deaths/ante: " + st.lost.slice(0, MAXA).join(" "));
/* Πόση από τη διασπορά είναι «αυτό το run είναι δυνατό» και πόση «αυτός ο γύρος πήγε καλά»; */
{
  const med = [];
  for (let a = 0; a < G.TARGETS.length + 4; a++) med[a] = st.score[a].length >= 8 ? q(st.score[a], .5) : null;
  const O = st.obs.filter((o) => med[o.a] && o.s > 0 && o.a < MAXA).map((o) => ({ run: o.run, r: Math.log(o.s / med[o.a]), plays: o.plays }));
  const byRun = {}; O.forEach((o) => { (byRun[o.run] = byRun[o.run] || []).push(o.r); });
  const runEff = Object.keys(byRun).filter((k) => byRun[k].length >= 3).map((k) => mean(byRun[k]));
  const resid = []; Object.keys(byRun).forEach((k) => { if (byRun[k].length < 3) return; const m = mean(byRun[k]); byRun[k].forEach((x) => resid.push(x - m)); });
  const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) * (x - m)))); };
  console.log("sd(ln score) total " + f2(sd(O.map((o) => o.r))) + " = between-run " + f2(sd(runEff)) + " + within-run " + f2(sd(resid)) +
    "  → run-strength share " + f1(100 * Math.pow(sd(runEff), 2) / Math.pow(sd(O.map((o) => o.r)), 2)) + "%");
  const byPl = {}; O.forEach((o) => { (byPl[o.plays] = byPl[o.plays] || []).push(o.r); });
  console.log("  by playsMax: " + Object.keys(byPl).sort().map((k) => k + " → ×" + f2(Math.exp(mean(byPl[k]))) + " (n" + byPl[k].length + ")").join(" · "));
}
