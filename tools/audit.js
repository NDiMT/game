/* Έλεγχος αξίας: πόσο αξίζει στ' αλήθεια κάθε perk, κάθε charm και πόσο δαγκώνει κάθε challenge.

   node tools/audit.js [runs] [charms|perks|challenges|all]

   Μέθοδος για perks/charms: ζευγαρωτή σύγκριση στα ΙΔΙΑ seeds. Το bot παίζει κανονικά, αλλά
   του χαρίζεται ΕΝΑ επιπλέον αντικείμενο στην αρχή. Το Δ στο μέσο ante θανάτου είναι η
   οριακή αξία του — ακριβώς στο περιθώριο που το συναντά ο παίκτης. Χωρίς PRIO bias.

   Για τα challenges: κανονικά runs, μετρώντας πόσες φορές συναντήθηκε το καθένα και πόσες
   φορές σκότωσε — δηλαδή ο ρυθμός θανάτου ανά challenge, με 95% διάστημα Wilson. */
const G = require("../site/raise/game.js");
const N = +process.argv[2] || 60, WHAT = process.argv[3] || "all";
const ALL = G.CHARMS.map((c) => c.id);
/* Σειρά επιλογής. Η παλιά ήταν μετρημένα κακή: το m1 έχει maxBuy 20, οπότε ρουφούσε κάθε
   μεταγενέστερη επιλογή και το bot δεν έπαιρνε ΠΟΤΕ Wide Hand ή Cull· και έλειπαν τα leap/scout,
   που φιλτράρονταν έξω από το `pr >= 0`. Μετρημένο (tools/prio.js 800, ίδια seeds, ίδια πολιτική
   παιξίματος): μέσο ante θανάτου 19,23 → 32,01 και νίκες 9/800 → 267/800 μόνο από τη σειρά.
   Βαθμονόμηση πάνω στην παλιά σειρά σήμαινε βαθμονόμηση πάνω σε παίκτη που ψωνίζει λάθος. */
const PRIO = (process.env.PRIO || "patient,court,kingmaker,mirror,climber,encore,loyal,lowroad,sleight,wind,ember,scout,leap,summiteer,cheap,goldsmith,ladder,afterburner,wi,pl,th,m2,cs,m1,gt,di").split(",");

function discardStep(S) {
  let o = G.orphans(S);
  if (!o.length) o = S.hand.map((_, i) => i).filter((i) => !S.hand[i].h && S.hand[i].r !== 14 && !G.isWild(S.hand[i])).slice(0, 2);
  if (!o.length) return false;
  S.sel = o.slice(0, Math.min(3, o.length)); return G.discard(S);
}
/* Ένας γύρος όπως παίζεται πραγματικά: σταματά τη στιγμή που πέφτει ο στόχος.
   Το discard δεν είναι πια έσχατη λύση: αν το καλύτερο χέρι δεν βγάζει το μερίδιο που του
   αναλογεί (ό,τι λείπει, διά τα plays που μένουν), το bot ψαρεύει αντί να το σπαταλήσει.
   Χωρίς αυτό, το bot έκανε 0,09 discard τον γύρο και κάθε αναβάθμιση discard μετριόταν νεκρή. */
/* Το bot παίζει όπως πρέπει να παίζεται το παιχνίδι: το μεγαλύτερο σχήμα που ανεβαίνει.
   Το σπαμ ζευγαριών είναι πια μετρήσιμα κακή στρατηγική, οπότε δεν είναι βάση μέτρησης. */
function bestMove(S) {
  const all = G.candidates(S); if (!all.length) return null;
  const up = all.filter((o) => G.climbs(S, o.k)), pool = up.length ? up : all;
  return pool.reduce((b, o) => (!b || G.scoreOf(S, o.k, o.idx.map((i) => S.hand[i])).pts > G.scoreOf(S, b.k, b.idx.map((i) => S.hand[i])).pts ? o : b), null);
}
const movePts = (S, m) => G.scoreOf(S, m.k, m.idx.map((i) => S.hand[i])).pts;
function playRound(S, tally) {
  for (let guard = 0; guard < 200 && S.phase === "round"; guard++) {
    if (S.playsLeft < 1) break;
    const m = bestMove(S);
    if (m) {
      const need = Math.max(0, G.target(S) - S.score), share = need / Math.max(1, S.playsLeft);
      if (S.playsLeft > 1 && movePts(S, m) < 0.55 * share && G.canDiscardAny(S) && discardStep(S)) { if (tally) tally.disc++; continue; }
      S.sel = m.idx.slice(); const ev = G.play(S); if (tally) tally.plays++;
      if (ev.cleared) break;
      continue;
    }
    if (G.canDiscardAny(S) && discardStep(S)) { if (tally) tally.disc++; continue; }
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
/* grant: {charm:id} ή {perk:id, n} — χαρίζεται πριν την πρώτη πίστα. */
function run(seed, grant, tally) {
  const S = G.newRun(seed, ALL);
  if (grant && grant.charm) { S.charms.push(grant.charm); S.charmSlots += 1; }
  if (grant && grant.perk) for (let i = 0; i < (grant.n || 1); i++) G.applyFree(S, grant.perk);
  G.startRound(S);
  for (;;) {
    playRound(S, tally);
    if (S.phase === "lost") {
      if (tally) { const c = S.chal || "-"; tally.died[c] = (tally.died[c] || 0) + 1; }
      return S.ante;
    }
    if (S.phase === "won") return G.TARGETS.length;
    if (tally) { const c = S.chal; if (c) tally.faced[c] = (tally.faced[c] || 0) + 1; }
    shop(S);
  }
}
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const seeds = Array.from({ length: N }, (_, i) => "au-" + i);
/* Wilson 95% για ρυθμό θανάτου */
function wilson(k, n) {
  if (!n) return [0, 0];
  const p = k / n, z = 1.96, d = 1 + z * z / n;
  const c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}

const baseT = { plays: 0, disc: 0, rounds: 0, faced: {}, died: {} };
const base = seeds.map((s) => run(s, null, baseT));
const bm = mean(base);
console.log(`baseline · ${N} runs · mean death ante ${bm.toFixed(2)} · discards per play ${(baseT.disc / baseT.plays).toFixed(2)}`);

function table(title, rows) {
  console.log("\n" + title);
  console.log("item".padEnd(14) + "mean".padStart(7) + "Δ".padStart(8) + "  bar");
  rows.sort((a, b) => b.d - a.d).forEach((r) => {
    const n = Math.round(Math.abs(r.d) * 4);
    console.log(r.id.padEnd(14) + r.m.toFixed(2).padStart(7) + (r.d >= 0 ? "+" : "") + r.d.toFixed(2).padStart(7) + "  " + (r.d >= 0 ? "".padEnd(n, "█") : "".padEnd(n, "·")));
  });
}
if (WHAT === "charms" || WHAT === "all") {
  table("CHARMS · marginal value (one free charm, same seeds)",
    G.CHARMS.map((c) => { const m = mean(seeds.map((s) => run(s, { charm: c.id }))); return { id: c.id, m, d: m - bm }; }));
}
if (WHAT === "perks" || WHAT === "all") {
  table("PERKS · marginal value (the perk granted twice, same seeds)",
    G.POOL.map((o) => { const m = mean(seeds.map((s) => run(s, { perk: o.id, n: 2 }))); return { id: o.id, m, d: m - bm }; }));
}
if (WHAT === "challenges" || WHAT === "all") {
  console.log("\nCHALLENGES · how often each one kills you");
  console.log("challenge".padEnd(12) + "faced".padStart(7) + "died".padStart(6) + "rate".padStart(8) + "   95% CI");
  const ids = G.CHALLENGES.map((c) => c.id);
  const rows = ids.map((id) => { const f = (baseT.faced[id] || 0) + (baseT.died[id] || 0), d = baseT.died[id] || 0; return { id, f, d, r: f ? d / f : 0 }; });
  rows.sort((a, b) => b.r - a.r).forEach((r) => {
    const [lo, hi] = wilson(r.d, r.f);
    console.log(r.id.padEnd(12) + String(r.f).padStart(7) + String(r.d).padStart(6) + (100 * r.r).toFixed(0).padStart(7) + "%   " + (100 * lo).toFixed(0) + "–" + (100 * hi).toFixed(0) + "%");
  });
  const pf = Object.entries(baseT.faced).reduce((a, [, v]) => a + v, 0) + Object.entries(baseT.died).reduce((a, [k, v]) => a + (k === "-" ? 0 : v), 0);
  const pd = baseT.died["-"] || 0, pn = base.length * 0 + (baseT.plays, 0);
  console.log(`plain antes: died ${pd} (challenge antes faced ${pf})`);
}
