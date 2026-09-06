/* trig.js — ΡΥΘΜΟΣ ΕΝΕΡΓΟΠΟΙΗΣΗΣ κάθε charm, με το charm ΧΑΡΙΣΜΕΝΟ (άρα υπό συνθήκη
   κατοχής). Το audit2 λέει ΠΟΣΟ αξίζει· αυτό λέει ΓΙΑΤΙ: πόσο συχνά μιλάει καν.
   Ένα charm που δεν μιλάει δεν είναι αδύναμο — είναι αόρατο, κι αυτό είναι χειρότερο.

   node tools/trig.js [N] [mode]
     mode = run  : Classic (builder), ρυθμός ανά παίξιμο και ανά γύρο
     mode = surv : Survival
*/
const G = require("../site/raise/game.js");
const N = +process.argv[2] || 120, MODE = process.argv[3] || "run";
const pts = (S, o) => G.scoreOf(S, o.k, o.idx.map((i) => S.hand[i])).pts;
const cost = (k) => G.KINDS[k.kind].tier * 1e6 + k.size * 1e3 + k.rank;

/* Πρόθεμα note → charm id. Ό,τι δεν έχει note μετριέται δομικά (βλ. STRUCT). */
const NOTE = {
  court: ["Court +60", "Crown Jewels +120"], kingmaker: ["Kingmaker +", "Royal Court +"],
  ladder: ["Ladder +2 steps", "Back Stairs +2 steps"], loyal: ["Loyalty +1 step"],
  patient: ["Patient +"], summiteer: ["Summiteer ×2"], leap: ["Overkill ×2"],
  lowroad: ["Low Road ×2"], mirror: ["Mirror ×2"], ember: ["Ember ×2", "Chain Reaction ×3"],
  encore: ["Encore ×2", "Bookends ×3"], afterburner: ["Afterburner ×2"],
  goldsmith: ["Gold ×", "Gold + Silver ×"],
};
/* Charms χωρίς note: μετριούνται από το γεγονός του γύρου. */
const STRUCT = { climber: "κάθε ανέβασμα", sleight: "κάθε γύρος", scout: "κάθε γύρος", cheap: "σπάσιμο", wind: "σπάσιμο" };

function discardStep(S) {
  let o = G.orphans(S);
  if (!o.length) o = S.hand.map((_, i) => i).filter((i) => !S.hand[i].h && S.hand[i].r !== 14 && !G.isWild(S.hand[i])).slice(0, 2);
  if (!o.length) return false;
  S.sel = o.slice(0, Math.min(3, o.length)); return G.discard(S);
}
function runClassic(seed, charm, t) {
  const S = G.newRun(seed, []);
  if (charm) { S.charms.push(charm); S.charmSlots = Math.max(1, S.charmSlots); G.startRound(S); }
  for (;;) {
    const T = G.target(S);
    let firedThisRound = 0;
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
      if (!ev) break;
      t.plays++;
      const pre = NOTE[charm] || [];
      if (pre.some((p) => (ev.notes || []).some((x) => x.indexOf(p) === 0))) { t.fired++; firedThisRound = 1; }
      if (charm === "climber" && ev.up) { t.fired++; firedThisRound = 1; }
      if ((charm === "cheap" || charm === "wind") && ev.broke) { t.fired++; firedThisRound = 1; }
      if (ev.cleared) break;
    }
    t.rounds++; if (firedThisRound) t.firedRounds++;
    if (charm === "sleight" || charm === "scout") { t.fired += 1; t.firedRounds += firedThisRound ? 0 : 1; }
    if (S.phase === "round") G.finish(S);
    if (S.phase === "lost" || S.phase === "won") break;
    S.pickUp = 0; S.pickCharm = 0; S.offers = [];
    if (!G.nextAnte(S)) break;
  }
  return S.ante + 1;
}
function runSurv(seed, charm, t) {
  const S = G.newRun(seed, [], "survival");
  if (charm) { S.charms.push(charm); S.charmSlots = 1; }
  for (let guard = 0; guard < 4000 && S.phase === "round"; guard++) {
    const all = G.candidates(S);
    if (!all.length) { if (G.canDiscardAny(S)) { const o = G.orphans(S); S.sel = (o.length ? o : S.hand.map((_, i) => i)).slice(0, 3); if (S.sel.length && G.discard(S)) continue; } break; }
    const up = all.filter((o) => G.climbs(S, o.k));
    let m = null, breathe = false;
    if (up.length) m = up.reduce((b, o) => (cost(o.k) < (b ? cost(b.k) : Infinity) ? o : b), null);
    else if (G.discardsLeft(S) > 0 && G.canDiscardAny(S)) breathe = true;
    else m = all.reduce((b, o) => (!b || pts(S, o) > pts(S, b) ? o : b), null);
    if (breathe) { const o = G.orphans(S); S.sel = (o.length ? o : S.hand.map((_, i) => i)).slice(0, 2); if (S.sel.length && G.discard(S)) continue; m = all[0]; }
    if (!m) break;
    S.sel = m.idx.slice();
    const ev = G.play(S); if (!ev) break;
    t.plays++;
    const pre = NOTE[charm] || [];
    if (pre.some((p) => (ev.notes || []).some((x) => x.indexOf(p) === 0))) t.fired++;
    if (charm === "climber" && ev.up) t.fired++;
    if ((charm === "cheap" || charm === "wind") && ev.broke) t.fired++;
    if (ev.last) break;
  }
  G.finish(S);
  return S.score;
}
const seeds = Array.from({ length: N }, (_, i) => "tg-" + i);
console.log((MODE === "surv" ? "Survival" : "Classic") + " · " + N + " runs ανά charm · το charm χαρισμένο από την αρχή\n");
console.log("charm".padEnd(14) + "μιλάει/παίξιμο".padStart(15) + (MODE === "surv" ? "" : "μιλάει/γύρο".padStart(14)) + "  σημείωμα");
const rows = [];
for (const c of G.CHARMS) {
  const t = { plays: 0, fired: 0, rounds: 0, firedRounds: 0 };
  seeds.forEach((s) => (MODE === "surv" ? runSurv(s, c.id, t) : runClassic(s, c.id, t)));
  rows.push({ id: c.id, r: t.fired / Math.max(1, t.plays), rr: t.firedRounds / Math.max(1, t.rounds), note: STRUCT[c.id] || "" });
}
rows.sort((a, b) => b.r - a.r);
rows.forEach((r) => console.log(r.id.padEnd(14) + (100 * r.r).toFixed(1).padStart(13) + "%" + (MODE === "surv" ? "" : ((100 * r.rr).toFixed(0) + "%").padStart(14)) + "  " + r.note));
