/* Συμφωνεί η σκάλα ΑΝΕΒΑΣΜΑΤΟΣ (beats) με τη σκάλα ΠΛΗΡΩΜΗΣ (scoreOf)?
   Κάθε ζευγάρι χεριών A, B όπου beats(A,B) αλλά pts(A) < pts(B) είναι προδοσία:
   ο παίκτης ανέβηκε σκαλί και πληρώθηκε λιγότερο. */
const G = require("../site/raise/game.js");
let uid = 0;
const c = (r, si) => ({ r: r, si: si, s: G.SUITS[si].s, red: G.SUITS[si].red, id: ++uid });

/* Κανονικά δείγματα κάθε (kind, size, rank) με πραγματικά φύλλα. */
function samples() {
  const out = [];
  const add = (cs) => { const k = G.classify(cs); if (k) out.push({ k: k, cs: cs }); };
  for (let r = 2; r <= 14; r++) {
    add([c(r, 0)]);                                        // single (μόνο άσος περνά)
    add([c(r, 0), c(r, 1)]);                               // pair
    add([c(r, 0), c(r, 1), c(r, 2)]);                      // trips
    add([c(r, 0), c(r, 1), c(r, 2), c(r, 3)]);             // quads
    for (let m = 2; m <= 4; m++) {                         // two pair / stairs, m ζευγάρια
      if (r - m + 1 < 2) continue;
      const cs = [], cs2 = [];
      for (let i = 0; i < m; i++) { cs.push(c(r - i, 0), c(r - i, 1)); }
      add(cs);
      /* μη-συνεχόμενα ζευγάρια → two pair αντί stairs */
      for (let i = 0; i < m; i++) { const rr = r - i * 2; if (rr < 2) break; cs2.push(c(rr, 0), c(rr, 1)); }
      if (cs2.length === m * 2) add(cs2);
    }
    if (r - 1 >= 2) add([c(r, 0), c(r, 1), c(r, 2), c(r - 1, 0), c(r - 1, 1)]);  // full
    for (let n = 5; n <= 8; n++) {                          // straight / straight flush
      if (r - n + 1 < 2) continue;
      const st = [], sf = [];
      for (let i = 0; i < n; i++) { st.push(c(r - i, i % 4)); sf.push(c(r - i, 0)); }
      add(st); add(sf);
    }
  }
  /* μοναδικά ανά (kind,size,rank) */
  const seen = {}, uniq = [];
  out.forEach((o) => { const key = o.k.kind + "/" + o.k.size + "/" + o.k.rank; if (!seen[key]) { seen[key] = 1; uniq.push(o); } });
  return uniq;
}

const S = G.newRun("ladder");
S.rung = null; S.chain = 0; S.charms = []; S.mult = {}; S.chainStart = 0; S.chainBonus = 0;
S.chals = []; S.rules = [];
const label = (k) => G.KINDS[k.kind].short + (k.size ? "" : "") + " " + k.size + "×" + G.rname(k.rank);

const all = samples().map((o) => {
  const e = G.scoreOf(S, o.k, o.cs);
  return { k: o.k, pts: e.pts, chips: e.chips, mult: e.mult, lab: label(o.k) };
});

let pairs = 0, bad = [];
for (const a of all) for (const b of all) {
  if (a === b) continue;
  if (!G.beats(a.k, b.k)) continue;
  pairs++;
  if (a.pts < b.pts) bad.push({ a: a, b: b, gap: b.pts - a.pts, rel: b.pts / a.pts });
}
bad.sort((x, y) => y.rel - x.rel);
console.log("δείγματα σχημάτων: " + all.length + " · ζεύγη όπου Α χτυπάει το Β: " + pairs);
console.log("ΠΡΟΔΟΣΙΕΣ (ανέβηκες και πλήρωσες λιγότερο): " + bad.length +
  "  (" + (100 * bad.length / pairs).toFixed(2) + "% των ζευγών)");
const shown = {};
bad.forEach((x) => {
  const key = G.KINDS[x.a.k.kind].short + ">" + G.KINDS[x.b.k.kind].short;
  shown[key] = (shown[key] || 0) + 1;
});
console.log("\nανά τύπο (χτυπά > χτυπημένο) : πόσα ζεύγη");
Object.keys(shown).sort((p, q) => shown[q] - shown[p]).forEach((k) => console.log("  " + k.padEnd(20) + shown[k]));
console.log("\nτα 14 χειρότερα:");
bad.slice(0, 14).forEach((x) => console.log("  " + x.a.lab.padEnd(16) + x.a.pts.toString().padStart(6) +
  "   χτυπάει   " + x.b.lab.padEnd(16) + x.b.pts.toString().padStart(6) + "   ×" + x.rel.toFixed(2)));

/* Και η καθαρή σκάλα: το ΕΛΑΧΙΣΤΟ και ΜΕΓΙΣΤΟ πληρωμής κάθε tier. */
console.log("\nσκάλα πληρωμής ανά tier (min–max πάνω σε όλα τα μεγέθη/αξίες):");
G.BY_TIER.forEach((K) => {
  const xs = all.filter((a) => a.k.kind === G.KINDS.findIndex((z) => z && z.id === K.id)).map((a) => a.pts);
  if (!xs.length) return;
  console.log("  t" + K.tier + " " + K.short.padEnd(8) + String(Math.min.apply(null, xs)).padStart(6) + " – " + String(Math.max.apply(null, xs)).padStart(6));
});
