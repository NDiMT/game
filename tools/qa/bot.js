/* shared bot: plays runs, records invariant violations */
const G = require("/home/user/game/site/raise/game.js");
const PRIO = "patient,court,kingmaker,mirror,climber,encore,loyal,lowroad,sleight,wind,ember,scout,leap,summiteer,cheap,goldsmith,ladder,afterburner,wi,pl,th,m2,cs,m1,gt,di".split(",");
const pts = (S, o) => G.scoreOf(S, o.k, o.idx.map((i) => S.hand[i])).pts;

function discardStep(S) {
  let o = G.orphans(S);
  if (!o.length) o = S.hand.map((_, i) => i).filter((i) => !S.hand[i].h && S.hand[i].r !== 14 && !G.isWild(S.hand[i])).slice(0, 2);
  if (!o.length) return false;
  S.sel = o.slice(0, Math.min(3, o.length));
  return G.discard(S);
}

/* Classic round bot */
function playRound(S, bug) {
  const T = G.target(S);
  for (let g = 0; g < 500 && S.phase === "round"; g++) {
    if (S.playsLeft < 1) break;
    if (S.score >= T) break;
    const all = G.candidates(S);
    if (!all.length) { if (G.canDiscardAny(S) && discardStep(S)) continue; break; }
    const up = all.filter((o) => G.climbs(S, o.k));
    const m = (up.length ? up : all).reduce((b, o) => (!b || pts(S, o) > pts(S, b) ? o : b), null);
    if (!m) break;
    const need = Math.max(0, T - S.score), share = need / Math.max(1, S.playsLeft);
    if (S.playsLeft > 1 && pts(S, m) < 0.55 * share && G.canDiscardAny(S) && discardStep(S)) continue;
    S.sel = m.idx.slice();
    if (!G.play(S)) { bug && bug("play() returned null with a legal move", S); break; }
  }
  return G.finish(S);
}

function shop(S) {
  for (let g = 0; g < 30; g++) {
    if (S.phase !== "shop") break;
    if (!G.picksLeft(S)) break;
    let bi = -1, br = 1e9;
    S.offers.forEach((o, i) => {
      if (!G.canTake(S, i).ok) return;
      const r = PRIO.indexOf(o.id) < 0 ? 99 : PRIO.indexOf(o.id);
      if (r < br) { br = r; bi = i; }
    });
    if (bi < 0) break;
    if (!G.take(S, bi)) break;
  }
  return G.nextAnte(S);
}

/* Survival bot following the game's own hint */
function survRun(S, bug, maxSteps) {
  maxSteps = maxSteps || 5000;
  let steps = 0;
  while (S.phase === "round" && steps++ < maxSteps) {
    if (G.stuck(S)) break;
    const s = G.suggest(S);
    if (s === null) {
      /* hint says breathe */
      let o = G.orphans(S);
      if (!o.length) o = S.hand.map((_, i) => i).filter((i) => !G.isWild(S.hand[i])).slice(0, 3);
      if (!o.length) o = [0];
      S.sel = o.slice(0, 3);
      if (!G.discard(S)) {
        /* fall back to playing something */
        const all = G.candidates(S);
        if (!all.length) break;
        S.sel = all[0].idx.slice();
        if (!G.play(S)) break;
      }
      continue;
    }
    S.sel = s.idx.slice();
    if (!G.play(S)) { bug && bug("survival play() null", S); break; }
  }
  return steps;
}

module.exports = { G, playRound, shop, discardStep, survRun, pts, PRIO };
