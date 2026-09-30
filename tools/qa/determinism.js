/* RNG determinism: same seed -> byte-identical run, and identical across serialize/restore */
const { G, pts, PRIO } = require("./bot.js");
const N = +process.argv[2] || 40;
let bad = [];

function step(S) {
  /* fully deterministic policy, no Math.random */
  if (S.phase === "round") {
    const T = G.target(S);
    if (S.playsLeft < 1 || (S.score >= T && !G.isSurv(S))) return G.finish(S) ? "finish" : "stop";
    const all = G.candidates(S);
    if (!all.length) {
      if (G.canDiscardAny(S)) { const o = G.orphans(S); S.sel = (o.length ? o : [0]).slice(0, 3); if (G.discard(S)) return "disc"; }
      return G.finish(S) ? "finish" : "stop";
    }
    const up = all.filter((o) => G.climbs(S, o.k));
    const m = (up.length ? up : all).reduce((b, o) => (!b || pts(S, o) > pts(S, b) ? o : b), null);
    S.sel = m.idx.slice();
    if (!G.play(S)) return "stop";
    if (G.isSurv(S) && G.stuck(S)) return G.finish(S) ? "finish" : "stop";
    return "play";
  }
  if (S.phase === "shop") {
    let guard = 0;
    while (G.picksLeft(S) && guard++ < 20) {
      let bi = -1, br = 1e9;
      S.offers.forEach((o, i) => { if (!G.canTake(S, i).ok) return; const r = PRIO.indexOf(o.id) < 0 ? 99 : PRIO.indexOf(o.id); if (r < br) { br = r; bi = i; } });
      if (bi < 0) break;
      G.take(S, bi);
    }
    return G.nextAnte(S) ? "next" : "stop";
  }
  return "stop";
}

function runTrace(seed, deck, roundTrip) {
  let S = G.newRun(seed, G.CHARMS.map((c) => c.id), deck);
  const trace = [];
  for (let i = 0; i < 3000; i++) {
    if (roundTrip) { const j = G.serialize(S); const R = G.restore(j); if (!R) { trace.push("RESTORE-FAIL@" + S.phase); break; } S = R; }
    const r = step(S);
    trace.push(r + "|" + S.phase + "|" + S.ante + "|" + S.score + "|" + S.rng);
    if (r === "stop" || S.phase === "lost" || S.phase === "won") break;
  }
  return trace.join("\n") + "\nFINAL:" + G.serialize(S);
}

for (let i = 0; i < N; i++) {
  for (const deck of ["classic", "wild", "survival"]) {
    const seed = "d" + i;
    const a = runTrace(seed, deck, false);
    const b = runTrace(seed, deck, false);
    if (a !== b) bad.push(deck + " " + seed + ": two identical runs diverged");
    const c = runTrace(seed, deck, true);
    if (a !== c) {
      let k = 0; const A = a.split("\n"), C = c.split("\n");
      while (k < Math.min(A.length, C.length) && A[k] === C[k]) k++;
      bad.push(deck + " " + seed + ": serialize/restore diverged at step " + k + "\n    plain: " + (A[k] || "<end>") + "\n    rt   : " + (C[k] || "<end>"));
    }
  }
}
console.log("determinism violations:", bad.length);
bad.slice(0, 12).forEach((b) => console.log("  " + b));
