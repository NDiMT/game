/* Endless: reachable, progresses, offers keep coming, targets sane. Plus restore() shape gaps. */
const { G, playRound, shop, discardStep, pts, PRIO } = require("./bot.js");

/* --- 1. force a win, then push into Endless with a very strong build --- */
function forceWin(seed) {
  const S = G.newRun(seed, G.CHARMS.map((c) => c.id), "classic");
  /* cheat the run forward: jump to ante 49 and clear it */
  S.ante = G.TARGETS.length - 1;
  G.startRound(S);
  S.score = G.target(S) + 1;
  const r = G.finish(S);
  return { S, r };
}
const { S, r } = forceWin("endless1");
console.log("won:", JSON.stringify(r), "phase", S.phase);
console.log("goEndless:", G.goEndless(S), "phase", S.phase, "offers", S.offers.length, "picks", G.picksLeft(S));
let bad = [];
let guard = 0;
while (guard++ < 200) {
  if (S.phase === "shop") {
    if (G.picksLeft(S) > 0 && !S.offers.length) bad.push("endless ante " + S.ante + ": picks " + G.picksLeft(S) + " but no offers");
    shop(S);
    if (S.phase !== "round") { bad.push("nextAnte failed at ante " + S.ante); break; }
    continue;
  }
  if (S.phase !== "round") break;
  /* cheat: always clear, to test the endless ladder machinery, not the bot */
  const T = G.target(S);
  if (!isFinite(T) || T <= 0) bad.push("bad target at ante " + S.ante + ": " + T);
  if (!G.isReward(S.ante)) bad.push("endless ante " + S.ante + " is not a reward ante");
  if (!S.chal) bad.push("endless ante " + S.ante + " has no challenge");
  S.score = T;
  const rr = G.finish(S);
  if (!rr || !rr.cleared) { bad.push("finish failed at endless ante " + S.ante); break; }
  if (S.ante > 120) break;
}
console.log("endless walked to ante", S.ante + 1, "target", G.target(S) || "-", "charms", S.charms.length, "bought", JSON.stringify(S.bought));
console.log("endless issues:", bad.length); bad.slice(0, 10).forEach((b) => console.log("  " + b));

/* --- 2. restore() shape validation vs what later code assumes --- */
console.log("\n--- restore() shape gaps");
const base = G.newRun("shape", [], "classic");
base.hand[0].e = "gold";
const good = G.serialize(base);
const mutations = {
  "null inside pile": (o) => { o.pile[3] = null; },
  "null inside deck": (o) => { o.deck[3] = null; },
  "null inside played": (o) => { o.played = [null]; },
  "pile entry missing r": (o) => { delete o.pile[3].r; },
  "phase is garbage": (o) => { o.phase = "banana"; },
  "ante is a string": (o) => { o.ante = "5"; },
  "ante beyond TARGETS, not endless": (o) => { o.ante = 900; },
  "negative ante": (o) => { o.ante = -3; },
  "mult array too short": (o) => { o.mult = [0]; },
  "charms contains unknown id": (o) => { o.charms = ["notacharm"]; },
  "charms contains null": (o) => { o.charms = [null]; },
  "sel points past hand": (o) => { o.sel = [99]; },
  "rung is garbage": (o) => { o.rung = { kind: 42, rank: 3, size: 2 }; },
  "chal unknown id": (o) => { o.chal = "nope"; o.chals["0"] = "nope"; },
  "deckId unknown": (o) => { o.deckId = "nope"; },
  "discMax negative": (o) => { o.discMax = -5; },
  "rdisc huge": (o) => { o.rdisc = 999; },
  "playsLeft negative": (o) => { o.playsLeft = -2; },
  "score is a string": (o) => { o.score = "100"; },
  "stats missing keys": (o) => { o.stats = {}; },
  "v missing": (o) => { delete o.v; },
};
Object.keys(mutations).forEach((name) => {
  const o = JSON.parse(good); mutations[name](o);
  const R = G.restore(JSON.stringify(o));
  if (!R) { console.log("  REJECTED   " + name); return; }
  /* accepted — now see whether the engine survives normal use */
  let err = "";
  try {
    G.target(R); G.chainPos(R); G.discardsLeft(R); G.handCap(R);
    const c = G.candidates(R);
    G.stuck(R); G.stuckReason(R); G.suggest(R); G.orphans(R); G.climbCards(R);
    if (R.charms.length) G.activeSynergies(R);
    if (c.length) { R.sel = c[0].idx.slice(); G.evalSel(R); G.play(R); }
    G.beatText(R); G.nearMiss(R);
  } catch (e) { err = e.constructor.name + ": " + e.message; }
  console.log("  ACCEPTED   " + name + (err ? "   -> THROWS  " + err : "   (survives)"));
});

/* truncated saves */
console.log("\n--- truncated saves");
let survived = 0, threw = 0;
for (let i = 1; i < good.length; i += Math.max(1, Math.floor(good.length / 200))) {
  try { const R = G.restore(good.slice(0, i)); if (R) console.log("  truncation at " + i + " ACCEPTED"); survived++; } catch (e) { threw++; console.log("  truncation at " + i + " THREW " + e.message); }
}
console.log("  truncations tested", survived + threw, "threw", threw);
