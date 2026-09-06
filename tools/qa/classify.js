/* classify() against an independent oracle.
   Oracle: enumerate every rank a Joker could take (suits are irrelevant to classify —
   a Joker matches any suit, and flushness is decided by the naturals), evaluate the
   resulting concrete multiset with plain Tichu rules, keep the best by (kbase, rank). */
const { G } = require("./bot.js");
const KINDS = G.KINDS;
const kbase = G.kbase;

/* concrete evaluation: ranks[] (all real), allSameSuit = naturals all one suit */
function concreteKinds(ranks, allSameSuit) {
  const n = ranks.length, out = [];
  const cnt = {}; ranks.forEach((r) => { cnt[r] = (cnt[r] || 0) + 1; });
  const rs = Object.keys(cnt).map(Number).sort((a, b) => a - b);
  const d = rs.length, lo = rs[0], hi = rs[d - 1], span = hi - lo + 1;
  const maxC = Math.max.apply(null, rs.map((r) => cnt[r]));
  if (n === 1) { if (ranks[0] === 14) out.push({ kind: 9, rank: 14, size: 1 }); return out; }
  if (n === 2 && d === 1) out.push({ kind: 1, rank: lo, size: 2 });
  if (n === 3 && d === 1) out.push({ kind: 2, rank: lo, size: 3 });
  if (n === 4 && d === 1) out.push({ kind: 6, rank: lo, size: 4 });
  if (n === 5 && d === 2) { rs.forEach((r) => { if (cnt[r] === 3 && cnt[rs[0] === r ? rs[1] : rs[0]] === 2) out.push({ kind: 5, rank: r, size: 5 }); }); }
  /* pairs: n/2 pairs at n/2 distinct ranks, any ranks */
  if (n >= 4 && n % 2 === 0 && n <= 8 && d === n / 2 && maxC === 2) out.push({ kind: 8, rank: hi, size: n });
  /* stairs: n/2 consecutive pairs */
  if (n >= 4 && n % 2 === 0 && d === n / 2 && maxC === 2 && span === n / 2) out.push({ kind: 3, rank: hi, size: n });
  /* straight / straight flush: n>=5 distinct consecutive */
  if (n >= 5 && maxC === 1 && span === n && lo >= 2) {
    out.push({ kind: 4, rank: hi, size: n });
    if (allSameSuit) out.push({ kind: 7, rank: hi, size: n });
  }
  return out;
}

function oracle(cs) {
  const nat = cs.filter((c) => c.e !== "wild");
  const w = cs.length - nat.length;
  const natRanks = nat.map((c) => c.r);
  const allSame = nat.length === 0 || nat.every((c) => c.si === nat[0].si);
  let best = null;
  const consider = (k) => { if (!best || kbase(k) > kbase(best) || (kbase(k) === kbase(best) && k.rank > best.rank)) best = k; };
  /* single joker alone is an Ace */
  if (cs.length === 1) { if (natRanks[0] === 14 || w === 1) return { kind: 9, rank: 14, size: 1 }; return null; }
  const assign = (i, acc) => {
    if (i === w) { concreteKinds(natRanks.concat(acc), allSame).forEach(consider); return; }
    for (let r = 2; r <= 14; r++) assign(i + 1, acc.concat([r]));
  };
  assign(0, []);
  return best;
}

const eq = (a, b) => (!a && !b) || (!!a && !!b && a.kind === b.kind && a.rank === b.rank && a.size === b.size);

/* random hands */
function deck(nj) {
  const d = [];
  let id = 1;
  for (let r = 2; r <= 14; r++) for (let si = 0; si < 4; si++) d.push({ id: id++, r, si });
  for (let j = 0; j < nj; j++) d.push({ id: id++, r: 0, si: j % 4, e: "wild" });
  return d;
}
let rng = 12345;
const rnd = () => { rng = (rng * 1103515245 + 12345) & 0x7fffffff; return rng / 0x7fffffff; };

let mism = [], tested = 0;
const MAXW = 3; /* oracle is 13^w */
for (let trial = 0; trial < 250000; trial++) {
  const nj = Math.floor(rnd() * 5);
  const d = deck(nj);
  const n = 1 + Math.floor(rnd() * 8);
  const pick = [];
  const used = new Set();
  while (pick.length < n) { const i = Math.floor(rnd() * d.length); if (used.has(i)) continue; used.add(i); pick.push(d[i]); }
  const w = pick.filter((c) => c.e === "wild").length;
  if (w > MAXW) continue;
  tested++;
  const got = G.classify(pick), want = oracle(pick);
  if (!eq(got, want)) {
    if (mism.length < 60) mism.push({ cards: pick.map((c) => (c.e === "wild" ? "W" : G.rname(c.r) + "shdc"[c.si])).join(" "), got, want });
  }
}
/* also structured sweeps: every multiset of ranks up to size 6 from a small alphabet + jokers */
function sweep() {
  const alpha = [2, 3, 4, 5, 6, 13, 14];
  const out = [];
  const rec = (acc, start) => {
    if (acc.length >= 1 && acc.length <= 6) out.push(acc.slice());
    if (acc.length === 6) return;
    for (let i = start; i < alpha.length; i++) for (let c = 1; c <= 4 && acc.filter((r) => r === alpha[i]).length + c <= 4; c++) rec(acc.concat(Array(c).fill(alpha[i])), i + 1);
  };
  rec([], 0);
  return out;
}
let sm = 0, st = 0;
for (const ranks of sweep()) {
  for (let nw = 0; nw <= 2; nw++) {
    if (ranks.length + nw > 8 || ranks.length + nw < 1) continue;
    for (const flush of [true, false]) {
      const cs = ranks.map((r, i) => ({ id: i + 1, r, si: flush ? 0 : i % 4 }));
      for (let j = 0; j < nw; j++) cs.push({ id: 100 + j, r: 0, si: 0, e: "wild" });
      st++;
      const got = G.classify(cs), want = oracle(cs);
      if (!eq(got, want)) { sm++; if (mism.length < 60) mism.push({ cards: ranks.map(G.rname).join(",") + (flush ? " flush" : "") + " +" + nw + "W", got, want }); }
    }
  }
}
console.log("random hands tested:", tested, "sweep:", st);
console.log("mismatches:", mism.length, "(sweep", sm + ")");
const byKey = {};
mism.forEach((m) => {
  const k = (m.got ? m.got.kind + "/" + m.got.size : "null") + " -> want " + (m.want ? m.want.kind + "/" + m.want.size : "null");
  (byKey[k] = byKey[k] || []).push(m);
});
Object.keys(byKey).forEach((k) => {
  const e = byKey[k][0];
  console.log("  [" + byKey[k].length + "] " + k + "  e.g. " + e.cards + "  got=" + JSON.stringify(e.got) + " want=" + JSON.stringify(e.want));
});
