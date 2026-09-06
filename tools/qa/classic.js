/* Classic: full runs, invariants, softlocks, budget accounting, save round-trip every move */
const { G, playRound, shop, discardStep, pts, PRIO } = require("./bot.js");
const N = +process.argv[2] || 200;
const CHECK_SAVE = process.argv[3] === "save";
let bad = [];
const note = (s, m) => { if (bad.length < 400) bad.push(s + ": " + m); };
let deaths = [], wins = 0, stuckBug = 0;

function invariants(S, seed) {
  if (S.phase !== "round") return;
  const dm = G.discMaxOf(S);
  if (S.discMax !== dm) note(seed, "ante " + S.ante + " discMax " + S.discMax + " != discMaxOf " + dm + " chal=" + S.chal);
  if (S.rdisc > S.discMax + 1) note(seed, "rdisc " + S.rdisc + " > discMax " + S.discMax + " (chal " + S.chal + ")");
  if (G.discardsLeft(S) < 0) note(seed, "discardsLeft < 0");
  if (S.hand.length > G.handCap(S)) note(seed, "hand " + S.hand.length + " > cap " + G.handCap(S));
  if (S.playsLeft < 0) note(seed, "playsLeft < 0");
  // no legal action but not stuck and not finishable
  const canP = G.hasLegal(S) && S.playsLeft > 0;
  const canD = G.canDiscardAny(S);
  if (!canP && !canD && !G.stuck(S)) note(seed, "no legal action yet stuck()==false");
  // frozen aces must never be playable
  if (S.chal === "noace") {
    G.candidates(S).forEach((o) => { o.idx.forEach((i) => { const c = S.hand[i]; if (!G.isWild(c) && c.r === 14) note(seed, "noace: candidate contains an Ace"); }); });
  }
  // ids unique
  const ids = S.hand.map((c) => c.id).concat(S.pile.map((c) => c.id), S.discardPile.map((c) => c.id));
  if (new Set(ids).size !== ids.length) note(seed, "duplicate ids hand+pile+discard");
  if (CHECK_SAVE) {
    const j = G.serialize(S), R = G.restore(j);
    if (!R) note(seed, "restore() rejected a live state, phase=" + S.phase);
    else if (G.serialize(R) !== j) note(seed, "serialize/restore not identity");
  }
}

for (let i = 0; i < N; i++) {
  const seed = "c" + i;
  const S = G.newRun(seed, G.CHARMS.map((c) => c.id), "classic");
  let guard = 0;
  while (guard++ < 400) {
    invariants(S, seed);
    if (S.phase === "round") {
      const T = G.target(S);
      let g2 = 0;
      while (S.phase === "round" && g2++ < 300) {
        invariants(S, seed);
        if (S.playsLeft < 1 || S.score >= T) break;
        const all = G.candidates(S);
        if (!all.length) { if (G.canDiscardAny(S) && discardStep(S)) continue; break; }
        const up = all.filter((o) => G.climbs(S, o.k));
        const m = (up.length ? up : all).reduce((b, o) => (!b || pts(S, o) > pts(S, b) ? o : b), null);
        if (!m) break;
        const need = Math.max(0, T - S.score), share = need / Math.max(1, S.playsLeft);
        if (S.playsLeft > 1 && pts(S, m) < 0.55 * share && G.canDiscardAny(S) && discardStep(S)) continue;
        S.sel = m.idx.slice();
        if (!G.play(S)) { note(seed, "play() null with legal move ante " + S.ante); break; }
      }
      const r = G.finish(S);
      if (!r) { note(seed, "finish() returned null in phase round"); break; }
      if (!r.cleared) { deaths.push(S.ante); break; }
      if (r.won) { wins++; break; }
    }
    if (S.phase === "shop") {
      if (CHECK_SAVE) { const j = G.serialize(S); if (G.serialize(G.restore(j)) !== j) note(seed, "shop save not identity"); }
      // offers sanity
      S.offers.forEach((o) => {
        if (o.kind === "charm" && G.has(S, o.id)) note(seed, "offered a charm already held: " + o.id);
        if (o.kind === "up" && G.CFG.maxBuy[o.id] && (S.bought[o.id] || 0) >= G.CFG.maxBuy[o.id]) note(seed, "offered a maxed perk: " + o.id);
      });
      if (G.picksLeft(S) > 0 && S.offers.length === 0) note(seed, "shop has picks but no offers, ante " + S.ante);
      if (!shop(S)) { note(seed, "nextAnte failed, ante " + S.ante + " phase " + S.phase); break; }
      continue;
    }
    if (S.phase === "won" || S.phase === "lost") break;
  }
  if (guard >= 400) note(seed, "run did not terminate");
}
const q = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length * p)]; };
console.log("runs", N, "wins", wins, "p50 death ante", q(deaths, .5), "max", Math.max.apply(null, deaths.concat([0])));
console.log("violations", bad.length);
const seen = new Set();
bad.forEach((b) => { const k = b.replace(/^\w+\d+: /, "").replace(/\d+/g, "#"); if (!seen.has(k)) { seen.add(k); console.log("  " + b); } });
