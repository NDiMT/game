# Εννέα Χέρια

Σχεδιαστική δουλειά για σόλο χαρτοπαίγνια με βάση το πόκερ και climbing μηχανική,
συν ένα playable prototype.

## Περιεχόμενα

| Διαδρομή | Τι είναι |
| --- | --- |
| `site/index.html` | Αρχική σελίδα |
| `site/raise/index.html` | **RAISE** — playable demo, ένα αυτόνομο αρχείο HTML χωρίς build |
| `site/ideas/index.html` | Ο κατάλογος των εννέα παιχνιδιών |
| `docs/games.md` | Οι εννέα σχεδιασμοί με κανόνες και παραδείγματα γύρου |
| `docs/concepts-poker-tichu.md` | Ο πλήρης κατάλογος concepts, με ανάλυση ανά ιδέα |

## RAISE — το prototype

Ιεραρχία χεριών πόκερ παιγμένη ως climbing σκάλα, με **τράβηγμα**: κρατάς 8 φύλλα,
τραβάς πίσω στα 8 μετά από κάθε παίξιμο, και έχεις **5 παιξίματα** τον γύρο.
Δώδεκα antes, seeded RNG, κατάστημα με charms. Σχεδιασμένο για κινητό, με ένα χέρι.
UI στα αγγλικά.

### Γιατί άλλαξε το μοντέλο

Η προηγούμενη έκδοση μοίραζε 15 φύλλα φανερά: ένα puzzle πλήρους πληροφορίας που
ο άνθρωπος έλυνε σχεδόν τέλεια (9/10 νίκες), ενώ το bot κέρδιζε 4% — καμία καμπύλη
δεν μπορούσε να το κρατήσει. Το τράβηγμα φέρνει αβεβαιότητα, και το όριο
παιξιμάτων δίνει το πραγματικό παζλ: **πώς τακτοποιείς 5 παιξίματα για το μέγιστο,
ψαρεύοντας με discards**. Χωρίς όριο παιξιμάτων, το bot κέρδιζε 80% (μετρήθηκε).

### Κανόνες

- **Pair** 10 · **Trips** 25 · **Straight** 40 · **Flush** 60 · **Full House** 80 · **Quads** 120
- Κάθε χέρι πρέπει να ξεπερνά το **Rung**: ανώτερη κατηγορία, ή ίδια με ψηλότερη αξία.
- Σκορ = βάση × **Chain** (θέση στην αλυσίδα) × ενισχύσεις × charms.
- Πόροι ανά γύρο: **5 Plays**, **3 Discards** (πετάς 1–5 φύλλα, τραβάς), **2 Breaths**
  (Pass: Rung και Chain μηδενίζουν). Ο γύρος τελειώνει όταν τελειώσουν τα Plays.
- **Ace in the Hole:** Άσος μόνος του → Rung μηδενίζει, Chain μένει, δεν κοστίζει Play.
- **Raise:** μόλις καθαρίσεις τον στόχο, ανέβασέ τον σε ×1,6 για τα Plays που έμειναν.
  Πιάνεις → αμοιβή ×2. Χάνεις → αμοιβή ×0.
- Ξεκινάς με μία **Chisel**. Straight flush = Flush. Ο άσος είναι μόνο ψηλός.

### Κατάστημα

5 προσφορές ανά ante — **2 αναβαθμίσεις, 1 ενισχυμένο φύλλο, 2 charms** — και **Reroll**
(3◎, +2 κάθε φορά). Επαναλήψεις της ίδιας αναβάθμισης +50%. Τα charms πωλούνται στο
μισό.

| Αναβαθμίσεις | Ενισχυμένα φύλλα |
| --- | --- |
| Pairs+ … Quads+ (έως ×3), Extra Play (έως 7), Breath, Discard, Chisel, Wide Hand, Head Start, Cull | **Gold** ×2 · **Glass** ×3 και σπάει · **Wild** · **Steel** (πάντα στο αρχικό χέρι) |

### Charms (5 θέσεις, 18 συνολικά, 5 κλειδωμένα)

Ladder · Leapfrog · Low Road · Court · Loyalty · Cheap Breath · Second Wind · Sleight ·
Encore · Mirror · Vault · Thrift · Scout — και κλειδωμένα με επιτεύγματα ζωής:
**Goldsmith** (3 Gold), **Glassblower** (5 Glass σπασμένα), **Summiteer** (3 Quads),
**Gambler** (3 Raise), **Ember** (chain ×7). Η **Collection** φαίνεται στην αρχική οθόνη.

### Challenges

Antes 3, 6, 9 (seeded, με στόχο ×0,75): No Pass · Short Hand · Blind Deal · High Ground ·
One Breath · Thin Air · Rich Air · One Discard · Four Plays · Sticky Rung. Το ante 12
είναι πάντα **The Summit**: μόνο Άσος μηδενίζει το Rung.

### Δομή

| Αρχείο | Ρόλος |
| --- | --- |
| `site/raise/game.js` | Καθαρή λογική, χωρίς DOM. Browser (`window.RAISE`) και Node. |
| `site/raise/ui.js` | DOM, είσοδος, sheets, αποθήκευση run, lifetime stats, unlocks. |
| `site/raise/fx.js` | Σωματίδια, ήχος (Web Audio), FLIP, δόνηση. |
| `site/raise/app.css` | Οπτική ταυτότητα. |
| `site/raise/sw.js`, `manifest.webmanifest`, `icon*` | PWA. |
| `tools/sweep.js` | Bot + σάρωση δυσκολίας (`node tools/sweep.js 400`, ή με JSON cases). |
| `tools/sim.js` | Το bot στις τρέχουσες σταθερές. |
| `tools/bundle.py` | Ένα αρχείο για artifact. |

### Βαθμονόμηση

Bot: cheapest legal climb, discards ορφανά, Άσος όταν κολλά, συντηρητικό Raise,
charms πρώτα. Στόχοι `100 → 2950` (×1,36): **~2% νίκες bot**, θάνατοι ανά ante
`12/14/39/63/58/35/26/21/12/9/4/1` — καμπάνα στα 4–5, ουρά ως το 12. Ο άνθρωπος
υπολογίζεται 3–6× καλύτερος: στόχος ~1/10 νίκες.

## Δημοσίευση

Το `.github/workflows/pages.yml` ανεβάζει τον φάκελο `site/` στο GitHub Pages.

Απαιτείται **μία χειροκίνητη ενέργεια, μία φορά**, από κάποιον με δικαιώματα
admin στο repository:

> **Settings → Pages → Build and deployment → Source: GitHub Actions**

Δεν γίνεται από το workflow. Το `actions/configure-pages` έχει παράμετρο
`enablement: true` που υποτίθεται ότι δημιουργεί το Pages site μέσω API, αλλά
η δημιουργία απαιτεί δικαιώματα admin στο repository — το `GITHUB_TOKEN` ενός
workflow απαντά `Resource not accessible by integration`. Δοκιμασμένο, δεν
δουλεύει.

Μετά την ενεργοποίηση, κάθε push που αγγίζει το `site/` κάνει redeploy, ή
τρέχεις το workflow χειροκίνητα από την καρτέλα Actions.

Διεύθυνση μετά την ενεργοποίηση: **https://ndimt.github.io/game/**

## Νομικές σημειώσεις

Το πόκερ και το cribbage είναι δημόσιο κτήμα. Οι μηχανισμοί των climbing games
(Big Two, Zheng Shangyou) είναι επίσης δημόσιο κτήμα, αλλά τα ονόματα, οι ειδικές
κάρτες και τα εικαστικά των εμπορικών εκδόσεων προστατεύονται — γι' αυτό όλη η
ορολογία εδώ είναι πρωτότυπη.
