/* cap.js — πόσο συχνά ΔΕΝΕΙ το hmCap, και ποια charms τρώγονται από αυτό.
   Υπόθεση: η διασπορά αξίας 25× στα charms δεν είναι «ρυθμός ενεργοποίησης» αλλά
   ΚΑΝΙΒΑΛΙΣΜΟΣ: Patient προσθέτει Mult (πριν την αλυσίδα, δικό του πλαφόν), ενώ
   Ember/Summiteer/Encore/Mirror/Overkill/Low Road/Back Stairs/Afterburner μπαίνουν ΟΛΑ
   στον ίδιο κουβά `hm`, με πλαφόν hmCap=3. Το πρώτο ×2 αξίζει, τα επόμενα τίποτα.

   node tools/cap.js [N] [mode]
     mode = obs   : παρατήρηση σε κανονικά runs (ποιο ποσοστό των παιξιμάτων δένει)
     mode = pairs : οριακή αξία ενός charm ΜΟΝΟΥ vs ΜΑΖΙ με ένα δεύτερο ×2 charm
*/
const G = require("../site/raise/game.js");
const N = +process.argv[2] || 200, MODE = process.argv[3] || "obs";
const ALL = G.CHARMS.map((c) => c.id);
const PRIO = (process.env.PRIO || "patient,court,kingmaker,mirror,climber,encore,loyal,lowroad,sleight,wind,ember,scout,leap,summiteer,cheap,goldsmith,ladder,afterburner,wi,pl,th,m2,cs,m1,gt,di").split(",");
const pts = (S, o) => G.scoreOf(S, o.k, o.idx.map((i) => S.hand[i])).pts;

/* Ποια notes ανήκουν στον κουβά hm (πολλαπλασιαστές χεριού, μέσα στο hmCap). */
const HM_NOTES = [
  ["Back Stairs ×", "backstairs"], ["Summiteer ×2", "summiteer"], ["Overkill ×2", "leap"],
  ["Low Road ×2", "lowroad"], ["Mirror ×2", "mirror"], ["Ember ×2", "ember"],
  ["Chain Reaction ×3", "ember"], ["Encore ×2", "encore"], ["Bookends ×3", "encore"],
  ["Afterburner ×2", "afterburner"], ["Red Night ×1.5", "rule"], ["Black Night ×1.5", "rule"],
  ["Runway ×2", "rule"], ["Triplets ×2", "rule"], ["Open House ×2", "rule"], ["Underdogs ×2", "rule"],
];

function discardStep(S) {
  let o = G.orphans(S);
  if (!o.length) o = S.hand.map((_, i) => i).filter((i) => !S.hand[i].h && S.hand[i].r !== 14 && !G.isWild(S.hand[i])).slice(0, 2);
  if (!o.length) return false;
  S.sel = o.slice(0, Math.min(3, o.length)); return G.discard(S);
}
function playRound(S, tally) {
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
    const ev = G.play(S);
    if (tally && ev) {
      tally.plays++;
      const notes = ev.notes || [];
      const capped = notes.some((n) => n.indexOf("(cap)") >= 0);
      /* πόσοι hm-πολλαπλασιαστές ήταν παρόντες σε αυτό το παίξιμο */
      let n = 0; const who = [];
      HM_NOTES.forEach(([pre, id]) => { if (notes.some((x) => x.indexOf(pre) === 0)) { n++; who.push(id); } });
      tally.hmCount[n] = (tally.hmCount[n] || 0) + 1;
      if (capped) { tally.capped++; who.forEach((id) => { tally.capVictim[id] = (tally.capVictim[id] || 0) + 1; }); }
      who.forEach((id) => { tally.seen[id] = (tally.seen[id] || 0) + 1; });
      /* enhCap */
      const g = notes.find((x) => /^(Gold|Silver|Gold \+ Silver) ×/.test(x));
      if (g) { tally.enh++; const v = +g.split("×")[1]; if (v >= (G.has(S, "goldsmith") ? G.CFG.goldsmithCap : G.CFG.enhCap)) tally.enhCapped++; }
    }
    if (ev && ev.cleared) break;
  }
  if (S.phase === "round") G.finish(S);
}
function shop(S) {
  while (G.picksLeft(S) > 0) {
    const list = S.offers.map((o, i) => ({ o, i, pr: PRIO.indexOf(o.id) })).filter((x) => !x.o.bought && x.pr >= 0 && G.canTake(S, x.i).ok).sort((a, b) => a.pr - b.pr);
    if (!list.length) break;
    G.take(S, list[0].i);
  }
  G.nextAnte(S);
}
function run(seed, grant, tally) {
  const S = G.newRun(seed, ALL);
  if (grant) {
    (grant.charms || []).forEach((c) => S.charms.push(c));
    S.charmSlots = Math.max(S.charmSlots, S.charms.length);
    G.startRound(S);
  }
  for (;;) {
    playRound(S, tally);
    if (S.phase === "lost") return S.ante + 1;
    if (S.phase === "won") return G.TARGETS.length + 1;
    shop(S);
  }
}
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const seeds = Array.from({ length: N }, (_, i) => "cap-" + i);

if (MODE === "obs") {
  const t = { plays: 0, capped: 0, hmCount: {}, capVictim: {}, seen: {}, enh: 0, enhCapped: 0 };
  seeds.forEach((s) => run(s, null, t));
  console.log("παρατήρηση · " + N + " runs · " + t.plays + " παιξίματα · hmCap=" + G.CFG.hmCap);
  console.log("παιξίματα όπου το hmCap ΔΕΝΕΙ: " + (100 * t.capped / t.plays).toFixed(1) + "%");
  console.log("hm-πολλαπλασιαστές ανά παίξιμο: " + Object.keys(t.hmCount).sort().map((k) => k + " → " + (100 * t.hmCount[k] / t.plays).toFixed(1) + "%").join(" · "));
  console.log("όταν δένει, ποιοι ήταν παρόντες: " + Object.entries(t.capVictim).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + " " + v + "/" + t.seen[k] + " (" + (100 * v / t.seen[k]).toFixed(0) + "% των εμφανίσεών του)").join(" · "));
  console.log("enh: " + t.enh + " παιξίματα με Gold/Silver, από αυτά στο πλαφόν " + (t.enh ? (100 * t.enhCapped / t.enh).toFixed(0) : 0) + "%");
} else {
  /* Οριακή αξία ενός ×2 charm ΜΟΝΟ, και ΜΑΖΙ με ένα δεύτερο ×2 charm.
     Αν ο κανιβαλισμός είναι αληθινός, το δεύτερο πρέπει να αξίζει πολύ λιγότερο. */
  const X2 = ["mirror", "encore", "ember", "summiteer", "leap", "lowroad", "afterburner"];
  const ADD = ["mirror", "patient"];
  const base = {}, cell = {};
  const val = (charms) => mean(seeds.map((s) => run(s, { charms }, null)));
  const b0 = val([]);
  console.log("κανένα charm: " + b0.toFixed(2) + " (" + N + " runs)\n");
  console.log("charm".padEnd(14) + "μόνο".padStart(8) + "Δ".padStart(8) + "  |  " + "με mirror".padStart(10) + "Δ".padStart(8) + "  |  " + "με patient".padStart(11) + "Δ".padStart(8));
  const withM = val(["mirror"]), withP = val(["patient"]);
  X2.forEach((c) => {
    if (c === "mirror") return;
    const a = val([c]), m = val([c, "mirror"]), p = val([c, "patient"]);
    console.log(c.padEnd(14) + a.toFixed(2).padStart(8) + (a - b0 >= 0 ? "+" : "") + (a - b0).toFixed(2).padStart(7) +
      "  |  " + m.toFixed(2).padStart(10) + (m - withM >= 0 ? "+" : "") + (m - withM).toFixed(2).padStart(7) +
      "  |  " + p.toFixed(2).padStart(11) + (p - withP >= 0 ? "+" : "") + (p - withP).toFixed(2).padStart(7));
  });
  console.log("\nmirror μόνο: " + withM.toFixed(2) + " (Δ " + (withM - b0).toFixed(2) + ") · patient μόνο: " + withP.toFixed(2) + " (Δ " + (withP - b0).toFixed(2) + ")");
}
