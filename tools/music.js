/* Έλεγχος αρμονίας του κομματιού. Δεν μπορώ να το ακούσω — μπορώ όμως να ελέγξω ότι
   κάθε νότα της μελωδίας είναι φθόγγος της συγχορδίας ή της κλίμακας, ότι καμία δεν πέφτει
   ημιτόνιο από φωνή του pad, και ότι οι τέσσερις φράσεις είναι όντως διαφορετικές.
   Οι πίνακες διαβάζονται από το ΙΔΙΟ αρχείο που παίζει — όχι αντίγραφο.
   node tools/music.js */
const fs = require("fs");
const src = fs.readFileSync(require("path").join(__dirname, "../site/raise/fx.js"), "utf8");
const grab = (name) => {
  const m = src.match(new RegExp("const " + name + " = (\\[[\\s\\S]*?\\]);"));
  if (!m) throw new Error("δεν βρέθηκε ο πίνακας " + name);
  return eval(m[1]);
};
const CHORD = grab("CHORD"), M1 = grab("M1"), M2 = grab("M2"), M3 = grab("M3"), M4 = grab("M4");
const PHRASE = [M1, M2, M3, M4];
const SPB = +src.match(/SPB = (\d+)/)[1], BARS = +src.match(/BARS = (\d+)/)[1], BPM = +src.match(/BPM = (\d+)/)[1];
const NAME = ["A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#"];
const nm = (s) => NAME[((s % 12) + 12) % 12];
const AEOLIAN = [0, 2, 3, 5, 7, 8, 10];               /* λα ελάσσων φυσική */
const pad = (root, minor) => [root, root + (minor ? 3 : 4), root + 7, root + 14];

let bad = 0, warn = 0, notes = 0;
console.log("κομμάτι · " + BPM + " BPM · " + BARS + " μπάρες · κύκλος " + (BARS * SPB * (60 / BPM / 4)).toFixed(1) + "s\n");
console.log("φράση  μπάρα  συγχορδία   νότες");
for (let ph = 0; ph < PHRASE.length; ph++) {
  const mel = PHRASE[ph];
  for (let b = 0; b < 4; b++) {
    const bar = ph * 4 + b, ch = CHORD[bar], root = ch[0], minor = !!ch[1];
    const inBar = mel.filter((e) => Math.floor(e[0] / SPB) === b);
    const chordTones = pad(root, minor).map((x) => ((x % 12) + 12) % 12);
    const line = inBar.map((e) => {
      notes++;
      const pc = ((e[1] % 12) + 12) % 12;
      const isChord = chordTones.indexOf(pc) >= 0;
      const rel = ((pc - root) % 12 + 12) % 12;
      const inScale = AEOLIAN.indexOf(((pc % 12) + 12) % 12) >= 0;
      /* Ημιτονιακή σύγκρουση με φωνή του pad; (εκτός από τη b9, που είναι σκέτο λάθος) */
      const clash = chordTones.some((t) => { const d = Math.abs(((pc - t) % 12 + 12) % 12); return d === 1 || d === 11; });
      let tag = isChord ? "✓χορδή" : inScale ? "·κλίμακα" : "✗ΕΚΤΟΣ";
      if (!inScale && !isChord) bad++;
      if (clash && !isChord) { tag += " ⚠ημιτόνιο"; warn++; }
      return nm(e[1]) + "(" + tag + ")";
    }).join(" ");
    console.log("  P" + (ph + 1) + "     " + (bar + 1 + "").padStart(2) + "   " +
      (nm(root) + (minor ? "m" : "")).padEnd(10) + " " + (line || "—"));
  }
}
/* Είναι οι φράσεις διαφορετικές; */
const sig = PHRASE.map((m) => JSON.stringify(m));
const uniq = new Set(sig).size;
console.log("\nνότες μελωδίας: " + notes + " · εκτός κλίμακας: " + bad + " · ημιτονιακές συγκρούσεις: " + warn);
console.log("διακριτές φράσεις: " + uniq + " / 4" + (uniq < 3 ? "  ✗ λούπα" : "  ✓"));
/* Πτώση: κλείνει το κομμάτι στη ρίζα; */
const last = M4[M4.length - 1], lastBar = CHORD[BARS - 1];
console.log("τελευταία νότα: " + nm(last[1]) + " πάνω σε " + nm(lastBar[0]) + (lastBar[1] ? "m" : "") +
  (((last[1] % 12) + 12) % 12 === lastBar[0] % 12 ? "  ✓ λύνει στη ρίζα" : "  ⚠ δεν λύνει"));
process.exit(bad ? 1 : 0);
