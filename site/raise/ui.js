/* RAISE — UI v3. DOM και είσοδος· η λογική ζει στο game.js (window.RAISE). */
(function () {
  "use strict";
  const G = window.RAISE, FX = window.FX, IC = window.ICONS;
  const $ = (id) => document.getElementById(id);
  const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
  const KEY = "raise.run.v15", LIFE = "raise.life.v1", TAUGHT = "raise.taught.v1";
  let S = null, shown = 0, ui = { note: null, noteT: 0, ending: false }, installEvt = null;

  /* ---------- storage ---------- */
  const save = () => { try { localStorage.setItem(KEY, G.serialize(S)); } catch (e) {} };
  const load = () => { try { return G.restore(localStorage.getItem(KEY)); } catch (e) { return null; } };
  /* Τα stats ζωής διαβάζονταν από το localStorage — με JSON.parse — μέσα στο `render()`,
     δηλαδή σε ΚΑΘΕ άγγιγμα φύλλου (η γραμμή του Survival ρωτά το bestSurv). Μετρημένο:
     4,0ms σε 32 αγγίγματα στα 4× CPU, για μια τιμή που αλλάζει μόνο στο τέλος ενός run.
     Τώρα μένει στη μνήμη· ακυρώνεται στην αρχική οθόνη, όπου η αλήθεια έχει σημασία. */
  let lifeC = null;
  const lifeDefaults = () => ({ runs: 0, wins: 0, best: 0, bestScore: 0, bestSurv: 0, gold: 0, silver: 0, quads: 0, chain7: 0, plays: 0, aces: 0 });
  const life = () => {
    if (lifeC) return lifeC;
    try { lifeC = Object.assign(lifeDefaults(), JSON.parse(localStorage.getItem(LIFE) || "{}")); } catch (e) { lifeC = lifeDefaults(); }
    return lifeC;
  };
  const saveLife = (l) => { lifeC = l; try { localStorage.setItem(LIFE, JSON.stringify(l)); } catch (e) {} };
  const unlockedFrom = (l) => G.CHARMS.filter((c) => !c.lock || (l[c.lock.key] || 0) >= c.lock.n).map((c) => c.id);
  const DECK_KEY = "raise.deck.v1";
  const deckOpen = (l, d) => !d.lock || (l[d.lock.key] || 0) >= d.lock.n;
  const deckPick = () => { try { const id = localStorage.getItem(DECK_KEY) || "classic"; const d = G.deckById[id]; return d && deckOpen(life(), d) ? id : "classic"; } catch (e) { return "classic"; } };
  /* Μεταφέρει τα stats του run στα stats ζωής και ξεκλειδώνει charms. */
  function commitStats() {
    /* Survival δεν ξεκλειδώνει τίποτα: η αλυσίδα ×6 πιάνεται εύκολα εκεί (p50 ×16), οπότε
       θα χάριζε τη σκάλα των unlocks του κανονικού run. Μετράει μόνο για το δικό του ρεκόρ. */
    if (G.isSurv(S)) return [];
    const l = life(), was = S.statsCommitted || {};
    Object.keys(S.stats).forEach((k) => { l[k] = (l[k] || 0) + (S.stats[k] - (was[k] || 0)); });
    S.statsCommitted = Object.assign({}, S.stats);
    saveLife(l);
    const fresh = unlockedFrom(l).filter((id) => S.unlocked.indexOf(id) < 0);
    fresh.forEach((id) => S.unlocked.push(id));
    return fresh;
  }
  function recordEnd(won) {
    const l = life(); if (!S.recorded) l.runs += 1; S.recorded = true; if (won) l.wins += 1;
    const ante = S.ante + (won ? 1 : 0);
    if (G.isSurv(S)) { const prev = l.bestSurv || 0; l.bestSurv = Math.max(prev, S.score); saveLife(l); return S.score > prev; }
    l.best = Math.max(l.best, ante); l.bestScore = Math.max(l.bestScore, S.score);
    l.seeds = l.seeds || {};
    const cur = l.seeds[S.seed], newBest = !cur || ante > cur.ante || (ante === cur.ante && S.score > cur.score);
    if (newBest) l.seeds[S.seed] = { ante, score: S.score, deck: S.deckId || "classic", at: Date.now() };
    saveLife(l);
    return newBest;
  }

  /* ---------- run lifecycle ---------- */
  function begin(seed) { S = G.newRun(seed, unlockedFrom(life()), deckPick()); ui.note = null; ui.countT = 0; shown = 0; FX.music.start(); FX.music.key(0); save(); hideStart(); render(); afterMove(); }
  /* Ένα run ΑΞΙΖΕΙ «Continue» μόνο αν έχει γίνει κάτι μέσα του. Ένα φρέσκο, άθικτο run στο
     ante 1 με μηδέν πόντους είναι ακριβώς ό,τι και το Play — και επειδή το `begin()` σώζει
     αμέσως, κάθε επιστροφή στον τίτλο έδειχνε «Continue · ante 1» για πάντα. */
  const worthResuming = (r) => !!r && r.phase !== "lost" &&
    (r.ante > 0 || r.score > 0 || (r.stats && r.stats.plays > 0) || (r.log && r.log.length > 0) ||
     r.charms.length > 0 || r.phase === "shop" || r.phase === "won");
  function resumeOrBegin() {
    const saved = load();
    if (saved) { S = saved; shown = S.score; ui.countT = 0; render(); }
    /* Και η νικημένη Κορυφή είναι «συνέχισε»: αλλιώς ένα reload έτρωγε το Endless. */
    showStart(worthResuming(saved) ? saved : null);
  }

  /* ---------- cards ---------- */
  function cardHTML(c, i, sel, tbl, idx, n) {
    let st = "";
    if (!tbl && n > 1) st = ' style="--rot:' + (((idx / (n - 1)) - 0.5) * 3).toFixed(2) + 'deg"';
    if (tbl) st = ' style="animation-delay:' + (idx * 60) + 'ms"';
    if (c.h && !tbl) return '<button class="card down" disabled aria-label="face down"' + st + '><span class="card__back"></span></button>';
    const wild = G.isWild(c), su = G.SUITS[c.si], e = c.e, face = c.r >= 11 && !e;
    const cls = "card" + (e ? " e-" + e : "") + (!wild && su.red ? " red" : "") + (wild ? "" : " s" + c.si) + (sel ? " sel" : "") + (face ? " face" : "") + (c.n && !tbl ? " new" : "") + (c.x && !tbl ? " enh-new" : "");
    const tag = tbl ? "span" : "button";
    return '<' + tag + ' class="' + cls + '"' + st +
      (tbl ? ' aria-hidden="true"' : ' data-i="' + i + '" aria-pressed="' + (sel ? "true" : "false") + '" aria-label="' + (wild ? "Joker" : G.rname(c.r) + " " + su.s) + (e ? " " + e : "") + '"') +
      '><span class="card__ix"><span class="card__r">' + (wild ? "★" : G.rname(c.r)) + '</span><span class="card__rs">' + (wild ? "" : su.s) + '</span></span>' +
      '<span class="card__pip">' + (wild ? "★" : su.s) + '</span>' + (e ? '<span class="card__e">' + e + '</span>' : "") + '</' + tag + '>';
  }
  /* Μέγεθος φύλλου όπως στο v2: από το πλάτος, με οροφή· δύο ίσες σειρές. */
  function fitHand(n) {
    const W = ($("hand").parentElement || document.body).clientWidth || 360, H = innerHeight || 700;
    const rows = n <= 10 ? 2 : 3, per = Math.max(1, Math.ceil(n / rows));
    const byW = Math.floor((W - (per - 1) * 4) / per);
    const byH = Math.floor((Math.min(150, H * 0.2) - (rows - 1) * 5) / rows / 1.4);
    const cw = Math.max(36, Math.min(52, byW, byH));
    document.documentElement.style.setProperty("--cw", cw + "px");
    /* Το `--cw` το ξαναδιάβαζε το render με getComputedStyle — αναγκαστικός επαναϋπολογισμός
       στιλ σε κάθε άγγιγμα φύλλου, για έναν αριθμό που μόλις γράψαμε εμείς. */
    fitHand.cw = cw;
    /* Το χέρι πιάνει όλο το πλάτος και στενεύει με padding, όχι με max-width: η σειρά των
       φύλλων μένει ίδια, αλλά η χειρονομία ζει και στα κενά δεξιά κι αριστερά — εκεί που
       πέφτει ο αντίχειρας. Μετρημένο: το #hand ήταν 222px σε οθόνη 393px, δηλαδή το 44%
       του πλάτους ήταν νεκρό για το swipe. */
    const el = $("hand"), row = per * (cw + 4) + 2;
    el.style.maxWidth = ""; el.style.paddingLeft = el.style.paddingRight = "0px";
    const pad = Math.max(0, Math.floor((el.clientWidth - row) / 2));
    el.style.paddingLeft = el.style.paddingRight = pad + "px";
    const key = n + "/" + cw + "/" + pad, changed = key !== fitHand.key; fitHand.key = key;
    return changed;
  }
  const pips = (n, max, cls) => {
    /* Πάνω από 6 δεν χωράνε και δεν διαβάζονται — τότε ο αριθμός λέει το ίδιο πράγμα. */
    if (max > 6) return '<i></i><b>' + n + " / " + max + '</b>';
    let h = ""; for (let i = 0; i < max; i++) h += '<i class="' + (i < n ? "" : "spent") + '"></i>'; return h;
  };
  const charmToken = (id, extra) => { const c = G.charmById[id]; return '<button class="charm" data-charm="' + id + '" aria-label="' + c.name + '" style="--h:' + IC.hue(id) + '"' + (extra || "") + '>' + IC.svg(id) + '</button>'; };

  /* ---------- render ---------- */
  /* `render()` τρέχει σε ΚΑΘΕ άγγιγμα, και ξανάγραφε innerHTML σε επτά κόμβους που δεν
     είχαν αλλάξει: τα charms, τα dots του rung, τις πινέζες των plays/discards, το peek,
     τα ribbons, το κουμπί και τη γραμμή κάτω από το τραπέζι. Κάθε γράψιμο είναι parse +
     καταστροφή κόμβων + επαναϋπολογισμός στιλ. Η υπογραφή κρατιέται σε JS property, όχι
     σε dataset: ένα attribute write θα ακύρωνε το στιλ μόνο του. */
  const setHTML = (el, sig, html) => { if (el.__sig !== sig) { el.__sig = sig; el.innerHTML = typeof html === "function" ? html() : html; } };
  const setTXT = (el, t) => { if (el.__t !== t) { el.__t = t; el.textContent = t; } };
  /* `aria-disabled` και όχι `disabled`: με `disabled` ο Chrome δεν στέλνει ΚΑΝΕΝΑ pointer
     event, οπότε το πάτημα στο «Breathe» με μηδέν ανάσες ήταν απόλυτο κενό — ούτε ήχος, ούτε
     τρίξιμο, ούτε λόγος· ο αριθμός «0» πάνω στο κουμπί ήταν η μόνη ένδειξη. Τώρα το κουμπί
     δέχεται το άγγιγμα και απαντά με τον λόγο του. */
  const setOff = (el, off) => { el.classList.toggle("off", !!off); el.setAttribute("aria-disabled", off ? "true" : "false"); };
  const isOff = (el) => el.getAttribute("aria-disabled") === "true";
  /* Γιατί δεν πατιέται το discard — με τη σειρά που το κρίνει η μηχανή. */
  function discWhy() {
    const surv = G.isSurv(S);
    if (ui.ending) return "";
    if (S.chal === "nodiscard") return "This boss allows no discards at all.";
    if (G.discardsLeft(S) <= 0) return surv ? "No breath left. Only a climb can be played now." : "No discards left this round.";
    if (!S.sel.length) return surv ? "Pick the cards to breathe away — or swipe down with nothing picked and the orphans go." : "Pick the cards to throw first.";
    return surv ? "Nothing left to draw." : "The pile is empty.";
  }
  /* ---------- ο οδηγός του πρώτου run ---------- */
  /* Ο πήχης είναι ΟΛΟ το παιχνίδι και εξηγούνταν μόνο σε ένα φύλλο κανόνων 15 παραγράφων,
     που κανείς δεν διαβάζει. Τα τρία πρώτα χέρια του πρώτου run λένε τον βρόχο με μία
     γραμμή τη φορά, καρφωμένη πάνω στο πράγμα για το οποίο μιλά — και φεύγουν όταν παίξεις.
     Καμία καινούργια μηχανική, κανένα φύλλο δεν τονίζεται, καμία επιλογή δεν γίνεται για
     τον παίκτη: το βήμα είναι απλώς `S.stats.plays`, οπότε επιβιώνει reload και resume. */
  /* Η σημαία κρατιέται στη μνήμη: το `render()` τρέχει σε ΚΑΘΕ άγγιγμα φύλλου και ένα
     localStorage.getItem εκεί μέσα είναι ακριβώς το λάθος που έχει ήδη μετρηθεί στα stats. */
  let taughtC = null;
  const taught = () => { if (taughtC === null) { try { taughtC = !!localStorage.getItem(TAUGHT); } catch (e) { taughtC = true; } } return taughtC; };
  const setTaught = () => { taughtC = true; try { localStorage.setItem(TAUGHT, "1"); } catch (e) {} };
  const COACH = [
    { at: "rung", t: "The rung is the hand to beat. It says Open — whatever you play becomes the rung." },
    { at: "rung", t: (r) => r
      ? "Your hand is the rung now. Beat it next time and the chain climbs a step."
      : "The table is open again — anything you play climbs, and becomes the rung." },
    { at: "chain", t: "Every step of the chain is +" + Math.round(G.CFG.chainStep * 100) + "% Mult. Miss the rung and it goes back to ×1." },
  ];
  const coachOn = () => !!S && S.phase === "round" && !ui.ending && !G.isSurv(S) &&
    !taught() && $("start").hidden && $("veil").hidden && S.stats.plays < COACH.length;
  let coachMark = null;
  function coachSync() {
    const el = $("coach");
    /* Το φύλλο κλείνει μόνο του: μόλις παιχτούν τα τρία χέρια, ο οδηγός δεν ξαναγυρίζει. */
    if (S && !taught() && S.stats.plays >= COACH.length) setTaught();
    if (coachMark) { coachMark.classList.remove("coachmark"); coachMark = null; }
    if (!coachOn()) { el.hidden = true; return; }
    const st = COACH[S.stats.plays], txt = typeof st.t === "function" ? st.t(S.rung) : st.t;
    const sig = S.stats.plays + "\u00b7" + txt;
    if (el.__sig !== sig) {
      el.__sig = sig;
      /* Μία γραμμή και μία έξοδος, σε μία σειρά: το κουτί μένει ~54px, δηλαδή χωράει στο
         κενό πάνω από τα φύλλα του τραπεζιού ακόμη και στα 360×640. Με δεύτερη σειρά για
         μετρητή έβγαινε 82px και σκέπαζε φύλλα (μετρημένο). */
      el.innerHTML = '<div class="coach__in" role="status"><p>' + txt + '</p>' +
        '<button class="coach__x" data-coachskip="1">Skip</button></div>';
    }
    const anchor = st.at === "chain" ? $("chain") : $("rungVal");
    anchor.classList.add("coachmark"); coachMark = anchor;
    el.hidden = false;
    const w = Math.min(innerWidth - 16, 360);
    el.style.width = w + "px";
    const a = anchor.getBoundingClientRect(), h = el.offsetHeight;
    /* Δύο ΑΔΕΙΕΣ θέσεις, και ένα σκληρό όριο: το κουτί δεν κατεβαίνει ΠΟΤΕ κάτω από τη
       γραμμή του preview — από εκεί και κάτω είναι το tfoot, η αλυσίδα, το χέρι και το
       dock. Θέση A: κάτω από το rung, πάνω από τα φύλλα του τραπεζιού. Θέση B: κάτω από τα
       φύλλα, πάνω από το preview. Το βήμα της αλυσίδας προτιμά τη B (δείχνει προς τα κάτω),
       τα βήματα του rung την A. Μετρημένο: χωρίς το όριο, ένα βήμα «chain» με γεμάτο
       τραπέζι στα 360×640 κάθισε στα 413–461 και σκέπασε το χέρι. */
    const rungBox = document.querySelector(".rung").getBoundingClientRect();
    const maxBot = $("preview").getBoundingClientRect().top - 8;
    const cards = $("tcards").querySelectorAll(".card");
    const cTop = cards.length ? cards[0].getBoundingClientRect().top : null;
    let cBot = null;
    Array.prototype.forEach.call(cards, (c) => { const r = c.getBoundingClientRect(); if (cBot == null || r.bottom > cBot) cBot = r.bottom; });
    const topA = rungBox.bottom + 8, roomA = (cTop == null ? maxBot : cTop - 6) - topA;
    const topB = maxBot - h, roomB = cBot == null ? -1 : topB - (cBot + 6);
    let top;
    if (st.at === "chain") top = roomB >= 0 ? topB : (roomA >= h ? Math.max(topA, (cTop == null ? maxBot : cTop - 6) - h) : maxBot - h);
    else top = roomA >= h ? topA : (roomB >= 0 ? topB : maxBot - h);
    top = Math.max(6, Math.min(top, maxBot - h));
    let left = Math.round(a.left + a.width / 2 - w / 2);
    left = Math.max(8, Math.min(innerWidth - w - 8, left));
    el.style.left = left + "px"; el.style.top = Math.round(top) + "px";
    const below = top + h / 2 > a.top + a.height / 2;
    el.classList.toggle("down", below); el.classList.toggle("up", !below);
    el.style.setProperty("--cx", Math.max(14, Math.min(w - 14, Math.round(a.left + a.width / 2 - left))) + "px");
  }
  $("coach").addEventListener("click", (e) => {
    if (!e.target.closest("[data-coachskip]")) return;
    setTaught(); FX.sfx.tick(); coachSync();
  });

  /* ---------- η οροφή των ενισχυμένων φύλλων ---------- */
  /* Μετρημένο: το 55,3% των παιξιμάτων παίζει Gold ή Silver, το 37,6% από αυτά κάθεται στο
     πλαφόν και στο 23,6% το πλαφόν ΚΟΒΕΙ πραγματικά (raw > cap) — μέσος όρος ×2,04 πεταμένος,
     και το 97,9% αυτών από το ante 9 και πάνω. Δηλαδή στο δεύτερο μισό κάθε run ένα καινούργιο
     Gold δεν έκανε τίποτα, σιωπηλά. Καμία αλλαγή στο σκορ — μόνο το λέει.
     Ο υπολογισμός επαληθεύτηκε ενάντια στο `notes` της μηχανής: 0 διαφωνίες σε 5 708 παιξίματα. */
  function enhCut(e) {
    if (!e || !e.k || !e.cs || !e.notes) return null;
    const golds = e.cs.filter((c) => c.e === "gold").length, silvers = e.cs.filter((c) => c.e === "silver").length;
    if (!golds && !silvers) return null;
    const gs = G.has(S, "goldsmith");
    let raw = Math.pow(gs ? 3 : 2, golds) * Math.pow(1.5, silvers);
    raw = Math.round(raw * 100) / 100;
    const cap = gs && golds ? G.CFG.goldsmithCap : G.CFG.enhCap;
    if (raw <= cap) return null;
    const name = golds && silvers ? "Gold + Silver" : golds ? "Gold" : "Silver";
    /* Μόνο αν η ίδια η μηχανή γράφει το πλαφόν στο `notes`: αν αλλάξει ο κανόνας, η γραμμή
       σωπαίνει αντί να πει ψέματα. */
    if (e.notes.indexOf(name + " ×" + cap) < 0) return null;
    return name + " ×" + raw + " → ×" + cap + " cap";
  }

  let tcwC = { key: "", v: "" };
  function render(keepHand) {
    const T = G.target(S), e = G.evalSel(S), ch = G.current(S), pos = G.chainPos(S), cleared = S.score >= T;

    const surv = G.isSurv(S);
    document.body.classList.toggle("surv", surv);
    /* Το `countUp` με from === to γράφει ΑΜΕΣΩΣ την τελική τιμή — και το render τρέχει σε
       κάθε άγγιγμα. Δηλαδή ένα άγγιγμα φύλλου πάνω στο μέτρημα πετούσε το τελικό νούμερο
       στην οθόνη και μετά το μέτρημα συνέχιζε από κάτω: ένα καρέ με λάθος σκορ. Και όταν
       το render καλείται για να κλειδώσει το dock στο τέλος του γύρου, το μέτρημα πέθαινε
       εντελώς (μετρημένο: 971 → 1447 σε 150ms, αντί για ένα δευτερόλεπτο ανεβάσματος).
       Ο μετρητής ξεκινά μόνο όταν αλλάζει το σκορ· αλλιώς δεν τον αγγίζουμε. */
    if (shown !== S.score) { ui.countT = Date.now() + 2100; FX.countUp($("score"), shown, S.score, ui.scoreDelay || 0); shown = S.score; }
    else if (Date.now() > (ui.countT || 0)) setTXT($("score"), String(S.score));
    ui.scoreDelay = 0;
    $("score").classList.toggle("on", surv ? S.score > (life().bestSurv || 0) : cleared);
    /* Survival: δεν υπάρχει στόχος. Στη θέση του, η επόμενη ανάσα — και η μπάρα τη δείχνει,
       που είναι ο μόνος αριθμός στην οθόνη που ο παίκτης κυνηγά ενεργά. */
    const ms = surv ? G.survMilestone(S.survEarned || 0) : 0;
    const msPrev = surv ? (S.survEarned ? G.survMilestone((S.survEarned || 0) - 1) : 0) : 0;
    setTXT($("tgt"), surv ? "breath at " + ms.toLocaleString("en-US") : "/ " + T);
    setTXT($("ante"), String(surv ? S.stats.plays : S.ante + 1));
    setTXT($("anteN"), String(surv ? "hands" : S.endless && S.ante >= G.TARGETS.length ? "∞" : G.TARGETS.length));
    const f = $("fill");
    f.style.width = (surv ? Math.max(0, Math.min(100, 100 * (S.score - msPrev) / Math.max(1, ms - msPrev))) : Math.min(100, S.score / T * 100)) + "%";
    f.classList.toggle("done", surv ? false : cleared);
    f.classList.toggle("spend", surv);

    const playsMax = S.playsMax - (ch && ch.id === "fewplays" ? 1 : 0);
    setHTML($("plays"), surv ? "surv" : S.playsLeft + "/" + playsMax, () => (surv ? "" : pips(S.playsLeft, playsMax)));
    $("plays").setAttribute("aria-label", surv ? "no play limit" : S.playsLeft + " of " + playsMax + " plays left");
    const dmax = S.discMax == null ? G.discMaxOf(S) : S.discMax, dleft = G.discardsLeft(S);
    $("discards").hidden = false;
    setHTML($("discards"), dmax + "/" + dleft, () => (dmax ? pips(dleft, dmax) : '<b>none</b>'));
    $("discards").setAttribute("aria-label", dmax ? dleft + " of " + dmax + " discards left" : "no discards");
    $("discards").classList.toggle("off", dmax === 0);
    setTXT($("pileN"), String(S.pile.length)); setTXT($("dpileN"), String(S.discardPile.length));

    setHTML($("charms"), S.charms.join(",") + "/" + S.charmSlots + "/" + S.charms.map((id) => G.synergyFor(S, id).length).join(""), () => {
      let cm = S.charms.map((id) => charmToken(id, G.synergyFor(S, id).length ? ' data-syn="1"' : "")).join("");
      for (let i = S.charms.length; i < S.charmSlots; i++) cm += '<span class="charm charm--empty"></span>';
      return cm;
    });

    const rv = $("rungVal");
    if (S.rung) { const lb = G.clabel(S.rung); setTXT(rv, lb); rv.classList.remove("free"); rv.classList.toggle("long", lb.length > 11); rv.style.setProperty("--kh", IC.kindHue(S.rung.kind)); $("rungDots").style.setProperty("--kh", IC.kindHue(S.rung.kind)); }
    else { setTXT(rv, "Open"); rv.classList.add("free"); rv.classList.remove("long"); }
    setHTML($("rungDots"), S.rung ? S.rung.kind + "/" + S.rung.size : "-", () => (S.rung ? Array.from({ length: S.rung.size }, () => '<i class="' + (G.isBomb(S.rung) ? "bomb" : "at") + '"></i>').join("") : ""));
    $("chal").hidden = !ch; if (ch) setHTML($("chalName"), ch.id, () => IC.svg(ch.id) + ch.name);
    const rl = G.currentRule(S); $("rule").hidden = !rl; if (rl) setTXT($("ruleName"), rl.name);
    document.body.classList.toggle("lastplay", !surv && S.playsLeft >= 1 && S.playsLeft < 2 && !cleared);
    /* Η αλυσίδα λέει μόνη της τι αξίζει — αλλιώς ο πιο σημαντικός αριθμός δεν εξηγείται πουθενά. */
    /* Στο Survival η αλυσίδα ΔΕΝ έχει οροφή — αυτό είναι όλο το mode. Η ετικέτα έβαζε το
       `chainStepCap` ασυζητητί, οπότε από τη θέση 13 και πάνω έγραφε σταθερά «Mult ×3.6» ενώ
       το χέρι πλήρωνε ×7,8 ή ×17,5. Και το 100% των runs περνά τη θέση 12 (p50 μέγιστη
       αλυσίδα ×75), δηλαδή η ετικέτα έλεγε ψέματα σχεδόν σε όλο το mode, πάνω στον αριθμό
       που κοιτάς για να αποφασίσεις αν θα σπάσεις. */
    /* Ο τύπος ΔΕΝ ξαναγράφεται εδώ: `chainSteps` + `chainMulOf` είναι η μία πηγή αλήθειας
       στη μηχανή, οπότε η ετικέτα δεν μπορεί πια να ξεμείνει πίσω από τη βαθμονόμηση. */
    const cold = G.chainCold(S);
    { const steps = cold ? Math.min(G.chainSteps(S, pos), G.CFG.chainFloor) : G.chainSteps(S, pos),
        mul = Math.round(G.chainMulOf(S, steps) * 10) / 10;
      setTXT($("chainN"), "×" + pos);
      /* Ο μεγάλος αριθμός είναι το σκαλί· η ετικέτα λέει τι αξίζει, χωρίς να το ξαναπεί. */
      setTXT($("chain").firstElementChild, steps ? "Mult ×" + mul : "Chain"); }
    $("chain").classList.toggle("cold", pos <= 1 || cold);
    /* Το κομμάτι χτίζεται μαζί με την αλυσίδα. Ο μετρητής δεν έχει πια οροφή ΠΟΥΘΕΝΑ, αλλά η
       μουσική κλίμακα μένει σκόπιμα στο ορόσημο `chainCap`: στο Classic η διάμεση αλυσίδα είναι
       ×3, οπότε με αναφορά ×14 (όπως στο Survival, όπου η διάμεση μέγιστη είναι ×75) οι δέκα
       στρώσεις δεν θα άνοιγαν ποτέ. Πάνω από το ορόσημο το κομμάτι είναι ήδη φουλ. */
    FX.music.chain(pos, surv ? 14 : G.CFG.chainCap);
    document.body.dataset.heat = pos >= 6 ? 3 : pos >= 4 ? 2 : pos >= 2 ? 1 : 0;
    $("chain").style.setProperty("--pos", Math.min(pos, 12));
    const pk = G.peek(S); $("peek").hidden = !pk; if (pk) setHTML($("peekCard"), pk.map((c) => c.r + "/" + c.si + "/" + (c.e || "")).join(","), () => pk.map((c) => cardHTML(c, null, false, true, 0, 1)).join(""));
    const tc = $("tcards");
    /* Ο πήχης ξαναχτιζόταν σε κάθε render — δηλαδή σε κάθε άγγιγμα φύλλου — και ξανάπαιζε
       το `land`: opacity 0→1, άλμα 33px, 500ms, με stagger, και το δεύτερο άγγιγμα διέκοπτε
       το πρώτο. Το πιο σημαντικό πράγμα στην οθόνη αναβόσβηνε κάθε φορά που διάλεγες. */
    const tsig = S.log.length + "·" + S.played.map((c) => c.r + "/" + c.si + "/" + (c.e || "")).join(",");
    if (tc.dataset.sig !== tsig) { tc.dataset.sig = tsig; tc.innerHTML = S.played.map((c, i) => cardHTML(c, null, false, true, i, S.played.length)).join(""); }
    /* Το πλάτος των φύλλων του τραπεζιού είναι δύο περάσματα: γράψε --tcw, ΔΙΑΒΑΣΕ
       `clientHeight`, ξαναγράψε. Κάθε ανάγνωση μετά από γράψιμο είναι αναγκαστικό layout —
       και έτρεχαν και τα δύο σε κάθε άγγιγμα φύλλου, για ένα νούμερο που εξαρτάται μόνο
       από τα φύλλα στο τραπέζι και το μέγεθος της οθόνης. Τώρα κρατιέται σε cache. */
    const tKey = tsig + "|" + (fitHand.cw || 0) + "|" + innerWidth + "x" + innerHeight;
    if (tcwC.key !== tKey) {
      const tn = S.played.length, tw = ($("table").clientWidth || 340) - 28, cw = fitHand.cw || parseInt(getComputedStyle(document.documentElement).getPropertyValue("--cw")) || 44;
      tcwC = { key: tKey, v: Math.max(26, Math.min(Math.round(cw * 0.9), tn ? Math.floor((tw - (tn - 1) * 4) / tn) : 99)) + "px", second: true };
      tc.style.setProperty("--tcw", tcwC.v);
    }
    tc.classList.toggle("fresh", S.ante === 0 && !S.rung && !S.log.length);

    const n = S.hand.length, hand = $("hand");
    if (keepHand && hand.children.length === n) {
      Array.prototype.forEach.call(hand.children, (el, i) => {
        const on = S.sel.indexOf(i) >= 0;
        el.classList.toggle("sel", on); el.setAttribute("aria-pressed", on ? "true" : "false");
      });
    } else {
      fitHand(n);
      hand.innerHTML = S.hand.map((c, i) => cardHTML(c, i, S.sel.includes(i), false, i, n)).join("");
    }
    /* Τα φύλλα δείχνουν ΟΛΑ ίδια. Το Survival έσβηνε όσα δεν ανεβαίνουν και τόνιζε τα
       υπόλοιπα: ο παίκτης το είδε ως «το παιχνίδι διαλέγει για μένα» — το ίδιο πράγμα με το
       tap-to-complete που είχε απορριφθεί. Το χέρι το διαβάζει εκείνος. (Μαζί φεύγει και ο
       λόγος να τρέχει το `climbCards()` σε κάθε render.) */
    /* Τα σημάδια «μόλις τραβήχτηκε» σβήνουν πάντα — αλλιώς ένα επόμενο πλήρες render
       ξαναπαίζει το drawin σε φύλλα που είναι στο χέρι εδώ και ώρα. */
    S.hand.forEach((c) => { delete c.n; delete c.x; });
    hand.classList.toggle("picking", S.sel.length > 0);

    /* Το #tools δεν έχει περιεχόμενο από τότε που το «?» μετακόμισε στο τραπέζι — έμενε ένα
       `innerHTML = ""` που έτρεχε σε κάθε άγγιγμα χωρίς να γράφει τίποτα. */
    /* Σημειώσεις/tooltips: αιωρούμενη κάρτα πάνω από το dock, δεν μετακινεί τίποτα· κλείνει με άγγιγμα. */
    const tipOn = !!ui.note && Date.now() < ui.noteT;
    $("tip").hidden = !tipOn;
    /* Η υπογραφή κρατά και το `noteT`: δύο ίδιες σημειώσεις στη σειρά είναι δύο σημειώσεις,
       και η δεύτερη θέλει το δικό της μπάσιμο. */
    if (tipOn) setHTML($("tip"), ui.noteT + "\u00b7" + ui.note, () => '<div class="tip__in">' + ui.note + '</div>');

    const go = $("bPlay"); go.className = "go";
    const pv = $("preview"); pv.className = "preview"; let pvt = "", gh = "";
    if (ui.ending || (!surv && S.playsLeft < 1) || cleared) { go.classList.add("done"); go.disabled = true; gh = '<span class="go__t">' + (surv ? "No way up" : cleared ? "Target!" : "Round over") + '</span><span class="go__s">' + (surv ? S.score.toLocaleString("en-US") + " points" : cleared ? "Ante " + (S.ante + 1) + " cleared" : "Short by " + (T - S.score)) + '</span>'; }
    else if (surv && !S.sel.length && !G.hasClimb(S)) { go.classList.add("idle"); go.disabled = true; gh = '<span class="go__t">Nothing climbs</span><span class="go__s">' + (G.discardsLeft(S) > 0 ? "Breathe (" + G.discardsLeft(S) + " left) · or break it, which costs one too" : "No breath left · the next hand you play is your last") + '</span>'; }
    else if (!S.sel.length) {
      go.classList.add("idle"); go.disabled = true;
      gh = '<span class="go__t">Pick cards</span><span class="go__s">' + (S.rung ? "Climb over " + G.clabel(S.rung) : "Any hand opens") + (!surv && S.playsLeft < 2 ? " · last play" : "") + '</span>';
    }
    else if (!e.k) { go.classList.add("no"); go.disabled = true; gh = '<span class="go__t">Not a hand</span><span class="go__s">' + (G.canDiscard(S) ? (surv ? "Breathe these away instead?" : "Discard these instead?") : "Pick a pair, a run or a set") + '</span>'; }
    /* Μηδέν ανάσες και υπάρχει ανέβασμα στο χέρι: το σπάσιμο είναι κλειδωμένο, γιατί θα
       τερμάτιζε το run ενώ υπάρχει δρόμος πάνω. Το κουμπί λέει ότι υπάρχει. */
    else if (surv && !e.up && G.discardsLeft(S) <= 0 && G.hasClimb(S)) {
      go.classList.add("no"); go.disabled = true;
      gh = '<span class="go__t">Will not climb</span><span class="go__s">No breath left · something in your hand does climb</span>';
    }
    else {
      go.classList.add(e.up ? "ok" : "down"); go.disabled = false; go.style.setProperty("--kh", IC.kindHue(e.k.kind));
      const calc = e.chips + " × " + e.mult;
      /* Survival: το σπάσιμο επιτρέπεται και κοστίζει μία ανάσα — και στο μηδέν είναι το
         τελευταίο σου χέρι. Το κουμπί το λέει, ώστε η απόφαση να είναι δική σου. */
      const brk = surv
        ? (G.discardsLeft(S) > 0 ? "Breaks the chain · −1 breath (" + G.discardsLeft(S) + ")" : "Breaks the chain · your last hand")
        : "Breaks the chain · " + calc;
      if (surv && !e.up) go.classList.add("cost");
      gh = '<span class="go__t go__t--pts">+' + e.pts + '</span><span class="go__s">' + (e.up ? goLabel(e.k) + ' · ' + calc : brk) + '</span>';
    }
    /* Το κουμπί ξαναγραφόταν κάθε render, ακόμη κι όταν έλεγε ακριβώς το ίδιο πράγμα —
       parse, καταστροφή δύο κόμβων, και μετά ένα δεύτερο πέρασμα με querySelectorAll για
       τα κεφαλαία. Τώρα γράφεται μόνο όταν αλλάζει το κείμενο. */
    if (go.__sig !== gh) {
      go.__sig = gh; go.innerHTML = gh;
      Array.prototype.forEach.call(go.querySelectorAll(".go__s"), (el) => { el.textContent = cap(el.textContent); });
    }
    /* Η γραμμή κάτω από το τραπέζι δεν αλλάζει με την επιλογή: λέει τι θέλει το rung, και μόνο.
       Ο αριθμός του χεριού ζει στο κουμπί, εκεί που πέφτει ο αντίχειρας. */
    pv.classList.add("hint");
    /* Όταν έχεις διαλέξει κάτι που δεν ανεβαίνει, η γραμμή εξηγεί ΓΙΑΤΙ — αυτή είναι η
       στιγμή που ο παίκτης μαθαίνει τη σκάλα, όχι το φύλλο των κανόνων. */
    const why = e.k && !e.up ? G.whyNoClimb(S, e.k) : "";
    pvt = (why ? why : S.rung ? "Beat " + G.clabel(S.rung) + " to climb" : G.beatText(S)) +
      (!surv && S.playsLeft < 2 ? " · last play" : "") +
      (surv && S.rung ? " · or breathe (" + G.discardsLeft(S) + ")" : "");
    if (why) pv.classList.add("bad");
    const pvh0 = !pvt ? "" : pv.classList.contains("hint") ? cap(pvt).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      : cap(pvt).split(" · ").map((x) => "<span>" + x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/ /g, "\u00a0") + "</span>").join(' <i>·</i> ');
    /* Η οροφή των ενισχυμένων φύλλων γίνεται ορατή τη στιγμή που δαγκώνει: με τα φύλλα ήδη
       διαλεγμένα, πριν πατήσεις. Ο πολλαπλασιαστής που κόπηκε, με το νούμερό του. */
    const cut = enhCut(e);
    const pvh = pvh0 + (cut ? '<b class="capd">' + cut.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/ /g, "\u00a0") + '</b>' : "");
    setHTML(pv, pvh, pvh);
    /* Τα φύλλα του τραπεζιού χωράνε και σε ύψος: μετά το preview, μέτρα τον ελεύθερο χώρο και ψαλίδισε.
       Το `clientHeight` εδώ είναι ΑΝΑΓΚΑΣΤΙΚΟ layout — τρέχει μόνο όταν άλλαξε κάτι που το
       μετακινεί (τα φύλλα του τραπεζιού, το μέγεθος της οθόνης, ή το κείμενο του preview). */
    if (tcwC.second && tcwC.pvh !== pvh) {
      tcwC.pvh = pvh;
      const tn = S.played.length;
      tc.style.setProperty("--tcw", tcwC.v);   /* ξεκίνα από το πλάτος, όπως πριν, και μετά ψαλίδισε στο ύψος */
      if (tn) { const free = tc.clientHeight, cur = parseInt(tc.style.getPropertyValue("--tcw")) || 40;
        if (free > 0) tc.style.setProperty("--tcw", Math.max(24, Math.min(cur, Math.floor((free - 6) / 1.42))) + "px"); }
    }
    /* Ο έλεγχος «νεκρό χέρι» τρέχει το `candidates()` — και έτρεχε δύο φορές σε κάθε
       άγγιγμα φύλλου, ακόμη κι όταν είχες ανάσες (τότε δεν υπάρχει δωρεάν discard) και
       ακόμη και στο Survival, όπου δωρεάν ανάσα δεν υπάρχει καθόλου. */
    const freeDisc = !surv && dleft <= 0 && G.deadHand(S);
    setOff($("bDisc"), ui.ending || !G.canDiscard(S));
    setTXT($("discN"), freeDisc ? "Free" : String(dleft));
    /* Στο Survival ένα πληρωμένο discard ανοίγει και το τραπέζι — άλλο πράγμα, άλλο όνομα. */
    setTXT($("bDisc").firstElementChild, surv && !freeDisc ? "Breathe" : "Discard");
    setOff($("bHint"), ui.ending || S.playsLeft < 1);
    coachSync();
  }
  /* Συμπαγής ετικέτα για το κουμπί: το εύρος φαίνεται στη δεύτερη γραμμή. */
  const goLabel = (k) => k.kind === 3 ? "Stairs " + k.size / 2 : k.kind === 4 ? "Straight " + k.size : k.kind === 7 ? "Str. Flush " + k.size : k.kind === 8 ? G.clabel(k).replace(/ \S+$/, "") : G.clabel(k);
  function note(msg, ms) { ui.note = cap(msg); ui.noteT = Date.now() + (ms || 3800); render(true); setTimeout(() => { if (Date.now() >= ui.noteT) render(true); }, (ms || 3800) + 100); }
  /* Ένα callout τη φορά: τα υπόλοιπα μπαίνουν σε ουρά αντί να σκοτώνουν το προηγούμενο. */
  const CQ = [];
  function callout(t) { if (!t) return; CQ.push(t); if (CQ.length === 1) calloutNext(); }
  /* «Target!» δεν περιμένει στην ουρά πίσω από το «Chain broken»: είναι η στιγμή του γύρου. */
  function calloutNow(t) { CQ.length = 0; clearTimeout(callout.t); CQ.push(t); calloutNext(); }
  function calloutNext() {
    const t = CQ[0]; if (!t) return;
    const el = $("callout"); el.textContent = t;
    el.classList.toggle("bomb", t === "Bomb!"); el.classList.toggle("target", t === "Target!");
    FX.pulse(el, "show");
    if (FX.RM) el.style.opacity = "1";
    clearTimeout(callout.t);
    callout.t = setTimeout(() => { if (FX.RM) { el.style.opacity = ""; el.textContent = ""; } CQ.shift(); calloutNext(); }, FX.RM ? 1100 : 900);
  }
  function selRects() { return S.sel.map((i) => { const el = $("hand").querySelector('[data-i="' + i + '"]'); return el ? el.getBoundingClientRect() : null; }); }
  function afterMove() {
    save();
    /* Ο γύρος κλείνει σε 1500ms — και μέσα σε αυτά ο πίνακας ήταν ακόμη ζωντανός: ένα
       πάτημα στο Discard/Breathe ή ένα σύρσιμο κάτω ΞΟΔΕΥΕ πραγματικό resource για έναν
       γύρο που είχε τελειώσει. Μετρημένο: discards 2 → 1, out 6 → 8, pile 40 → 38 μέσα στη
       γιορτή του «Target!». Το `ui.ending` είναι η κλειδαριά — και το render το δείχνει. */
    if (!G.stuck(S)) return;
    const why = G.stuckReason(S) || "Round over.";
    if (ui.ending) { if (why) note(why, 1800); return; }   /* το κλείσιμο τρέχει ήδη */
    ui.ending = true;
    note(why, 1800);
    setTimeout(() => { ui.ending = false; end(); }, 1500);
  }

  /* ---------- actions ---------- */
  /* Ένα χτύπημα, ένα φύλλο. Δοκιμάστηκε συντόμευση όπου το χτύπημα διάλεγε ολόκληρο το
     καλύτερο χέρι που περιέχει το φύλλο, με κύκλο στα εναλλακτικά — και αφαιρέθηκε: το
     παιχνίδι ΕΙΝΑΙ η επιλογή των φύλλων, και μια συντόμευση που τη μαντεύει την παίρνει
     από τα χέρια του παίκτη. Η ταχύτητα δεν αξίζει τον έλεγχο. */
  function tapCard(el) {
    if (!el || ui.ending || !S || S.phase !== "round") return;
    ui.note = null;
    if (G.toggle(S, +el.dataset.i)) { FX.sfx.tick(); FX.buzz(6); render(true); }
  }
  function doPlay() {
    if (ui.ending) return;
    if (!G.isSurv(S) && S.playsLeft < 1) { end(); return; }
    const from = selRects();
    const ev = G.play(S); if (!ev) return;
    ui.note = null;
    if (ev.k && ev.k.kind === 9) { FX.sfx.ace(); FX.buzz(14); }
    if (ev.bomb) { FX.sfx.bomb(); FX.buzz([30, 40, 120]); FX.boom($("table")); FX.flash(); FX.pulse($("app"), "shake"); setTimeout(() => FX.floatIn($("table"), "+" + ev.pts), 320); document.body.classList.add("boom"); setTimeout(() => document.body.classList.remove("boom"), 900); }
    else if (!ev.up) { FX.sfx.pass(); FX.buzz(40); setTimeout(() => FX.floatIn($("table"), "+" + ev.pts), 320); }
    else { FX.sfx.climb(ev.pos); FX.buzz(18); FX.burstAt($("table"), Math.min(50, 10 + Math.round(ev.pts / 24)), 2.4 + Math.min(3, ev.pts / 300), ["#ffd166", "#ff6b6b", "#4ecdc4", "#c77dff", "#ffffff", "hsl(" + IC.kindHue(ev.k.kind) + " 90% 70%)"]); setTimeout(() => FX.floatIn($("table"), "+" + ev.pts), 320); $("callout").style.setProperty("--kh", IC.kindHue(ev.k.kind)); }
    const crossed = S.score >= G.target(S) && S.score - ev.pts < G.target(S);
    ui.scoreDelay = 300;   /* τα φύλλα προσγειώνονται πρώτα, μετά ανεβαίνει ο αριθμός */
    render();
    if (crossed) { setTimeout(() => { calloutNow("Target!"); FX.sfx.clear(); FX.burstAt($("score"), 30, 4, ["#8ff0bf", "#ffffff", "#ffd166"]); }, 1100); }
    /* Φτάνεις τον στόχο ή τελειώνουν τα plays: ο γύρος κλείνει μόνος του, χωρίς άλλο πάτημα.
       Μετρημένο: το «Target!» έμενε 365ms πριν το φύλλο το σκεπάσει — δεν προλάβαινε ούτε
       να μπει, και η τετράφωνη καμπάνα έπαιζε ακόμα. Ο στόχος θέλει τον χρόνο του. */
    if (ev.cleared || (!G.isSurv(S) && S.playsLeft < 1) || (G.isSurv(S) && G.stuck(S))) {
      ui.ending = true; render(true);   /* κλείδωσε το dock ΤΩΡΑ, όχι στο επόμενο render */
      setTimeout(() => { ui.ending = false; end(); }, ev.cleared ? 2400 : 1500);
    }
    FX.fly(from, Array.prototype.slice.call($("tcards").children));
    if (ev.drawn) setTimeout(() => FX.sfx.draw(), 180);
    /* Τα φύλλα του τραπεζιού προσγειώνονται με stagger (ως ~640ms): η θέση του οδηγού
       ξαναμετριέται αφού σταθούν, αλλιώς καρφώνεται πάνω σε rect που ακόμη κινείται. */
    setTimeout(coachSync, 700);
    enhPop();
    if (ev.up) FX.pulse($("chain"), "bump"); else FX.pulse($("chain"), "drop");
    callout(ev.tags[0]);
    /* Η κερδισμένη ανάσα είναι το μόνο πράγμα που κυνηγάς ενεργά στο Survival: φαίνεται. */
    if (ev.breaths) setTimeout(() => { calloutNow(ev.breaths > 1 ? ev.breaths + " breaths!" : "Breath earned"); FX.sfx.unlock(); FX.buzz([12, 30, 12]); FX.burstAt($("discards"), 26, 3, ["#cfe9f2", "#8fd0e2", "#ffffff"]); }, 700);
    afterMove();
  }
  /* Ένα φύλλο που τράβηξες «έσκασε» σε Gold/Silver/Joker: μικρή γιορτή. */
  function enhPop() {
    const e = S.enhNew && S.enhNew.length ? S.enhNew : null; S.enhNew = [];
    if (!e) return;
    setTimeout(() => { callout(e[0] === "wild" ? "Joker!" : G.ENH[e[0]].name + " card!"); FX.sfx.unlock(); FX.burstAt($("hand"), 26, 3.5, e[0] === "gold" ? ["#f5cf6a", "#fff1bf"] : e[0] === "silver" ? ["#eef3f8", "#a9b7c6"] : ["#c9a6ff", "#8fd0e2"]); }, 520);
  }
  function doDiscard() {
    if (ui.ending) return;
    if (!G.canDiscard(S)) { const w = discWhy(); if (w) { FX.sfx.pass(); FX.buzz(6); note(w); } return; }
    const rects = selRects();
    /* Το `$("dpile")` δεν υπήρξε ποτέ στο index.html: το ghostTo έβγαινε αμέσως και το
       discard ήταν η μόνη χειρονομία χωρίς κίνηση — τα φύλλα απλώς εξαφανίζονταν.
       Στόχος είναι ο μετρητής «Out», που χτυπά όταν προσγειώνονται. */
    if (G.discard(S)) {
      FX.sfx.discard(); FX.buzz(10); FX.ghostTo(rects, $("dpileN")); ui.note = null; render();
      setTimeout(() => FX.sfx.draw(), 160); setTimeout(() => FX.pulse($("dpileN"), "hit"), 430); enhPop();
      /* Η ανάσα ανοίγει το τραπέζι — και μπορεί να ήταν η τελευταία. */
      if (G.isSurv(S)) { if (!S.rung) calloutNow("Table open"); if (G.stuck(S)) { ui.ending = true; render(true); setTimeout(() => { ui.ending = false; end(); }, 1500); return; } }
      afterMove();
    }
  }
  function doHint() {
    if (ui.ending) return;
    if (S.playsLeft < 1) { FX.sfx.pass(); note("No plays left — the round is over."); return; }
    const m = G.suggest(S);
    if (m) { S.sel = m.idx.slice(); ui.note = null; FX.sfx.tick(); render(true); return; }
    const o = G.orphans(S);
    if (G.canDiscardAny(S) && o.length) {
      S.sel = o.slice(0, Math.min(4, o.length)); FX.sfx.tick(); FX.pulse($("bDisc"), "hit");
      note(G.isSurv(S)
        ? "Nothing climbs. A breath opens the table and keeps the chain — cheaper than breaking it."
        : "These fit no hand — swipe down or tap Discard to swap them.");
      return;
    }
    /* Survival χωρίς ορφανά αλλά με ανάσα: η ανάσα είναι ακόμη η σωστή κίνηση. */
    if (G.isSurv(S) && G.discardsLeft(S) > 0 && G.canDiscardAny(S)) {
      S.sel = S.hand.map((_, i) => i).sort((a, b) => S.hand[a].r - S.hand[b].r).slice(0, 2);
      FX.sfx.tick(); FX.pulse($("bDisc"), "hit");
      note("Nothing climbs. Breathe — it opens the table and keeps the chain."); return;
    }
    note(G.stuckReason(S));
  }
  function end() {
    const r = G.finish(S); if (!r) return;
    /* Το `save()` έτρεχε ΠΡΙΝ το `recordEnd()`, οπότε το `S.recorded = true` δεν αποθηκευόταν
       ποτέ: κλείσιμο της εφαρμογής στο sheet της νίκης και συνέχεια σε Endless μέτραγε το ίδιο
       run δύο φορές στο `l.runs`. */
    const fresh = commitStats();
    if (!r.cleared) { const nb = recordEnd(false); save(); FX.sfx.bust(); FX.buzz([60, 40, 90]); sheetLose(nb); return; }
    FX.sfx.clear(); FX.flash(); FX.spark(innerWidth / 2, innerHeight * 0.42, 120, 6.5); FX.buzz([12, 60, 12]); FX.pulse($("app"), "shake");
    if (r.won) { recordEnd(true); save(); sheetWin(); }
    else if (r.reward) sheetShop(r, fresh);
    else sheetNext(fresh);
  }

  /* ---------- sheets ---------- */
  /* Το CI γράφει το SHA στο <meta name="build">. Στο bundled artifact μένει το placeholder. */
  const buildTag = () => { const m = document.querySelector('meta[name="build"]'); const v = m && m.content; return v && v !== "__BUILD__" ? "build " + v : "build · local"; };
  /* `info`: φύλλο που απλώς ΔΙΑΒΑΖΕΤΑΙ (How to play, Collection, μενού). Ένα άγγιγμα μέσα
     του δεν πρέπει να προχωρά τον γύρο — δες τον φρουρό στο `#veil` πιο κάτω. */
  const openS = (h, exit, info) => {
    $("sheet").dataset.info = info ? "1" : "";
    $("sheet").innerHTML = '<div class="shead">' + (exit ? '<button class="sheet__x" data-title="1" aria-label="Back to the menu">Menu ›</button>' : "") + '<div class="grip"></div></div>' + h;
    /* Το φύλλο ξαναχρησιμοποιείται· χωρίς αυτό κρατούσε το scrollTop του προηγούμενου.
       Μετρημένο: «How to play» πατημένο από το κάτω μέρος του μενού άνοιγε ΣΤΗ ΜΕΣΗ του
       κειμένου, δηλαδή ο τίτλος και η πρώτη παράγραφος ήταν πάνω από το ορατό. */
    $("sheet").scrollTop = 0;
    $("veil").hidden = false; $("sheet").focus(); FX.sfx.open();
    coachSync();
  };
  const closeS = () => { $("veil").hidden = true; coachSync(); };
  function chipsHTML() {
    const c = [];
    G.BY_TIER.forEach((t) => { const m = S.mult[G.KINDS.indexOf(t)]; if (m > 0) c.push(t.short + " <b>+" + m + " mult</b>"); });
    if (S.playsMax > G.CFG.plays) c.push("Plays <b>" + S.playsMax + "</b>");
    if (S.handSize > G.CFG.handSize) c.push("Hand <b>" + S.handSize + "</b>");
    if (S.chainStart) c.push("Head Start <b>+" + S.chainStart + "</b>");
    { const d = G.discMaxOf(S); if (d !== G.CFG.discards) c.push("Discards <b>" + d + "</b>"); }
    if (S.charmSlots > G.CFG.charmSlots) c.push("Slots <b>" + S.charmSlots + "</b>");
    if (S.removed.length) c.push("Culled <b>" + S.removed.map(G.rname).join(",") + "</b>");
    const enh = {}; S.deck.forEach((d) => { if (d.e) enh[d.e] = (enh[d.e] || 0) + 1; });
    Object.keys(enh).forEach((k) => c.push(G.ENH[k].name + " <b>" + enh[k] + "</b>"));
    return c.length ? c.map((x) => '<span class="chip">' + x + '</span>').join("") : '<span class="chip">none yet</span>';
  }
  function ownedCharmsHTML() {
    if (!S.charms.length) return '<p class="sub">No charms yet · ' + S.charmSlots + ' slots</p>';
    return '<div class="owned">' + S.charms.map((id) => { const c = G.charmById[id]; return '<div class="owned__row">' + IC.bubble(id, "charm charm--s") + '<div><strong>' + c.name + '</strong><span>' + c.desc + '</span></div></div>'; }).join("") + '</div>';
  }
  /* Δύο διάδρομοι, ένα από τον καθένα: ένα perk και ένα charm. */
  function laneHTML(kind) {
    const rows = S.offers.map((o, i) => ({ o, i })).filter((x) => x.o.kind === kind);
    if (!rows.length) return "";
    const left = G.laneLeft(S, kind);
    const title = kind === "charm" ? "Charm" : "Perk";
    const head = '<div class="lane__h"><span class="lbl">' + title + '</span><span class="lane__n' + (left ? " on" : "") + '">' + (left ? "pick one" : "taken ✓") + '</span></div>';
    return '<div class="lane">' + head + '<div class="offers">' + rows.map(({ o, i }) => {
      const cb = G.canTake(S, i), dis = o.bought || !cb.ok ? " disabled" : "";
      const it = kind === "charm" ? G.charmById[o.id] : G.poolById[o.id];
      const why = !o.bought && !cb.ok && cb.why === "full" ? '<span class="why">Charm slots full</span>' : "";
      return '<button class="offer offer--pick' + (o.bought ? " bought" : "") + (!o.bought && cb.ok ? " open" : "") + '" data-take="' + i + '"' + dis + '>' +
        IC.bubble(o.id, "charm charm--s") + '<strong>' + it.name + '</strong><em>' + (o.bought ? "✓" : title) + '</em><span>' + it.desc + why + (kind === "charm" ? synHint(o.id) : "") + '</span></button>';
    }).join("") + '</div></div>';
  }
  /* Τα charms που κρατάς, σαν σειρά από εικονίδια — δεν πωλούνται, δεν χρειάζονται λίστα. */
  function ownedRowHTML() {
    if (!S.charms.length) return "";
    let h = S.charms.map((id) => '<button class="charm charm--s" data-charm="' + id + '" aria-label="' + G.charmById[id].name + '" style="--h:' + IC.hue(id) + '"' + (G.synergyFor(S, id).length ? ' data-syn="1"' : "") + '>' + IC.svg(id) + '</button>').join("");
    for (let i = S.charms.length; i < S.charmSlots; i++) h += '<span class="charm charm--s charm--empty"></span>';
    return '<div class="sec"><span class="lbl">Your charms · ' + S.charms.length + '/' + S.charmSlots + ' · tap to read</span><div class="ownedrow">' + h + '</div></div>';
  }
  const synHint = (id) => G.synergyFor(S, id).map((s) => { const p = G.charmById[s.a === id ? s.b : s.a]; return '<i class="syn">⚡ ' + s.name + ' with ' + p.name + ' — ' + s.desc + '</i>'; }).join("");
  /* Υπάρχει ακόμη κάτι που μπορείς να πάρεις; Αν όχι, το κατάστημα δεν σε κρατά. */
  const canPickMore = () => G.picksLeft(S) > 0 && S.offers.some((o, i) => G.canTake(S, i).ok);
  function shopBody() {
    const left = G.picksLeft(S), took = S.offers.some((o) => o.bought);
    const kind = S.offers.length && S.offers[0].kind === "charm" ? "charm" : "perk";
    const label = left ? "Take one " + kind : took ? "Taken · on to the next ante" : "Nothing left to take";
    return '<div class="picks' + (left ? " on" : "") + '">' + label + '</div>' +
      laneHTML("up") + laneHTML("charm") + ownedRowHTML();
  }
  const nextUpHTML = () => {
    const up = G.upcoming(S);
    return '<div class="nextup"><span class="lbl">Next · Ante ' + (S.ante + 2) + ' · target ' + G.nextTarget(S) + '</span>' +
      (up ? '<div class="chalnext bossnext">' + IC.bubble(up.id, "charm charm--s") + '<div><span class="lbl">Boss ante</span><b>' + up.name + '</b><span>' + up.desc + '</span><em>' + up.tell + ' ' + up.tip + '</em></div></div>'
          : (G.upcomingRule(S) ? '<div class="chalnext rulenext"><span class="lbl">Table rule</span><b>' + G.upcomingRule(S).name + '</b><span>' + G.upcomingRule(S).desc + '</span></div>' : "")) + '</div>';
  };
  /* Πίστα χωρίς ανταμοιβή: μια ανάσα να δεις τι έρχεται, και συνεχίζει μόνη της. */
  function sheetNext(fresh) {
    openS('<h2>Ante ' + (S.ante + 1) + ' cleared</h2><p class="sub">' + S.score + ' of ' + G.target(S) + '</p>' +
      (fresh && fresh.length ? '<div class="unlocked">✦ Unlocked · ' + fresh.map((id) => G.charmById[id].name).join(", ") + '</div>' : "") +
      nextUpHTML() + '<div class="picks">Straight on · tap to skip</div>');
    if (fresh && fresh.length) FX.sfx.unlock();
    clearTimeout(sheetNext.t);
    sheetNext.t = setTimeout(() => { $("sheet").classList.add("leaving"); setTimeout(goNextAnte, 520); }, fresh && fresh.length ? 2200 : 1500);
  }
  function sheetShop(r, fresh) {
    const T = G.target(S);
    const one = S.offers.length && S.offers[0].kind === "charm" ? "a charm" : "a perk";
    openS('<h2>Ante ' + (S.ante + 1) + ' cleared</h2><p class="sub">' + S.score + ' of ' + T + ' · ' + one + '</p>' +
      (fresh && fresh.length ? '<div class="unlocked">✦ Unlocked · ' + fresh.map((id) => G.charmById[id].name).join(", ") + '</div>' : "") +
      nextUpHTML() +
      '<div id="shopBody">' + shopBodyFull() + '</div>');
    if (fresh && fresh.length) FX.sfx.unlock();
  }
  /* Το κουμπί «επόμενο ante» υπάρχει μόνο όταν δεν έχεις τίποτα να διαλέξεις — αλλιώς
     η επιλογή είναι υποχρεωτική και προχωράει μόνη της. */
  const shopBodyFull = () => shopBody() +
    (canPickMore() ? "" : '<button class="big" data-next="1" style="margin-top:.9rem">Ante ' + (S.ante + 2) + ' · target ' + G.nextTarget(S) + '</button>');
  const refreshShop = () => { $("shopBody").innerHTML = shopBodyFull(); };
  function goNextAnte() {
    if (S.phase !== "shop") return;
    FX.music.key((S.ante + 1) * 7);
    clearTimeout(sheetNext.t);
    $("sheet").classList.remove("leaving");
    /* Ο μετρητής ξεκινούσε τον νέο γύρο μετρώντας ΑΝΑΠΟΔΑ από το σκορ του προηγούμενου
       ante ως το μηδέν — ένα δευτερόλεπτο με τον ήχο του ταμείου να σου παίρνει πίσω ό,τι
       μόλις κέρδισες. Μετρημένο: 726 → 0 σε 1063ms, με ~19 τικ. */
    G.nextAnte(S); shown = S.score; ui.countT = 0; closeS(); render(); afterMove();
    /* 47 από τις 50 πίστες δεν έχουν τελετή: μία λέξη τους δίνει ακμή. */
    setTimeout(() => { if (S && S.phase === "round") calloutNow("Ante " + (S.ante + 1)); }, 260);
    const bc = G.current(S); if (bc) bossIntro(bc);
  }
  const shareText = () => (G.isSurv(S) ? "ANABASIS · Survival · " + S.seed + " · " + S.score + " pts · " + S.stats.plays + " hands · best chain ×" + S.stats.maxChain : "ANABASIS · " + S.seed + (S.deckId && S.deckId !== "classic" ? " · " + G.deckById[S.deckId].name : "") + " · " + (S.phase === "won" ? "Summit ▲" : (S.endless ? "Endless ante " : "Ante ") + (S.ante + 1)) + " · " + S.score + " pts" + (S.charms.length ? " · " + S.charms.map((id) => G.charmById[id].name).join(", ") : ""));
  function missHTML() {
    const nm = G.nearMiss(S); if (!nm || !nm.close) return "";
    let body;
    if (nm.best && nm.enough) body = '<span>One more play and this would have made it:</span><div class="miss__cards">' + nm.best.idx.map((i) => cardHTML(S.hand[i], null, false, true, 0, 1)).join("") + '</div><em>' + G.clabel(nm.best.k) + ' · +' + nm.best.pts + '</em>';
    else if (nm.best) body = '<span>Your best hand left was worth ' + nm.best.pts + '. One more step of chain would have done it.</span><div class="miss__cards">' + nm.best.idx.map((i) => cardHTML(S.hand[i], null, false, true, 0, 1)).join("") + '</div>';
    else body = '<span>Nothing in your hand made a combination. One more discard would have opened it up.</span>';
    return '<div class="miss"><b>Short by ' + nm.gap + '</b>' + body + '</div>';
  }
  /* Μία συμβουλή τη φορά στην οθόνη Busted — κάθε φορά διαφορετική. */
  const BUSTED_TIPS = [
    "Every step of chain is +" + Math.round(G.CFG.chainStep * 100) + "% Mult. Four cheap hands that climb beat one fat hand that does not.",
    "A hand that does not climb still scores — it just scores flat. Sometimes that is the right call.",
    "Discards do not cost you a play. Two hands you cannot use are two hands you should throw.",
    "A lone Ace is the cheapest hand there is, and it is the first step of the chain. Open with it.",
    "Every third ante pays: one charm, then one perk, turn and turn about. The two before it are the run-up.",
    "Bombs beat anything and the chain carries on through them. Save one for a wall.",
    "The shape of the hand matters far more than the rank of the cards. Build shapes.",
  ];
  /* Ο λόγος να πατήσεις «ξανά»: το πιο κοντινό κλειδωμένο charm, με το πόσο σου λείπει. */
  function nextUnlock() {
    const l = life();
    const near = G.CHARMS.filter((c) => c.lock && (l[c.lock.key] || 0) < c.lock.n)
      .map((c) => ({ c, left: c.lock.n - (l[c.lock.key] || 0) }))
      .sort((a, b) => a.left - b.left)[0];
    if (!near) return "";
    return '<div class="nextun"><span class="lbl">Closest unlock</span><b>' + near.c.name + '</b>' +
      '<span>' + near.c.lock.text + ' · ' + (near.c.lock.n - near.left) + '/' + near.c.lock.n + '</span></div>';
  }
  /* Survival δεν «μπουσουλάει»: η τράπουλα τέλειωσε, το σκορ είναι το αποτέλεσμα. */
  function sheetSurv(rec) {
    const l = life(), best = l.bestSurv || 0;
    return openS('<h2 class="' + (rec ? "good" : "") + '">' + (rec ? "New record" : "No way up") + '</h2>' +
      '<p class="sub">' + S.score.toLocaleString("en-US") + ' points' + (rec ? "" : " · best " + best.toLocaleString("en-US")) + '</p>' +
      '<div class="tally"><div>Hands climbed<b>' + S.stats.plays + '</b></div>' +
      '<div>Longest chain<b>×' + S.stats.maxChain + '</b></div>' +
      '<div>Breaths<b>' + (S.rdisc || 0) + ' of ' + (S.discMax == null ? G.discMaxOf(S) : S.discMax) + '</b></div>' +
      '<div>Earned on the way<b>+' + (S.survEarned || 0) + '</b></div>' +
      '<div>Bombs<b>' + (S.stats.quads || 0) + '</b></div>' +
      '<div>Seed<b>' + S.seed + '</b></div></div>' +
      '<p class="sub" style="margin:.8rem 0">Every chain step is worth ' + Math.round(G.CFG.survChainStep * 100) + '% more Mult than the last, with no ceiling — so the cheapest climb is usually the right one. Breaking the chain is allowed; it just costs a breath.</p>' +
      '<button class="big" data-restart="1">Same seed, again</button>' +
      '<div class="row2"><button class="big ghost" data-fresh="1">New seed</button><button class="big ghost" data-title="1">Title screen</button></div>', 1);
  }
  function sheetLose(newBest) {
    if (G.isSurv(S)) return sheetSurv(newBest);
    const rec = (life().seeds || {})[S.seed];
    openS('<h2 class="bad">Busted</h2><p class="sub">Ante ' + (S.ante + 1) + ' · ' + S.score + ' of ' + G.target(S) + '</p>' + missHTML() +
      (newBest && S.ante > 0 ? '<div class="unlocked">✦ New best on this seed</div>' : "") +
      '<div class="tally"><div>Antes cleared<b>' + S.ante + '</b></div><div>Best chain<b>×' + S.stats.maxChain + '</b></div>' + (rec && !newBest ? '<div>Best on this seed<b>Ante ' + rec.ante + ' · ' + rec.score + '</b></div>' : "") + '<div>Seed<b>' + S.seed + '</b></div></div>' +
      (S.charms.length ? '<span class="lbl">Your build</span><div class="chips">' + S.charms.map((id) => '<span class="chip">' + G.charmById[id].name + '</span>').join("") + chipsHTML() + '</div>' : "") +
      nextUnlock() +
      '<p class="sub" style="margin:.9rem 0">' + BUSTED_TIPS[(S.ante + S.stats.plays) % BUSTED_TIPS.length] + '</p>' +
      '<button class="big" data-restart="1">Same seed, again</button>' +
      '<div class="row2"><button class="big ghost" data-fresh="1">New seed</button><button class="big ghost" data-title="1">Title screen</button></div>', 1);
  }
  function sheetWin() {
    openS('<h2 class="good">The Summit</h2><p class="sub">All fifty · last hand ' + S.score + ' of ' + G.target(S) + '</p>' +
      '<div class="tally"><div>Charms<b>' + S.charms.length + '</b></div><div>Best chain<b>×' + S.stats.maxChain + '</b></div><div>Seed<b>' + S.seed + '</b></div></div>' +
      '<span class="lbl">Your build</span><div class="chips">' + S.charms.map((id) => '<span class="chip">' + G.charmById[id].name + '</span>').join("") + chipsHTML() + '</div>' +
      '<button class="big" data-endless="1" style="margin-top:1rem">Keep climbing · Endless</button>' +
      '<div class="row2"><button class="big ghost" data-fresh="1">New run</button><button class="big ghost" data-title="1">Title screen</button></div>', 1);
  }
  function sheetMenu() {
    openS('<h2>This round</h2>' +
      '<div class="log" style="margin-top:.5rem">' + (S.log.length ? S.log.slice().reverse().map((e) => '<div class="' + (e.cls || "") + '"><span>' + e.t + '</span><em>' + cap(e.c) + '</em><b>' + (typeof e.p === "number" ? "+" + e.p : e.p) + '</b></div>').join("") : '<div style="border:0;color:var(--muted)">No plays yet</div>') + '</div>' +
      '<div class="sec"><span class="lbl">Charms</span>' + ownedCharmsHTML() + '</div>' +
      '<div class="sec"><span class="lbl">Build</span><div class="chips">' + chipsHTML() + '</div></div>' +
      '<div class="sec"><span class="lbl">Paytable · base × mult, before cards and chain</span><div class="rtab">' + G.BY_TIER.map((t) => { const ki = G.KINDS.indexOf(t), k = { kind: ki, size: t.size || t.min, rank: 14 };
        return '<div><span>' + t.name + (t.id === "single" ? ' <em>One card · the first step</em>' : t.min ? ' <em>' + (t.id === "stairs" ? 'Two pairs in a row · longer pays more' : t.id === "pairs" ? 'Up to 4 pairs · more pay more' : '5 cards · longer pays more') + '</em>' : '') + '</span><b>' + G.kchips(k) + ' × ' + (G.kmult(k) + S.mult[ki]) + '</b></div>'; }).join("") + '</div></div>' +
      '<div class="sec"><span class="lbl">Seed · ' + S.seed + '</span><div class="seedrow"><input id="sd" value="" placeholder="custom seed" spellcheck="false" aria-label="Seed"><button data-seed="1">Go</button></div>' +
      '<button class="big ghost" data-fresh="1" style="margin-top:.4rem">Random seed</button></div>' +
      '<div class="row2" style="margin-top:1.1rem"><button class="big ghost" data-howto="1">How to play</button><button class="big ghost" data-collection="1">Collection</button></div>' +
      '<div class="row2"><button class="big ghost" data-sound="1">Sound · ' + (FX.isMuted() ? "off" : "on") + '</button><button class="big ghost" data-music="1">Music · ' + ["off", "on", "loud"][FX.musicLevel()] + '</button></div>' +
      /* Η έκδοση και η ΠΡΑΓΜΑΤΙΚΗ κατάσταση του ήχου: όταν ο παίκτης λέει «δεν ακούω»,
         αυτή η γραμμή απαντά αντί να μαντεύουμε. */
      '<p class="build">' + buildTag() + ' · audio: ' + FX.audioState() + '</p>' +
      '<div class="row2"><button class="big ghost" data-title="1">Title screen</button><button class="big ghost" data-share="1">Share</button></div>' +
      /* Διέξοδος όταν το τηλέφωνο κρατά παλιά έκδοση: σβήνει ΚΑΘΕ cache, ξεγράφει τον
         service worker, και ξαναφορτώνει καθαρά. */
      '<button class="big ghost" data-hardreload="1" style="margin-top:.4rem">Force update · clear cache</button>' +
      (installEvt ? '<button class="big" data-install="1" style="margin-top:.4rem">Add to home screen</button>' : "") +
      '<button class="big ghost" data-close="1" style="margin-top:.5rem">Back</button>', 0, 1);
  }
  function sheetHowTo() {
    /* Ο ΒΡΟΧΟΣ ΠΡΩΤΟΣ. Το φύλλο άνοιγε με δεκαπέντε παραγράφους και ο πήχης — που είναι
       ολόκληρο το παιχνίδι — εξηγούνταν στη δεύτερη, ανάμεσα σε πίνακα πληρωμών, charms
       και table rules. Καμία λέξη δεν άλλαξε: οι παράγραφοι είναι οι ίδιες, αλλάζει η
       σειρά και το τι είναι ανοιχτό. Πάνω μένουν τέσσερις — ο βρόχος και ο γύρος· η
       εγκυκλοπαίδεια μαζεύεται σε τέσσερα πτυσσόμενα από κάτω. */
    openS('<h2>How to play</h2><div class="rulz" style="margin-top:.6rem;font-size:.9rem">' +
      '<p class="loop"><b>The loop.</b> Beat the hand on the table and the chain climbs a step. What you just played is the new hand to beat. That is the game.</p>' +
      '<p>The hand sitting on the table is the <b>rung</b>. Everything in the game is about whether your next hand goes over it.</p>' +
      '<p><b>The chain multiplies.</b> Beat the hand on the table — a stronger kind, or the same kind Tichu-style (same length, higher rank, or a longer run) — and the chain climbs one step. <b>Every step is +' + Math.round(G.CFG.chainStep * 100) + '% Mult, the first climb included</b>, and <b>the counter never stops</b> — ×' + G.CFG.chainCap + ' is worth ×' + (Math.round((1 + G.CFG.chainStep * (G.CFG.chainCap + G.CFG.chainFloor - 1)) * 10) / 10) + ' Mult, ×' + G.CFG.chainStepCap + ' is worth ×' + (Math.round((1 + G.CFG.chainStep * G.CFG.chainStepCap) * 10) / 10) + ', and past that every further step still pays, just less than the one before. It is a percentage, so it rewards a big hand exactly as much as a small one — the shape is what decides the score. Play something lower and it still scores its plain Base × Mult, but you get no chain bonus and the chain drops back to ×1. <b>The chain survives the ante</b> — a new ante starts on a clean table with the chain you finished on, and only the first hand of it pays as if the chain were cold.</p>' +
      '<p>So the round is one question, five times over: <b>climb for the multiplier, or cash in a big hand and start again.</b> No single hand clears an ante on its own — you need three of them, and the target is built that way on purpose.</p>' +
      '<p><b>One round, five plays, two discards.</b> Pick cards from your hand, make a hand, play it. You draw back up to eight after every play. Reach the target before the plays run out — <b>the moment you reach it the round is over</b> and the next ante starts on its own.</p>' +
      '<details class="rulz__d"><summary>The hands, and what they pay</summary>' +
      '<p><b>The hands</b>, weakest to strongest: a lone <b>Ace</b> · pair · two, three or four pairs · trips · <b>stairs</b> (pairs in a row, 22 33 44) · <b>straight</b> of five or more · full house · then the two bombs, quads and straight flush. <b>Jokers</b> stand in for any card.</p>' +
      '<p><b>Score = Base × Mult.</b> Every hand has a <b>Base</b> and a <b>Mult</b>, and the score is the two multiplied. The shape sets both: a pair is 25 × 3, two pair 30 × 4, trips 34 × 5, a straight 38 × 5, a full house 42 × 6, a straight flush 62 × 8. Measured over real runs, a full house pays about <b>four times</b> a pair — enough that combinations are always worth building, not so much that one lucky hand ends the round. Then every card adds to the Base: 2 to 10 as printed, J Q K ten, an Ace eleven. <b>There is no currency in this game</b> — Base is half of the score, not money.</p>' +
      '</details>' +
      '<details class="rulz__d"><summary>Aces, bombs and discards</summary>' +
      '<p>A lone <b>Ace</b> is a hand of its own — the cheapest one, and the first step of every chain. Anything else beats it, so it is the natural way to open. <b>Bombs</b> beat anything, open the table, and keep the chain climbing.</p>' +
      '<p><b>Discards</b> are their own resource — two a round, they never cost you a play. Throw any number of cards and draw the same number back. Once your discards are spent, a hand that makes no combination at all still gets one free.</p>' +
      '</details>' +
      '<details class="rulz__d"><summary>Antes, rewards, charms, table rules</summary>' +
      '<p><b>Every third ante is the one that pays</b>, and it is also the <b>boss</b> — the two go together (the Summit at 50 is a boss too, but there is nothing left to spend it on). It gives you <b>one thing</b>, three on offer: a <b>charm</b> at the first station, a <b>perk</b> at the next, turn and turn about. No money, no prices, no selling: one tap and you are back at the table, and the two antes in between pass straight through. Perks are upgrades (more Mult, another play, a wider hand) — the Mult ones repeat forever, the rest run out; charms are passive and permanent, and you only ever hold <b>five</b> — so each one is a pillar of the run, not a trinket. Once all five slots are full, a charm station pays a perk instead.</p>' +
      '<p><b>Your hand carries over</b> between antes and tidies itself — cards that fit no combination are swapped for fresh ones. Cards are never for sale, but about one card in sixteen that you draw turns out enhanced, for the rest of the run: <b>Silver</b> (Mult ×1.5, the common one), <b>Gold</b> (Mult ×2, and two of them ×3 — the cap on enhanced cards) or a <b>Joker</b>.</p>' +
      '<p>Most of the antes in between carry a <b>table rule</b> — Red Night, Cheap Pairs, Runway. Tap the ribbon to read it. A boss ante has a rule that bites instead, and a target a tenth lower to pay for it.</p>' +
      '<p>Fifty antes. Gentle at first, steep at the end. The Summit at 50 — and Endless after that.</p>' +
      '</details>' +
      '<details class="rulz__d"><summary>Survival &middot; the third choice on the start screen</summary>' +
      '<p><b>Survival</b> is the third choice in the row on the start screen, next to the two decks — and a different game. <b>No targets, no antes, no perks or charms</b>, and the cards never run out — the deck comes round again, shuffled, for as long as you last. Three things change:</p>' +
      /* Τα νούμερα βγαίνουν από το CFG, δεν γράφονται με το χέρι: η προηγούμενη έκδοση αυτής
         της παραγράφου έλεγε «πέντε ανάσες» και «1 500, 3 300, 7 260» για ώρες αφού ο κώδικας
         είχε γίνει δέκα και 1 200 / 2 640 / 5 808 — και, το χειρότερο, έλεγε ότι το σπάσιμο
         της αλυσίδας ΑΠΑΓΟΡΕΥΕΤΑΙ, δηλαδή έκρυβε τη μόνη απόφαση του mode. */
      '<p>· <b>Climbing is not compulsory — it costs.</b> A hand that does not beat the rung plays and scores as normal, but it <b>breaks the chain and costs a breath</b>. With no breath left you cannot break it while something in your hand still climbs; when nothing does, that hand is your last.<br>· <b>The chain has no ceiling and no slowdown</b> — step forty is worth forty full steps of Mult, where a normal run would have started paying less per step by then.<br>· <b>A bomb clears the ladder and keeps the chain.</b> Quads or a straight flush beat anything, so the table opens behind them: your next hand can be a <b>lone Ace</b> and it still counts as a climb, at the full multiplier. A breath does the same for the price of one breath — that is the way back down when the rung has climbed out of reach.<br>· A discard also <b>opens the table</b>: a <b>breath</b>. You start with <b>' + G.CFG.survDiscards + '</b>, and <b>earn one more every time your score passes the next mark</b> — ' + [0, 1, 2].map((i) => G.survMilestone(i).toLocaleString("en-US")).join(", then ") + ', each mark ' + G.CFG.survGrow + '× the last. The bar under your score is how close the next one is.</p>' +
      '<p>The run ends the moment nothing climbs and you have no breath left. So it is one long question: <b>the cheapest climb keeps the rung low and the chain alive</b> — spend the big hands and the rung gets too high to beat. Measured, playing the biggest hand every time scores about <b>10 000</b> over twenty-six hands; playing the smallest climb scores about <b>122 000</b> over seventy-three. That gap is the mode.</p>' +
      '</details>' +
      '</div>' +
      '<button class="big ghost" data-close="1" style="margin-top:1.1rem">Back</button>', 0, 1);
  }
  function sheetCollection() {
    const l = life(), un = unlockedFrom(l);
    openS('<h2>Collection</h2><p class="sub">' + un.length + ' of ' + G.CHARMS.length + ' charms</p>' +
      '<div class="coll">' + G.CHARMS.map((c) => { const ok = un.indexOf(c.id) >= 0; return '<div class="coll__i' + (ok ? "" : " locked") + '">' + (ok ? IC.bubble(c.id, "charm charm--s") : '<span class="charm charm--s charm--lock"><span>?</span></span>') + '<div><strong>' + c.name + '</strong><span>' + (ok ? c.desc : c.lock.text + " · " + Math.min(l[c.lock.key] || 0, c.lock.n) + "/" + c.lock.n) + '</span></div></div>'; }).join("") + '</div>' +
      '<span class="lbl" style="display:block;margin-top:1rem">Synergies · two charms, one more effect</span><div class="synlist">' + G.SYNERGIES.map((s) => '<div class="synrow"><b>⚡ ' + s.name + '</b><span>' + G.charmById[s.a].name + ' + ' + G.charmById[s.b].name + ' — ' + s.desc + '</span></div>').join("") + '</div>' +
      '<button class="big ghost" data-close="1" style="margin-top:1.1rem">Back</button>', 0, 1);
  }
  function sheetCharm(id) { const c = G.charmById[id], sy = G.synergyFor(S, id); note(c.name + " — " + c.desc + sy.map((s) => " ⚡ " + s.name + ": " + s.desc).join(""), 6000); }

  /* Είσοδος boss ante: κάρτα με εικονίδιο, όνομα, «tell» και συμβουλή· φεύγει μόνη της ή με άγγιγμα. */
  function bossIntro(c) {
    const el = $("boss");
    el.innerHTML = '<div class="boss__in"><span class="boss__lbl">Boss ante ' + (S.ante + 1) + '</span>' + IC.bubble(c.id, "charm boss__ico") + '<b>' + c.name + '</b><em>' + c.tell + '</em><span class="boss__tip">' + c.tip + '</span></div>';
    el.hidden = false; el.classList.remove("show"); void el.offsetWidth; el.classList.add("show");
    FX.sfx.boss(); FX.buzz([20, 60, 40]);
    clearTimeout(bossIntro.t); bossIntro.t = setTimeout(() => { el.hidden = true; }, 2800);
  }
  $("boss").addEventListener("click", () => { $("boss").hidden = true; });
  $("tip").addEventListener("click", () => { ui.noteT = 0; render(true); });

  /* ---------- start screen ---------- */
  const FAN = [{ r: 10, si: 0 }, { r: 11, si: 2 }, { r: 12, si: 3 }, { r: 13, si: 1 }, { r: 14, si: 0 }];
  function showStart(resume) {
    FX.music.level(0.1);
    lifeC = null;   /* στην αρχική οθόνη τα stats διαβάζονται φρέσκα από τον δίσκο */
    const l = life(), un = unlockedFrom(l);
    $("fan").innerHTML = FAN.map((c, i) => '<span class="fan__c" style="--i:' + i + '">' + cardHTML(c, null, false, true, i, 5) + '</span>').join("");
    $("startBtns").innerHTML =
      /* Ένα κύριο κουμπί, όχι δύο: Continue αν τρέχει run, αλλιώς Play. */
      (resume
        ? '<button class="big" data-continue="1">' + (resume.phase === "won" ? "Keep climbing · Endless" : "Continue · ante " + (resume.ante + 1) + (resume.score ? " · " + resume.score.toLocaleString("en-US") + " pts" : "")) + '</button>' +
          /* Με run σε εξέλιξη χρειάζεσαι και έξοδο προς νέο run — αλλιώς το Continue είναι ο μόνος δρόμος. */
          '<div class="row2"><button class="big ghost" data-howto="1">How to play</button><button class="big ghost" data-random="1">New game</button></div>'
        : '<button class="big" data-random="1">Play</button><button class="big ghost" data-howto="1">How to play</button>') +
      '<button class="colllink" data-collection="1">Collection · ' + un.length + ' / ' + G.CHARMS.length + ' charms ›</button>';
    const pick = deckPick(), mp = G.deckById[pick] && G.deckById[pick].mode === "surv" ? "surv" : "run";
    $("decks").innerHTML = G.DECKS.map((d) => { const ok = deckOpen(l, d), on = d.id === pick; return '<button class="deckc' + (on ? " on" : "") + (ok ? "" : " locked") + '" data-deck="' + d.id + '"' + (ok ? "" : " disabled") + '><b>' + d.glyph + ' ' + d.name + '</b><span>' + (ok ? d.desc : "🔒 " + d.lock.text) + '</span></button>'; }).join("");
    /* Το κάτω μέρος της αρχικής τελειώνει στα στατιστικά. Το ledger (μία σειρά ανά seed με
       το καλύτερό σου, πατημένη ξανάπαιζε το seed) έφυγε: ο παίκτης δεν το ζήτησε ποτέ, δεν
       κατάλαβε τι ήταν, και ήταν το μόνο πράγμα που γέμιζε το κάτω μέρος. Το `l.seeds`
       μένει — το «Best on this seed» στο τέλος του run το διαβάζει. */
    $("stats").innerHTML = l.runs ? '<div><b>' + l.runs + '</b><span>runs</span></div><div><b>' + l.best + '</b><span>best ante</span></div><div><b>' + l.wins + '</b><span>summits</span></div><div><b>' + (mp === "surv" ? (l.bestSurv || 0) + '</b><span>best survival' : l.bestScore + '</b><span>best round') + '</span></div>' : "";
    $("start").hidden = false; document.body.classList.add("on-start"); FX.embers(true);
    coachSync();
  }
  function hideStart() { $("start").hidden = true; document.body.classList.remove("on-start"); FX.embers(false); coachSync(); }
  /* Ο ήχος δεν επιτρέπεται πριν από χειρονομία — η μουσική μπαίνει στο πρώτο άγγιγμα,
     χαμηλά, και ανεβαίνει μόνη της μαζί με την αλυσίδα. */
  addEventListener("pointerdown", () => { FX.music.start(); if ($("start") && !$("start").hidden) FX.music.level(0.1); }, { once: true, passive: true });

  /* ---------- events ---------- */
  const SWIPE = 45;
  let swipe = { y0: 0, x0: 0, did: false, moved: 0, armed: false };
  const hand = $("hand");
  /* Το χέρι ακολουθεί τον αντίχειρα όσο σέρνεις. Πριν, τίποτα δεν κουνιόταν κατά τη
     χειρονομία: ένα σύρσιμο που απορριπτόταν ήταν εντελώς αδιάκριτο από αστοχία. */
  const dragTo = (dy) => { hand.style.transform = dy ? "translateY(" + Math.max(-18, Math.min(18, dy * 0.35)).toFixed(1) + "px)" : ""; };
  const dragEnd = () => { hand.classList.remove("dragging"); hand.style.transform = ""; };
  /* ΤΟ ΑΓΓΙΓΜΑ ΚΛΕΙΝΕΙ ΣΤΟ ΣΗΚΩΜΑ ΤΟΥ ΔΑΧΤΥΛΟΥ, ΟΧΙ ΣΤΟ `click`.
     Μετρημένο σε mobile Chromium με πραγματικά touch events: ο browser βγάζει το `click`
     10,9ms (p50) / 24,3ms (max) μετά το `pointerup` στα 4× CPU. Πάνω σε αυτό κάθεται ο
     χρόνος του handler, οπότε από το σήκωμα του δαχτύλου ως το φύλλο που γυρίζει περνούσαν
     18,3ms (p50) / 29,9ms (max). Στο `pointerup` ξέρουμε ΗΔΗ την απόσταση της χειρονομίας —
     άρα ξέρουμε αν ήταν άγγιγμα ή σύρσιμο — και δεν υπάρχει λόγος να περιμένουμε το click:
     5,3ms (p50) / 10,9ms (max). Το `click` που ακολουθεί καταπίνεται· μένει ενεργό μόνο
     για πληκτρολόγιο, όπου δεν προηγείται pointer. */
  hand.addEventListener("pointerdown", (e) => {
    swipe = { y0: e.clientY, x0: e.clientX, did: false, moved: 0, armed: false, el: e.target.closest("[data-i]"), tapT: 0 };
  });
  hand.addEventListener("pointermove", (e) => {
    const dy = e.clientY - swipe.y0;
    swipe.moved = Math.max(swipe.moved, Math.abs(dy));
    if (swipe.moved > 8) { hand.classList.add("dragging"); dragTo(dy); }
    /* Ένα χτύπημα τη στιγμή που περνάς το κατώφλι: το όριο γίνεται αισθητό, όχι αόρατο. */
    if (!swipe.armed && Math.abs(dy) >= SWIPE) { swipe.armed = true; FX.buzz(4); }
  });
  /* Ακυρωμένος pointer δεν καταπίνει τη σειρά: το επόμενο click ξαναμετράει ως άγγιγμα. */
  hand.addEventListener("pointercancel", () => { swipe.did = false; swipe.tapT = 0; dragEnd(); });
  hand.addEventListener("pointerup", (e) => {
    dragEnd();
    const dy = e.clientY - swipe.y0, dx = e.clientX - swipe.x0;
    /* Ένα σύρσιμο δεν είναι ποτέ άγγιγμα. Πριν, μια χειρονομία που απορριπτόταν άφηνε το
       click να περάσει και *άλλαζε την επιλογή* κάτω από τον αντίχειρα. */
    if (Math.abs(dy) > 12 || swipe.moved > 12) swipe.did = true;
    /* Δεν κουνήθηκε: είναι άγγιγμα, και το φύλλο γυρίζει ΤΩΡΑ. Το `swipe.el` είναι το
       φύλλο του `pointerdown` — το ίδιο που θα έδινε το click, χωρίς την αναμονή. */
    if (!swipe.did && Math.abs(dx) <= 14) {
      if (swipe.el) { swipe.tapT = performance.now(); tapCard(swipe.el); }
      return;
    }
    /* Το παλιό όριο των 700ms έκοβε κάθε αργό, σκόπιμο σύρσιμο: μετρημένο, σύρσιμο 95px σε
       717ms (132 px/δευτ — απολύτως φυσιολογικός αντίχειρας) δεν έπαιζε ΤΙΠΟΤΑ. Η σελίδα δεν
       κάνει scroll· ο κάθετος άξονας είναι δικός μας, οπότε κρίνει η απόσταση, όχι το ρολόι.
       Απορρίπτεται μόνο ένα κυρίως οριζόντιο σύρσιμο — ο αντίχειρας γράφει τόξο. */
    if (Math.abs(dy) < SWIPE || Math.abs(dx) > Math.abs(dy) * 1.4) return;
    const go = $("bPlay");
    if (dy < 0 && !go.disabled && (go.classList.contains("ok") || go.classList.contains("down"))) doPlay();
    /* Ένα σύρσιμο πάνω που δεν μπορεί να παιχτεί δεν έκανε ΤΙΠΟΤΑ — καμία εικόνα, κανένας
       λόγος. Ο παίκτης δεν ξέρει αν αστόχησε τη χειρονομία ή αν το χέρι δεν παίζεται.
       Τώρα το κουμπί απαντά με τον δικό του λόγο, που είναι πάντα γραμμένο πάνω του. */
    else if (dy < 0 && S.sel.length && !ui.ending) {
      const t = go.querySelector(".go__t"), sub = go.querySelector(".go__s");
      if (t) note(t.textContent + (sub && sub.textContent ? " — " + sub.textContent : ""), 2400);
      FX.buzz(8);
    }
    /* Σύρσιμο κάτω που δεν μπορεί να πετάξει: πριν, η επιλογή απλώς ΕΞΑΦΑΝΙΖΟΤΑΝ, χωρίς
       λέξη — και ο παίκτης δεν είχε τρόπο να ξέρει αν πέταξε τα φύλλα ή όχι. */
    else if (dy > 0 && S.sel.length) {
      if (G.canDiscard(S)) doDiscard();
      else {
        const dm = S.discMax == null ? G.discMaxOf(S) : S.discMax;
        S.sel = [];
        note(dm === 0 ? "This round has no discards — the cards are back in your hand."
          : G.isSurv(S) ? "No breath left — the cards are back in your hand."
          : "No discards left — the cards are back in your hand.", 2400);
      }
    }
    /* Survival: σύρσιμο κάτω με ΑΔΕΙΑ επιλογή = ανάσα με τα άχρηστα φύλλα. Όταν τίποτα δεν
       ανεβαίνει, η ανάσα είναι η κίνηση — δεν έχει νόημα να διαλέξεις πρώτα τι θα πετάξεις. */
    else if (dy > 0 && !S.sel.length && G.isSurv(S) && G.canDiscardAny(S) && G.discardsLeft(S) > 0) {
      const o = G.orphans(S);
      S.sel = (o.length ? o : S.hand.map((_, i) => i).sort((a, b) => S.hand[a].r - S.hand[b].r)).slice(0, Math.max(1, Math.min(3, o.length || 2)));
      if (G.canDiscard(S)) doDiscard(); else { S.sel = []; render(true); }
    }
    /* Σύρσιμο κάτω με άδεια επιλογή και καμία ανάσα: η χειρονομία έπεφτε στο κενό. */
    else if (dy > 0 && !ui.ending) note(G.isSurv(S) ? "No breath left — every hand from here has to climb." : "Pick the cards you want to throw first.", 2400);
  });
  hand.addEventListener("click", (e) => {
    if (swipe.did) { swipe.did = false; return; }
    /* Το άγγιγμα το χειρίστηκε ήδη το pointerup· αυτό εδώ είναι ο απόηχός του. */
    if (swipe.tapT && performance.now() - swipe.tapT < 900) { swipe.tapT = 0; return; }
    tapCard(e.target.closest("[data-i]"));
  });
  $("tools").addEventListener("click", (e) => {
    const a = e.target.closest("[data-act]"); if (!a) return;
    const act = a.dataset.act;
    if (act === "hint") doHint();
  });
  $("charms").addEventListener("click", (e) => { const c = e.target.closest("[data-charm]"); if (c) sheetCharm(c.dataset.charm); });
  $("chal").addEventListener("click", () => { const c = G.current(S); if (c) note(c.name + " — " + c.desc, 4500); });
  $("rule").addEventListener("click", () => { const r = G.currentRule(S); if (r) note(r.name + " — " + r.desc, 4500); });
  $("bPlay").addEventListener("click", doPlay);
  $("bDisc").addEventListener("click", doDiscard);
  $("bMenu").addEventListener("click", sheetMenu);
  $("bHint").addEventListener("click", doHint);
  $("veil").addEventListener("click", (e) => {
    const t = e.target;
    const pick = t.closest("[data-take]");
    if (pick) {
      if (G.take(S, +pick.dataset.take)) {
        FX.sfx.buy(); FX.buzz(10); FX.burstAt(pick, 22, 3, ["#ffd166", "#fff6d4"]);
        save(); refreshShop();
        /* Τελευταία επιλογή: μια στιγμή να δεις τι πήρες, και συνεχίζει μόνο του. */
        /* Μετρημένο: το φύλλο άρχιζε να φεύγει 156ms μετά το χτύπημα — η μοναδική
           ανταμοιβή τριών antes περνούσε χωρίς να προλάβεις να τη δεις. Μία ανάσα πρώτα. */
        if (!canPickMore()) setTimeout(() => { $("sheet").classList.add("leaving"); setTimeout(goNextAnte, 620); }, 850);
      }
      return;
    }
    const cm = t.closest("[data-charm]");
    if (cm) { sheetCharm(cm.dataset.charm); return; }
    if (t.closest("[data-next]")) { goNextAnte(); return; }
    /* Ο «tap to skip» του «Ante cleared» έπιανε ΚΑΘΕ άγγιγμα μέσα στο φύλλο. Με ένα run
       αποθηκευμένο σε phase "shop", το How to play από την αρχική οθόνη προχωρούσε το ante
       με το πρώτο άγγιγμα — και τώρα που τα κεφάλαια του How to play ανοιγοκλείνουν, κάθε
       άνοιγμα κεφαλαίου θα το έκανε. Τα φύλλα ανάγνωσης εξαιρούνται ρητά. */
    if (S && S.phase === "shop" && !S.offers.length && $("sheet").dataset.info !== "1") { clearTimeout(sheetNext.t); goNextAnte(); return; }
    if (t.closest("[data-endless]")) { if (G.goEndless(S)) { FX.sfx.open(); save(); sheetShop(null, []); } return; }
    if (t.closest("[data-restart]")) { closeS(); begin(S.seed); return; }
    if (t.closest("[data-fresh]")) { closeS(); begin(""); return; }
    if (t.closest("[data-seed]")) { const v = $("sd").value.trim(); if (v) { closeS(); begin(v); } return; }
    if (t.closest("[data-sound]")) { FX.toggleMute(); FX.sfx.tick(); sheetMenu(); return; }
    if (t.closest("[data-hardreload]")) {
      note("Clearing cache…", 4000);
      Promise.resolve()
        .then(() => (self.caches ? caches.keys().then((ks) => Promise.all(ks.map((k) => caches.delete(k)))) : null))
        .then(() => (navigator.serviceWorker ? navigator.serviceWorker.getRegistrations().then((rs) => Promise.all(rs.map((r) => r.unregister()))) : null))
        .catch(() => {})
        .then(() => { try { sessionStorage.removeItem("raise.reloaded"); } catch (x) {} location.replace(location.pathname + "?fresh=" + Date.now()); });
      return;
    }
    if (t.closest("[data-music]")) { FX.toggleMusic(); FX.sfx.tick(); sheetMenu(); return; }
    if (t.closest("[data-howto]")) { sheetHowTo(); return; }
    if (t.closest("[data-collection]")) { sheetCollection(); return; }
    if (t.closest("[data-share]")) { const txt = shareText(); (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => { t.closest("[data-share]").textContent = "Copied"; }).catch(() => { prompt("Copy your result", txt); }); return; }
    if (t.closest("[data-title]")) { closeS(); showStart(worthResuming(S) ? S : null); return; }
    if (t.closest("[data-install]")) { if (installEvt) { installEvt.prompt(); installEvt = null; } closeS(); return; }
    if (t.closest("[data-close]") || t === $("veil")) { if ((S && S.phase === "round") || !$("start").hidden) closeS(); }
  });
  $("start").addEventListener("click", (e) => {
    if (e.target.closest("[data-continue]")) { hideStart(); FX.sfx.open(); render(); if (S.phase === "shop") sheetShop(null, []); else if (S.phase === "won") sheetWin(); else afterMove(); return; }
    const dk = e.target.closest("[data-deck]"); if (dk) { try { localStorage.setItem(DECK_KEY, dk.dataset.deck); } catch (x) {} FX.sfx.tick(); showStart(worthResuming(S) ? S : null); return; }
    if (e.target.closest("[data-random]")) { FX.sfx.open(); begin(""); return; }
    if (e.target.closest("[data-howto]")) { sheetHowTo(); return; }
    if (e.target.closest("[data-collection]")) { sheetCollection(); return; }
  });
  /* Στο κινητό η μπάρα διεύθυνσης κρύβεται και ξαναεμφανίζεται όσο παίζεις, και κάθε φορά
     πέφτει resize. Μετρημένο: ένα resize ξανάχτιζε και τα 8 φύλλα του χεριού ακόμη κι όταν
     το --cw έμενε ίδιο — αντικαθιστούσε DOM κάτω από τον αντίχειρα χωρίς λόγο. */
  /* Η μπάρα διεύθυνσης δίνει μια ΡΙΠΗ από resize όσο γλιστράει (μετρημένο: 9 σε ~250ms) —
     ένα render το καθένα. Ένα ανά καρέ αρκεί: το layout δεν μπορεί να αλλάξει πιο συχνά. */
  let rzRaf = 0;
  addEventListener("resize", () => {
    if (!S || rzRaf) return;
    rzRaf = requestAnimationFrame(() => { rzRaf = 0; if (!S) return; if (fitHand(S.hand.length)) render(); else render(true); });
  });
  addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; });
  document.addEventListener("visibilitychange", () => { if (document.hidden && S) save(); });

  resumeOrBegin();
})();
