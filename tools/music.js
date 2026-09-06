/* Έλεγχος αρμονίας του κομματιού. Δεν μπορώ να το ακούσω — μπορώ όμως να ελέγξω ότι:
     · κάθε νότα της μελωδίας είναι φθόγγος της συγχορδίας ή της κλίμακας της μπάρας της
     · καμία δεν πέφτει ημιτόνιο από φωνή του pad που ηχεί ΤΑΥΤΟΧΡΟΝΑ
     · κάθε νότα του arp είναι φθόγγος της συγχορδίας
     · τα τέσσερα μέρη είναι όντως διαφορετικά (και το arp τους, και η μελωδία τους)
     · η φόρμα κλείνει στη ρίζα
     · το arp χτυπά σε ΚΑΘΕ δέκατο-έκτο στα μέρη A/B/A΄ (αυτό είναι το synthwave)
   Οι πίνακες διαβάζονται από το ΙΔΙΟ αρχείο που παίζει — όχι αντίγραφο.
   node tools/music.js */
const fs = require("fs");
const src = fs.readFileSync(require("path").join(__dirname, "../site/raise/fx.js"), "utf8");
const grab = (name) => {
  const m = src.match(new RegExp("const " + name + " = (\\[[\\s\\S]*?\\]);"));
  if (!m) throw new Error("δεν βρέθηκε ο πίνακας " + name);
  return eval(m[1]);
};
const num = (name) => { const m = src.match(new RegExp(name + " = ([\\d.]+)")); if (!m) throw new Error("δεν βρέθηκε " + name); return +m[1]; };

const INTRO = grab("INTRO"), VA = grab("VA"), VB = grab("VB"), VC = grab("VC");
const CHORD = [].concat(INTRO, VA, VA, VB, VB, VC, VC);
const SECT = grab("SECT");
const ARP = [grab("ARP_I"), grab("ARP_A"), grab("ARP_B"), grab("ARP_C")];
const PHRASE = [grab("M_I"), grab("M_A"), grab("M_B"), grab("M_C")];
const BPM = num("BPM"), SPB = num("SPB"), BARS = CHORD.length;
/* Τα δύο lambdas που ορίζουν τη φωνή — τα διαβάζουμε από την πηγή και τα τρέχουμε,
   ώστε ο έλεγχος να μη μπορεί να ξεσυγχρονιστεί από τον κώδικα που παίζει. */
const ARPV = eval(src.match(/const ARPV = (\(minor\) => \[[^\]]*\]);/)[1]);
const padVoices = eval("(" + src.match(/(function padVoices\(root, minor\) \{[^}]*\})/)[1] + ")");

const NAME = ["A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#"];
const pc = (s) => ((s % 12) + 12) % 12;
const nm = (s) => NAME[pc(s)];
const AEOLIAN = [0, 2, 3, 5, 7, 8, 10];               /* λα ελάσσων φυσική */
const SNAME = ["intro", "A", "B", "A'"];
const STEP = 60 / BPM / 4, CYCLE = BARS * SPB;

let bad = 0, clash = 0, notes = 0, arpBad = 0, arpNotes = 0;
console.log("κομμάτι · " + BPM + " BPM · " + BARS + " μπάρες · κύκλος " +
  (CYCLE * STEP).toFixed(1) + "s · βήμα " + (STEP * 1000).toFixed(1) + "ms");
console.log("φόρμα: " + SECT.map((s, i) => SNAME[i] + " " + s[1] + "μπ (μπάρα " + (s[0] + 1) + ")").join(" → ") + "\n");

/* ---- μελωδία, νότα-νότα ---- */
console.log("μέρος μπάρα συγχορδία  μελωδία");
for (let s = 0; s < SECT.length; s++) {
  const mel = PHRASE[s], first = SECT[s][0], len = SECT[s][1];
  for (let b = 0; b < len; b++) {
    const bar = first + b, ch = CHORD[bar], root = ch[0], minor = !!ch[1];
    const padPc = padVoices(root, minor).map(pc);
    const inBar = mel.filter((e) => Math.floor(e[0] / SPB) === b);
    const line = inBar.map((e) => {
      notes++;
      const p = pc(e[1]);
      const isChord = padPc.indexOf(p) >= 0;
      const inScale = AEOLIAN.indexOf(p) >= 0;
      /* Ημιτόνιο από φωνή του pad που ηχεί την ίδια στιγμή; */
      const semi = padPc.some((t) => { const d = pc(p - t); return d === 1 || d === 11; });
      let tag = isChord ? "✓χορδή" : inScale ? "·κλίμακα" : "✗ΕΚΤΟΣ";
      if (!inScale && !isChord) bad++;
      if (semi && !isChord) { tag += " ⚠ημιτόνιο"; clash++; }
      return nm(e[1]) + (Math.floor((69 + e[1]) / 12) - 1) + "(" + tag + ")";
    }).join(" ");
    if (line) console.log("  " + SNAME[s].padEnd(5) + " " + (bar + 1 + "").padStart(2) + "  " +
      (nm(root) + (minor ? "m" : "")).padEnd(9) + "  " + line);
  }
}

/* ---- arp: κάθε νότα φθόγγος της συγχορδίας, και πυκνότητα ανά μπάρα ---- */
console.log("\narp");
for (let s = 0; s < SECT.length; s++) {
  const pat = ARP[s], hits = pat.filter((x) => x >= 0).length;
  for (let b = 0; b < SECT[s][1]; b++) {
    const c2 = CHORD[SECT[s][0] + b], r = c2[0], v = ARPV(!!c2[1]);
    for (let k = 0; k < pat.length; k++) if (pat[k] >= 0) {
      arpNotes++;
      const p = pc(r + 12 + v[pat[k]]);
      const chordPc = padVoices(r, !!c2[1]).map(pc);
      if (chordPc.indexOf(p) < 0) { arpBad++; console.log("  ✗ μπάρα " + (SECT[s][0] + b + 1) + " βήμα " + k + " → " + nm(p)); }
    }
  }
  console.log("  " + SNAME[s].padEnd(5) + " μοτίβο [" + pat.join(",") + "] · " + hits + "/16 χτυπήματα ανά μπάρα" +
    (hits === 16 ? "  ✓ γεμάτα δεκαέκτατα" : hits === 8 ? "  · όγδοα" : "  ⚠"));
}

/* ---- διαφορές μεταξύ μερών (γιατί αλλιώς είναι λούπα) ---- */
const mSig = PHRASE.map((m) => JSON.stringify(m)), aSig = ARP.map((a) => a.join(","));
const cSig = SECT.map((s) => CHORD.slice(s[0], s[0] + s[1]).map((c) => c[0] + (c[1] ? "m" : "")).join(" "));
console.log("\nμέρη: μελωδίες " + new Set(mSig).size + "/4 διακριτές · μοτίβα arp " +
  new Set(aSig).size + "/4 · αρμονίες " + new Set(cSig).size + "/4");
SECT.forEach((s, i) => console.log("  " + SNAME[i].padEnd(5) + " " + cSig[i]));

/* ---- πτώση ---- */
const mc = PHRASE[3], lastNote = mc[mc.length - 1], lastBar = CHORD[BARS - 1];
const resolves = pc(lastNote[1]) === pc(lastBar[0]);
console.log("\nτελευταία νότα: " + nm(lastNote[1]) + " πάνω σε " + nm(lastBar[0]) + (lastBar[1] ? "m" : "") +
  (resolves ? "  ✓ λύνει στη ρίζα" : "  ⚠ δεν λύνει"));

/* ---- σύνολο ---- */
console.log("\nνότες μελωδίας " + notes + " · εκτός κλίμακας " + bad + " · ημιτονιακές συγκρούσεις " + clash);
console.log("νότες arp " + arpNotes + " · εκτός συγχορδίας " + arpBad);
const fail = bad || clash || arpBad || new Set(mSig).size < 4 || new Set(aSig).size < 4 || !resolves;
console.log(fail ? "\n✗ ΑΠΟΤΥΧΙΑ" : "\n✓ όλα καθαρά");
process.exit(fail ? 1 : 0);
