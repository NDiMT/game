/* variant.js — ζευγαρωμένη μέτρηση ΠΑΡΑΛΛΑΓΩΝ ΚΩΔΙΚΑ, όχι μόνο τιμών CFG.
   Το paired.js συγκρίνει δύο CFG· εδώ χρειάζεται να ΜΕΤΑΚΙΝΗΘΟΥΝ ΓΡΑΜΜΕΣ: πού μπαίνει το
   Patient σε σχέση με την αλυσίδα, τι ΣΧΗΜΑ έχει η οροφή των ενισχύσεων. Η παραλλαγή
   γράφεται σε ΑΝΤΙΓΡΑΦΟ του game.js σε προσωρινό φάκελο και φορτώνεται από εκεί — το
   πραγματικό αρχείο δεν αγγίζεται ποτέ.

   Οι παραλλαγές εκφράζονται ως ΔΙΑΦΟΡΕΣ ΑΠΟ ΟΤΙ ΠΑΙΖΕΙ ΣΗΜΕΡΑ, και το `old` γυρίζει και τα
   δύο πίσω (Patient +3 ώς +9 · σκληρή οροφή 3/6), οπότε κάθε γραμμή διαβάζεται ζευγαρωμένη
   έναντι του σημερινού κώδικα. Ίδιο πρωτόκολλο με το audit2.js — ίδια seeds, ίδια πολιτική,
   ίδιο PRIO — ώστε τα Δ να συγκρίνονται απευθείας με τον πίνακα charms.

     node tools/variant.js [N] [variant,variant,…] [top|all|curve|pair]
       top   : baseline + Patient + οι 3 επόμενοι (γρήγορο, για σαρώσεις)
       all   : και τα 18 charms (για τα φιναλίστ — εδώ φαίνεται αν κάποιο πέσει ≤ 0)
       curve : μόνο το baseline — νίκες, ποσοστημόρια θανάτου, νεκρά Gold
       pair  : υπέρβαση προσθετικότητας σε επιλεγμένα ζευγάρια charms
     SEED=st- node tools/variant.js 400 old curve      (τα seeds του tune.js)
     node tools/variant.js list                        τυπώνει τις παραλλαγές
*/
const fs = require("fs"), path = require("path");
const SRCPATH = path.join(__dirname, "..", "site", "raise", "game.js");
const SRC = fs.readFileSync(SRCPATH, "utf8");
const TMP = path.join(process.env.TMPDIR || "/tmp", "raise-variants");

/* ---- άγκυρες μέσα στο scoreOf. Αν αλλάξει η γραμμή, το εργαλείο ΣΤΑΜΑΤΑ αντί να ψευτομετρήσει. ---- */
const line = (needle) => {
  const i = SRC.indexOf(needle);
  if (i < 0) throw new Error("δεν βρέθηκε η άγκυρα: " + needle);
  const a = SRC.lastIndexOf("\n", i) + 1, b = SRC.indexOf("\n", i) + 1;
  return SRC.slice(a, b);
};
const L_PAT = line('if (has(S, "patient")) { const d = Math.min(CFG.patientCap');
const L_CHAIN = line("if (steps) { mult = roundMult(mult * chainMul);");
const L_ECAP = line('const ecap = has(S, "goldsmith") && golds ? CFG.goldsmithCap : CFG.enhCap;');
const L_CLAMP = line("if (factor > ecap) factor = ecap * Math.pow(factor / ecap, CFG.enhSoft);");
const L_TOTAL = line("const total = roundMult(mult * factor * hm * bombMul);");
const L_GOLD = line('if (golds) factor *= Math.pow(has(S, "goldsmith") ? 3 : 2, golds);');
const L_SILV = line("if (silvers) factor *= Math.pow(1.5, silvers);");
const HARD = "    if (factor > ecap) factor = ecap;\n";

const swap = (src, from, to) => {
  if (src.indexOf(from) < 0) throw new Error("λείπει η γραμμή προς αντικατάσταση");
  return src.replace(from, to);
};
/* +N Mult ανά αδιάθετο discard */
const stepPatch = (s, per) => swap(s, L_PAT, L_PAT.replace("discardsLeft(S) * 2", "discardsLeft(S) * " + per));
/* σκληρή οροφή, όπως ήταν πριν */
const hardPatch = (s) => swap(s, L_CLAMP, HARD);
/* το Patient ξαναγραμμένο με άλλο σώμα, με το παλιό βήμα +3 */
const patLine = (body) => '    if (has(S, "patient")) { const d = Math.min(CFG.patientCap, discardsLeft(S) * 3); if (d) { ' + body + '; notes.push("Patient +" + d + " Mult"); } }\n';
/* άλλα μεγέθη ανά ενισχυμένο φύλλο */
const goldPatch = (s, gold, silver, gsGold) =>
  swap(swap(s, L_GOLD, '    if (golds) factor *= Math.pow(has(S, "goldsmith") ? ' + gsGold + " : " + gold + ", golds);\n"),
    L_SILV, "    if (silvers) factor *= Math.pow(" + silver + ", silvers);\n");

/* ---- οι παραλλαγές, ΟΛΕΣ ως διαφορά από ό,τι παίζει σήμερα ---- */
const OLDPAT = { patientCap: 9 }, OLDENH = { enhCap: 3, goldsmithCap: 6 };
const p3 = (s) => stepPatch(s, 3);
const V = {
  base: { desc: "ό,τι παίζει σήμερα", patch: (s) => s },
  old: { desc: "ΠΙΣΩ ΚΑΙ ΤΑ ΔΥΟ: Patient +3 ώς +9 · σκληρή οροφή 3/6", cfg: Object.assign({}, OLDPAT, OLDENH), patch: (s) => hardPatch(p3(s)) },
  oldpat: { desc: "πίσω μόνο το Patient: +3 ώς +9", cfg: OLDPAT, patch: p3 },
  oldenh: { desc: "πίσω μόνο η οροφή: σκληρή 3/6", cfg: OLDENH, patch: hardPatch },

  /* ---- Patient. Τα «pre*» κρατούν το παλιό βήμα +3 και κουνούν ΜΟΝΟ την οροφή, με την
         παλιά σκληρή οροφή ενισχύσεων, ώστε να συγκρίνονται με το `old`. ---- */
  pre6: { desc: "Patient +3 ώς +6", cfg: Object.assign({ patientCap: 6 }, OLDENH), patch: (s) => hardPatch(p3(s)) },
  pre5: { desc: "Patient +3 ώς +5", cfg: Object.assign({ patientCap: 5 }, OLDENH), patch: (s) => hardPatch(p3(s)) },
  pre4: { desc: "Patient +3 ώς +4", cfg: Object.assign({ patientCap: 4 }, OLDENH), patch: (s) => hardPatch(p3(s)) },
  pre3: { desc: "Patient +3 ώς +3", cfg: Object.assign({ patientCap: 3 }, OLDENH), patch: (s) => hardPatch(p3(s)) },
  s2c6: { desc: "Patient +2 ώς +6 (σκληρή οροφή)", cfg: Object.assign({ patientCap: 6 }, OLDENH), patch: hardPatch },
  s2c4: { desc: "Patient +2 ώς +4 (σκληρή οροφή)", cfg: Object.assign({ patientCap: 4 }, OLDENH), patch: hardPatch },
  s1c5: { desc: "Patient +1 ώς +5 (σκληρή οροφή)", cfg: Object.assign({ patientCap: 5 }, OLDENH), patch: (s) => hardPatch(stepPatch(s, 1)) },
  /* ΘΕΣΗ αντί για μέγεθος: μετά την αλυσίδα, και έξω από κάθε πολλαπλασιαστή */
  post: { desc: "Patient +3 ώς +9 ΜΕΤΑ την αλυσίδα", cfg: Object.assign({}, OLDPAT, OLDENH), patch: (s) => { const t = hardPatch(p3(s)); const L = L_PAT.replace("discardsLeft(S) * 2", "discardsLeft(S) * 3"); return swap(swap(t, L, ""), L_CHAIN, L_CHAIN + L); } },
  last: {
    desc: "Patient +3 ώς +9 στο τέλος, έξω από κάθε ×", cfg: Object.assign({}, OLDPAT, OLDENH),
    patch: (s) => swap(swap(hardPatch(s), L_PAT, patLine("patAdd = d")).replace("    const notes = [], R = rule(S);", "    const notes = [], R = rule(S); let patAdd = 0;"),
      L_TOTAL, "    const total = roundMult(mult * factor * hm * bombMul + patAdd);\n"),
  },
  flat: { desc: "σταθερό +9 Mult ό,τι κι αν κρατάς (ΑΛΛΟ charm, για σύγκριση)", cfg: Object.assign({}, OLDPAT, OLDENH), patch: (s) => swap(hardPatch(s), L_PAT, '    if (has(S, "patient")) { const d = CFG.patientCap; mult += d; notes.push("Patient +" + d + " Mult"); }\n') },
  chips: { desc: "Patient σε Base: +10 ανά μονάδα αντί για Mult", cfg: Object.assign({}, OLDPAT, OLDENH), patch: (s) => swap(hardPatch(s), L_PAT, patLine("chips += d * 10")) },

  /* ---- Patient ΜΑΖΙ με τη σημερινή μαλακή οροφή: οι υποψήφιες που θα έμπαιναν ---- */
  sp6: { desc: "Patient +3 ώς +6 · σημερινή μαλακή οροφή", cfg: { patientCap: 6 }, patch: p3 },
  sp5: { desc: "Patient +3 ώς +5 · σημερινή μαλακή οροφή", cfg: { patientCap: 5 }, patch: p3 },
  sp4: { desc: "Patient +3 ώς +4 · σημερινή μαλακή οροφή", cfg: { patientCap: 4 }, patch: p3 },
  sp2c8: { desc: "Patient +2 ώς +8 · σημερινή μαλακή οροφή", cfg: { patientCap: 8 }, patch: (s) => s },

  /* ---- ΤΟ ΠΑΚΕΤΟ: το κόψιμο του Patient πληρώνει τη μαλάκωση της οροφής. Το πρώτο ΒΓΑΖΕΙ
         ουρά (νίκες 20→14 στα 500, ante 45 6,2%→4,0%), το δεύτερο βάζει· μαζί, ο μέσος και
         η ουρά επιστρέφουν κοντά στο σημείο εκκίνησης και τα δύο προβλήματα φεύγουν. ---- */
  pkg25: { desc: "ΠΑΚΕΤΟ: Patient +2 ώς +6 · μαλακή οροφή στο ΠΑΛΙΟ 3/6, εκθέτης 0.25", cfg: { enhCap: 3, goldsmithCap: 6, enhSoft: 0.25 }, patch: (s) => s },
  pkg15: { desc: "ΠΑΚΕΤΟ: Patient +2 ώς +6 · μαλακή οροφή στο ΠΑΛΙΟ 3/6, εκθέτης 0.15", cfg: { enhCap: 3, goldsmithCap: 6, enhSoft: 0.15 }, patch: (s) => s },
  pkg28: { desc: "ΠΑΚΕΤΟ: Patient +2 ώς +6 · μαλακή οροφή 2.8/5.6, εκθέτης 0.25", cfg: { enhCap: 2.8, goldsmithCap: 5.6, enhSoft: 0.25 }, patch: (s) => s },

  /* ---- η οροφή των ενισχύσεων, με το σημερινό Patient ώστε να απομονώνεται ---- */
  e4: { desc: "σκληρή οροφή 4 — η παλιά, απορριφθείσα πρόταση", cfg: { enhCap: 4, goldsmithCap: 6 }, patch: hardPatch },
  sc24: { desc: "μαλακή οροφή 2.4/4.8, εκθέτης 0.25", cfg: { enhCap: 2.4, goldsmithCap: 4.8, enhSoft: 0.25 }, patch: (s) => s },
  sc26: { desc: "μαλακή οροφή 2.6/5.2, εκθέτης 0.25", cfg: { enhCap: 2.6, goldsmithCap: 5.2, enhSoft: 0.25 }, patch: (s) => s },
  sc28: { desc: "μαλακή οροφή 2.8/5.6, εκθέτης 0.25", cfg: { enhCap: 2.8, goldsmithCap: 5.6, enhSoft: 0.25 }, patch: (s) => s },
  sc3: { desc: "μαλακή οροφή 3/6 — μαλακώνει ΠΑΝΩ στο παλιό, δεν βαθμονομεί", cfg: { enhCap: 3, goldsmithCap: 6, enhSoft: 0.25 }, patch: (s) => s },
  over60: { desc: "σκληρή 3, υπέρβαση → +60 Base ανά μονάδα factor", cfg: OLDENH, patch: (s) => swap(s, L_CLAMP, "    if (factor > ecap) { chips += Math.round((factor - ecap) * 60); factor = ecap; }\n") },
  ante: { desc: "σκληρή 3, +1 από το ante 25 και πάνω", cfg: OLDENH, patch: (s) => swap(hardPatch(s), L_ECAP, '    const ecap = (has(S, "goldsmith") && golds ? CFG.goldsmithCap : CFG.enhCap) + (S.ante >= 25 ? 1 : 0);\n') },
  sep: {
    desc: "σκληρές, ΧΩΡΙΣΤΕΣ οροφές Gold και Silver", cfg: OLDENH,
    patch: (s) => swap(swap(hardPatch(s), L_ECAP, "    const ecap = Infinity;\n"), HARD,
      '    { const gc = has(S, "goldsmith") ? CFG.goldsmithCap : CFG.enhCap; let gf = 1, sf = 1;\n' +
      '      if (golds) gf = Math.min(gc, Math.pow(has(S, "goldsmith") ? 3 : 2, golds));\n' +
      "      if (silvers) sf = Math.min(2.25, Math.pow(1.5, silvers));\n" +
      "      factor = gf * sf; }\n"),
  },
  /* μικρότερο βήμα ανά φύλλο, ίδια σκληρή οροφή: ίδιο ταβάνι, πολύ σπανιότερο δέσιμο */
  g15c3: { desc: "σκληρή 3 · Gold ×1.5 · Silver ×1.25", cfg: OLDENH, patch: (s) => goldPatch(hardPatch(s), 1.5, 1.25, 2) },
  g15c4: { desc: "σκληρή 4 · Gold ×1.5 · Silver ×1.25", cfg: { enhCap: 4, goldsmithCap: 6 }, patch: (s) => goldPatch(hardPatch(s), 1.5, 1.25, 2) },
};

if (process.argv[2] === "list") {
  Object.keys(V).forEach((k) => console.log(k.padEnd(10) + (V[k].cfg ? JSON.stringify(V[k].cfg).padEnd(22) : "".padEnd(22)) + V[k].desc));
  process.exit(0);
}
const N = +process.argv[2] || 200;
const NAMES = (process.argv[3] || "base").split(",");
const WHAT = process.argv[4] || "top";

function load(name) {
  const v = V[name];
  if (!v) throw new Error("άγνωστη παραλλαγή: " + name);
  fs.mkdirSync(TMP, { recursive: true });
  const f = path.join(TMP, "g-" + name + ".js");
  fs.writeFileSync(f, v.patch(SRC));
  delete require.cache[require.resolve(f)];
  const G = require(f);
  Object.assign(G.CFG, v.cfg || {});
  return G;
}

/* ---- η πολιτική: ίδια με audit2.js/paired.js, γραμμένη ξανά επειδή δένει σε άλλο module ---- */
const PRIO = (process.env.PRIO || "patient,court,kingmaker,mirror,climber,encore,loyal,lowroad,sleight,wind,ember,scout,leap,summiteer,cheap,goldsmith,ladder,afterburner,wi,pl,th,m2,cs,m1,gt,di").split(",");
function harness(G) {
  const ALL = G.CHARMS.map((c) => c.id);
  const pts = (S, o) => G.scoreOf(S, o.k, o.idx.map((i) => S.hand[i])).pts;
  function discardStep(S) {
    let o = G.orphans(S);
    if (!o.length) o = S.hand.map((_, i) => i).filter((i) => !S.hand[i].h && S.hand[i].r !== 14 && !G.isWild(S.hand[i])).slice(0, 2);
    if (!o.length) return false;
    S.sel = o.slice(0, Math.min(3, o.length)); return G.discard(S);
  }
  function playRound(S, t) {
    const T = G.target(S);
    for (let g = 0; g < 300 && S.phase === "round"; g++) {
      if (S.playsLeft < 1) break;
      const all = G.candidates(S);
      if (!all.length) { if (G.canDiscardAny(S) && discardStep(S)) continue; break; }
      const up = all.filter((o) => G.climbs(S, o.k));
      const m = (up.length ? up : all).reduce((b, o) => (!b || pts(S, o) > pts(S, b) ? o : b), null);
      if (!m) break;
      const need = Math.max(0, T - S.score), share = need / Math.max(1, S.playsLeft);
      if (S.playsLeft > 1 && pts(S, m) < 0.55 * share && G.canDiscardAny(S) && discardStep(S)) continue;
      /* ΤΟ ΜΕΤΡΟ ΤΟΥ ΑΙΣΘΗΜΑΤΟΣ: πόσο αξίζει ΑΚΟΜΑ ΕΝΑ Gold σε αυτό ακριβώς το χέρι.
         Δεν ρωτά «δένει η οροφή;» αλλά «αν έσκαγε τώρα ένα Gold, θα το έβλεπα;».
         Παίρνει ένα απλό φύλλο του χεριού, το κάνει χρυσό, ξαναβαθμολογεί, το γυρνά πίσω. */
      if (t) {
        const cs0 = m.idx.map((i) => S.hand[i]);
        const c0 = cs0.find((c) => !c.e);
        if (c0) {
          const p0 = G.scoreOf(S, m.k, cs0).pts;
          c0.e = "gold";
          const p1 = G.scoreOf(S, m.k, cs0).pts;
          delete c0.e;
          t.marg++; if (p1 <= p0) t.margDead++; t.margGain += p0 ? (p1 - p0) / p0 : 0;
        }
      }
      S.sel = m.idx.slice();
      const ev = G.play(S);
      if (t && ev) {
        t.plays++;
        const g2 = (ev.notes || []).find((x) => /^(Gold|Silver|Gold \+ Silver) ×/.test(x));
        if (g2) {
          t.enh++;
          const raw = rawFactor(G, S);
          const cap = G.has(S, "goldsmith") && raw.golds ? G.CFG.goldsmithCap : G.CFG.enhCap;
          if (raw.f > cap + 1e-9) t.enhOver++;
          if (+g2.split("×")[1] >= cap - 1e-9) t.enhAtCap++;
          /* ίδιο, κομμένο ανά δεκάδα ante: το παράπονο είναι ότι ΑΡΓΟΤΕΡΑ ένα νέο Gold δεν αξίζει τίποτα */
          const bk = Math.min(4, Math.floor(S.ante / 10));
          const bb = t.byAnte[bk] || (t.byAnte[bk] = { n: 0, at: 0, over: 0 });
          bb.n++; if (+g2.split("×")[1] >= cap - 1e-9) bb.at++; if (raw.f > cap + 1e-9) bb.over++;
        }
      }
      if (ev && ev.cleared) break;
    }
    if (S.phase === "round") G.finish(S);
  }
  function shop(S) {
    while (G.picksLeft(S) > 0) {
      const l = S.offers.map((o, i) => ({ o, i, pr: PRIO.indexOf(o.id) })).filter((x) => !x.o.bought && x.pr >= 0 && G.canTake(S, x.i).ok).sort((a, b) => a.pr - b.pr);
      if (!l.length) break;
      G.take(S, l[0].i);
    }
    G.nextAnte(S);
  }
  return function run(seed, charm, t) {
    const S = G.newRun(seed, ALL);
    const gr = charm ? (Array.isArray(charm) ? charm : [charm]) : [];
    if (gr.length) { gr.forEach((c) => S.charms.push(c)); S.charmSlots = Math.max(S.charmSlots, S.charms.length); G.startRound(S); }
    for (;;) {
      playRound(S, t);
      if (S.phase === "lost") return { x: S.ante + 1, won: 0 };
      if (S.phase === "won") return { x: G.TARGETS.length + 1, won: 1 };
      shop(S);
    }
  };
}
/* Το ΑΚΑΤΕΡΓΑΣΤΟ γινόμενο των ενισχύσεων του παιξίματος, για να ξεχωρίσει
   «ακούμπησε την οροφή» από «ΞΕΠΕΡΑΣΕ την οροφή» (μόνο το δεύτερο χάνει αξία). */
function rawFactor(G, S) {
  const cs = S.played || [];
  const golds = cs.filter((c) => c && c.e === "gold").length, silvers = cs.filter((c) => c && c.e === "silver").length;
  let f = 1;
  if (golds) f *= Math.pow(G.has(S, "goldsmith") ? 3 : 2, golds);
  if (silvers) f *= Math.pow(1.5, silvers);
  return { f, golds, silvers };
}

const seeds = Array.from({ length: N }, (_, i) => (process.env.SEED || "au-") + i);
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const q = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(p * (b.length - 1))]; };
const TOP = ["patient", "court", "kingmaker", "climber"];

console.log(N + " runs ανά κελί · ίδια seeds (" + seeds[0].replace(/0$/, "*") + ") · ίδια πολιτική με audit2\n");
/* Το ΙΔΙΟ που φυλάει το tune.js: πόσο κουνά η παραλλαγή το μέσο ante θανάτου του bot.
   Ζευγαρωμένο στα ίδια seeds, ώστε το ±0,4 του ίδιου του μέτρου να μη σκεπάζει τη διαφορά. */
const REF = (() => { const r = harness(load("base")); return seeds.map((s) => r(s, null, null).x); })();
for (const name of NAMES) {
  const G = load(name);
  const run = harness(G);
  const t = { plays: 0, enh: 0, enhAtCap: 0, enhOver: 0, byAnte: {}, marg: 0, margDead: 0, margGain: 0 };
  const base = seeds.map((s) => run(s, null, t));
  const bx = base.map((r) => r.x), bm = mean(bx);
  const dr = bx.map((x, i) => x - REF[i]), dm = mean(dr);
  const dsd = Math.sqrt(mean(dr.map((x) => (x - dm) * (x - dm))));
  console.log(name.padEnd(9) + "│ " + (V[name].desc || "") + "   ζευγ. Δ ante θανάτου έναντι base " + (dm >= 0 ? "+" : "") + dm.toFixed(2) + " ±" + (1.96 * dsd / Math.sqrt(N)).toFixed(2) + " (95%)");
  const sd0 = Math.sqrt(mean(bx.map((x) => (x - bm) * (x - bm))));
  const share = (n) => (100 * bx.filter((x) => x >= n).length / N).toFixed(1) + "%";
  console.log("  baseline " + bm.toFixed(2) + " ±" + (sd0 / Math.sqrt(N)).toFixed(2) + " · νίκες " + base.filter((r) => r.won).length + "/" + N +
    " · ουρά ≥25 " + share(25) + " ≥35 " + share(35) + " ≥45 " + share(45) +
    " · θάνατος p10/p50/p75/p90 " + q(bx, .1) + "/" + q(bx, .5) + "/" + q(bx, .75) + "/" + q(bx, .9) +
    (t.enh ? " · Gold/Silver παιξίματα " + t.enh + ", στο πλαφόν " + (100 * t.enhAtCap / t.enh).toFixed(0) + "%, ΠΑΝΩ από αυτό " + (100 * t.enhOver / t.enh).toFixed(0) + "%" : ""));
  if (t.marg) console.log("  ένα ΑΚΟΜΑ Gold σε αυτό το χέρι: αξίζει μηδέν στο " + (100 * t.margDead / t.marg).toFixed(1) + "% των παιξιμάτων · μέσο κέρδος +" + (100 * t.margGain / t.marg).toFixed(1) + "%");
  if (t.enh) console.log("  ανά δεκάδα ante · στο πλαφόν / ΠΑΝΩ από αυτό: " + Object.keys(t.byAnte).map(Number).sort((a, b) => a - b)
    .map((k) => (k * 10 + 1) + "-" + (k * 10 + 10) + " " + (100 * t.byAnte[k].at / t.byAnte[k].n).toFixed(0) + "%/" + (100 * t.byAnte[k].over / t.byAnte[k].n).toFixed(0) + "% (n" + t.byAnte[k].n + ")").join(" · "));
  if (WHAT === "curve") { console.log(""); continue; }
  /* ΥΠΕΡΒΑΣΗ ΠΡΟΣΘΕΤΙΚΟΤΗΤΑΣ: το ζευγάρι μείον το άθροισμα των δύο μόνων τους.
     Ο λόγος που το patientCap υπάρχει καν είναι ότι το Patient+Sleight μετρήθηκε
     +0,92 πάνω από την πρόβλεψη — αυτό το νούμερο πρέπει να ξαναμετρηθεί μετά. */
  if (WHAT === "pair") {
    const val = (c) => { const v = seeds.map((s) => run(s, c, null).x); const d = v.map((x, i) => x - bx[i]), m = mean(d); return { d: m, se: Math.sqrt(mean(d.map((y) => (y - m) * (y - m)))) / Math.sqrt(N) }; };
    [["patient", "sleight"], ["patient", "climber"], ["patient", "court"], ["court", "goldsmith"]].forEach(([a, b]) => {
      const A = val(a), B = val(b), AB = val([a, b]);
      const ex = AB.d - A.d - B.d;
      console.log("    " + (a + "+" + b).padEnd(20) + "μόνα " + A.d.toFixed(2) + " + " + B.d.toFixed(2) + " = " + (A.d + B.d).toFixed(2) + " · μαζί " + AB.d.toFixed(2) + " · υπέρβαση " + (ex >= 0 ? "+" : "") + ex.toFixed(2) + " ±" + (Math.sqrt(A.se * A.se + B.se * B.se + AB.se * AB.se)).toFixed(2));
    });
    console.log("");
    continue;
  }
  const list = WHAT === "all" ? G.CHARMS.map((c) => c.id) : TOP;
  const rows = list.map((id) => {
    const v = seeds.map((s) => run(s, id, null));
    const d = v.map((r, i) => r.x - bx[i]), m = mean(d);
    const sd = Math.sqrt(mean(d.map((x) => (x - m) * (x - m))));
    return { id, m: mean(v.map((r) => r.x)), d: m, se: sd / Math.sqrt(N), won: v.filter((r) => r.won).length };
  }).sort((a, b) => b.d - a.d);
  const p = rows.find((r) => r.id === "patient"), nxt = rows.filter((r) => r.id !== "patient")[0];
  rows.forEach((r) => console.log("    " + r.id.padEnd(14) + r.m.toFixed(2).padStart(7) + (r.d >= 0 ? "+" : "") + r.d.toFixed(2).padStart(7) + " ±" + r.se.toFixed(2) + "  νίκες " + r.won));
  if (p && nxt) console.log("  patient/επόμενο ×" + (p.d / nxt.d).toFixed(2) + " (" + p.d.toFixed(2) + " vs " + nxt.id + " " + nxt.d.toFixed(2) + ")");
  console.log("");
}
