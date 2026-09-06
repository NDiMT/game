/* Force every challenge and every table rule onto many rounds and assert no dead end. */
const { G, pts, discardStep } = require("./bot.js");
const N = +process.argv[2] || 60;
let bad = [];
const note = (m) => { if (bad.length < 200) bad.push(m); };

const CHALS = G.CHALLENGES.map((c) => c.id);
const RULES = G.RULES.map((r) => r.id);

function runRound(S, tag) {
  let g = 0;
  while (S.phase === "round" && g++ < 400) {
    const dm = G.discMaxOf(S);
    if (S.discMax !== dm) note(tag + ": discMax " + S.discMax + " != " + dm);
    if (G.discardsLeft(S) < 0) note(tag + ": discardsLeft negative");
    if (S.rdisc > S.discMax && !G.has(S, "scout") && !G.deadHand(S)) note(tag + ": rdisc " + S.rdisc + " > discMax " + S.discMax);
    if (S.hand.length > G.handCap(S)) note(tag + ": hand " + S.hand.length + " > cap " + G.handCap(S));
    const canP = G.hasLegal(S) && S.playsLeft > 0, canD = G.canDiscardAny(S);
    if (!canP && !canD && !G.stuck(S)) note(tag + ": no action, stuck()==false, playsLeft " + S.playsLeft + " pile " + S.pile.length);
    if (G.stuck(S)) break;
    if (S.playsLeft < 1) break;
    if (S.score >= G.target(S)) break;
    const all = G.candidates(S);
    if (!all.length) { if (canD && discardStep(S)) continue; break; }
    if (S.chal === "noace") all.forEach((o) => o.idx.forEach((i) => { const c = S.hand[i]; if (!G.isWild(c) && c.r === 14) note(tag + ": noace candidate holds an Ace"); }));
    const up = all.filter((o) => G.climbs(S, o.k));
    const m = (up.length ? up : all).reduce((b, o) => (!b || pts(S, o) > pts(S, b) ? o : b), null);
    S.sel = m.idx.slice();
    const ev = G.play(S);
    if (!ev) { note(tag + ": play() null with a legal move"); break; }
    if (S.chal === "summit" && !ev.up && ev.pts !== 0) note(tag + ": Summit scored " + ev.pts + " on a non-climb");
    if (S.chal === "thinair" && ev.up && ev.pos > G.CFG.thinAirCap) note(tag + ": Thin Air chain reached x" + ev.pos);
    if (G.currentRule(S) && G.currentRule(S).id === "r_cap" && ev.up && ev.pos > G.CFG.lowCeiling) note(tag + ": Low Ceiling chain reached x" + ev.pos);
    if (S.chal === "highground" && ev.up && (ev.k.kind === 9 || (ev.k.kind === 1 && ev.k.rank < G.CFG.highGroundRank))) note(tag + ": High Ground let a small hand climb");
  }
  const r = G.finish(S);
  if (!r) note(tag + ": finish() null");
  return r;
}

/* every challenge at a mid ante, with and without a fat build */
for (const id of CHALS) {
  let cleared = 0, played = 0;
  for (let i = 0; i < N; i++) {
    const S = G.newRun("f" + id + i, G.CHARMS.map((c) => c.id), "classic");
    S.ante = 20;
    S.chals[20] = id; delete S.rules[20];
    S.charms = ["patient", "court", "kingmaker", "mirror", "climber"];
    S.mult = [0, 6, 8, 8, 8, 8, 8, 8, 6, 0]; S.playsMax = 6; S.handSize = 9; S.chainStart = 1;
    G.startRound(S);
    if (S.chal !== id) { note("chal " + id + " did not take"); break; }
    const r = runRound(S, "chal:" + id);
    if (r && r.cleared) cleared++;
    played += S.stats.plays;
  }
  console.log("chal " + id.padEnd(11) + " cleared " + String(cleared).padStart(3) + "/" + N + "  avg hands " + (played / N).toFixed(1));
}
/* every rule at a mid ante */
for (const id of RULES) {
  let cleared = 0, played = 0;
  for (let i = 0; i < N; i++) {
    const S = G.newRun("r" + id + i, G.CHARMS.map((c) => c.id), "classic");
    S.ante = 19;
    delete S.chals[19]; S.rules[19] = id;
    S.charms = ["patient", "court", "kingmaker", "mirror", "climber"];
    S.mult = [0, 6, 8, 8, 8, 8, 8, 8, 6, 0]; S.playsMax = 6; S.handSize = 9;
    G.startRound(S);
    const cr = G.currentRule(S);
    if (!cr || cr.id !== id) { note("rule " + id + " did not take"); break; }
    const r = runRound(S, "rule:" + id);
    if (r && r.cleared) cleared++;
    played += S.stats.plays;
  }
  console.log("rule " + id.padEnd(9) + " cleared " + String(cleared).padStart(3) + "/" + N + "  avg hands " + (played / N).toFixed(1));
}
console.log("\nviolations:", bad.length);
const seen = new Set();
bad.forEach((b) => { const k = b.replace(/\d+/g, "#"); if (!seen.has(k)) { seen.add(k); console.log("  " + b); } });
