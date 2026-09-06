/* RAISE — καθαρή λογική παιχνιδιού (v5: Chips × Mult, προαιρετική αλυσίδα, discards ανά γύρο).
   Χωρίς DOM. Browser: window.RAISE · Node: module.exports. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RAISE = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ============================== σταθερές ============================== */
  const SUITS = [{ s: "♠", red: false }, { s: "♥", red: true }, { s: "♦", red: true }, { s: "♣", red: false }];
  const RN = { 11: "J", 12: "Q", 13: "K", 14: "A" };
  const rname = (r) => RN[r] || String(r);
  /* Συνδυασμοί κατά Tichu. size = φύλλα. Βόμβες χτυπούν οτιδήποτε.
     Η ονομαστική σκάλα είναι ×6,6 από ζευγάρι σε στρέιτ φλας, με τη ΚΟΡΥΦΗ μαζεμένη:
     εκεί γεννιόταν το «ένα χέρι κάλυψε ολόκληρο το ante». Ήταν ×4 (τα ζευγάρια έπαιρναν
     τα πάντα) και μετά ×21 — που έσπασε αλλιώς: ένα τυχερό φουλ κάλυπτε ΟΛΟΚΛΗΡΟ το ante.
     Μετρημένο, το μεγαλύτερο χέρι ήταν 1,5× ο στόχος και ο γύρος τελείωνε στο 2ο παίξιμο.
     Στο Balatro ένα χέρι είναι κλάσμα του blind και θέλεις τρία-τέσσερα. Ο λόγος δύο άσοι
     προς δύο τριάρια μένει καρφωμένος στο ×1,44 — το φύλλο μετράει λίγο, το σχήμα αρκετά. */
  /* tier = σειρά ισχύος (ανώτερο χτυπάει κατώτερο). Το kind μένει σταθερό για τα saves. */
  /* Κάθε χέρι έχει Chips και Mult (όπως στο Balatro). cstep/mstep = ανά επιπλέον βήμα μήκους. */
  const KINDS = [null,
    { id: "pair", name: "Pair", short: "PAIR", chips: 25, mult: 3, size: 2, tier: 1 },
    { id: "trips", name: "Trips", short: "TRIPS", chips: 34, mult: 5, size: 3, tier: 3 },
    { id: "stairs", name: "Stairs", short: "STAIRS", chips: 36, mult: 5, cstep: 8, mstep: 1, min: 4, tier: 4 },
    { id: "straight", name: "Straight", short: "STR8", chips: 38, mult: 5, cstep: 7, mstep: 1, min: 5, tier: 5 },
    { id: "full", name: "Full House", short: "FULL", chips: 42, mult: 6, size: 5, tier: 6 },
    { id: "quads", name: "Quads", short: "QUADS", chips: 50, mult: 7, size: 4, bomb: true, tier: 7 },
    { id: "sflush", name: "Straight Flush", short: "SFLUSH", chips: 62, mult: 8, cstep: 8, mstep: 1, min: 5, bomb: true, tier: 8 },
    { id: "pairs", name: "Two Pair", short: "PAIRS", chips: 30, mult: 4, cstep: 8, mstep: 1, min: 4, tier: 2 },
    /* Ο μοναχικός άσος: το φθηνότερο χέρι και το πρώτο σκαλί κάθε αλυσίδας. */
    { id: "single", name: "Ace", short: "ACE", chips: 15, mult: 2, size: 1, tier: 0 },
  ];
  const BY_TIER = KINDS.slice(1).sort((a, b) => a.tier - b.tier);
  /* Ποια σχήματα πιάνει κάθε αναβάθμιση, και πόσο Mult δίνει. Μετρημένο: τα ζευγάρια είναι
     το 74% των χεριών, τα σχήματα το 15%, οι βόμβες το 1% — άρα το βήμα μεγαλώνει όσο πιο
     σπάνιο είναι το σχήμα, αλλιώς η προσφορά είναι νεκρή (Sets+ έβγαζε Δ +0,10 στα 60 runs). */
  const MULT_KIND = { m1: [1, 8], m2: [2, 3, 4, 5, 6, 7] };
  const MULT_STEP = { m1: 1, m2: 2 };
  /* Πόσα βήματα μήκους πάνω από το ελάχιστο: ζεύγη/σκάλες μετρούν ζευγάρια, κέντες φύλλα. */
  const kunits = (k) => (k.kind === 3 || k.kind === 8 ? k.size / 2 - 2 : k.kind === 4 || k.kind === 7 ? k.size - 5 : 0);
  const kchips = (k) => { const K = KINDS[k.kind]; return K.chips + (K.cstep || 0) * kunits(k); };
  const kmult = (k) => { const K = KINDS[k.kind]; return K.mult + (K.mstep || 0) * kunits(k); };
  /* Ονομαστική αξία του σχήματος (χωρίς φύλλα): για ταξινόμηση και για τον πίνακα πληρωμών. */
  const kbase = (k) => kchips(k) * kmult(k);
  const isBomb = (k) => !!k && !!KINDS[k.kind].bomb;
  /* 50 antes. Κάθε στόχος είναι το h(a)-ποσοστημόριο των σκορ όσων φτάνουν εκεί, με τον ρυθμό
     θανάτου h να πάει από 3% (ante 1) σε 20% (ante 50).
     ΠΡΟΣΟΧΗ: τα antes ΧΩΡΙΣ challenge έχουν +10% εδώ μέσα, και τα challenge antes πληρώνουν
     ×0,8 (chalTargetMul) αντί για ×0,9 — αλλιώς ο κίνδυνος ήταν πριονωτός: τα boss σκότωναν
     9,7% και τα «κενά» 3,6% (2,67×), δηλαδή δύο στους τρεις γύρους ήταν γέμισμα.
     Μετά: 6,1% / 5,1%. Το tune.js εξομαλύνει πλέον ΧΩΡΙΣΤΑ τις δύο σειρές και προσαρμόζει
     σε ΛΟΓΟ score/target, όχι σε σκέτο score — αλλιώς αγνοούσε το chalTargetMul. */
  const TARGETS = [972, 1190, 1320, 1790, 2150, 2300, 2920, 3270, 3340, 3960, 4320, 4550, 5370, 6230, 6620, 7830, 8720, 9060, 10200, 11100, 11400, 13400, 14400, 15000, 17700, 19600, 20100, 23500, 25400, 26000, 29300, 31200, 33600, 38900, 41100, 42600, 49000, 52900, 54200, 61100, 65100, 66600, 75400, 79600, 81600, 94000, 96500, 101000, 123000, 126000];
  const CFG = {
    handSize: 8, plays: 5, discards: 2, jokers: 2,
    /* Η αλυσίδα ΠΟΛΛΑΠΛΑΣΙΑΖΕΙ το Mult του χεριού, δεν του προσθέτει.
       Ως πρόσθεση ευνοούσε δυσανάλογα τα μικρά χέρια: +6 Mult σε ζευγάρι (βάση 3) το τριπλασίαζε,
       στο φουλ (βάση 14) το ανέβαζε 43% — γι' αυτό το bot έπαιζε 69% ζευγάρια. Ως πολλαπλασιαστής
       δίνει σε όλους το ίδιο ποσοστό, οπότε αποφασίζει το σχήμα. Κάθε σκαλί: +35%. */
    chainStep: 0.22,
    /* Το πρώτο ανέβασμα μετράει ήδη ένα σκαλί: κάθε χέρι που ανεβαίνει παίρνει τουλάχιστον +1 Mult.
       Είναι το πάτωμα της αλυσίδας — μαζεύει την ουρά p10 χωρίς να πειράζει την κορυφή. */
    chainFloor: 1,
    /* Οροφή στο Mult που δίνει η αλυσίδα — δένει Climber/Tempo, που αλλιώς έτρεχαν ως +30. */
    /* chainStepCap = chainCap × 2, ώστε ο Climber («κάθε σκαλί διπλό») να πληρώνει μέχρι
       την κορυφή. Στο 8 έδενε: με Climber τα σκαλιά 5 και 6 έδιναν ακριβώς μηδέν, και το
       Tempo («τριπλό») ήταν ίδιο με το Climber από το σκαλί 3 και πάνω. */
    chainStepCap: 12, patientCap: 9,
    /* Οροφή στο γινόμενο των ενισχυμένων φύλλων και στο γινόμενο charms/κανόνων ενός χεριού. */
    /* Οροφή στα ενισχυμένα φύλλα και στα charms. Χαμηλά επίτηδες: στο Balatro οι xMult
       ισχύουν σε ΚΑΘΕ χέρι· εδώ οι μεγάλοι πολλαπλασιαστές ήταν δεμένοι σε ένα παίξιμο
       (Encore, Mirror) και έφτιαχναν ακριβώς το «ένα φουλ καθαρίζει το ante». */
    /* enhCap: το πλαφόν στο γινόμενο Gold/Silver. Ο Goldsmith («Gold: Mult ×3») ήταν ΝΕΚΡΟΣ:
       ένα Gold έφτανε ήδη το πλαφόν, και δύο Gold έδιναν ×3 με ή χωρίς αυτόν. Τώρα σηκώνει
       το δικό του πλαφόν — αλλιώς δεν αγοράζει τίποτα (μετρημένο: ×1,06 → ×1,30). */
    enhCap: 3, goldsmithCap: 6, hmCap: 3,
    /* ενισχύσεις: δεν αγοράζονται· «σκάνε» τυχαία σε φύλλα που τραβάς μέσα στον γύρο */
    enhChance: 0.06, enhWeights: { silver: 55, gold: 25, wild: 20 }, jokerCap: 4,
    /* Ρυθμός: κάθε 3η πίστα είναι challenge ΚΑΙ η μόνη που πληρώνει — ένα perk και ένα charm.
       Οι άλλες δύο περνούν χωρίς στάση: φτάνεις τον στόχο, συνεχίζεις. */
    rewardEvery: 3, offers: 3, chainCap: 6, lowCeiling: 4, endlessStep: 1.08, charmFirst: 1,
    /* Τέσσερις θέσεις, και τέλος. Με τόσο λίγες, το κάθε charm πρέπει να είναι στύλος του
       build — γι' αυτό όλα τα bonus ανέβηκαν μαζί με τα πλαφόν. */
    charmSlots: 5,
    /* chalMul: ένας πολλαπλασιαστής ανά challenge, από τον μετρημένο ρυθμό θανάτου του
       (ελαστικότητα dlnh/dlnT ≈ 3,5 → m = (6%/h)^(1/3,5)). Χωρίς αυτόν, με τον ίδιο στόχο
       το Blind σκότωνε 11% και το Sticky 3%. Μετά: 5–7% όλα. */
    chalTargetMul: 0.8,
    chalMul: { nodiscard: 0.70, summit: 0.83, blind: 0.92, onedisc: 0.89, short: 0.95, fewplays: 0.95, richair: 1.05, highground: 1.23, thinair: 1.13, noace: 1.22, sticky: 1.22 },
    /* Survival: ανάσες στην αρχή, και μία σε κάθε ορόσημο σκορ (1200 ×2,2 κάθε φορά).
       Η ανάσα κάνει ΔΥΟ δουλειές: πετάς φύλλα, ή σπας την αλυσίδα.
       Δέκα στην αρχή, ζητούμενο του παίκτη. Μετρημένο (300 runs): σωστό παίξιμο 73 χέρια και
       p50 123 060, άπληστο 27 χέρια και 10 009 — headroom +1129%, spread ×3,04, 0 ατέρμονα,
       και ο Hint ταιριάζει ακριβώς με το βέλτιστο. Το κόστος είναι ΜΟΝΟ ο χρόνος: το run
       τραβά ~28% παραπάνω από τις 7 ανάσες (57 χέρια). Αν χρειαστεί να κοντύνει χωρίς να
       πειραχτούν οι αρχικές, το survGrow ×2,8 δίνει 66 χέρια και spread ×2,76. */
    survDiscards: 10, survStep: 1200, survGrow: 2.2, survEarnCap: 99,
    /* Το Survival δεν είχε ΚΑΜΙΑ καμπύλη. Μετρημένο ανά δεκάδα χεριών (tools/decide.js 60):
       από το χέρι 1 ώς το 80 τα νούμερα της απόφασης είναι ταυτόσημα — υποψήφια χέρια 4,4→5,0,
       ανεβάσματα 3,4→3,1, είδη που ανεβαίνουν 1,96→1,82, «καμία επιλογή» 40%→45%, κόστος
       λάθους ×1,77→×1,77. Δηλαδή μία απόφαση, 73 φορές. (Το Classic ΕΧΕΙ καμπύλη: υποψήφια
       6,1→20,2, «καμία επιλογή» 53%→21%, γιατί το χέρι μεγαλώνει και η τράπουλα λεπταίνει.)

       ΔΟΚΙΜΑΣΜΕΝΟ ΚΑΙ ΑΠΟΡΡΙΦΘΕΝ: «κάθε πέρασμα της τράπουλας παίρνει τη χαμηλότερη
       βαθμίδα». Είναι ΔΩΡΟ, όχι πίεση: λιγότερες βαθμίδες σε χέρι 8 φύλλων σημαίνει
       ΠΥΚΝΟΤΕΡΟ χέρι, άρα φουλ και καρέ συνεχώς. Μετρημένο (200 runs): 73 → 212 χέρια,
       p50 123 060 → 2 998 906, spread ×3,04 → ×46,4. Η πυκνότητα κερδίζει τη στενότητα.

       Ό,τι δουλεύει είναι το ΑΝΤΙΘΕΤΟ άκρο: το βουνό γίνεται πιο απότομο. Κάθε survSteep
       χέρια, το rung ανεβαίνει μία βαθμίδα παραπάνω μετά από κάθε παίξιμο (ο ίδιος
       μηχανισμός με το challenge «Sticky Rung», κλιμακωτά). Τα ανεβάσματα κατά βαθμίδα
       στερεύουν, μένουν τα άλματα είδους — δηλαδή αλλάζει η ΑΠΟΦΑΣΗ, όχι μόνο η δυσκολία.
       Σαρωμένο (tools/steep.js 200, ίδια seeds· χέρια / p50 σωστού / headroom / spread):
         0 → 73 · 121 995 · +1131% · ×2,70   (η επίπεδη βάση — καμία καμπύλη)
         6 → 53 ·  79 118 ·  +741% · ×2,53   (κοντύτερο, αλλά −35% στην κορυφή)
         8 → 55 ·  85 925 ·  +803% · ×2,36
        10 → 57 ·  90 920 ·  +846% · ×2,52
        12 → 59 ·  88 983 ·  +808% · ×2,17   ← διαλεγμένο
        16 → 61 ·  97 146 ·  +885% · ×2,70   (σχεδόν σαν σβηστό)
        20 → 63 · 104 933 ·  +964% · ×2,78
       ΔΟΚΙΜΑΣΜΕΝΟ ΚΑΙ ΑΠΟΡΡΙΦΘΕΝ, το άλλο μισό: «κάθε δεύτερο ορόσημο μεγαλώνει το χέρι»
       (survWide). Το Survival είναι ΥΠΕΡΕΥΑΙΣΘΗΤΟ στον αριθμό επιλογών: ένα φύλλο παραπάνω
       στο χέρι μακραίνει το run κατά 30% και ΜΕΓΑΛΩΝΕΙ το skill cliff, δηλαδή ακριβώς το
       αντίθετο από τον σκοπό (tools/steep2.js 150, steep=12: wide 0 → 59 χέρια/+808%,
       wide 1 → 76/+1370%, wide 2 → 97/+3027%). Καμία τιμή του steep δεν το αντισταθμίζει.

       ΣΒΗΣΤΟ (0), ΑΠΟΦΑΣΗ ΣΧΕΔΙΑΣΜΟΥ: ο μηχανισμός δουλεύει και μένει στον κώδικα, αλλά
       το Survival είναι το mode που ο παίκτης ζήτησε **να μην τον τιμωρεί**: δέκα ανάσες,
       προαιρετική αλυσίδα, και καμία απώλεια run όσο υπάρχει ανέβασμα. Ένα rung που ανεβαίνει
       ΜΟΝΟ ΤΟΥ διαβάζεται ως bug πριν διαβαστεί ως καμπύλη, και κοστίζει 27% της κορυφής
       (121 995 → 88 983) και 323 μονάδες headroom. Άναψέ το με `survSteep: 12` — τα νούμερα
       της σάρωσης παραπάνω ισχύουν. */
    survSteep: 0,
    /* Οι βόμβες πληρώνουν έξω από το `hmCap`. Ο σωστός φρουρός δεν είναι το `maxPlay/T` αλλά
       «πόσοι γύροι έκλεισαν στο 1ο παίξιμο»: 1,25 → 7,45% · 1,40 → 8,63% · 1,55 → 9,66% ·
       1,70 → 9,73% (πλατό). Διαλέχτηκε το 1,55. */
    bombMul: 1.55,
    /* Survival: κάθε βόμβα δίνει και μία ανάσα. */
    survBombBreath: 1,
    /* Παράθυρα των charms που είναι δεμένα στο rung. Μετρημένος ρυθμός ενεργοποίησης
       (tools/trig.js 100, με το charm χαρισμένο): Ladder 3,5% και Overkill 6,0% των
       παιξιμάτων — δηλαδή ένα Ladder μιλούσε μία φορά κάθε τέσσερις γύρους. Και τα δύο
       μετρούσαν ΑΡΝΗΤΙΚΗ αξία (−0,90 και −0,56 ante): μια θέση charm ξοδεμένη στο τίποτα.
       Η αιτία είναι δομική, όχι μέγεθος bonus: η σκάλα ανεβάσματος είναι κατά ΕΙΔΟΣ, οπότε
       δύο διαδοχικά χέρια σπάνια δένουν σε βαθμίδα (tools/rung.js: ακριβώς +1 βαθμός στο
       4,7% των χεριών με rung, ίδιο σχήμα στο 13,7%).
       Τώρα: Ladder 1–3 βαθμίδες (10,4%, +1,50), Overkill 4+ χωρίς όρο σχήματος (11,8%, +3,67).
       Τα δύο παράθυρα ΕΦΑΠΤΟΝΤΑΙ χωρίς κενό και χωρίς επικάλυψη — «σφιχτό βήμα» έναντι
       «άλμα». Σάρωση ladderWindow (200 ζευγαρωμένα, μέσο τελικό ante του κατόχου):
         3 → 17,76 ← διαλεγμένο · 4 → 18,49 · 5 → 20,15
       Το 4 και το 5 πληρώνουν παραπάνω, αλλά το 4 επικαλύπτεται με το Overkill και το 5
       ακυρώνει τη συνέργεια Back Stairs. Η καθαρή ανάγνωση αξίζει τα 2,4 ante.
       slipKeep: τι κρατά το σπασμένο χέρι από την αλυσίδα. Σάρωση (200 ζευγαρωμένα):
         0 → 17,29 (η παλιά συμπεριφορά) · 0,34 → 18,41 · 0,5 → 20,61 ← διαλεγμένο
         0,67 → 21,08 · 1 → 21,58 (εκεί το σπάσιμο παύει να κοστίζει — ο πυρήνας του
         παιχνιδιού διαλύεται). Το «μισή» είναι και το μόνο κλάσμα που διαβάζεται σε κάρτα. */
    ladderWindow: 3, backStairsWindow: 5, overkillGap: 4, slipKeep: 0.5,
    /* Ο ΡΗΤΟΣ κανόνας «κανένα μεμονωμένο χέρι δεν καθαρίζει ante» ΔΕΝ κρατιόταν, και το
       νούμερο που τον φύλαγε (maxPlay/T ≤ 0,90) δεν μπορούσε να τον δει: είναι ΔΙΑΜΕΣΟΣ
       ανά ante, ενώ ο κανόνας μιλάει για την ουρά. Μετρημένο σωστά (tools/tune.js, πόσοι
       γύροι έκλεισαν στο 1ο παίξιμο): 7,71% πριν από αυτό το πέρασμα. Το Mirror φτιάχνει
       το ένα τρίτο τους — βγάζοντάς το από τη λίστα αγορών, το 9,43% γίνεται 6,48%.
       Σάρωση mirrorMul (200 runs, ίδια seeds): 2 → 9,43% · 1,75 → 8,60% · 1,5 → 7,71%.
       Το 1,5 επαναφέρει ακριβώς τη βάση και διαβάζεται σαν το Silver και το Red Night· το
       1,75 απορρίφθηκε ως άσχημος αριθμός σε κάρτα παίκτη. Κόστος: το Mirror χάνει
       2,92 ± 2,87 ante από τα +9,32 του. */
    mirrorMul: 1.5,
    thinAirCap: 2, ruleChance: 0.75, highGroundRank: 8, shortHand: 7, richAirMul: 1.15, blindCount: 3, blindKeep: 1,
    maxBuy: { cs: 3, wi: 2, di: 2, pl: 1, gt: 1, m1: 20, m2: 20 },
  };

  const POOL = [
    { id: "m1", name: "Pairs +", desc: "Pairs and two pair: +1 Mult" },
    { id: "m2", name: "Big Hands +", desc: "Trips, stairs, straights, full houses and bombs: +2 Mult" },
    { id: "pl", name: "Extra Play", desc: "+1 play a round" },
    { id: "di", name: "Nimble Hands", desc: "+1 discard a round" },
    { id: "wi", name: "Wide Hand", desc: "Hold one more card" },
    { id: "cs", name: "Head Start", desc: "The chain starts a step higher" },
    { id: "th", name: "Cull", desc: "Drop the lowest rank from your deck, for good" },
    /* μόνο από τη μέση του run και μετά */
    { id: "gt", name: "Golden Touch", desc: "Every Ace in your deck turns Gold", min: 8 },
  ];
  const poolById = Object.fromEntries(POOL.map((o) => [o.id, o]));

  const ENH = {
    gold: { name: "Gold", desc: "Mult ×2 when played — they stack, up to ×3 (×6 with Goldsmith)" },
    wild: { name: "Joker", desc: "Any rank, any suit — and an Ace" },
    silver: { name: "Silver", desc: "Mult ×1.5 when played — the common cousin of Gold" },
  };

  /* Charms: παθητικά εφέ. `lock` = συνθήκη ξεκλειδώματος (UI, lifetime stats). */
  const CHARMS = [
    { id: "climber", name: "Climber", glyph: "↑", desc: "Every chain step counts double" },
    { id: "patient", name: "Patient", glyph: "◷", desc: "+3 Mult for every discard you still hold, up to +9" },
    { id: "ladder", name: "Ladder", glyph: "≡", desc: "A hand one to three ranks above the rung: two extra chain steps for that hand" },
    { id: "leap", name: "Overkill", glyph: "⤒", desc: "Climb four ranks or more above the rung: Mult ×2" },
    { id: "lowroad", name: "Low Road", glyph: "2", desc: "Pairs of 2 to 6: Mult ×2, and +40 Base" },
    { id: "court", name: "Court", glyph: "♛", desc: "A face card in the hand you play: +60 Base" },
    { id: "loyal", name: "Loyalty", glyph: "♠", desc: "Same lead suit as your last play: a chain step higher, and +60 Base on the way up" },
    { id: "cheap", name: "Slipstream", glyph: "~", desc: "A break still pays half the chain, and drops one step instead of resetting" },
    { id: "wind", name: "Second Wind", glyph: "∞", desc: "The first two breaks of the round keep everything" },
    { id: "sleight", name: "Sleight", glyph: "✂", desc: "+3 discards a round" },
    { id: "encore", name: "Encore", glyph: "⧗", desc: "Your last play of the round: Mult ×2" },
    { id: "mirror", name: "Mirror", glyph: "◐", desc: "First hand of the round: Mult ×1.5 and two chain steps" },
    { id: "scout", name: "Scout", glyph: "◉", desc: "See the next three cards — and your first discard each round is free" },
    { id: "kingmaker", name: "Kingmaker", glyph: "A", desc: "Every Ace in the hand you play: +45 Base" },
    { id: "afterburner", name: "Afterburner", glyph: "»", desc: "A bomb and every hand after it, until the chain breaks: Mult ×2" },
    { id: "goldsmith", name: "Goldsmith", glyph: "★", desc: "Gold cards: Mult ×3, and their ceiling rises to ×6", lock: { key: "gold", n: 3, text: "Play 3 Gold cards" } },
    { id: "summiteer", name: "Summiteer", glyph: "▲", desc: "Bombs: Mult ×2", lock: { key: "quads", n: 3, text: "Play 3 bombs" } },
    { id: "ember", name: "Ember", glyph: "✦", desc: "Chain ×3 and above: Mult ×2", lock: { key: "chain7", n: 1, text: "Reach chain ×6" } },
  ];
  const charmById = Object.fromEntries(CHARMS.map((c) => [c.id, c]));

  const CHALLENGES = [
    { id: "noace", name: "No Aces", desc: "Aces cannot be played at all — but you hold one more card. Jokers still work.", tell: "The Warden. No Ace leaves the cell.", tip: "They are dead weight — spend a discard and be rid of them." },
    { id: "short", name: "Short Hand", desc: "You hold seven cards — and get one more discard.", tell: "The Pickpocket. One card lighter.", tip: "Throw more, to find the shapes anyway." },
    { id: "blind", name: "Blind Deal", desc: "Three cards start face down, and one of the cards you draw stays down after every play. A discard turns them all up.", tell: "The Dealer. Face down, no questions.", tip: "A discard is how you look." },
    { id: "highground", name: "High Ground", desc: "Nothing under a pair of 8 climbs — all round.", tell: "The Bouncer. Small hands do not get in.", tip: "Lone Aces and low pairs still score, but the chain will not move." },
    { id: "onedisc", name: "One Discard", desc: "A single discard this round.", tell: "The Diver. One dive, no coming up.", tip: "Save it for a hand you truly cannot use." },
    { id: "thinair", name: "Thin Air", desc: "The chain caps at ×2.", tell: "The Altitude. The air runs out at ×2.", tip: "Big hands, not long chains." },
    { id: "richair", name: "Rich Air", desc: "A target 15% above what this boss would otherwise ask — and five offers instead of three.", tell: "The Patron. Asks more, gives more.", tip: "A harder round for a better pick." },
    { id: "nodiscard", name: "No Discards", desc: "No discards — but you hold one more card.", tell: "The Miser. What you hold is what you play.", tip: "A bigger hand instead of a second chance." },
    { id: "fewplays", name: "Four Plays", desc: "One play fewer.", tell: "The Clock. Four swings.", tip: "Every hand must count double." },
    { id: "sticky", name: "Sticky Rung", desc: "After every play the rung climbs two more ranks.", tell: "The Escalator. It climbs without you.", tip: "Jump kinds instead of ranks." },
    { id: "summit", name: "The Summit", desc: "A hand that does not climb scores nothing.", tell: "The Summit. One clean ascent.", tip: "Bring Aces and a bomb." },
  ];
  const chalById = Object.fromEntries(CHALLENGES.map((c) => [c.id, c]));
  /* Συμβόλαια: ένας προαιρετικός στόχος ανά γύρο, τυχαίος (seeded). pct = % του σκορ του γύρου. */
  /* Κανόνες τραπεζιού: ένας μικρός θετικός ή αρνητικός κανόνας στα antes χωρίς challenge. */
  const RULES = [
    { id: "r_red", name: "Red Night", desc: "Hands led by red cards: Mult ×1.5." },
    { id: "r_black", name: "Black Night", desc: "Hands led by black cards: Mult ×1.5." },
    { id: "r_head", name: "Running Start", desc: "The chain starts at ×2." },
    { id: "r_cap", name: "Low Ceiling", desc: "The chain caps at ×4." },
    { id: "r_pair0", name: "Cheap Pairs", desc: "Single pairs score no Base — but still climb." },
    { id: "r_str2", name: "Runway", desc: "Plain straights: Mult ×2." },
    { id: "r_trips2", name: "Triplets", desc: "Trips: Mult ×2." },
    { id: "r_full2", name: "Open House", desc: "Full houses: Mult ×2." },
    { id: "r_low2", name: "Underdogs", desc: "Hands topped by a 6 or lower, bombs aside: Mult ×2." },
    { id: "r_gift", name: "Spare Card", desc: "One more discard this round." },
  ];
  const ruleById = Object.fromEntries(RULES.map((r) => [r.id, r]));
  const RANDOM_CHALLENGES = CHALLENGES.filter((c) => c.id !== "summit").map((c) => c.id);

  /* Τράπουλες: διαφορετικό ξεκίνημα. lock = επίτευγμα ζωής (best = καλύτερο ante). */
  const DECKS = [
    { id: "classic", name: "Classic", desc: "52 cards and two Jokers.", glyph: "♠" },
    { id: "wild", name: "Wild Deck", desc: "Four Jokers. Jokers pop up twice as often.", glyph: "★", lock: { key: "best", n: 10, text: "Clear ante 10" } },
    /* Στη θέση του Headless, που ήταν άλλη τράπουλα για το ίδιο παιχνίδι. Ίδια σειρά, τρίτη
       επιλογή — αλλά αυτή αλλάζει τον τρόπο, όχι τα φύλλα: καθόλου στόχοι, καθόλου perks. */
    { id: "survival", name: "Survival", desc: "No targets, no perks. The cards never run out — climb until nothing does.", glyph: "∞", mode: "surv", lock: { key: "best", n: 6, text: "Clear ante 6" } },
  ];
  const deckById = {}; DECKS.forEach((d) => { deckById[d.id] = d; });

  /* Συνέργειες: δύο charms μαζί ξεκλειδώνουν ένα τρίτο εφέ. */
  const SYNERGIES = [
    { id: "royal", a: "kingmaker", b: "loyal", name: "Royal Court", desc: "Aces are worth +70 Base instead of +45." },
    { id: "reaction", a: "afterburner", b: "ember", name: "Chain Reaction", desc: "Chain ×3 and above: Mult ×3 instead of ×2 — bomb or no bomb." },
    { id: "backstairs", a: "lowroad", b: "ladder", name: "Back Stairs", desc: "Ladder reaches five ranks above the rung — and every Ladder step pays Mult ×1.5." },
    { id: "lockstep", a: "ladder", b: "loyal", name: "Lockstep", desc: "Loyalty counts any suit you have already led this round, not just the last one." },
    { id: "bookends", a: "encore", b: "mirror", name: "Bookends", desc: "A last hand of the same kind as your first: Mult ×3 instead of ×2." },
    { id: "tempo", a: "climber", b: "patient", name: "Tempo", desc: "Every chain step counts triple." },
    { id: "lungs", a: "cheap", b: "wind", name: "Deep Lungs", desc: "Every broken chain gives you a discard back." },
    { id: "jewels", a: "court", b: "goldsmith", name: "Crown Jewels", desc: "A Gold face card adds +120 Base instead of +60." },
  ];
  const synById = {}; SYNERGIES.forEach((s) => { synById[s.id] = s; });
  /* Ποιο «όνομα» φωνάζει η οθόνη όταν ένα χέρι αξίζει περισσότερα από ένα. */
  /* Η σειρά κρίνει ΤΙ φωνάζει η οθόνη: το callout δείχνει το tags[0]. Άγνωστο tag έπαιρνε
     `indexOf` −1, δηλαδή πήγαινε ΠΡΩΤΟ — έτσι το «Second Wind» και το «+1 breath» έκλεβαν το
     callout από το «Bomb!». Τώρα το άγνωστο πάει τελευταίο. */
  const TAG_ORDER = ["Bomb!", "Ladder to Heaven", "Ace", "Chain broken", "Second Wind", "Overkill", "Long Run", "Staircase", "Mirror", "+1 breath", "Deep Lungs", "Tight Step", "Humble"];
  const tagOrd = (t) => { const i = TAG_ORDER.indexOf(t); return i < 0 ? 99 : i; };

  /* ============================== RNG ============================== */
  function hash(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return (h ^ (h >>> 16)) >>> 0; }
  function next(S) { S.rng = (S.rng + 0x6d2b79f5) | 0; let t = Math.imul(S.rng ^ (S.rng >>> 15), 1 | S.rng); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  function shuffle(S, a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(next(S) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  /* ============================== helpers ============================== */
  const has = (S, id) => S.charms.indexOf(id) >= 0;
  const chal = (S) => S.chal || null;
  /* S.noSyn: διακόπτης μόνο για μέτρηση (tools/synergy.js) — απενεργοποιεί κάθε συνέργεια
     ώστε να μετρηθεί η καθαρή οριακή αξία της, με τα ΙΔΙΑ δύο charms στο χέρι. */
  const syn = (S, id) => { if (S.noSyn) return false; const s = synById[id]; return !!s && has(S, s.a) && has(S, s.b); };
  const activeSynergies = (S) => SYNERGIES.filter((s) => has(S, s.a) && has(S, s.b));
  /* Συνέργειες που θα ενεργοποιούσε το charm `id` με όσα ήδη κρατάς. */
  const synergyFor = (S, id) => SYNERGIES.filter((s) => (s.a === id && has(S, s.b)) || (s.b === id && has(S, s.a)));
  /* Στόχος πέρα από την Κορυφή (Endless). Ήταν καρφωμένο ×1,15 ανά ante ενώ η μόνη ανταμοιβή
     εκεί είναι ένα perk ανά 3 antes (≈ +10% δύναμη): ο στόχος τριπλασιαζόταν στον χρόνο που
     η δύναμη ανέβαινε 10%, και το Endless κρατούσε 4 antes (p50 θάνατος 54). Τώρα από το CFG,
     και στο Endless πληρώνει ΚΑΘΕ ante — αλλιώς γεωμετρικός στόχος vs προσθετική ανταμοιβή. */
  const tgtAt = (a) => (a < TARGETS.length ? TARGETS[a] : Math.round(TARGETS[TARGETS.length - 1] * Math.pow(CFG.endlessStep, a - TARGETS.length + 1)));
  const rule = (S) => (S.chal ? null : (S.rules && S.rules[S.ante]) || null);
  /* Κάθε 3η πίστα: challenge και ανταμοιβή μαζί — αλλά ΕΝΑ πράγμα, εναλλάξ.
     Σταθμός 1 perk, σταθμός 2 charm, σταθμός 3 perk… Ένα charm κάθε έξι πίστες, τρεις θέσεις:
     το build κλειδώνει νωρίς και μετά χτίζεις γύρω του με perks. */
  const isReward = (a) => a >= TARGETS.length || a % CFG.rewardEvery === CFG.rewardEvery - 1;
  /* Ο ΠΡΩΤΟΣ σταθμός πληρώνει charm, όχι perk. Μετρημένο (tools/cadence.js 250, ίδια seeds,
     ίδια πολιτική): με perk πρώτο το 32% των runs τελείωνε χωρίς να έχει δει ΠΟΤΕ charm και
     το 1ο charm έφτανε στο ante 6 — δηλαδή ένα στα τρία runs δεν συναντούσε καθόλου το
     επίπεδο build του παιχνιδιού. Με charm πρώτο: 12% και ante 3. Η δύναμη δεν αλλάζει
     (μέσο ante θανάτου 14,73 → 14,61, νίκες 13 → 14): αλλάζει μόνο η ΣΕΙΡΑ. */
  const rewardKind = (a) => (Math.floor(a / CFG.rewardEvery) % 2 === (CFG.charmFirst ? 0 : 1) ? "charm" : "up");
  const cmp = (a, b) => a.r - b.r || a.si - b.si;
  const isWild = (c) => !!c && c.e === "wild";
  const isAce = (c) => !!c && (c.r === 14 || isWild(c));
  const isFace = (c) => !!c && !isWild(c) && c.r >= 11 && c.r <= 13;
  /* No Aces: οι άσοι παγώνουν τελείως — δεν παίζονται ούτε μόνοι ούτε μέσα σε χέρι.
     Ο τζόκερ δεν είναι άσος εδώ: μένει μπαλαντέρ. */
  const frozen = (S, c) => chal(S) === "noace" && !isWild(c) && c.r === 14;

  function apply(S, id) {
    switch (id) {
      case "m1": case "m2": MULT_KIND[id].forEach((k) => { S.mult[k] += MULT_STEP[id]; }); break;
      case "pl": S.playsMax += 1; break;
      case "di": S.discMore = (S.discMore || 0) + 1; break;
      case "wi": S.handSize += 1; break;
      case "cs": S.chainStart += 1; break;
      case "gt": S.deck.concat(S.hand).forEach((c) => { if (c.r === 14 && !c.e) c.e = "gold"; }); break;
      case "th": {
        const ranks = S.deck.filter((c) => !isWild(c)).map((c) => c.r);
        if (!ranks.length) break;
        const lo = Math.min.apply(null, ranks);
        /* «For good» σημαίνει τράπουλα, χέρι ΚΑΙ στοίβα. Πριν έφευγαν μόνο από την τράπουλα:
           ό,τι κρατούσες τη στιγμή της αγοράς έμενε για πάντα, γιατί το startRound κρατά ό,τι
           δεν είναι ορφανό — και ένα ζευγάρι διάρια δεν είναι ορφανό. Μετρημένο: 8/8 κομμένα
           φύλλα ακόμη στο χέρι έξι γύρους αργότερα, στο 3ο πιο πολύτιμο perk του παιχνιδιού. */
        const keep = (c) => isWild(c) || c.r !== lo;
        S.deck = S.deck.filter(keep);
        S.hand = S.hand.filter(keep);
        if (S.pile) S.pile = S.pile.filter(keep);
        S.removed.push(lo);
        break;
      }
    }
    S.bought[id] = (S.bought[id] || 0) + 1;
  }

  /* ============================== run ============================== */
  function newRun(seedStr, unlocked, deckId) {
    const seed = String(seedStr || "").trim() || String(Math.floor(Math.random() * 1e9));
    const D = deckById[deckId] || DECKS[0];
    const S = {
      v: 15, seed, rng: hash(seed) | 0, deckId: D.id, endless: false, mode: D.mode === "surv" ? "surv" : "run",
      ante: 0, phase: "round", offers: [], picks: 0, nOffers: CFG.offers,
      handSize: CFG.handSize, playsMax: CFG.plays, discMore: 0, chainStart: 0,
      hand: [],
      mult: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], removed: [], bought: {},
      deck: [], nextId: 1, charms: [], charmSlots: CFG.charmSlots,
      unlocked: (unlocked || []).slice(),
      chals: {}, rules: {},
      stats: { quads: 0, gold: 0, silver: 0, chain7: 0, maxChain: 0, plays: 0, aces: 0, breaks: 0 },
    };
    const topR = 14, jokers = D.id === "wild" ? 4 : CFG.jokers;
    for (let r = 2; r <= topR; r++) for (let si = 0; si < 4; si++) S.deck.push({ id: S.nextId++, r, si });
    for (let j = 0; j < jokers; j++) S.deck.push({ id: S.nextId++, r: 0, si: j % 4, e: "wild" });
    /* Survival: μία τράπουλα, κανένας στόχος, κανένα perk ή charm, κανένα challenge.
       Τελειώνει όταν τελειώσουν τα φύλλα — η τράπουλα ΕΙΝΑΙ το χρονόμετρο. */
    if (S.mode === "surv") { S.playsMax = 999; S.charmSlots = 0; }
    else {
      const pool = RANDOM_CHALLENGES.slice();
      for (let a = 0; a < TARGETS.length; a++) if (isReward(a)) S.chals[a] = pool.length ? pool.splice(Math.floor(next(S) * pool.length), 1)[0] : RANDOM_CHALLENGES[Math.floor(next(S) * RANDOM_CHALLENGES.length)];
      S.chals[TARGETS.length - 1] = "summit";
      for (let a = 1; a < TARGETS.length - 1; a++) if (!S.chals[a] && next(S) < CFG.ruleChance) S.rules[a] = RULES[Math.floor(next(S) * RULES.length)].id;
    }
    S.rolled = {};
    startRound(S);
    return S;
  }
  /* Κάθε challenge ante παίρνει την ίδια έκπτωση· το Rich Air χτίζει πάνω σε αυτήν. */
  const chalMulOf = (id) => (id ? CFG.chalTargetMul * (CFG.chalMul[id] || 1) : 1);
  const isSurv = (S) => S.mode === "surv";
  /* Πόσο απότομο είναι το βουνό τώρα: πόσες ΕΠΙΠΛΕΟΝ βαθμίδες ανεβαίνει το rung μετά από
     κάθε παίξιμο. Μόνο στο Survival, και μεγαλώνει με τα χέρια που έχεις παίξει. */
  const steepOf = (S) => (isSurv(S) && CFG.survSteep ? Math.floor((S.stats.plays || 0) / CFG.survSteep) : 0);
  const target = (S) => (isSurv(S) ? Infinity : Math.round(tgtAt(S.ante) * chalMulOf(chal(S)) * (chal(S) === "richair" ? CFG.richAirMul : 1)));
  const roundHandSize = (S) => (chal(S) === "short" ? Math.min(CFG.shortHand, S.handSize) : chal(S) === "nodiscard" || chal(S) === "noace" ? S.handSize + 1 : S.handSize);
  const handCap = (S) => roundHandSize(S);

  /* Τυχαία ενίσχυση σε φύλλο που μόλις τράβηξες: μένει για πάντα (και στην τράπουλα). */
  function maybeEnhance(S, c) {
    if (c.e || isWild(c) || next(S) >= CFG.enhChance) return;
    const W = Object.assign({}, CFG.enhWeights);
    const jcap = S.deckId === "wild" ? CFG.jokerCap + 2 : CFG.jokerCap;
    if (S.deck.filter(isWild).length >= jcap) delete W.wild; else if (S.deckId === "wild") W.wild *= 2;
    const keys = Object.keys(W), tw = keys.reduce((a, k) => a + W[k], 0);
    let x = next(S) * tw, e = keys[0];
    for (const k of keys) { x -= W[k]; if (x <= 0) { e = k; break; } }
    c.e = e; c.x = e; if (e === "wild") c.r = 0;
    const d = S.deck.find((k) => k.id === c.id); if (d) { d.e = e; if (e === "wild") d.r = 0; }
    (S.enhNew = S.enhNew || []).push(e);
  }
  /* Survival: τα φύλλα δεν σώνονται ποτέ. Ό,τι έχει παιχτεί ή πεταχτεί ξανακατεβαίνει
     ανακατεμένο — με τις ενισχύσεις του, γιατί αυτές είναι μόνιμες. */
  function refill(S) {
    if (!isSurv(S) || S.pile.length) return;
    const held = new Set(S.hand.map((c) => c.id));
    const back = S.deck.filter((c) => !held.has(c.id)).map((c) => Object.assign({}, c));
    if (!back.length) return;
    S.shuffles = (S.shuffles || 0) + 1;
    S.pile = shuffle(S, back);
    S.discardPile = [];
    S.log.push({ t: "Shuffle", c: "the deck comes round again · " + S.pile.length + " cards", p: "", cls: "bonus" });
  }
  function draw(S, n, deal) {
    const drawn = [];
    while (n > 0) {
      refill(S);
      if (!S.pile.length) break;
      const c = S.pile.pop(); c.n = true; if (!deal) maybeEnhance(S, c); S.hand.push(c); drawn.push(c); n--;
    }
    S.hand.sort(cmp);
    return drawn;
  }
  function startRound(S) {
    S.chal = S.chals[S.ante] || null;
    const n = roundHandSize(S);
    /* Το χέρι μένει από γύρο σε γύρο, χωρίς να διαλέγεις: τα «ορφανά» (φύλλα που δεν μπαίνουν
       σε κανέναν συνδυασμό) αντικαθίστανται μόνα τους. */
    const drop = new Set(S.hand.length > 1 ? orphans(S).map((i) => S.hand[i].id) : []);
    const kept = S.hand.filter((c) => c && !drop.has(c.id)).map((c) => Object.assign({}, c));
    const first = kept.slice(0, n), firstIds = new Set(first.map((c) => c.id));
    const rest = shuffle(S, S.deck.filter((c) => !firstIds.has(c.id)).map((c) => Object.assign({}, c)));
    S.pile = rest; S.discardPile = [];
    S.hand = first.map((c) => { const k = Object.assign({}, c); delete k.h; delete k.n; return k; });
    draw(S, n - S.hand.length, true);
    S.hand.forEach((c) => { delete c.n; });
    S.enhNew = [];
    if (chal(S) === "blind") {
      /* «Open cheap, then look» θέλει κάτι ανοιχτό να παίξεις: ξαναδιαλέγουμε ποια φύλλα
         είναι μπρούμυτα μέχρι τα φανερά να κάνουν έστω έναν συνδυασμό. */
      const nb = Math.min(CFG.blindCount, S.hand.length - 2);
      for (let t = 0; t < 12; t++) {
        S.hand.forEach((c) => { delete c.h; });
        shuffle(S, S.hand.map((_, i) => i)).slice(0, nb).forEach((i) => { S.hand[i].h = true; });
        if (candidates(S).length) break;
      }
    }
    S.sel = [];
    S.rung = null;
    S.chain = 0; S.score = 0; S.plays = 0; S.lastSuit = null; S.breaks = 0;
    S.rdisc = 0; S.rfree = 0; S.rbombs = 0; S.survBomb = S.survBomb || 0; S.rsuits = []; S.hot = 0; S.done = 0; S.brokeCost = 0; S.rkinds = {}; S.rmax = 0; S.firstK = null; S.lastK = null;
    S.chainBonus = rule(S) === "r_head" ? 1 : 0;
    /* Discards: σταθερός πόρος του γύρου, ξεχωριστός από τα plays. */
    S.discMax = discMaxOf(S);
    S.playsLeft = S.playsMax - (chal(S) === "fewplays" ? 1 : 0);
    S.played = []; S.log = [];
    S.phase = "round"; S.offers = [];
  }

  /* ============================== αξιολόγηση ============================== */
  const K = (kind, rank, size) => ({ kind, rank, size });
  /* Ταξινόμηση κατά Tichu. Wild = οποιοδήποτε φύλλο (γεμίζει κενά, επεκτείνει προς τα πάνω). */
  function classify(cs) {
    if (!cs || !cs.length) return null;
    /* Ένα φύλλο είναι χέρι μόνο αν είναι άσος (ή τζόκερ): το πρώτο σκαλί της αλυσίδας. */
    if (cs.length === 1) return isAce(cs[0]) ? K(9, 14, 1) : null;
    const n = cs.length, F = cs.filter((c) => !isWild(c)), w = n - F.length;
    /* Όλα τζόκερ: το `n >= 5` έδινε Straight (base 190) αντί Straight Flush (496) — και
       χανόταν το bomb, δηλαδή δεν άνοιγε το τραπέζι. Οι μπαλαντέρ παίρνουν όποιο χρώμα θέλουν,
       άρα μια ατόφια σκάλα από τζόκερ είναι εξ ορισμού και χρωματιστή. */
    if (!F.length) return n === 2 ? K(1, 14, 2) : n === 3 ? K(2, 14, 3) : n === 4 ? K(6, 14, 4) : n >= 5 ? K(7, 14, n) : null;
    const bR = {}; F.forEach((c) => { bR[c.r] = (bR[c.r] || 0) + 1; });
    const ranks = Object.keys(bR).map(Number).sort((x, y) => x - y), d = ranks.length, lo = ranks[0], hi = ranks[d - 1], span = hi - lo + 1;
    const maxC = Math.max.apply(null, ranks.map((r) => bR[r]));
    let best = null;
    const take = (k) => { if (!best || kbase(k) > kbase(best) || (kbase(k) === kbase(best) && k.rank > best.rank)) best = k; };
    if (d === 1) {
      if (n === 2) take(K(1, lo, 2)); else if (n === 3) take(K(2, lo, 3)); else if (n === 4) take(K(6, lo, 4));
      else if (n === 5) { if (bR[lo] === 3) take(K(5, lo, 5)); else if (bR[lo] <= 2 && w >= 3) take(K(5, 14, 5)); }
    }
    if (n >= 4 && n % 2 === 0 && n <= 8 && d <= n / 2 && maxC <= 2) take(K(8, d < n / 2 ? 14 : hi, n));
    if (n === 5 && d === 2) {
      const a = hi, b = lo;
      if (bR[a] <= 3 && bR[b] <= 2) take(K(5, a, 5)); else if (bR[b] <= 3 && bR[a] <= 2) take(K(5, b, 5));
    }
    if (n >= 5 && maxC === 1 && span <= n && span - d <= w) {
      const top = Math.min(14, hi + (n - span));
      if (top - n + 1 >= 2) take(K(F.every((c) => c.si === F[0].si) ? 7 : 4, top, n));
    }
    if (n >= 4 && n % 2 === 0 && maxC <= 2) {
      const p = n / 2;
      if (span <= p) { const top = Math.min(14, hi + (p - span)); if (top - p + 1 >= 2) take(K(3, top, n)); }
    }
    return best;
  }
  /* Υβρίδιο: ανώτερος τύπος χτυπάει κατώτερο (Pair < Trips < Stairs < Straight < Full < Quads < Str.Flush).
     Στον ίδιο τύπο, Tichu: ίδιο μήκος και ψηλότερη αξία — ή μακρύτερη κέντα / σκάλα. */
  function beats(k, r) {
    if (!k) return false;
    if (!r) return true;
    if (k.kind !== r.kind) return KINDS[k.kind].tier > KINDS[r.kind].tier;
    if (k.size !== r.size) return k.size > r.size;
    return k.rank > r.rank;
  }
  /* Όλα τα χέρια παίζονται. Το «climbs» λέει μόνο αν συνεχίζει η αλυσίδα. */
  /* High Ground: ο φραγμός δεν είναι αρχικό rung (θα ίσχυε μόνο για το πρώτο χέρι) — είναι
     όρος που κρατά όλο τον γύρο. Μοναχικός άσος και μικρά ζευγάρια γράφουν, αλλά δεν ανεβάζουν. */
  const tooSmall = (S, k) => chal(S) === "highground" && (k.kind === 9 || (k.kind === 1 && k.rank < CFG.highGroundRank));
  const climbs = (S, k) => beats(k, S.rung) && !tooSmall(S, k);
  const sameShape = (a, b) => !!a && !!b && a.kind === b.kind && a.size === b.size;
  /* Πού θα βρεθεί το rung ΜΕΤΑ από αυτό το χέρι. Το UI χρειάζεται να το δείχνει: με το
     Sticky Rung ή με απότομο βουνό, το rung πηδάει μόνο του και χωρίς αυτό διαβάζεται ως bug. */
  const rungAfter = (S, k) => (!k ? S.rung || null : isBomb(k) ? null
    : { kind: k.kind, rank: Math.min(14, k.rank + (chal(S) === "sticky" ? 2 : 0) + steepOf(S)), size: k.size });
  /* Το πλαφόν σε ένα σημείο, ώστε να μην το προσπερνά κανείς προσθέτοντας βήματα μετά. */
  /* Στο Survival η αλυσίδα ΔΕΝ έχει οροφή: όλο το mode είναι «πόσο κρατάς μία αλυσίδα».
     Μετρημένο με οροφή ×6, το skill headroom ήταν +6% (greedy 4885 → σωστό παίξιμο 5164),
     δηλαδή το σκορ το έγραφε η τράπουλα, όχι ο παίκτης. */
  function capPos(S, p) { if (isSurv(S)) return p; p = Math.min(CFG.chainCap, p); return chal(S) === "thinair" ? Math.min(CFG.thinAirCap, p) : rule(S) === "r_cap" ? Math.min(CFG.lowCeiling, p) : p; }
  function chainPos(S) { return capPos(S, S.chain + 1 + S.chainStart + (S.chainBonus || 0)); }
  /* Χρώμα που «οδηγεί» το χέρι: τα περισσότερα φύλλα, και στην ισοπαλία το ΨΗΛΟΤΕΡΟ φύλλο.
     Χωρίς το δεύτερο κριτήριο η ισοπαλία έσπαγε με τη σειρά των κλειδιών — δηλαδή πάντα ♠ —
     οπότε το 43,7% των χεριών «οδηγούνταν» από μπαστούνι, το Black Night χτυπούσε 55% έναντι
     45% του Red Night με ταυτόσημο κείμενο, και το Loyalty ήταν κρυφά charm για μπαστούνια. */
  function leadSuit(cs) {
    const cnt = {}, top = {};
    let ids = 0;
    cs.forEach((c) => { if (isWild(c)) return; cnt[c.si] = (cnt[c.si] || 0) + 1; if (!(top[c.si] >= c.r)) top[c.si] = c.r; ids += c.id | 0; });
    const ks = Object.keys(cnt).map(Number);
    if (!ks.length) return null;
    let bc = 0, bt = 0;
    ks.forEach((k) => { if (cnt[k] > bc || (cnt[k] === bc && top[k] > bt)) { bc = cnt[k]; bt = top[k]; } });
    /* Ισοπαλία (π.χ. ζευγάρι ♠♥): ντετερμινιστικό αλλά ομοιόμορφο σπάσιμο πάνω στα ids. */
    const tied = ks.filter((k) => cnt[k] === bc && top[k] === bt);
    return tied.length === 1 ? tied[0] : tied[Math.abs(ids) % tied.length];
  }
  /* Πλήρης υπολογισμός πόντων ενός υποψήφιου χεριού — UI και bot βλέπουν το ίδιο.
     Chips × Mult, όπως στο Balatro:
       Chips = βάση σχήματος + αξία φύλλων + σταθερά μπόνους (Court, Kingmaker)
       Mult  = βάση σχήματος + αναβαθμίσεις + βήματα αλυσίδας, επί τους πολλαπλασιαστές (Gold, Silver, charms)
     Αξία φύλλων: 2–10 όσο γράφουν, J/Q/K 10, A 11, τζόκερ 10 — μετράει, χωρίς να κυριαρχεί. */
  const CHIPV = { 11: 10, 12: 10, 13: 10, 14: 11 };
  const cardChip = (c) => (isWild(c) ? 10 : CHIPV[c.r] || c.r);
  const cardChips = (cs) => cs.reduce((a, c) => a + cardChip(c), 0);
  const roundMult = (m) => Math.round(m * 10) / 10;
  function scoreOf(S, k, cs) {
    const notes = [], R = rule(S);
    let chips = kchips(k) + cardChips(cs);
    let mult = kmult(k) + (S.mult[k.kind] || 0);
    if (has(S, "court") && cs.some(isFace)) { const jw = syn(S, "jewels") && cs.some((c) => isFace(c) && c.e === "gold"); chips += jw ? 120 : 60; notes.push(jw ? "Crown Jewels +120" : "Court +60"); }
    if (has(S, "kingmaker")) { const na = cs.filter(isAce).length; if (na) { const per = syn(S, "royal") ? 70 : 45; chips += per * na; notes.push((syn(S, "royal") ? "Royal Court +" : "Kingmaker +") + per * na); } }
    /* Αλυσίδα: κάθε σκαλί πολλαπλασιάζει το Mult — μόνο αν το χέρι ανεβαίνει.
       Χέρι που δεν ανεβαίνει γράφει σκέτο chips × mult και σπάει την αλυσίδα. */
    const prev = S.rung, up = climbs(S, k);
    let pos = chainPos(S);
    /* Το Ladder ζητούσε ΙΔΙΟ σχήμα ΚΑΙ ακριβώς +1 βαθμό: μετρημένο Δ +0,80 ante, δηλαδή
       στατιστικά αδιάκριτο από το τίποτα. Ο περιορισμός στο σχήμα έφυγε — μένει το σφιχτό βήμα. */
    const lgap = prev ? k.rank - prev.rank : 0;
    let bshm = 1;
    const lwin = syn(S, "backstairs") ? CFG.backStairsWindow : CFG.ladderWindow;
    const ladder = has(S, "ladder") && !!prev && lgap >= 1 && lgap <= lwin;
    /* Lockstep: το Loyalty κοιτούσε ΜΟΝΟ το αμέσως προηγούμενο lead suit — δύο σφιχτοί όροι
       μαζί (Ladder + ίδιο χρώμα) ήταν μετρημένα νεκρή συνέργεια (Δ +0,01 ante). Τώρα δέχεται
       κάθε χρώμα που οδήγησες μέσα στον γύρο. */
    const ls = leadSuit(cs);
    const loyal = has(S, "loyal") && ls != null && (syn(S, "lockstep") ? (S.rsuits || []).indexOf(ls) >= 0 : S.lastSuit === ls);
    if (up) {
      let steps = 0;
      if (ladder) { steps += 2; notes.push(lgap > CFG.ladderWindow ? "Back Stairs +2 steps" : "Ladder +2 steps"); }
      /* Τα σκαλιά κόβονται στο chainCap, οπότε ένα charm που δίνει ΜΟΝΟ σκαλιά είναι δομικά
         νεκρό μόλις η αλυσίδα ακουμπήσει την οροφή. Το Back Stairs πληρώνει και σε Mult. */
      if (ladder && syn(S, "backstairs")) { bshm = 1.5; }
      if (loyal) { steps += 1; chips += 60; notes.push("Loyalty +1 step, +60"); }
      pos = capPos(S, pos + steps);
    }
    /* Patient μπαίνει ΠΡΙΝ την αλυσίδα, ώστε να πολλαπλασιάζεται μαζί με το υπόλοιπο Mult. */
    /* Το Patient μπαίνει πριν την αλυσίδα και πριν ΚΑΙ ΤΑ ΔΥΟ πλαφόν ×, οπότε ό,τι το ταΐζει
       (Sleight +3 discards) πολλαπλασιαζόταν ανεμπόδιστα: μετρημένα το ζευγάρι Patient+Sleight
       άξιζε +0,92 πάνω από την πρόβλεψη — 3,5× την καλύτερη δηλωμένη συνέργεια. Δικό του πλαφόν. */
    if (has(S, "patient")) { const d = Math.min(CFG.patientCap, discardsLeft(S) * 3); if (d) { mult += d; notes.push("Patient +" + d + " Mult"); } }
    /* Climber μετράει κάθε σκαλί διπλό, το Tempo τριπλό — μέχρι την οροφή του chainStepCap. */
    const stepMult = syn(S, "tempo") ? 3 : has(S, "climber") ? 2 : 1;
    const rawSteps = Math.max(0, pos - 1 + CFG.chainFloor) * stepMult;
    const capSteps = (n) => (isSurv(S) ? n : Math.min(CFG.chainStepCap, n));
    /* Το σπάσιμο τιμωρεί ΔΥΟ φορές: το χέρι χάνει ΟΛΟ τον πολλαπλασιαστή αλυσίδας, και η
       αλυσίδα μηδενίζει. Το Slipstream μάλωνε μόνο με το δεύτερο — μετρημένο άξιζε −1,49
       ante, το χειρότερο charm του παιχνιδιού, παρότι μιλούσε στο 73% των γύρων: ένα σκαλί
       πίσω σε γύρο 3,4 παιξιμάτων δεν είναι τίποτα. Τώρα πιάνει το ΠΡΩΤΟ, που είναι το
       ακριβό: το σπασμένο χέρι πληρώνεται μισή αλυσίδα. */
    let steps = up ? capSteps(rawSteps) : 0;
    if (!up && has(S, "cheap")) steps = Math.floor(capSteps(rawSteps) * CFG.slipKeep);
    const chainMul = 1 + CFG.chainStep * steps;
    if (steps) { mult = roundMult(mult * chainMul); notes.push(up ? "Chain ×" + pos + " · Mult ×" + roundMult(chainMul) : "Slipstream · half chain, Mult ×" + roundMult(chainMul)); }
    /* Gold και Silver πολλαπλασιάζουν, ένα φύλλο τη φορά — όπως ακριβώς το λένε οι περιγραφές. */
    const golds = cs.filter((c) => c.e === "gold").length, silvers = cs.filter((c) => c.e === "silver").length;
    let factor = 1;
    if (golds) factor *= Math.pow(has(S, "goldsmith") ? 3 : 2, golds);
    if (silvers) factor *= Math.pow(1.5, silvers);
    /* Η ψηλή οροφή είναι του Goldsmith ΚΑΙ του χρυσού: χωρίς gold στο χέρι, τρία silver
       πληρώνονταν ×3,38 αντί ×3 μόνο επειδή ο παίκτης κρατούσε το charm. */
    const ecap = has(S, "goldsmith") && golds ? CFG.goldsmithCap : CFG.enhCap;
    if (factor > ecap) factor = ecap;
    factor = Math.round(factor * 100) / 100;
    if (factor > 1) notes.push((golds && silvers ? "Gold + Silver" : golds ? "Gold" : "Silver") + " ×" + factor);
    let hm = bshm;
    if (bshm > 1) notes.push("Back Stairs ×" + bshm);
    if (has(S, "summiteer") && isBomb(k)) { hm *= 2; notes.push("Summiteer ×2"); }
    /* Το Overkill ζητούσε ΙΔΙΟ σχήμα ΚΑΙ +4 βαθμούς. Μετρημένο (tools/trig.js) μιλούσε στο
       6,0% των παιξιμάτων και άξιζε −0,56 ante: αόρατο. Η αιτία είναι δομική — η σκάλα
       ανεβάσματος είναι κατά ΕΙΔΟΣ, οπότε δύο διαδοχικά χέρια σπάνια έχουν ίδιο σχήμα
       (13,7% των παιξιμάτων, tools/rung.js). Μένει το «πολύ ψηλότερα από το rung». */
    if (has(S, "leap") && up && !!prev && k.rank - prev.rank >= CFG.overkillGap) { hm *= 2; notes.push("Overkill ×2"); }
    if (has(S, "lowroad") && k.kind === 1 && k.rank <= 6) { hm *= 2; chips += 40; notes.push("Low Road ×2, +40"); }
    if (has(S, "mirror") && S.plays === 0) { hm *= CFG.mirrorMul; notes.push("Mirror ×" + CFG.mirrorMul); }
    if (has(S, "ember") && pos >= 3) { const cr = syn(S, "reaction"); hm *= cr ? 3 : 2; notes.push(cr ? "Chain Reaction ×3" : "Ember ×2"); }
    if (has(S, "encore") && S.playsLeft < 2) { const be = syn(S, "bookends") && S.firstK && S.firstK.kind === k.kind; hm *= be ? 3 : 2; notes.push(be ? "Bookends ×3" : "Encore ×2"); }
    /* S.hot: άναψε στη βόμβα, σβήνει στο σπάσιμο της αλυσίδας. */
    /* Η βόμβα ΜΕΤΡΑΕΙ και η ίδια. Πριν, το Afterburner πλήρωνε μόνο τα χέρια ΜΕΤΑ τη βόμβα —
       και ο γύρος έχει 3,4 παιξίματα, οπότε μετά μια βόμβα μένει ~1 χέρι: 4,5% ρυθμός και
       −1,00 ante. */
    if (has(S, "afterburner") && (S.hot || isBomb(k))) { hm *= 2; notes.push("Afterburner ×2"); }
    if (R === "r_red" || R === "r_black") { const red = ls === 1 || ls === 2; if (ls != null && (R === "r_red") === red) { hm *= 1.5; notes.push((R === "r_red" ? "Red" : "Black") + " Night ×1.5"); } }
    if ((R === "r_str2" && k.kind === 4) || (R === "r_trips2" && k.kind === 2) || (R === "r_full2" && k.kind === 5)) { hm *= 2; notes.push(ruleById[R].name + " ×2"); }
    if (R === "r_low2" && !isBomb(k) && k.rank <= 6) { hm *= 2; notes.push("Underdogs ×2"); }
    if (hm > CFG.hmCap) { hm = CFG.hmCap; notes.push("Stacked ×" + hm + " (cap)"); }
    /* Μηδενισμοί στο τέλος, ώστε «κανένα Chip» να σημαίνει πραγματικά κανένα. */
    if (R === "r_pair0" && k.kind === 1) { chips = 0; notes.push("Cheap Pairs · no base"); }
    if (chal(S) === "summit" && !up) { chips = 0; notes.push("Summit · no climb, no score"); }
    /* Οι βόμβες είναι το σπανιότερο χέρι και πλήρωναν ΛΙΓΟΤΕΡΟ από ένα φουλ: μετρημένο σε
       πραγματικό παίξιμο, καρέ 5 225 πόντοι ανά παίξιμο έναντι 6 534 του φουλ, γιατί τέσσερα
       φύλλα ίδιας αξίας φέρνουν λιγότερα chips από πέντε. Δικός τους πολλαπλασιαστής, ΕΞΩ από
       το hmCap, ώστε το Summiteer να προσθέτει αντί να τον καταπίνει. */
    const bombMul = isBomb(k) ? CFG.bombMul : 1;
    if (bombMul > 1) notes.push("Bomb ×" + bombMul);
    const total = roundMult(mult * factor * hm * bombMul);
    return { chips, mult: total, kchips: kchips(k), kmult: kmult(k), cards: cardChips(cs), pos, notes, pts: Math.round(chips * total) };
  }
  const selCards = (S) => S.sel.map((i) => S.hand[i]);
  function evalSel(S) {
    const cs = selCards(S);
    const k = classify(cs);
    if (!k || cs.some((c) => frozen(S, c))) return { k: null, legal: false, cs };
    const sc = scoreOf(S, k, cs);
    return Object.assign({ k, legal: true, up: climbs(S, k), cs }, sc);
  }
  /* "Pair 8" · "Stairs 3 to 6" · "Straight 7 to J" · "Str. Flush 5 to 9" */
  const PAIRS_NAME = { 4: "Two Pair", 6: "Three Pair", 8: "Four Pair" };
  function clabel(k) {
    if (k.kind === 9) return "Ace";
    if (k.kind === 8) return PAIRS_NAME[k.size] + " " + rname(k.rank);
    if (k.kind === 3) return "Stairs " + k.size / 2 + " to " + rname(k.rank);
    if (k.kind === 4) return "Straight " + k.size + " to " + rname(k.rank);
    if (k.kind === 7) return "Str. Flush " + k.size + " to " + rname(k.rank);
    return KINDS[k.kind].name + " " + rname(k.rank);
  }
  /* Οι βαθμίδες που καλύπτει: "4·5·6" για σκάλες, "7…J" για κέντες. */
  function crange(k) {
    if (k.kind === 3) { const p = k.size / 2, out = []; for (let r = k.rank - p + 1; r <= k.rank; r++) out.push(rname(r) + rname(r)); return out.join(" "); }
    if (k.kind === 4 || k.kind === 7) return rname(k.rank - k.size + 1) + "…" + rname(k.rank);
    return "";
  }
  /* Τι χρειάζεται για να χτυπηθεί το rung. */
  function beatText(S) {
    const r = S.rung;
    if (chal(S) === "highground" && !r) return "Nothing under a pair of " + CFG.highGroundRank + " climbs · smaller hands still score";
    const st = steepOf(S) + (chal(S) === "sticky" ? 2 : 0);
    const tail = st ? " · the rung climbs " + st + " rank" + (st === 1 ? "" : "s") + " on its own after every play" : "";
    /* Το ανοιχτό τραπέζι ΚΡΑΤΑ την αλυσίδα: μια βόμβα (ή μια ανάσα) καθαρίζει τη σκάλα και
       το επόμενο χέρι μπορεί να είναι ένας σκέτος άσος — και μετράει κανονικά ως ανέβασμα, με
       ολόκληρο τον πολλαπλασιαστή. Η παλιά διατύπωση («any hand starts the chain») διαβαζόταν
       ως «η αλυσίδα ξαναρχίζει», δηλαδή έλεγε το αντίθετο από αυτό που κάνει ο κώδικας. */
    if (!r) return (chainPos(S) > CFG.chainFloor
      ? "Table is open · anything climbs · chain ×" + chainPos(S) + " kept"
      : "Table is open · any hand starts the chain") + tail;
    const n = KINDS[r.kind].name.toLowerCase();
    const how = r.kind === 8 ? "more pairs" : r.kind === 3 || r.kind === 4 ? "a longer or higher " + n : "a higher " + n;
    return "To climb: " + how + ", or a better kind of hand" + tail;
  }

  /* Γιατί ΑΥΤΟ το χέρι δεν ανεβαίνει. Χωρίς αυτό, ο παίκτης διαλέγει δύο ζευγάρια με Κ πάνω
     σε stairs με J, βλέπει «δεν ανεβαίνει», και δεν έχει τρόπο να μάθει ότι η αξία μετράει
     ΜΟΝΟ μέσα στο ίδιο είδος και μήκος — το είδος αποφασίζει πρώτο. */
  function whyNoClimb(S, k) {
    if (!k) return "";
    if (tooSmall(S, k)) return "High Ground · nothing under a pair of " + CFG.highGroundRank + " climbs this round";
    const r = S.rung;
    if (!r || beats(k, r)) return "";
    const K = KINDS[k.kind], R = KINDS[r.kind];
    if (k.kind !== r.kind) return K.name + " ranks below " + R.name + " · a higher card does not carry across kinds";
    const pairish = k.kind === 3 || k.kind === 8;
    if (k.size !== r.size) return pairish
      ? "needs more than " + (r.size / 2) + " pairs, not a higher one"
      : "needs more than " + r.size + " cards, not a higher one";
    return "same kind and length · needs to top " + rname(r.rank);
  }

  /* ============================== κινήσεις ============================== */
  function candidatesRaw(S) {
    const bR = {}, W = [], vis = [];
    S.hand.forEach((c, i) => { if (c.h || frozen(S, c)) return; vis.push(i); if (isWild(c)) { W.push(i); return; } (bR[c.r] = bR[c.r] || []).push(i); });
    const out = [], rs = Object.keys(bR).map(Number).sort((a, b) => a - b), nw = W.length, wl = (n) => W.slice(0, n);
    /* Ο μοναχικός άσος παίζεται σαν κάθε άλλο χέρι — εκτός αν ο γύρος τον απαγορεύει. */
    vis.forEach((i) => { if (isAce(S.hand[i])) out.push([i]); });
    rs.forEach((r) => { const g = bR[r]; [2, 3, 4].forEach((tot) => { for (let use = 0; use <= Math.min(nw, tot - 1); use++) if (g.length >= tot - use) out.push(g.slice(0, tot - use).concat(wl(use))); }); });
    for (let n = 2; n <= Math.min(4, nw); n++) out.push(wl(n));
    /* 2–4 ζευγάρια σε οποιεσδήποτε βαθμίδες (wilds γεμίζουν) */
    (function pairsets(start, acc, need) {
      if (acc.length >= 2 && need <= nw) out.push(acc.reduce((a, r) => a.concat(bR[r].slice(0, 2)), []).concat(wl(need)));
      if (acc.length === 4) return;
      for (let i = start; i < rs.length; i++) pairsets(i + 1, acc.concat([rs[i]]), need + Math.max(0, 2 - bR[rs[i]].length));
    })(0, [], 0);
    rs.forEach((t) => rs.forEach((p) => {
      if (t === p) return;
      const nt = Math.max(0, 3 - bR[t].length), np = Math.max(0, 2 - bR[p].length);
      if (nt + np <= nw) out.push(bR[t].slice(0, 3).concat(bR[p].slice(0, 2), wl(nt + np)));
    }));
    const maxL = Math.min(vis.length, 13);
    for (let L = 5; L <= maxL; L++) for (let s = 2; s + L - 1 <= 14; s++) {
      let need = 0; const pk = [];
      for (let r = s; r < s + L; r++) { if (bR[r]) pk.push(bR[r][0]); else need++; }
      if (need <= nw && pk.length) out.push(pk.concat(wl(need)));
      for (let si = 0; si < 4; si++) {
        let need2 = 0; const pk2 = [];
        for (let r = s; r < s + L; r++) { const j = bR[r] ? bR[r].find((i) => S.hand[i].si === si) : undefined; if (j !== undefined) pk2.push(j); else need2++; }
        if (need2 <= nw && pk2.length >= 3) out.push(pk2.concat(wl(need2)));
      }
    }
    for (let p = 2; 2 * p <= vis.length; p++) for (let s = 2; s + p - 1 <= 14; s++) {
      let need = 0; const pk = [];
      for (let r = s; r < s + p; r++) { const g = bR[r] || []; pk.push.apply(pk, g.slice(0, 2)); need += 2 - Math.min(2, g.length); }
      if (need <= nw && pk.length) out.push(pk.concat(wl(need)));
    }
    const seen = new Set();
    return out.filter((idx) => { const key = idx.slice().sort((a, b) => a - b).join(","); if (seen.has(key)) return false; seen.add(key); return true; })
      .map((idx) => ({ idx, k: classify(idx.map((i) => S.hand[i])) })).filter((o) => o.k);
  }
  /* Το `candidates()` είναι η ακριβότερη συνάρτηση της μηχανής — 0,22ms με οκτώ διαφορετικές
     βαθμίδες, 0,68ms με δώδεκα φύλλα και τέσσερα joker — και καλείται 5,9 φορές για το ΙΔΙΟ
     χέρι: deadHand, hasClimb, hasLegal, climbCards, orphans, suggest. Το αποτέλεσμα εξαρτάται
     μόνο από το χέρι και το `chal` (το rung μπαίνει μετά, στο `climbs`), οπότε ένα memo μιας
     θέσης το κόβει σε μία κλήση. Κανένας καλών δεν πειράζει τον πίνακα που παίρνει πίσω:
     ελεγμένο ένα προς ένα (deadHand/hasLegal/hasClimb μετρούν, climbCards/orphans διαβάζουν,
     suggest και chainLen φτιάχνουν δικά τους). */
  const candidates = (function () {
    let key = null, val = null;
    return function (S) {
      const k = S.phase + "|" + (S.chal || "") + "|" +
        S.hand.map((c) => c.r + "/" + c.si + "/" + (c.e || "") + (c.h ? "h" : "")).join(",");
      if (k !== key) { key = k; val = candidatesRaw(S); }
      return val;
    };
  })();
  const legalMoves = candidates;
  const hasLegal = (S) => candidates(S).length > 0;
  /* Πόσα σκαλιά ανεβαίνει άπληστα από εδώ με ξένα φύλλα, παίρνοντας κάθε φορά το φθηνότερο που χτυπάει. */
  const costKey = (k) => KINDS[k.kind].tier * 10000 + k.size * 100 + k.rank;
  function chainLen(S, c, all) {
    const used = new Set(c.idx); let cur = c.k, len = 1;
    for (;;) {
      let nx = null;
      all.forEach((o) => { if (!beats(o.k, cur) || isBomb(o.k) || o.idx.some((i) => used.has(i))) return; if (!nx || costKey(o.k) < costKey(nx.k)) nx = o; });
      if (!nx) break;
      nx.idx.forEach((i) => used.add(i)); cur = nx.k; len++;
    }
    return len;
  }
  /* Πρόταση = το ΜΕΓΑΛΥΤΕΡΟ σχήμα που ανεβαίνει, με το μήκος της αλυσίδας μόνο για ισοπαλίες.
     Έδινε πριν «το φθηνότερο που χτυπάει το rung» — δηλαδή ακριβώς τη στρατηγική που τα ίδια
     τα εργαλεία μετρούν ως κακή. Μετρημένο σε ίδια seeds: παίκτης που ακολουθεί το Hint σε
     κάθε παίξιμο πεθαίνει στο ante 3,89· ο builder στο 17,45 (Δ −13,56 ± 0,44). Το κουμπί
     «?» του παιχνιδιού συμβούλευε να χάσεις. */
  function suggest(S) {
    const all = candidates(S);
    if (!all.length) return null;
    const up = all.filter((o) => climbs(S, o.k)), pool = up.length ? up : all;
    const val = (o) => scoreOf(S, o.k, o.idx.map((i) => S.hand[i])).pts;
    /* Survival: η αλυσίδα δεν έχει οροφή, άρα το ΜΗΚΟΣ της είναι όλο το παιχνίδι. Το φθηνότερο
       ανέβασμα κρατά το rung χαμηλά και το σερί ζωντανό. Αν τίποτα δεν ανεβαίνει, το σπάσιμο
       επιτρέπεται και κοστίζει ανάσα — τότε η σωστή πρόταση είναι το ΑΚΡΙΒΟΤΕΡΟ χέρι: αν
       πληρώσεις ανάσα, πληρώσου κι εσύ. */
    if (isSurv(S)) {
      const rank = (o) => KINDS[o.k.kind].tier * 1e6 + o.k.size * 1e3 + o.k.rank;
      if (up.length) return up.reduce((b2, o) => (!b2 || rank(o) < rank(b2) ? o : b2), null);
      /* Τίποτα δεν ανεβαίνει: αν υπάρχει ανάσα, ΑΥΤΗ είναι η σωστή κίνηση — `null` σημαίνει
         «μη παίξεις χέρι». Μετρημένο, ένας Hint που πρότεινε το μεγαλύτερο χέρι εδώ έβγαζε
         p50 5 904 έναντι 48 187 του σωστού παιξίματος: δίδασκε τη χειρότερη γραμμή.
         Με μηδέν ανάσες το σπάσιμο είναι αναπόφευκτο, οπότε προτείνει το ακριβότερο. */
      if (discardsLeft(S) > 0 && canDiscardAny(S)) return null;
      return all.reduce((b2, o) => (!b2 || val(o) > val(b2) ? o : b2), null);
    }
    let best = null, bv = -1, bl = -1;
    pool.forEach((o) => {
      const v = val(o);
      if (v < bv) return;
      const len = isBomb(o.k) ? 1 : chainLen(S, o, all);
      if (v > bv || len > bl) { best = o; bv = v; bl = len; }
    });
    return best;
  }
  /* Ποια φύλλα του χεριού μπορούν να μπουν σε ΑΝΕΒΑΣΜΑ. Στο Survival, όπου κάνεις 70+
     παιξίματα, αυτό είναι η διαφορά ανάμεσα στο «διαβάζω το χέρι μου» και στο «ψάχνω». */
  function climbCards(S) {
    const set = {};
    candidates(S).forEach((o) => { if (climbs(S, o.k)) o.idx.forEach((i) => { set[i] = 1; }); });
    return set;
  }
  /* Ορφανά: φύλλα που δεν μπαίνουν σε κανέναν συνδυασμό (εκτός Άσων και Wild). */
  function orphans(S) {
    const inUse = new Set(); candidates(S).forEach((o) => o.idx.forEach((i) => inUse.add(i)));
    const o = S.hand.map((c, i) => i).filter((i) => { const c = S.hand[i]; return !c.h && !isWild(c) && (c.r !== 14 || frozen(S, c)) && !inUse.has(i); });
    return o.sort((a, b) => S.hand[a].r - S.hand[b].r);
  }

  /* ============================== ενέργειες ============================== */
  const reveal = (S) => { S.hand.forEach((c) => { if (c.h) delete c.h; }); };
  function toggle(S, i) {
    if (S.phase !== "round" || !S.hand[i] || S.hand[i].h) return false;
    const at = S.sel.indexOf(i);
    if (at >= 0) S.sel.splice(at, 1); else S.sel.push(i);
    return true;
  }
  function removeSel(S, toDiscard) {
    const cs = selCards(S);
    S.hand = S.hand.filter((_, i) => !S.sel.includes(i));
    S.sel = [];
    cs.forEach((c) => { delete c.n; if (toDiscard) S.discardPile.push(c); });
    return cs;
  }
  /* Πόσα ορόσημα σκορ έχεις περάσει: 2500, 4500, 8100, 14580 … (×1,8 κάθε φορά).
     Γεωμετρικά, γιατί το σκορ του Survival μεγαλώνει τετραγωνικά με τα χέρια: με σταθερό
     βήμα οι ανάσες θα έρχονταν πιο γρήγορα απ' όσο ξοδεύονται και το run δεν θα τέλειωνε. */
  function survMilestone(k) { return Math.round(CFG.survStep * Math.pow(CFG.survGrow, k)); }
  function survEarn(S) {
    if (!isSurv(S)) return 0;
    let got = 0;
    while ((S.survEarned || 0) + got < CFG.survEarnCap && S.score >= survMilestone((S.survEarned || 0) + got)) got += 1;
    if (got) {
      S.survEarned = (S.survEarned || 0) + got;
      S.discMax = discMaxOf(S);
    }
    return got;
  }
  function afterPlay(S, cs, ev) {
    S.stats.gold += cs.filter((c) => c.e === "gold").length;
    S.stats.silver += cs.filter((c) => c.e === "silver").length;
    reveal(S);
    const drawn = draw(S, handCap(S) - S.hand.length);
    /* Blind Deal: δύο από τα φύλλα που μόλις τράβηξες μένουν μπρούμυτα μέχρι το επόμενο παίξιμο. */
    if (chal(S) === "blind") drawn.slice(0, CFG.blindKeep).forEach((c) => { c.h = true; });
    ev.drawn = drawn.length;
    if (S.brokeCost) { ev.brokeCost = 1; S.brokeCost = 0; }
    if (isSurv(S) && S.done) ev.last = 1;
    const earned = survEarn(S);
    if (earned) {
      ev.breaths = earned;
      S.log.push({ t: earned > 1 ? earned + " breaths earned" : "Breath earned", c: "past " + survMilestone((S.survEarned || 0) - 1).toLocaleString("en-US"), p: "+" + earned, cls: "bonus" });
    }
    S.plays += 1; S.stats.plays += 1;
  }
  /* Καταγράφει την κορυφή της αλυσίδας — τη θέση που ΠΛΗΡΩΣΕ το χέρι, όχι την επόμενη.
     Καλούνταν μετά το `S.chain += 1`, άρα έγραφε πάντα +1 σκαλί: το «Ladder to Heaven» και το
     ξεκλείδωμα του Ember («Reach chain ×6») έσκαγαν ενώ είχε πληρωθεί μόνο ×5 (743 από 757
     γύρους διαφωνούσαν με το πραγματικό μέγιστο). */
  function noteChain(S, at) {
    const pos = at == null ? chainPos(S) : at, fresh = pos > S.rmax;
    if (fresh) S.rmax = pos;
    if (pos > S.stats.maxChain) S.stats.maxChain = pos;
    if (pos >= CFG.chainCap) S.stats.chain7 = 1;
    return { pos, fresh };
  }
  function play(S) {
    if (S.phase !== "round") return null;
    const e = evalSel(S);
    if (S.playsLeft < 1) return null;
    if (!e.k) return null;
    /* Survival με μηδέν ανάσες: όσο υπάρχει ΑΝΕΒΑΣΜΑ στο χέρι, το σπάσιμο δεν επιτρέπεται.
       Το run δεν τελειώνει με ένα λάθος πάτημα ενώ υπάρχει δρόμος προς τα πάνω — τελειώνει
       μόνο όταν πραγματικά δεν ανεβαίνει τίποτα. */
    if (isSurv(S) && discardsLeft(S) <= 0 && !climbs(S, e.k) && hasClimb(S)) return null;
    const k = e.k, prev = S.rung, up = climbs(S, k), cs = removeSel(S, true);
    const tags = [];
    if (S.chain === 0 && k.kind === 1 && k.rank <= 3) tags.push("Humble");
    if (sameShape(k, prev) && k.rank === prev.rank + 1) tags.push("Tight Step");
    /* Το callout ακολουθεί τον όρο του charm Overkill — αλλιώς η οθόνη φωνάζει «Overkill»
       σε χέρια που το charm δεν πληρώνει, και αντίστροφα. */
    if (up && !!prev && k.rank - prev.rank >= CFG.overkillGap) tags.push("Overkill");
    const bomb = isBomb(k);
    if (bomb) { tags.push("Bomb!"); S.stats.quads += 1; }
    /* Survival: η βόμβα χαρίζει ΚΑΙ μία ανάσα. Καθαρίζει τη σκάλα, κρατά την αλυσίδα, και
       γεμίζει τα πνευμόνια — είναι το φύλλο που ψάχνεις όταν σε πνίγει το rung. */
    if (bomb && isSurv(S) && CFG.survBombBreath) {
      S.survBomb = (S.survBomb || 0) + CFG.survBombBreath;
      S.discMax = discMaxOf(S);
      tags.push("+1 breath");
      S.log.push({ t: "Breath earned", c: "bomb", p: "+" + CFG.survBombBreath, cls: "bonus" });
    }
    if (k.kind === 9) { tags.push("Ace"); S.stats.aces += 1; }
    if (k.kind === 4 && k.size >= 7) tags.push("Long Run");
    if (k.kind === 3 && k.size >= 6) tags.push("Staircase");
    /* Survival: το σπάσιμο ΕΠΙΤΡΕΠΕΤΑΙ και ΚΟΣΤΙΖΕΙ μία ανάσα. Ένας πόρος, δύο χρήσεις:
       πετάς φύλλα, ή σπάς την αλυσίδα. Με μηδέν ανάσες το χέρι παίζεται κανονικά, γράφει
       τους πόντους του, και το run κλείνει εκεί — δηλαδή το τελευταίο σου χέρι μπορεί να
       είναι το μεγαλύτερο, αντί για τοίχο που σου λέει «όχι». */
    if (isSurv(S) && !up) { if (discardsLeft(S) > 0) { S.rdisc += 1; S.brokeCost = 1; } else S.done = 1; }
    S.score += e.pts; S.playsLeft -= 1;
    S.lastSuit = leadSuit(cs);
    if (S.lastSuit != null) { if (!S.rsuits) S.rsuits = []; if (S.rsuits.indexOf(S.lastSuit) < 0) S.rsuits.push(S.lastSuit); }
    if (!S.firstK) S.firstK = k; S.lastK = k; if (bomb) S.hot = 1; S.rkinds[k.kind] = (S.rkinds[k.kind] || 0) + 1; if (bomb) S.rbombs += 1;
    /* Ανεβαίνεις → η αλυσίδα μεγαλώνει. Παίζεις κάτι χαμηλότερο → σπάει (ή χάνει το μισό με Slipstream). */
    let broke = 0;
    if (up) S.chain += 1;
    else {
      const was = chainPos(S);
      const keep = has(S, "wind") && S.breaks < 2;
      let np = keep ? was : has(S, "cheap") ? Math.max(1, was - 1) : 0;
      /* Το παλιό «ποτέ κάτω από ×3» ήταν νεκρό: το Slipstream χάνει ήδη ένα σκαλί μόνο και το
         Second Wind κρατά τα δύο πρώτα σπασίματα — η κατάσταση δεν προλάβαινε να προκύψει. */
      if (syn(S, "lungs") && S.rdisc > 0) { S.rdisc -= 1; tags.push("Deep Lungs"); }
      S.chain = Math.max(0, np - 1 - S.chainStart - (S.chainBonus || 0));
      /* Όταν το Second Wind ΑΠΟΡΡΟΦΑ το σπάσιμο, δεν έχει σπάσει τίποτα: το λογιστικό του
         σπασίματος έτρεχε και σε αυτόν τον δρόμο, οπότε έσβηνε το `hot` (δηλαδή σκότωνε το
         Afterburner που ο παίκτης πλήρωσε μια θέση για να έχει) και το χέρι έγραφε «Chain
         broken» ενώ η αλυσίδα κρατήθηκε ολόκληρη. */
      if (keep) { S.breaks += 1; tags.push("Second Wind"); }
      else { S.breaks += 1; S.stats.breaks += 1; broke = was; S.hot = 0; tags.push("Chain broken"); }
    }
    if (has(S, "mirror") && S.plays === 0) { S.chain += 1; tags.push("Mirror"); }
    S.rung = rungAfter(S, k);
    /* Το «Ladder to Heaven» βγαίνει μία φορά, όταν η αλυσίδα φτάσει πρώτη φορά στην οροφή. */
    { const n = noteChain(S, up ? e.pos : 0); if (n.fresh && n.pos >= CFG.chainCap) tags.push("Ladder to Heaven"); }
    S.played = cs.slice();
    S.log.push({ t: clabel(k), c: e.chips + " × " + e.mult + (bomb ? " · table opens, chain ×" + chainPos(S) + " kept" : broke ? " · chain ×" + broke + " broken" : steepOf(S) ? " · rung +" + steepOf(S) : ""), p: e.pts, cls: broke ? "pass" : "" });
    tags.sort((a, b) => tagOrd(a) - tagOrd(b));
    const ev = { type: "play", k, pts: e.pts, pos: e.pos, chips: e.chips, mult: e.mult, notes: e.notes, tags, bomb, up, broke, cleared: S.score >= target(S) };
    afterPlay(S, cs, ev);
    return ev;
  }
  /* Discard: σταθερός αριθμός ανά γύρο, ξεχωριστός από τα plays (όπως στο Balatro).
     Βάση 2 · +1 ανά Nimble Hands · +3 με Sleight · +1 με Spare Card ή Short Hand. */
  function discMaxOf(S) {
    /* Survival: το budget είναι για ΟΛΟ το run, όχι ανά γύρο. */
    /* Οι ανάσες από βόμβες μετριούνται ΞΕΧΩΡΙΣΤΑ από αυτές των οροσήμων: αν τις πρόσθετα στο
       `survEarned` θα μετακινούσαν τον δείκτη των οροσήμων, δηλαδή η βόμβα θα έτρωγε μια
       μελλοντική ανάσα αντί να χαρίζει μία. */
    if (isSurv(S)) return CFG.survDiscards + (S.discMore || 0) + (S.survEarned || 0) + (S.survBomb || 0);
    if (chal(S) === "nodiscard") return 0;
    if (chal(S) === "onedisc") return 1;
    return CFG.discards + (S.discMore || 0) + (has(S, "sleight") ? 3 : 0) + (rule(S) === "r_gift" ? 1 : 0) + (chal(S) === "short" ? 1 : 0);
  }
  const discardsLeft = (S) => Math.max(0, (S.discMax == null ? discMaxOf(S) : S.discMax) - (S.rdisc || 0));
  /* Χέρι χωρίς κανέναν συνδυασμό: το discard είναι δωρεάν, για να μη σε κλειδώνει η τράπουλα. */
  const deadHand = (S) => S.phase === "round" && S.hand.length > 0 && candidates(S).length === 0;
  /* Στο Survival δεν υπάρχει δωρεάν ανάσα: θα ήταν ατέλειωτη διαφυγή σε ατέλειωτη τράπουλα. */
  const canDiscard = (S) => S.phase === "round" && chal(S) !== "nodiscard" && (discardsLeft(S) > 0 || (!isSurv(S) && (deadHand(S) || freeScout(S)))) && S.sel.length > 0 && survStock(S);
  /* Scout: το πρώτο discard του γύρου δεν κοστίζει — μία φορά, όχι κάθε φορά. */
  const freeScout = (S) => has(S, "scout") && !S.rfree;
  function discard(S) {
    if (!canDiscard(S)) return false;
    const dead = !isSurv(S) && deadHand(S) && discardsLeft(S) <= 0, scout = !dead && freeScout(S), free = dead || scout;
    const cs = removeSel(S, true);
    if (scout) S.rfree = 1;
    if (!free) S.rdisc += 1;
    reveal(S);   /* το discard είναι η αντίδραση στο Blind Deal: γυρίζει τα κρυφά φύλλα */
    /* Survival: ένα ΠΛΗΡΩΜΕΝΟ discard ανοίγει και το τραπέζι — «μια ανάσα». Είναι ο μόνος
       τρόπος να μακρύνεις μία αλυσίδα, και είναι μετρημένα ό,τι δίνει βάθος στο mode:
       χωρίς αυτό, το σκορ το έγραφε η τράπουλα (skill headroom +6%). */
    if (isSurv(S) && !free) { S.rung = null; S.log.push({ t: "Breath", c: "table open · chain ×" + chainPos(S) + " kept", p: "", cls: "bonus" }); }
    const d = draw(S, handCap(S) - S.hand.length);
    S.log.push({ t: "Discard", c: cs.length + " out, " + d.length + " in", p: free ? "free" : discardsLeft(S) + " left", cls: "pass" });
    return true;
  }
  /* Survival: μόνο χέρια που ανεβαίνουν παίζονται. Τέλος όταν τίποτα δεν ανεβαίνει ΚΑΙ
     δεν έχεις ανάσα να ανοίξεις το τραπέζι. */
  const hasClimb = (S) => candidates(S).some((o) => climbs(S, o.k));
  /* Κόλλησες όταν καμία κίνηση δεν αλλάζει τίποτα. */
  function stuck(S) {
    if (S.phase !== "round") return false;
    if (isSurv(S)) return !!S.done || S.playsLeft < 1 || (!hasLegal(S) && !canDiscardAny(S));
    if (S.playsLeft < 1) return true;
    if (hasLegal(S)) return false;
    if (canDiscardAny(S)) return false;
    return true;
  }
  const survStock = (S) => S.pile.length > 0 || (isSurv(S) && S.deck.length > S.hand.length);
  /* Στο Survival δεν υπάρχει δωρεάν ανάσα σε νεκρό χέρι: η ατέλειωτη τράπουλα θα την έκανε
     ατέλειωτη διαφυγή (μετρημένο: 61 ανάσες ξοδεμένες από budget 14). */
  const canDiscardAny = (S) => chal(S) !== "nodiscard" && (discardsLeft(S) > 0 || (!isSurv(S) && (deadHand(S) || freeScout(S)))) && survStock(S) && S.hand.length > 0;
  function stuckReason(S) {
    if (isSurv(S)) {
      if (S.done) return "You broke the chain with no breath left — that is the run.";
      /* Το ταβάνι των 999 χεριών: αόρατο στην πράξη (μέγιστο μετρημένο 104), αλλά όταν το
         `stuck()` το βλέπει πρέπει να έχει και λόγο να δείξει. */
      if (S.playsLeft < 1) return "Nine hundred and ninety-nine hands. That is the ceiling of the mode — and the run.";
      if (hasClimb(S)) return "";
      if (discardsLeft(S) > 0) return "Nothing climbs. Breathe to open the table, or play anyway — breaking costs a breath too.";
      if (hasLegal(S)) return "No breath left — and nothing climbs. The next hand you play is your last, so make it count.";
      return "Nothing here makes a hand at all — that is the run.";
    }
    if (S.playsLeft < 1) return "No plays left — the round is over.";
    if (hasLegal(S)) return "";
    if (canDiscardAny(S)) return deadHand(S) && discardsLeft(S) <= 0 ? "These cards make no hand at all, so this discard is free." : "These cards make no hand. Discard and draw — " + discardsLeft(S) + " discard" + (discardsLeft(S) === 1 ? "" : "s") + " left.";
    if (!S.pile.length) return isSurv(S) ? "The deck is spent and nothing here makes a hand — that is the run." : "The pile is empty and nothing here makes a hand — the round is over.";
    return chal(S) === "nodiscard" ? "These cards make no hand, and this round has no discards — the round is over." : "These cards make no hand and there are no discards left — the round is over.";
  }
  function finish(S) {
    if (S.phase !== "round") return null;
    /* Survival δεν «χάνεται»: τελειώνει, και το σκορ είναι το αποτέλεσμα. */
    if (isSurv(S)) { S.phase = "lost"; return { cleared: false, surv: true }; }
    const T = target(S);
    if (S.score < T) { S.phase = "lost"; return { cleared: false }; }
    const ex = S.score - T, reward = isReward(S.ante), kind = rewardKind(S.ante);
    /* Ένα πράγμα ανά σταθμό. Το Rich Air δεν δίνει δεύτερο — δίνει περισσότερα να διαλέξεις. */
    S.pickUp = reward && kind === "up" ? 1 : 0;
    S.pickCharm = reward && kind === "charm" ? 1 : 0;
    S.nOffers = CFG.offers + (chal(S) === "richair" ? 2 : 0);
    if (S.ante === TARGETS.length - 1 && !S.endless) { S.phase = "won"; return { cleared: true, won: true, ex, reward }; }
    S.phase = "shop";
    if (S.endless) rollEndless(S, S.ante + 1);
    S.offers = reward ? makeOffers(S) : [];
    return { cleared: true, won: false, ex, reward };
  }

  /* ============================== κατάστημα ============================== */
  const charmAvailable = (S, c) => !has(S, c.id) && (!c.lock || S.unlocked.indexOf(c.id) >= 0);
  /* Ένα ταμείο: charms και αναβαθμίσεις μαζί, χωρίς τιμές. Διαλέγεις ένα και προχωράς. */
  /* Δύο διάδρομοι: perks και charms, ένα από κάθε έναν. Αν δεν χωράει charm (γεμάτες θέσεις
     ή τα έχεις όλα), η θέση του γίνεται δεύτερο perk — καμία επιλογή δεν πάει χαμένη. */
  function makeOffers(S) {
    const out = [], n = S.nOffers || CFG.offers;
    const up = POOL.filter((o) => (o.id !== "th" || S.removed.length < 5) && (!o.min || S.ante + 1 >= o.min) && (o.id !== "gt" || S.deck.concat(S.hand).some((c) => c.r === 14 && !c.e)) && (!CFG.maxBuy[o.id] || (S.bought[o.id] || 0) < CFG.maxBuy[o.id])).map((o) => o.id);
    const ch = S.charms.length < S.charmSlots ? CHARMS.filter((c) => charmAvailable(S, c)).map((c) => c.id) : [];
    const pull = (a) => a.splice(Math.floor(next(S) * a.length), 1)[0];
    /* Γεμάτες θέσεις ή τελείωσαν τα charms; Ο σταθμός πληρώνει perk — τα perks δεν αδειάζουν. */
    if (!ch.length && S.pickCharm) { S.pickUp += S.pickCharm; S.pickCharm = 0; }
    const kind = S.pickCharm ? "charm" : "up", pool = kind === "charm" ? ch : up;
    for (let i = 0; i < n && pool.length; i++) out.push({ kind, id: pull(pool), bought: false });
    return out;
  }
  const picksLeft = (S) => Math.max(0, S.pickUp || 0) + Math.max(0, S.pickCharm || 0);
  const laneLeft = (S, kind) => Math.max(0, (kind === "charm" ? S.pickCharm : S.pickUp) || 0);
  function canTake(S, i) {
    const o = S.offers[i];
    if (S.phase !== "shop" || !o || o.bought) return { ok: false, why: "gone" };
    if (o.kind === "charm" && S.charms.length >= S.charmSlots) return { ok: false, why: "full" };
    if (laneLeft(S, o.kind) <= 0) return { ok: false, why: "picks" };
    return { ok: true };
  }
  function take(S, i) {
    if (!canTake(S, i).ok) return false;
    const o = S.offers[i];
    if (o.kind === "charm") { S.charms.push(o.id); S.pickCharm -= 1; } else { apply(S, o.id); S.pickUp -= 1; }
    o.bought = true;
    return true;
  }
  function nextAnte(S) {
    if (S.phase !== "shop" || isSurv(S)) return false;
    S.ante += 1;
    const a = S.ante;
    rollEndless(S, a);
    startRound(S);
    return true;
  }
  /* Μετά την κορυφή: συνέχεια χωρίς τέλος. Ανοίγει το κατάστημα του ante 30. */
  function goEndless(S) {
    if (S.phase !== "won") return false;
    S.endless = true; S.phase = "shop";
    rollEndless(S, S.ante + 1);
    /* Η Κορυφή δεν είναι σταθμός πληρωμής: χωρίς picks δεν βγαίνουν προσφορές. */
    S.offers = picksLeft(S) ? makeOffers(S) : [];
    return true;
  }
  /* Endless: το επόμενο ante κληρώνεται όσο είσαι ακόμη στο κατάστημα, ώστε η
     προεπισκόπηση (στόχος, boss) να λέει την αλήθεια. Idempotent. */
  function rollEndless(S, a) {
    S.rolled = S.rolled || {};
    if (a < TARGETS.length || S.rolled[a]) return;
    if (isReward(a)) S.chals[a] = RANDOM_CHALLENGES[Math.floor(next(S) * RANDOM_CHALLENGES.length)];
    else if (next(S) < CFG.ruleChance) S.rules[a] = RULES[Math.floor(next(S) * RULES.length)].id;
    S.rolled[a] = 1;
  }
  /* Σχεδόν: πόσο έλειψε και ποιο χέρι από το τελικό χέρι θα το έπιανε (για την οθόνη Busted). */
  function nearMiss(S) {
    const T = target(S), gap = T - S.score;
    if (gap <= 0) return null;
    const P = Object.assign({}, S, { phase: "round", playsLeft: 1 });
    let best = null;
    legalMoves(P).forEach((o) => { const sc = scoreOf(P, o.k, o.idx.map((i) => S.hand[i])); if (!best || sc.pts > best.pts) best = { k: o.k, idx: o.idx, pts: sc.pts }; });
    return { gap, close: gap <= Math.max(15, T * 0.12), T, best, enough: !!best && best.pts >= gap };
  }
  const upcoming = (S) => (S.chals[S.ante + 1] ? chalById[S.chals[S.ante + 1]] : null);
  const current = (S) => (S.chal ? chalById[S.chal] : null);
  const currentRule = (S) => (rule(S) ? ruleById[rule(S)] : null);
  const upcomingRule = (S) => { const a = S.ante + 1; return !S.chals[a] && S.rules && S.rules[a] ? ruleById[S.rules[a]] : null; };
  const nextTarget = (S) => { const a = S.ante + 1, id = S.chals[a]; if (a >= TARGETS.length && !S.endless) return null; return Math.round(tgtAt(a) * chalMulOf(id) * (id === "richair" ? CFG.richAirMul : 1)); };
  const peek = (S) => (has(S, "scout") && S.pile.length ? S.pile.slice(-3).reverse() : null);

  /* ============================== σειριοποίηση ============================== */
  const serialize = (S) => JSON.stringify(S);
  function restore(json) {
    try {
      const S = JSON.parse(json);
      if (!S || S.v !== 15) return null;
      /* Έλεγχος σχήματος, όχι μόνο έκδοσης: ένα save με λείπον πίνακα περνούσε και έσκαγε αργότερα. */
      const arrays = ["hand", "pile", "deck", "charms", "mult", "sel", "removed", "unlocked", "discardPile", "played", "log"];
      if (!arrays.every((k) => Array.isArray(S[k]))) return null;
      if (!S.hand.every(Boolean) || !S.chals || !S.rules || !S.bought || !S.stats) return null;
      if (S.mode !== "run" && S.mode !== "surv") return null;
      /* Το rung μπαίνει σε `KINDS[k.kind]` χωρίς έλεγχο: ένα πειραγμένο save με `kind: 42`
         περνούσε και έσκαγε μέσα στο `beats()` με TypeError. Και τα φύλλα των σωρών θέλουν
         τον ίδιο έλεγχο που κάνει ήδη το χέρι. */
      if (S.rung != null && !(S.rung && S.rung.kind >= 0 && S.rung.kind < KINDS.length)) return null;
      if (!S.pile.every(Boolean) || !S.deck.every(Boolean) || !S.played.every(Boolean)) return null;
      return S;
    } catch (e) { return null; }
  }
  const todaySeed = (d) => { d = d || new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };

  return {
    SUITS, KINDS, isSurv, BY_TIER, TARGETS, tgtAt, RULES, ruleById, CFG, POOL, DECKS, deckById, SYNERGIES, synById, syn, activeSynergies, synergyFor, goEndless, nearMiss, kbase, kchips, kmult, isBomb, sameShape, beats, poolById, ENH, CHARMS, charmById, CHALLENGES, chalById, rname,
    newRun, startRound, target, nextTarget, roundHandSize,
    classify, climbs, hasClimb, steepOf, rungAfter, whyNoClimb, climbCards, chainPos, survMilestone, scoreOf, cardChip, cardChips, evalSel, clabel, crange, beatText, isAce, isWild, isFace, leadSuit,
    candidates, legalMoves, hasLegal, suggest, orphans,
    toggle, reveal, play, discard, canDiscard, canDiscardAny, discardsLeft, discMaxOf, deadHand, handCap, stuck, stuckReason, finish,
    makeOffers, canTake, take, picksLeft, laneLeft, isReward, rewardKind, nextAnte, applyFree: apply, upcoming, current, currentRule, upcomingRule, peek, has,
    serialize, restore, todaySeed,
  };
});
