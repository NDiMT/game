const { G } = require("./bot.js");
/* enumerate every hand descriptor the engine can produce */
const HS = [];
for (let kind = 1; kind <= 9; kind++) {
  const K = G.KINDS[kind];
  const sizes = K.size ? [K.size] : kind === 3 || kind === 8 ? [4, 6, 8] : [5, 6, 7, 8, 9];
  for (const size of sizes) for (let rank = 2; rank <= 14; rank++) HS.push({ kind, rank, size });
}
let bad = [];
HS.forEach((a) => { if (G.beats(a, a)) bad.push("beats(a,a) true for " + JSON.stringify(a)); });
for (const a of HS) for (const b of HS) if (a !== b && G.beats(a, b) && G.beats(b, a)) bad.push("both beat: " + JSON.stringify(a) + " / " + JSON.stringify(b));
let tchecked = 0;
for (const a of HS) for (const b of HS) { if (!G.beats(a, b)) continue; for (const c of HS) { if (!G.beats(b, c)) continue; tchecked++; if (!G.beats(a, c)) { if (bad.length < 8) bad.push("not transitive: " + JSON.stringify(a) + " > " + JSON.stringify(b) + " > " + JSON.stringify(c)); } } }
let ties = 0;
for (const a of HS) for (const b of HS) if (a !== b && !G.beats(a, b) && !G.beats(b, a)) ties++;
console.log("descriptors", HS.length, "transitive triples", tchecked, "incomparable distinct pairs", ties);
console.log("ordering violations:", bad.length); bad.forEach((b) => console.log("  " + b));

console.log("\n--- caps");
const mk = (over) => Object.assign(G.newRun("caps", G.CHARMS.map((x) => x.id), "classic"), over);
function scoreWith(charms, cards, kind, rank, size, extra) {
  const S = mk(Object.assign({ charms: charms.slice(), rung: null, chain: 0, plays: 1, playsLeft: 5 }, extra || {}));
  return G.scoreOf(S, { kind, rank, size }, cards);
}
const c = (r, si, e) => ({ id: 1, r, si, e });
const noBomb = scoreWith(["summiteer", "mirror", "ember"], [c(9, 0), c(9, 1), c(9, 2), c(9, 3)], 6, 9, 4);
const plainQ = scoreWith([], [c(9, 0), c(9, 1), c(9, 2), c(9, 3)], 6, 9, 4);
console.log("quads + summiteer/mirror/ember (hmCap " + G.CFG.hmCap + "): mult", noBomb.mult, "|", noBomb.notes.join(" | "));
console.log("plain quads: mult", plainQ.mult, "|", plainQ.notes.join(" | "));
const golds = [c(14, 0, "gold"), c(14, 1, "gold"), c(14, 2, "gold")];
console.log("3 gold, no goldsmith:", scoreWith([], golds, 2, 14, 3).notes.join(" | "));
console.log("3 gold, goldsmith   :", scoreWith(["goldsmith"], golds, 2, 14, 3).notes.join(" | "));
const silv = [c(14, 0, "silver"), c(14, 1, "silver"), c(14, 2, "silver")];
console.log("3 silver, no goldsmith:", scoreWith([], silv, 2, 14, 3).notes.join(" | "));
console.log("3 silver, WITH goldsmith:", scoreWith(["goldsmith"], silv, 2, 14, 3).notes.join(" | "));
const cl = mk({ charms: ["climber", "patient"], chain: 20, rung: null, chainStart: 0 });
console.log("classic chain 21:", G.scoreOf(cl, { kind: 1, rank: 5, size: 2 }, [c(5, 0), c(5, 1)]).notes.join(" | "));
const sv = G.newRun("caps", [], "survival"); sv.chain = 20; sv.rung = null;
console.log("survival chain 21:", G.scoreOf(sv, { kind: 1, rank: 5, size: 2 }, [c(5, 0), c(5, 1)]).notes.join(" | "));

console.log("\n--- Ladder charm vs its desc");
function ladderTest(withLadder) {
  const S = mk({ charms: withLadder ? ["ladder"] : [], chain: 2, rung: { kind: 1, rank: 7, size: 2 }, chainStart: 0 });
  const e = G.scoreOf(S, { kind: 1, rank: 8, size: 2 }, [c(8, 0), c(8, 1)]);
  return { pos: e.pos, mult: e.mult, notes: e.notes.join(" | ") };
}
console.log("no ladder, +1 rank climb:", JSON.stringify(ladderTest(false)));
console.log("ladder,    +1 rank climb:", JSON.stringify(ladderTest(true)));
{
  const S = mk({ charms: ["ladder"], chain: 2, rung: { kind: 1, rank: 7, size: 2 }, chainStart: 0, playsLeft: 5, plays: 1, phase: "round" });
  S.hand = [{ id: 900, r: 8, si: 0 }, { id: 901, r: 8, si: 1 }]; S.sel = [0, 1];
  const before = S.chain; G.play(S);
  console.log("S.chain " + before + " -> " + S.chain + " after a Ladder climb; next chainPos = x" + G.chainPos(S));
}

console.log("\n--- Second Wind vs Afterburner hot flag");
{
  const S = mk({ charms: ["wind", "afterburner"], chain: 3, rung: { kind: 1, rank: 10, size: 2 }, phase: "round", playsLeft: 5, plays: 1 });
  S.hot = 1; S.breaks = 0;
  S.hand = [{ id: 900, r: 3, si: 0 }, { id: 901, r: 3, si: 1 }]; S.sel = [0, 1];
  G.play(S);
  console.log("break #1 with Second Wind: chain kept ->", S.chain, "| hot flag now:", S.hot);
}
console.log("\n--- Back Stairs, gap of 2 (its desc pays x1.5 for the TIGHT step)");
{
  const S = mk({ charms: ["ladder", "lowroad"], chain: 1, rung: { kind: 1, rank: 5, size: 2 }, chainStart: 0 });
  console.log("gap 2:", G.scoreOf(S, { kind: 1, rank: 7, size: 2 }, [c(7, 0), c(7, 1)]).notes.join(" | "));
  const S2 = mk({ charms: ["ladder", "lowroad"], chain: 1, rung: { kind: 1, rank: 5, size: 2 }, chainStart: 0 });
  console.log("gap 1:", G.scoreOf(S2, { kind: 1, rank: 6, size: 2 }, [c(6, 0), c(6, 1)]).notes.join(" | "));
}
