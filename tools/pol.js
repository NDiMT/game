/* pol.js — paired policy comparison on identical seeds.
   node tools/pol.js [N] [pol1,pol2,...]
   Prints mean death ante, paired Δ vs the first policy, and its standard error. */
const G = require("../site/raise/game.js");
const N = +process.argv[2] || 500;
const WANT = (process.argv[3] || "builder,greedy,bomb,ascend,plan,cheapfirst").split(",");
const ALL = G.CHARMS.map((c) => c.id);
const PRIO = ["climber", "patient", "ladder", "leap", "scout", "lowroad", "mirror", "encore", "afterburner", "kingmaker", "court", "loyal", "sleight", "cheap", "wind", "ember", "goldsmith", "summiteer",
  "pl", "m1", "cs", "di", "wi", "m2", "th", "gt"];
const pts = (S, o) => G.scoreOf(S, o.k, o.idx.map((i) => S.hand[i])).pts;
const costKey = (k) => G.KINDS[k.kind].tier * 10000 + k.size * 100 + k.rank;

function discardStep(S) {
  let o = G.orphans(S);
  if (!o.length) o = S.hand.map((_, i) => i).filter((i) => !S.hand[i].h && S.hand[i].r !== 14 && !G.isWild(S.hand[i])).slice(0, 2);
  if (!o.length) return false;
  S.sel = o.slice(0, Math.min(3, o.length)); return G.discard(S);
}
/* Πόσα σκαλιά μπορεί ακόμη να ανέβει το χέρι μετά από αυτή την κίνηση (greedy, ίδια φύλλα). */
function chainAfter(S, c, all) {
  const used = new Set(c.idx); let cur = c.k, len = 0;
  for (;;) {
    let nx = null;
    all.forEach((o) => { if (!G.beats(o.k, cur) || o.idx.some((i) => used.has(i))) return; if (!nx || costKey(o.k) < costKey(nx.k)) nx = o; });
    if (!nx) break;
    nx.idx.forEach((i) => used.add(i)); cur = nx.k; len++;
  }
  return len;
}
const POLS = {
  /* η τρέχουσα «σωστή» πολιτική: το μεγαλύτερο σχήμα που ανεβαίνει */
  builder: (S, all, up) => (up.length ? up : all).reduce((b, o) => (!b || pts(S, o) > pts(S, b) ? o : b), null),
  /* αγνοεί τελείως την αλυσίδα */
  greedy: (S, all) => all.reduce((b, o) => (!b || pts(S, o) > pts(S, b) ? o : b), null),
  /* βόμβα όποτε υπάρχει (ανοίγει το τραπέζι) */
  bomb: (S, all, up) => {
    const b = all.filter((o) => G.isBomb(o.k));
    if (b.length) return b.reduce((x, o) => (!x || pts(S, o) > pts(S, x) ? o : x), null);
    return (up.length ? up : all).reduce((x, o) => (!x || pts(S, o) > pts(S, x) ? o : x), null);
  },
  /* ανεβαίνει με τη σειρά: κρατά όσο πιο χαμηλά γίνεται για να χωρέσουν κι άλλα σκαλιά,
     αρκεί το χέρι να βγάζει το μερίδιό του */
  ascend: (S, all, up) => {
    const pool = up.length ? up : all;
    const need = Math.max(0, G.target(S) - S.score), share = need / Math.max(1, S.playsLeft);
    const ok = pool.filter((o) => pts(S, o) >= share);
    if (ok.length) return ok.reduce((b, o) => (!b || costKey(o.k) < costKey(b.k) ? o : b), null);
    return pool.reduce((b, o) => (!b || pts(S, o) > pts(S, b) ? o : b), null);
  },
  /* πόντοι τώρα, σταθμισμένοι με τα σκαλιά που μένουν διαθέσιμα μετά */
  plan: (S, all, up) => {
    const pool = up.length ? up : all;
    if (pool.length === 1) return pool[0];
    return pool.reduce((b, o) => {
      const kv = pts(S, o) * (1 + 0.22 * Math.min(3, chainAfter(S, o, all)));
      if (!b) { o._v = kv; return o; }
      return kv > b._v ? (o._v = kv, o) : b;
    }, null);
  },
  /* ΑΚΡΙΒΩΣ ό,τι δείχνει το κουμπί Hint του UI (ui.js doHint → G.suggest) */
  hint: (S) => G.suggest(S),
  /* το φθηνότερο που ανεβαίνει */
  cheapfirst: (S, all, up) => (up.length ? up : all).reduce((b, o) => (!b || costKey(o.k) < costKey(b.k) ? o : b), null),
};

function playRound(S, pol) {
  const T = G.target(S);
  for (let guard = 0; guard < 300 && S.phase === "round"; guard++) {
    if (S.playsLeft < 1) break;
    const all = G.candidates(S);
    if (!all.length) { if (G.canDiscardAny(S) && discardStep(S)) continue; break; }
    const up = all.filter((o) => G.climbs(S, o.k));
    const m = POLS[pol](S, all, up);
    if (!m) break;
    const need = Math.max(0, T - S.score), share = need / Math.max(1, S.playsLeft);
    if (S.playsLeft > 1 && pts(S, m) < 0.55 * share && G.canDiscardAny(S) && discardStep(S)) continue;
    S.sel = m.idx.slice();
    const ev = G.play(S);
    if (ev.cleared) break;
  }
  if (S.phase === "round") G.finish(S);
}
function shop(S) {
  if (!S.offers.length) { G.nextAnte(S); return; }
  while (G.picksLeft(S) > 0) {
    const list = S.offers.map((o, i) => ({ o, i })).filter((x) => !x.o.bought && G.canTake(S, x.i).ok);
    if (!list.length) break;
    const ch = list.slice().sort((a, b) => PRIO.indexOf(a.o.id) - PRIO.indexOf(b.o.id))[0];
    G.take(S, ch.i);
  }
  G.nextAnte(S);
}
function run(seed, pol) {
  const S = G.newRun(seed, ALL);
  for (;;) {
    playRound(S, pol);
    if (S.phase === "lost") return S.ante + 1;
    if (S.phase === "won") return G.TARGETS.length + 1;
    shop(S);
  }
}
const res = {};
WANT.forEach((p) => { res[p] = []; });
for (let s = 0; s < N; s++) WANT.forEach((p) => res[p].push(run("st-" + s, p)));
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const base = res[WANT[0]];
console.log("N " + N + " · paired on identical seeds · base = " + WANT[0]);
console.log("policy".padEnd(12) + "mean".padStart(8) + "Δ".padStart(8) + "±SE".padStart(7) + "  wins");
WANT.forEach((p) => {
  const d = res[p].map((x, i) => x - base[i]);
  const m = mean(d), sd = Math.sqrt(mean(d.map((x) => (x - m) * (x - m))));
  const w = res[p].filter((x) => x > G.TARGETS.length).length;
  console.log(p.padEnd(12) + mean(res[p]).toFixed(2).padStart(8) + (m >= 0 ? "+" : "") + m.toFixed(2).padStart(7) + (sd / Math.sqrt(N)).toFixed(2).padStart(7) + String(w).padStart(6));
});
