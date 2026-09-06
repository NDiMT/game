/* Πόσο δυνατό είναι το «ρίξε και σκουπίδια μαζί»; node tools/junk.js [N]
   Ίδια seeds, ίδια πολιτική αγορών, ίδια πολιτική παιξίματος — αλλάζει ΜΟΝΟ πόσα άσχετα
   φύλλα ρίχνει ο bot μαζί με κάθε χέρι (0 = η παλιά συμπεριφορά). */
const G = require("../site/raise/game.js");
const N = +process.argv[2] || 200;
const ALL = G.CHARMS.map((c) => c.id);
const PRIO = "patient,court,kingmaker,mirror,climber,encore,loyal,lowroad,sleight,wind,ember,scout,leap,summiteer,cheap,goldsmith,ladder,afterburner,wi,pl,th,m2,cs,m1,gt,di".split(",");

function discardStep(S) {
  let o = G.orphans(S);
  if (!o.length) o = S.hand.map((_, i) => i).filter((i) => !S.hand[i].h && S.hand[i].r !== 14 && !G.isWild(S.hand[i])).slice(0, 2);
  if (!o.length) return false;
  S.sel = o.slice(0, Math.min(3, o.length)); return G.discard(S);
}
/* Τα σκουπίδια: ορφανά φύλλα που δεν μπαίνουν σε κανένα σχήμα, και σε δεύτερη επιλογή τα
   χαμηλότερα φύλλα εκτός του πυρήνα. Ποτέ άσος, ποτέ joker, ποτέ ενισχυμένο. */
function junkFor(S, core, n) {
  if (n <= 0) return [];
  const inCore = new Set(core);
  const ok = (i) => { const c = S.hand[i]; return !inCore.has(i) && !c.h && c.r !== 14 && !G.isWild(c) && !c.e; };
  const orph = G.orphans(S).filter(ok);
  const rest = S.hand.map((_, i) => i).filter((i) => ok(i) && orph.indexOf(i) < 0).sort((a, b) => S.hand[a].r - S.hand[b].r);
  return orph.concat(rest).slice(0, n);
}
function run(JUNK) {
  const st = { lost: 0, wins: 0, antes: [], plays: 0, dumped: 0, first: 0, rounds: 0, ratio: [] };
  for (let s = 0; s < N; s++) {
    const S = G.newRun("jk-" + s, ALL);
    for (;;) {
      /* ένας γύρος */
      for (let guard = 0; guard < 200 && S.phase === "round"; guard++) {
        if (S.playsLeft < 1) break;
        const all = G.candidates(S), up = all.filter((o) => G.climbs(S, o.k)), pool = up.length ? up : all;
        let m = pool.length ? pool.reduce((b, o) => (!b || G.scoreOf(S, o.k, o.idx.map((i) => S.hand[i])).pts > G.scoreOf(S, b.k, b.idx.map((i) => S.hand[i])).pts ? o : b), null) : null;
        if (m) {
          const need = Math.max(0, G.target(S) - S.score), share = need / Math.max(1, S.playsLeft);
          if (S.playsLeft > 1 && G.scoreOf(S, m.k, m.idx.map((i) => S.hand[i])).pts < 0.55 * share && G.canDiscardAny(S) && discardStep(S)) continue;
          /* «smart» (JUNK=-1): ρίχνει σκουπίδια ΜΟΝΟ όταν δεν έχει άλλα discards και υπάρχουν
             τουλάχιστον δύο νεκρά φύλλα — δηλαδή όταν το ξεφόρτωμα είναι το μόνο εργαλείο. */
          let j;
          if (JUNK < 0) {
            /* «orphans»: ρίχνει ΜΟΝΟ πραγματικά νεκρά φύλλα (δεν μπαίνουν σε κανένα σχήμα) —
               η φυσική κίνηση καλού παίκτη. Το «always» ρίχνει και χρήσιμα χαμηλά φύλλα. */
            const inCore = new Set(m.idx);
            j = G.orphans(S).filter((i) => { const c = S.hand[i]; return !inCore.has(i) && !c.h && c.r !== 14 && !G.isWild(c) && !c.e; }).slice(0, G.CFG.junkCap);
          } else j = junkFor(S, m.idx, JUNK);
          S.sel = m.idx.concat(j);
          const before = S.playsLeft, ev = G.play(S);
          if (!ev) { S.sel = m.idx.slice(); if (!G.play(S)) break; } else { st.dumped += (ev.junk == null ? j.length : ev.junk); }
          st.plays++;
          if (before === S.playsMax && S.score >= G.target(S)) st.first++;
          if (S.score >= G.target(S)) break;
          continue;
        }
        if (G.canDiscardAny(S) && discardStep(S)) continue;
        break;
      }
      st.rounds++; st.ratio.push(S.score / G.target(S));
      if (S.phase === "round") G.finish(S);
      if (S.phase === "lost") { st.lost++; st.antes.push(S.ante); break; }
      if (S.phase === "won") { st.wins++; st.antes.push(S.ante); break; }
      /* κατάστημα */
      if (!S.offers.length) { G.nextAnte(S); continue; }
      while (G.picksLeft(S) > 0) {
        const opts = S.offers.map((o, i) => ({ o, i, pr: PRIO.indexOf(o.id) })).filter((x) => !x.o.bought && x.pr >= 0 && G.canTake(S, x.i).ok).sort((a, b) => a.pr - b.pr);
        if (!opts.length) break;
        G.take(S, opts[0].i);
      }
      G.nextAnte(S);
    }
  }
  const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
  return { JUNK, ante: mean(st.antes), wins: st.wins, first: 100 * st.first / st.rounds, dumped: st.dumped / st.plays, ratio: mean(st.ratio) };
}
if (process.env.SCALE) {
  console.log("σάρωση στόχων με σκουπίδια " + (process.env.JUNK || 3) + " · " + N + " runs ανά κελί");
  console.log("  ×στόχοι   ante θανάτου   νίκες   1ο παίξιμο   score/T");
  process.env.SCALE.split(",").map(Number).forEach((x) => {
    G.CFG.tgtScale = x;
    const r = run(+(process.env.JUNK || 3));
    console.log("  " + x.toFixed(2).padStart(6) + "     " + r.ante.toFixed(2).padStart(8) + "   " + String(r.wins).padStart(5) + "   " + (r.first.toFixed(2) + "%").padStart(9) + "   " + r.ratio.toFixed(2).padStart(7));
  });
  G.CFG.tgtScale = 1;
  process.exit(0);
}
if (process.env.REDRAW) {
  console.log("σάρωση: πόσα σκουπίδια ξανατραβιούνται · " + N + " runs ανά κελί · cap " + G.CFG.junkCap);
  console.log("  ξανατραβά   πολιτική   ante θανάτου   νίκες   1ο παίξιμο   score/T");
  process.env.REDRAW.split(",").map(Number).forEach((rd) => {
    G.CFG.junkRedraw = rd;
    [3, -1].forEach((j) => {
      const r = run(j);
      console.log("  " + String(rd).padStart(9) + "   " + (j < 0 ? "orphans" : "always").padStart(8) + "   " + r.ante.toFixed(2).padStart(12) + "   " + String(r.wins).padStart(5) + "   " + (r.first.toFixed(2) + "%").padStart(9) + "   " + r.ratio.toFixed(2).padStart(7));
    });
  });
  process.exit(0);
}
console.log("junk · " + N + " runs ανά κελί · ίδια seeds");
console.log("  σκουπίδια  ante θανάτου   νίκες   γύροι που έκλεισαν στο 1ο παίξιμο   σκουπίδια/παίξιμο   μέσο score/T");
[0, 1, 2, 3, -1].forEach((j) => {
  const r = run(j);
  console.log("  " + String(r.JUNK < 0 ? "orphans" : r.JUNK).padStart(5) + "      " + r.ante.toFixed(2).padStart(8) + "   " + String(r.wins).padStart(5) + "   " + (r.first.toFixed(2) + "%").padStart(10) + "                 " + r.dumped.toFixed(2).padStart(8) + "        " + r.ratio.toFixed(2).padStart(8));
});
