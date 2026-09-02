/* RAISE — UI. Κρατά DOM και είσοδο· η λογική ζει στο game.js (window.RAISE). */
(function () {
  "use strict";
  const G = window.RAISE, FX = window.FX;
  const $ = (id) => document.getElementById(id);
  const KEY = "raise.run.v1";
  let S = null, shown = 0, ui = { chisel: false, note: null, noteT: 0 }, installEvt = null;

  /* ---------- persistence ---------- */
  const save = () => { try { localStorage.setItem(KEY, G.serialize(S)); } catch (e) {} };
  const load = () => { try { return G.restore(localStorage.getItem(KEY)); } catch (e) { return null; } };
  const wipe = () => { try { localStorage.removeItem(KEY); } catch (e) {} };

  /* ---------- run lifecycle ---------- */
  function begin(seed) {
    S = G.newRun(seed); ui.chisel = false; ui.note = null; shown = 0;
    save(); render();
  }
  function resumeOrBegin() {
    const saved = load();
    if (saved) {
      S = saved; shown = S.score;
      render();
      if (S.phase === "shop") sheetShop(null, null);
      else if (S.phase === "lost") sheetLose();
      else if (S.phase === "won") sheetWin();
      return;
    }
    begin(G.todaySeed());
  }

  /* ---------- cards ---------- */
  function cardHTML(c, i, sel, tbl, idx, n) {
    const su = G.SUITS[c.si], face = c.r >= 11;
    let st = "";
    if (!tbl && n > 1) st = ' style="--rot:' + (((idx / (n - 1)) - 0.5) * 4).toFixed(2) + 'deg"';
    if (tbl) st = ' style="animation-delay:' + (idx * 60) + 'ms"';
    return '<button class="card' + (su.red ? " red" : "") + (sel ? " sel" : "") + (face ? " face" : "") + '"' + st +
      (tbl ? ' disabled tabindex="-1" aria-hidden="true"' : ' data-i="' + i + '" aria-pressed="' + (sel ? "true" : "false") + '" aria-label="' + G.rname(c.r) + " " + su.s + '"') +
      '><span class="card__ix"><span class="card__r">' + G.rname(c.r) + '</span><span class="card__rs">' + su.s + '</span></span><span class="card__pip">' + su.s + '</span></button>';
  }
  /* Δύο σειρές πάντα (τρεις πάνω από 16 φύλλα), πλήρως ορατά, όσο μεγάλα χωράει η οθόνη. */
  function fitHand(n) {
    const W = $("hand").clientWidth || 360;
    const rows = n <= 16 ? 2 : 3, per = Math.max(1, Math.ceil(n / rows));
    const cw = Math.max(36, Math.min(60, Math.floor((W - (per - 1) * 4) / per)));
    document.documentElement.style.setProperty("--cw", cw + "px");
  }

  /* ---------- render ---------- */
  function render() {
    const T = G.target(S), k = G.selection(S), legal = G.isLegal(S, k);

    FX.countUp($("score"), shown, S.score); shown = S.score;
    $("score").classList.toggle("on", S.score >= T);
    $("tgt").textContent = "/ " + T;
    $("ante").textContent = S.ante + 1;
    $("money").textContent = S.money;
    let b = ""; for (let i = 0; i < S.breathsMax; i++) b += '<i class="' + (i < S.breaths ? "" : "spent") + '"></i>';
    $("breaths").innerHTML = b;
    const f = $("fill"); f.style.width = Math.min(100, S.score / T * 100) + "%"; f.classList.toggle("done", S.score >= T);

    const rv = $("rungVal");
    if (S.rung) { rv.textContent = G.TIERS[S.rung.tier].name + " " + G.rname(S.rung.rank); rv.classList.remove("free"); }
    else { rv.textContent = "ελεύθερο"; rv.classList.add("free"); }
    $("rungDots").innerHTML = G.TIERS.slice(1).map((t, i) => {
      const tier = i + 1, at = S.rung && S.rung.tier === tier, un = S.rung && tier < S.rung.tier;
      return '<i class="' + (at ? "at" : un ? "under" : "") + '" title="' + t.name + '"></i>';
    }).join("");
    $("tnote").textContent = S.rung ? "ίδια κατηγορία ψηλότερα, ή ανώτερη κατηγορία" : "παίξε ό,τι θέλεις — κράτα την κλίμακα ανοιχτή";
    $("chainN").textContent = "×" + G.chainPos(S);
    $("tcards").innerHTML = S.played.map((c, i) => cardHTML(c, null, false, true, i, S.played.length)).join("");

    const n = S.hand.length; fitHand(n);
    const hand = $("hand");
    hand.innerHTML = S.hand.map((c, i) => cardHTML(c, i, S.sel.includes(i), false, i, n)).join("");
    hand.classList.toggle("chisel", ui.chisel);

    /* tools row */
    let tools = "";
    if (ui.chisel) {
      tools = S.sel.length === 1
        ? '<div class="picker">' + rankButtons() + '</div><button class="tb on" data-act="chisel">Άκυρο</button>'
        : '<span class="toast" style="flex:1;border-left-color:var(--brass);background:rgba(212,169,79,.1)">Σμίλη: πάτα το φύλλο που θέλεις να αλλάξεις.</span><button class="tb on" data-act="chisel">Άκυρο</button>';
    } else {
      if (ui.note && Date.now() < ui.noteT) tools += '<span class="toast" style="flex:1">' + ui.note + '</span>';
      if (S.descendMax) tools += '<button class="tb" data-act="descend"' + (S.descend <= 0 || !S.rung ? " disabled" : "") + '>Κατέβα <em>' + S.descend + '</em></button>';
      if (S.chiselMax) tools += '<button class="tb" data-act="chisel"' + (S.chisel <= 0 ? " disabled" : "") + '>Σμίλη <em>' + S.chisel + '</em></button>';
    }
    $("tools").innerHTML = tools;

    /* το κουμπί ΠΑΙΞΕ είναι και το readout */
    const go = $("bPlay");
    go.className = "go";
    if (ui.chisel) {
      go.classList.add("idle"); go.disabled = true;
      go.innerHTML = '<span class="go__t">Σμίλη</span><span class="go__s">διάλεξε φύλλο και νέα αξία</span>';
    } else if (!S.sel.length) {
      const done = S.score >= T;
      go.classList.add(done ? "done" : "idle"); go.disabled = !done;
      go.innerHTML = done
        ? '<span class="go__t">Κλείσε τον γύρο</span><span class="go__s">ή συνέχισε για περισσότερο χρήμα</span>'
        : '<span class="go__t">Διάλεξε φύλλα</span><span class="go__s">' + (S.rung ? "ανέβα πάνω από " + G.TIERS[S.rung.tier].name + " " + G.rname(S.rung.rank) : "σύρε πάνω για να παίξεις") + '</span>';
    } else if (!k) {
      go.classList.add("no"); go.disabled = true;
      go.innerHTML = '<span class="go__t">' + S.sel.length + ' φύλλα</span><span class="go__s">δεν σχηματίζουν χέρι</span>';
    } else if (!legal) {
      go.classList.add("no"); go.disabled = true;
      go.innerHTML = '<span class="go__t">' + G.clabel(k) + '</span><span class="go__s">δεν ξεπερνά το σκαλί</span>';
    } else {
      go.classList.add("ok"); go.disabled = false;
      go.innerHTML = '<span class="go__t">' + G.clabel(k) + '</span><span class="go__s">' + G.cbase(S, k) + ' × ' + G.chainPos(S) + ' — πάτα ή σύρε πάνω</span><span class="go__p">+' + G.cscore(S, k) + '</span>';
    }
    $("bPass").disabled = ui.chisel || S.breaths <= 0 || !S.rung;
    $("passN").textContent = S.breaths;
    $("bHint").disabled = ui.chisel;
  }
  function rankButtons() { let h = ""; for (let r = 2; r <= 14; r++) h += '<button data-rank="' + r + '">' + G.rname(r) + '</button>'; return h; }
  function note(msg) { ui.note = msg; ui.noteT = Date.now() + 4000; render(); setTimeout(() => { if (Date.now() >= ui.noteT) render(); }, 4100); }

  /* ---------- actions ---------- */
  function doPlay() {
    const ev = G.play(S); if (!ev) return;
    FX.buzz(18);
    FX.burstAt($("table"), Math.min(50, 10 + Math.round(ev.pts / 24)), 2.4 + Math.min(3, ev.pts / 300));
    FX.floatIn($("table"), "+" + ev.pts);
    ui.note = null; render(); FX.pulse($("chain"), "bump"); save();
    if (ev.emptied) { setTimeout(end, 750); return; }
    if (G.stuck(S)) { note(G.stuckReason(S)); setTimeout(end, 1600); }
  }
  function doPass() { if (G.pass(S)) { FX.buzz(40); ui.note = null; render(); save(); if (G.stuck(S)) { note(G.stuckReason(S)); setTimeout(end, 1600); } } }
  function doDescend() { if (G.descend(S)) { FX.buzz(14); render(); save(); } }
  function doHint() {
    const m = G.cheapest(S);
    S.sel = m ? m.idx.slice() : [];
    if (!m) note(G.stuckReason(S)); else { ui.note = null; render(); }
  }
  function end() {
    const r = G.finish(S); if (!r) return;
    save();
    if (!r.cleared) { sheetLose(); return; }
    FX.spark(innerWidth / 2, innerHeight * 0.42, 120, 6.5); FX.buzz([12, 60, 12]);
    if (r.won) sheetWin(); else sheetShop(r.earn, r.ex);
  }

  /* ---------- sheets ---------- */
  const openS = (h) => { $("sheet").innerHTML = '<div class="grip"></div>' + h; $("veil").hidden = false; };
  const closeS = () => { $("veil").hidden = true; };
  function chipsHTML() {
    const c = [];
    G.TIERS.slice(1).forEach((t, i) => { if (S.mult[i + 1] > 1) c.push(t.short + " <b>×" + S.mult[i + 1] + "</b>"); });
    if (S.breathsMax > 3) c.push("Ανάσες <b>" + S.breathsMax + "</b>");
    if (S.chiselMax) c.push("Σμίλη <b>" + S.chiselMax + "</b>");
    if (S.descendMax) c.push("Κατέβασμα <b>" + S.descendMax + "</b>");
    if (S.handSize > 15) c.push("Χέρι <b>" + S.handSize + "</b>");
    if (S.chainStart) c.push("Αλυσίδα <b>+" + S.chainStart + "</b>");
    if (S.removed.length) c.push("Έφυγαν <b>" + S.removed.map(G.rname).join(",") + "</b>");
    return c.length ? c.map((x) => '<span class="chip">' + x + '</span>').join("") : '<span class="chip">καμία ακόμα</span>';
  }
  function offersHTML() {
    return S.offers.map((o, i) => {
      const it = G.poolById[o.id];
      return '<button class="offer' + (o.bought ? " bought" : "") + '" data-buy="' + i + '"' + (o.bought || it.cost > S.money ? " disabled" : "") +
        '><strong>' + it.name + '</strong><em>' + it.cost + '◎</em><span>' + it.desc + '</span></button>';
    }).join("");
  }
  function sheetShop(earn, ex) {
    const T = G.target(S);
    openS('<h2>Ante ' + (S.ante + 1) + ' καθαρό</h2><p class="sub">' + S.score + ' με στόχο ' + T + '.</p>' +
      '<div class="tally"><div>Σκορ γύρου<b>' + S.score + '</b></div>' +
      (ex != null ? '<div>Πάνω από τον στόχο<b>+' + ex + '</b></div><div>Αμοιβή<b>+' + earn + '◎</b></div>' : "") +
      '<div>Χρήμα<b id="mn">' + S.money + '◎</b></div></div>' +
      '<span class="lbl">Κατάστημα</span><div class="offers" id="offers">' + offersHTML() + '</div>' +
      '<button class="big" data-next="1">Ante ' + (S.ante + 2) + ' · στόχος ' + G.TARGETS[S.ante + 1] + '</button>');
  }
  function sheetLose() {
    openS('<h2 class="bad">Δεν έφτασε</h2><p class="sub">Ante ' + (S.ante + 1) + ': ' + S.score + ' από ' + G.target(S) + '. Έμειναν ' + S.hand.length + ' φύλλα.</p>' +
      '<div class="tally"><div>Antes που πέρασες<b>' + S.ante + '</b></div><div>Seed<b>' + S.seed + '</b></div></div>' +
      '<p class="sub" style="margin-bottom:1rem">Τα ορφανά φύλλα σκοτώνουν τους γύρους, όχι τα αδύναμα χαρτιά. Η Σμίλη και το Κατέβασμα λύνουν το σχήμα του χεριού.</p>' +
      '<button class="big" data-restart="1">Ίδιο seed, ξανά</button><button class="big ghost" data-fresh="1">Νέο seed</button>');
  }
  function sheetWin() {
    openS('<h2 class="good">Και τα οκτώ</h2><p class="sub">Το τελευταίο χέρι έβγαλε ' + S.score + ' με στόχο ' + G.target(S) + '.</p>' +
      '<div class="tally"><div>Τελικό χρήμα<b>' + S.money + '◎</b></div><div>Seed<b>' + S.seed + '</b></div></div>' +
      '<span class="lbl">Το build σου</span><div class="chips">' + chipsHTML() + '</div>' +
      '<button class="big" data-fresh="1" style="margin-top:1rem">Νέο run</button>');
  }
  function sheetMenu() {
    openS('<h2>Ο γύρος</h2>' +
      '<div class="log" style="margin-top:.5rem">' + (S.log.length ? S.log.slice().reverse().map((e) =>
        '<div class="' + (e.cls || "") + '"><span>' + e.t + '</span><em>' + e.c + '</em><b>' + (typeof e.p === "number" ? "+" + e.p : e.p) + '</b></div>').join("")
        : '<div style="border:0;color:var(--muted)">καμία κίνηση ακόμα</div>') + '</div>' +
      '<div class="sec"><span class="lbl">Αγορές</span><div class="chips">' + chipsHTML() + '</div></div>' +
      '<div class="sec"><span class="lbl">Πίνακας</span><div class="rtab">' +
        G.TIERS.slice(1).map((t, i) => '<div><span>' + t.name + '</span><b>' + (t.base * S.mult[i + 1]) + '</b></div>').join("") + '</div></div>' +
      '<div class="sec"><span class="lbl">Κανόνες</span><div class="rulz">' +
        '<p>Κάθε χέρι πρέπει να ξεπερνά το προηγούμενο: <b>ανώτερη κατηγορία, ή ίδια κατηγορία με ψηλότερη αξία</b>.</p>' +
        '<p>Σκορ = <b>βάση × θέση στην Αλυσίδα</b>. Το Πάσο μηδενίζει το Σκαλί, σπάει την Αλυσίδα και κοστίζει Ανάση.</p>' +
        '<p>Άδειασμα χεριού <b>+50%</b>. Κέντα-χρώμα μετράει ως Χρώμα. Ο άσος είναι μόνο ψηλός.</p>' +
        '<p><b>Σύρε πάνω</b> στα φύλλα για να παίξεις, <b>σύρε κάτω</b> για να ξεδιαλέξεις.</p></div></div>' +
      '<div class="sec"><span class="lbl">Seed · ' + S.seed + '</span><div class="seedrow">' +
        '<input id="sd" value="" placeholder="νέο seed" spellcheck="false" aria-label="Seed"><button data-seed="1">Ξεκίνα</button></div>' +
        '<div class="row2"><button class="big ghost" data-today="1">Σήμερα · ' + G.todaySeed() + '</button><button class="big ghost" data-fresh="1">Τυχαίο</button></div></div>' +
      (installEvt ? '<div class="sec"><button class="big" data-install="1">Εγκατάσταση στην αρχική οθόνη</button></div>' : "") +
      '<button class="big ghost" data-close="1" style="margin-top:1.1rem">Πίσω στο παιχνίδι</button>');
  }

  /* ---------- events ---------- */
  let swipe = { y0: 0, t0: 0, did: false };
  const hand = $("hand");
  hand.addEventListener("pointerdown", (e) => { swipe = { y0: e.clientY, t0: Date.now(), did: false }; });
  hand.addEventListener("pointerup", (e) => {
    const dy = e.clientY - swipe.y0;
    if (Math.abs(dy) < 45 || Date.now() - swipe.t0 > 700) return;
    swipe.did = true;
    if (dy < 0 && !$("bPlay").disabled && $("bPlay").classList.contains("ok")) doPlay();
    else if (dy > 0 && S.sel.length) { S.sel = []; render(); }
  });
  hand.addEventListener("click", (e) => {
    if (swipe.did) { swipe.did = false; return; }
    const b = e.target.closest("[data-i]"); if (!b || S.phase !== "round") return;
    const i = +b.dataset.i; ui.note = null;
    if (ui.chisel) { S.sel = [i]; render(); return; }
    if (G.toggle(S, i)) { FX.buzz(6); render(); }
  });
  $("tools").addEventListener("click", (e) => {
    const rk = e.target.closest("[data-rank]");
    if (rk) { if (G.chisel(S, S.sel[0], +rk.dataset.rank)) { ui.chisel = false; FX.buzz(12); render(); save(); } return; }
    const a = e.target.closest("[data-act]"); if (!a) return;
    if (a.dataset.act === "chisel") { ui.chisel = !ui.chisel; S.sel = []; render(); }
    if (a.dataset.act === "descend") doDescend();
  });
  $("bPlay").addEventListener("click", () => {
    if ($("bPlay").classList.contains("done")) { end(); return; }
    doPlay();
  });
  $("bPass").addEventListener("click", doPass);
  $("bHint").addEventListener("click", doHint);
  $("bMenu").addEventListener("click", sheetMenu);
  $("veil").addEventListener("click", (e) => {
    const buy = e.target.closest("[data-buy]");
    if (buy) {
      if (G.buy(S, +buy.dataset.buy)) {
        FX.buzz(10); save();
        $("offers").innerHTML = offersHTML(); const mn = $("mn"); if (mn) mn.textContent = S.money + "◎";
      }
      return;
    }
    if (e.target.closest("[data-next]")) { G.nextAnte(S); ui.chisel = false; closeS(); render(); save(); return; }
    if (e.target.closest("[data-restart]")) { closeS(); begin(S.seed); return; }
    if (e.target.closest("[data-fresh]")) { closeS(); begin(""); return; }
    if (e.target.closest("[data-today]")) { closeS(); begin(G.todaySeed()); return; }
    if (e.target.closest("[data-seed]")) { const v = $("sd").value.trim(); if (v) { closeS(); begin(v); } return; }
    if (e.target.closest("[data-install]")) { if (installEvt) { installEvt.prompt(); installEvt = null; } closeS(); return; }
    if (e.target.closest("[data-close]") || e.target === $("veil")) { if (S.phase === "round") closeS(); }
  });
  addEventListener("resize", () => { if (S) render(); });
  addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; });
  document.addEventListener("visibilitychange", () => { if (document.hidden && S) save(); });

  resumeOrBegin();
})();
