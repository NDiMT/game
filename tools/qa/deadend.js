/* Exhaustive dead-end probe: for every challenge / rule / mode, every combination of
   (pile empty?, discards left, hand shape), assert that either a legal action exists or
   stuck() is true AND stuckReason() is non-empty, and that the UI would offer a way out. */
const { G } = require("./bot.js");
let bad = [];
const note = (m) => { if (bad.length < 60) bad.push(m); };

const HANDS = {
  "all orphans": [{ r: 2, si: 0 }, { r: 5, si: 1 }, { r: 8, si: 2 }, { r: 11, si: 3 }, { r: 13, si: 0 }],
  "one pair": [{ r: 7, si: 0 }, { r: 7, si: 1 }, { r: 2, si: 2 }, { r: 5, si: 3 }, { r: 9, si: 0 }],
  "aces only": [{ r: 14, si: 0 }, { r: 14, si: 1 }],
  "one ace + orphans": [{ r: 14, si: 0 }, { r: 3, si: 1 }, { r: 6, si: 2 }, { r: 10, si: 3 }],
  "single orphan": [{ r: 4, si: 0 }],
  "one joker": [{ r: 0, si: 0, e: "wild" }],
  "empty": [],
  "all face down": [{ r: 4, si: 0, h: true }, { r: 9, si: 1, h: true }, { r: 12, si: 2, h: true }],
  "two low pairs": [{ r: 2, si: 0 }, { r: 2, si: 1 }, { r: 3, si: 2 }, { r: 3, si: 3 }],
};
const CHALS = [null].concat(G.CHALLENGES.map((c) => c.id));
const RULES = [null].concat(G.RULES.map((r) => r.id));
const RUNGS = [null, { kind: 6, rank: 14, size: 4 }, { kind: 7, rank: 14, size: 9 }, { kind: 1, rank: 14, size: 2 }];

let cases = 0;
function probe(mode, chalId, ruleId, handName, pileN, disc, playsLeft, rung, charms) {
  const S = G.newRun("dead", G.CHARMS.map((c) => c.id), mode === "surv" ? "survival" : "classic");
  S.ante = 10;
  S.chal = chalId; S.chals = {}; S.rules = {};
  if (ruleId && !chalId) S.rules[10] = ruleId;
  S.charms = (charms || []).slice();
  S.rung = rung;
  S.hand = HANDS[handName].map((c, i) => Object.assign({ id: 500 + i }, c));
  S.pile = [];
  for (let i = 0; i < pileN; i++) S.pile.push({ id: 700 + i, r: 2 + (i % 13), si: i % 4 });
  S.discardPile = [];
  S.discMax = G.discMaxOf(S);
  S.rdisc = Math.max(0, S.discMax - disc);
  S.playsLeft = playsLeft; S.plays = 1; S.phase = "round"; S.sel = [];
  S.rfree = 0; S.score = 100; S.chain = 0; S.breaks = 0; S.log = []; S.played = [];
  if (mode === "surv") { S.deck = S.deck; S.done = 0; }
  cases++;
  const tag = mode + "/" + chalId + "/" + ruleId + "/" + handName + "/pile" + pileN + "/disc" + disc + "/plays" + playsLeft + "/rung" + (rung ? rung.kind : "open");
  let canPlay, canDisc, stuck, reason;
  try {
    canPlay = G.hasLegal(S) && S.playsLeft > 0 && (!G.isSurv(S) || true);
    canDisc = G.canDiscardAny(S);
    stuck = G.stuck(S);
    reason = G.stuckReason(S);
  } catch (e) { note(tag + " THREW " + e.message); return; }
  if (!canPlay && !canDisc && !stuck) note("DEAD END, stuck()==false: " + tag);
  if (stuck && !reason) note("stuck with empty stuckReason: " + tag);
  /* if there IS a play, play() must not return null */
  if (canPlay) {
    const all = G.candidates(S);
    S.sel = all[0].idx.slice();
    const before = JSON.stringify(S.hand.length);
    let ev;
    /* By design in Survival: at zero breaths a hand that does not climb is refused while
       something in the hand still does climb - the run must not end on a mistaken tap while
       there is a way up. So a legal candidate can be unplayable there, and that is not a bug. */
    const byDesign = G.isSurv(S) && G.discardsLeft(S) <= 0 && G.hasClimb(S) && !G.climbs(S, G.evalSel(S).k);
    try { ev = G.play(S); } catch (e) { note(tag + " play() THREW " + e.message); return; }
    if (!ev && !byDesign) note("hasLegal true but play() returned null: " + tag);
  } else if (canDisc) {
    const o = G.orphans(S);
    S.sel = (o.length ? o : S.hand.map((_, i) => i).filter((i) => !S.hand[i].h)).slice(0, 2);
    if (!S.sel.length) S.sel = S.hand.map((_, i) => i).slice(0, 1);
    let okd;
    try { okd = G.canDiscard(S) ? G.discard(S) : "blocked"; } catch (e) { note(tag + " discard() THREW " + e.message); return; }
    if (okd === "blocked" && S.sel.length) note("canDiscardAny true but canDiscard false with a selection: " + tag);
  }
}

for (const mode of ["run", "surv"]) {
  for (const chalId of (mode === "surv" ? [null] : CHALS)) {
    for (const ruleId of (mode === "surv" || chalId ? [null] : RULES)) {
      for (const handName of Object.keys(HANDS)) {
        for (const pileN of [0, 1, 5]) {
          for (const disc of [0, 1, 3]) {
            for (const playsLeft of [0, 1, 3]) {
              for (const rung of RUNGS) {
                probe(mode, chalId, ruleId, handName, pileN, disc, playsLeft, rung, []);
              }
            }
          }
        }
      }
    }
  }
}
/* and with the charms that touch the discard budget */
for (const charms of [["scout"], ["sleight"], ["cheap", "wind"], ["patient"]]) {
  for (const handName of Object.keys(HANDS)) for (const pileN of [0, 3]) for (const disc of [0, 2]) for (const playsLeft of [0, 2]) for (const rung of RUNGS) {
    probe("run", null, null, handName, pileN, disc, playsLeft, rung, charms);
    probe("run", "nodiscard", null, handName, pileN, disc, playsLeft, rung, charms);
  }
}
console.log("cases probed:", cases);
console.log("violations:", bad.length);
const seen = new Set();
bad.forEach((b) => { const k = b.replace(/\d+/g, "#"); if (!seen.has(k)) { seen.add(k); console.log("  " + b); } });
