/* smoke.js — γρήγορος έλεγχος ακεραιότητας μετά από αλλαγή κανόνων. Δεν μετρά ισορροπία:
   ψάχνει σπασίματα. node tools/smoke.js [N] */
const G = require("../site/raise/game.js");
const N = +process.argv[2] || 40;
let fails = 0;
const ok = (c, m) => { if (!c) { console.log("  ✗ " + m); fails++; } };
const pts = (S, o) => G.scoreOf(S, o.k, o.idx.map((i) => S.hand[i])).pts;

/* 1. Classic: κανένα softlock, κανένα NaN, save/restore σε κάθε φάση. */
for (let i = 0; i < N; i++) {
  const S = G.newRun("sm-" + i, G.CHARMS.map((c) => c.id));
  let guard = 0;
  for (; guard < 4000; guard++) {
    if (S.phase === "round") {
      const all = G.candidates(S);
      if (all.length && S.playsLeft > 0) {
        const up = all.filter((o) => G.climbs(S, o.k));
        const m = (up.length ? up : all).reduce((b, o) => (!b || pts(S, o) > pts(S, b) ? o : b), null);
        S.sel = m.idx.slice();
        const ev = G.play(S);
        ok(ev && isFinite(ev.pts) && ev.pts >= 0, "run " + i + " ante " + S.ante + ": bad pts " + (ev && ev.pts));
        ok(!ev || !ev.k || G.clabel(ev.k).length > 0, "run " + i + ": no label");
      } else if (G.canDiscardAny(S)) {
        const o = G.orphans(S); S.sel = (o.length ? o : S.hand.map((_, k) => k)).slice(0, 2);
        if (!G.discard(S)) { G.finish(S); }
      } else G.finish(S);
      /* save/restore στη μέση του γύρου */
      if (guard % 17 === 0) { const r = G.restore(G.serialize(S)); ok(!!r, "run " + i + ": restore failed mid-round"); }
      continue;
    }
    if (S.phase === "shop") {
      let spin = 0;
      while (G.picksLeft(S) > 0 && spin++ < 20) {
        const list = S.offers.map((o, k) => ({ o, k })).filter((x) => !x.o.bought && G.canTake(S, x.k).ok);
        if (!list.length) break;
        G.take(S, list[0].k);
      }
      const r = G.restore(G.serialize(S)); ok(!!r, "run " + i + ": restore failed in shop");
      ok(G.nextAnte(S), "run " + i + ": nextAnte refused");
      continue;
    }
    break;
  }
  ok(guard < 4000, "run " + i + ": Classic never terminated");
  ok(S.phase === "lost" || S.phase === "won", "run " + i + ": ended in " + S.phase);
}
/* 2. Survival: τελειώνει, το rung ανεβαίνει μόνο του, το beatText το λέει. */
let steepSeen = 0, textSeen = 0;
for (let i = 0; i < N; i++) {
  const S = G.newRun("sv-sm-" + i, [], "survival");
  let guard = 0, lastRung = null;
  for (; guard < 4000 && S.phase === "round"; guard++) {
    const all = G.candidates(S);
    if (!all.length) { if (G.canDiscardAny(S)) { const o = G.orphans(S); S.sel = (o.length ? o : S.hand.map((_, k) => k)).slice(0, 3); if (S.sel.length && G.discard(S)) continue; } break; }
    const up = all.filter((o) => G.climbs(S, o.k));
    const m = (up.length ? up : all)[0];
    S.sel = m.idx.slice();
    const want = G.rungAfter(S, m.k);
    const ev = G.play(S);
    ok(JSON.stringify(want) === JSON.stringify(S.rung), "surv " + i + ": rungAfter disagrees with play()");
    if (G.steepOf(S) > 0) { steepSeen++; if (G.beatText(S).indexOf("climbs") >= 0) textSeen++; }
    lastRung = S.rung;
    if (!ev || ev.last) break;
  }
  ok(guard < 4000, "surv " + i + ": never terminated");
  const r = G.restore(G.serialize(S)); ok(!!r, "surv " + i + ": restore failed");
  G.finish(S);
  ok(S.phase === "lost", "surv " + i + ": ended in " + S.phase);
  ok(S.score > 0, "surv " + i + ": zero score");
}
ok(steepSeen > 0, "το βουνό δεν έγινε ποτέ απότομο σε " + N + " runs");
ok(textSeen === steepSeen, "beatText δεν ανακοίνωσε την απότομη ανηφόρα " + textSeen + "/" + steepSeen);
/* 3. Κάθε charm και κάθε perk μπαίνει χωρίς να σκάσει. */
G.CHARMS.forEach((c) => {
  const S = G.newRun("chk-" + c.id, [c.id]); S.charms.push(c.id);
  const all = G.candidates(S); ok(all.length > 0, c.id + ": no candidates");
  const e = G.scoreOf(S, all[0].k, all[0].idx.map((i) => S.hand[i]));
  ok(isFinite(e.pts) && isFinite(e.mult), c.id + ": non-finite score");
  ok(c.desc.length > 10 && c.desc.length < 100, c.id + ": desc length " + c.desc.length);
});
G.POOL.forEach((o) => { const S = G.newRun("pk-" + o.id, []); G.applyFree(S, o.id); G.startRound(S); ok(G.candidates(S).length >= 0, o.id + ": broke"); });
console.log(fails ? "\n" + fails + " ΑΠΟΤΥΧΙΕΣ" : "smoke: όλα καθαρά (" + N + " Classic + " + N + " Survival runs, " + G.CHARMS.length + " charms, " + G.POOL.length + " perks)");
process.exit(fails ? 1 : 0);
