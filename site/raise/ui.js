/* RAISE — UI. DOM και είσοδος· η λογική ζει στο game.js (window.RAISE). */
(function () {
  "use strict";
  const G = window.RAISE, FX = window.FX;
  const $ = (id) => document.getElementById(id);
  const KEY = "raise.run.v2";
  let S = null, shown = 0, ui = { chisel: false, note: null, noteT: 0 }, installEvt = null;

  const save = () => { try { localStorage.setItem(KEY, G.serialize(S)); } catch (e) {} };
  const load = () => { try { return G.restore(localStorage.getItem(KEY)); } catch (e) { return null; } };

  function begin(seed) { S = G.newRun(seed); ui.chisel = false; ui.note = null; shown = 0; save(); render(); }
  function resumeOrBegin() {
    const saved = load();
    if (saved) {
      S = saved; shown = S.score; render();
      if (S.phase === "shop") sheetShop(null, null);
      else if (S.phase === "lost") sheetLose();
      else if (S.phase === "won") sheetWin();
      return;
    }
    begin(G.todaySeed());
  }

  /* ---------- cards ---------- */
  function cardHTML(c, i, sel, tbl, idx, n) {
    let st = "";
    if (!tbl && n > 1) st = ' style="--rot:' + (((idx / (n - 1)) - 0.5) * 4).toFixed(2) + 'deg"';
    if (tbl) st = ' style="animation-delay:' + (idx * 60) + 'ms"';
    if (c.h && !tbl) return '<button class="card down" disabled aria-label="face down"' + st + '><span class="card__back"></span></button>';
    const wild = G.isWild(c), su = G.SUITS[c.si], e = c.e, face = c.r >= 11 && !e;
    const cls = "card" + (e ? " e-" + e : "") + (!wild && su.red ? " red" : "") + (sel ? " sel" : "") + (face ? " face" : "");
    const tag = tbl ? "span" : "button";
    return '<' + tag + ' class="' + cls + '"' + st +
      (tbl ? ' aria-hidden="true"' : ' data-i="' + i + '" aria-pressed="' + (sel ? "true" : "false") + '" aria-label="' + (wild ? "wild" : G.rname(c.r) + " " + su.s) + (e ? " " + e : "") + '"') +
      '><span class="card__ix"><span class="card__r">' + (wild ? "W" : G.rname(c.r)) + '</span><span class="card__rs">' + (wild ? "★" : su.s) + '</span></span>' +
      '<span class="card__pip">' + (wild ? "★" : su.s) + '</span>' + (e ? '<span class="card__e">' + e + '</span>' : "") + '</' + tag + '>';
  }
  function fitHand(n) {
    const W = $("hand").clientWidth || 360;
    const rows = n <= 16 ? 2 : 3, per = Math.max(1, Math.ceil(n / rows));
    const cw = Math.max(36, Math.min(60, Math.floor((W - (per - 1) * 4) / per)));
    document.documentElement.style.setProperty("--cw", cw + "px");
  }

  /* ---------- render ---------- */
  function render() {
    const T = G.goal(S), e = G.evalSel(S), ch = G.current(S), pos = G.chainPos(S);

    FX.countUp($("score"), shown, S.score); shown = S.score;
    $("score").classList.toggle("on", S.score >= T);
    $("tgt").textContent = "/ " + T + (S.raised ? " ↑" : "");
    $("tgt").classList.toggle("raised", !!S.raised);
    $("ante").textContent = S.ante + 1;
    $("anteN").textContent = G.TARGETS.length;
    $("money").textContent = S.money;
    $("deckN").textContent = S.deck.length;
    let b = ""; for (let i = 0; i < (ch && ch.id === "onebreath" ? 1 : S.breathsMax); i++) b += '<i class="' + (i < S.breaths ? "" : "spent") + '"></i>';
    $("breaths").innerHTML = b;
    const f = $("fill"); f.style.width = Math.min(100, S.score / T * 100) + "%"; f.classList.toggle("done", S.score >= T);

    const rv = $("rungVal");
    if (S.rung) { rv.textContent = G.TIERS[S.rung.tier].name + " " + G.rname(S.rung.rank); rv.classList.remove("free"); }
    else { rv.textContent = "open"; rv.classList.add("free"); }
    $("rungDots").innerHTML = G.TIERS.slice(1).map((t, i) => {
      const tier = i + 1, at = S.rung && S.rung.tier === tier, un = S.rung && tier < S.rung.tier;
      return '<i class="' + (at ? "at" : un ? "under" : "") + '" title="' + t.name + '"></i>';
    }).join("");
    $("chal").hidden = !ch; if (ch) $("chalName").textContent = ch.name;
    $("tnote").textContent = ch ? ch.desc : S.rung ? "beat it: higher rank or higher hand" : "any hand opens";
    $("chainN").textContent = "×" + pos;
    document.body.dataset.heat = pos >= 7 ? 3 : pos >= 5 ? 2 : pos >= 3 ? 1 : 0;
    const tc = $("tcards");
    tc.innerHTML = S.played.map((c, i) => cardHTML(c, null, false, true, i, S.played.length)).join("");
    tc.classList.toggle("fresh", S.ante === 0 && !S.rung && !S.log.length);

    const n = S.hand.length; fitHand(n);
    const hand = $("hand");
    hand.innerHTML = S.hand.map((c, i) => cardHTML(c, i, S.sel.includes(i), false, i, n)).join("");
    hand.classList.toggle("chisel", ui.chisel);

    let tools = "";
    if (ui.chisel) {
      tools = S.sel.length === 1
        ? '<div class="picker">' + rankButtons() + '</div><button class="tb on" data-act="chisel">Cancel</button>'
        : '<span class="toast gold" style="flex:1">Tap a card to rewrite.</span><button class="tb on" data-act="chisel">Cancel</button>';
    } else {
      if (ui.note && Date.now() < ui.noteT) tools += '<span class="toast" style="flex:1">' + ui.note + '</span>';
      if (G.canRaise(S)) tools += '<button class="tb raise" data-act="raise">Raise <em>×' + G.CFG.raiseMul + ' · pay ×' + G.CFG.raisePayout + '</em></button>';
      if (S.raised) tools += '<span class="toast gold raised">RAISED · reach ' + S.raiseTarget + ' or the payout is gone</span>';
      if (S.descendMax) tools += '<button class="tb" data-act="descend"' + (S.descend <= 0 || !S.rung ? " disabled" : "") + '>Step Down <em>' + S.descend + '</em></button>';
      if (S.chiselMax) tools += '<button class="tb" data-act="chisel"' + (S.chisel <= 0 ? " disabled" : "") + '>Chisel <em>' + S.chisel + '</em></button>';
    }
    $("tools").innerHTML = tools;

    /* το ΠΑΙΞΕ είναι και το readout */
    const go = $("bPlay"); go.className = "go";
    if (ui.chisel) {
      go.classList.add("idle"); go.disabled = true;
      go.innerHTML = '<span class="go__t">Chisel</span><span class="go__s">pick a card, then a rank</span>';
    } else if (!S.sel.length) {
      const done = S.score >= T;
      go.classList.add(done ? "done" : "idle"); go.disabled = !done;
      go.innerHTML = done
        ? '<span class="go__t">Bank it</span><span class="go__s">' + (S.raised ? "raise made · payout ×" + G.CFG.raisePayout : "or raise the stakes") + '</span>'
        : '<span class="go__t">Pick cards</span><span class="go__s">' + (S.rung ? "beat " + G.TIERS[S.rung.tier].name + " " + G.rname(S.rung.rank) : "swipe up to play") + '</span>';
    } else if (e.ace) {
      go.classList.add("ace"); go.disabled = false;
      go.innerHTML = '<span class="go__t">Ace in the Hole</span><span class="go__s">rung resets · keep chain ×' + pos + '</span><span class="go__p">↺</span>';
    } else if (!e.k) {
      go.classList.add("no"); go.disabled = true;
      go.innerHTML = '<span class="go__t">' + S.sel.length + ' cards</span><span class="go__s">not a hand</span>';
    } else if (!e.legal) {
      go.classList.add("no"); go.disabled = true;
      go.innerHTML = '<span class="go__t">' + G.clabel(e.k) + '</span><span class="go__s">won\'t climb</span>';
    } else {
      go.classList.add("ok"); go.disabled = false;
      go.innerHTML = '<span class="go__t">' + G.clabel(e.k) + '</span><span class="go__s">' + e.base + (e.factor > 1 ? ' × ' + e.factor : '') + ' × ' + pos + '</span><span class="go__p">+' + e.pts + '</span>';
    }
    $("bPass").disabled = ui.chisel || !G.canPass(S);
    $("passN").textContent = S.breaths;
    $("bHint").disabled = ui.chisel;
  }
  function rankButtons() { let h = ""; for (let r = 2; r <= 14; r++) h += '<button data-rank="' + r + '">' + G.rname(r) + '</button>'; return h; }
  function note(msg) { ui.note = msg; ui.noteT = Date.now() + 4000; render(); setTimeout(() => { if (Date.now() >= ui.noteT) render(); }, 4100); }
  function callout(t) { if (!t) return; const el = $("callout"); el.textContent = t; FX.pulse(el, "show"); }

  /* ---------- actions ---------- */
  function doPlay() {
    const from = S.sel.map((i) => { const el = $("hand").querySelector('[data-i="' + i + '"]'); return el ? el.getBoundingClientRect() : null; });
    const ev = G.play(S); if (!ev) return;
    ui.note = null;
    if (ev.type === "ace") { FX.sfx.ace(); FX.buzz(14); }
    else { FX.sfx.climb(ev.pos); FX.buzz(18); FX.burstAt($("table"), Math.min(50, 10 + Math.round(ev.pts / 24)), 2.4 + Math.min(3, ev.pts / 300)); FX.floatIn($("table"), "+" + ev.pts); }
    if (ev.shattered) { FX.sfx.shatter(); FX.burstAt($("table"), 18, 3.2, "#cfe9f2"); }
    render();
    FX.fly(from, Array.prototype.slice.call($("tcards").children));
    FX.pulse($("chain"), "bump");
    callout(ev.tags[0]);
    save();
    if (ev.emptied) { setTimeout(end, 800); return; }
    if (G.stuck(S)) { note(G.stuckReason(S)); setTimeout(end, 1700); }
  }
  function doPass() { if (G.pass(S)) { FX.sfx.pass(); FX.buzz(40); ui.note = null; render(); save(); if (G.stuck(S)) { note(G.stuckReason(S)); setTimeout(end, 1700); } } }
  function doDescend() { if (G.descend(S)) { FX.sfx.ace(); FX.buzz(14); render(); save(); } }
  function doHint() { const m = G.cheapest(S); S.sel = m ? m.idx.slice() : []; if (!m) note(G.stuckReason(S)); else { ui.note = null; FX.sfx.tick(); render(); } }
  function end() {
    const r = G.finish(S); if (!r) return;
    save();
    if (!r.cleared) { FX.sfx.bust(); FX.buzz([60, 40, 90]); sheetLose(); return; }
    FX.sfx.clear(); FX.spark(innerWidth / 2, innerHeight * 0.42, 120, 6.5); FX.buzz([12, 60, 12]); FX.pulse($("app"), "shake");
    if (r.won) sheetWin(); else sheetShop(r.earn, r.ex, r.raiseResult);
  }

  /* ---------- sheets ---------- */
  const openS = (h) => { $("sheet").innerHTML = '<div class="grip"></div>' + h; $("veil").hidden = false; FX.sfx.open(); };
  const closeS = () => { $("veil").hidden = true; };
  function chipsHTML() {
    const c = [];
    G.TIERS.slice(1).forEach((t, i) => { if (S.mult[i + 1] > 1) c.push(t.short + " <b>×" + S.mult[i + 1] + "</b>"); });
    if (S.breathsMax > 3) c.push("Breaths <b>" + S.breathsMax + "</b>");
    if (S.chiselMax > 1) c.push("Chisel <b>" + S.chiselMax + "</b>");
    if (S.descendMax) c.push("Step Down <b>" + S.descendMax + "</b>");
    if (S.handSize > 15) c.push("Hand <b>" + S.handSize + "</b>");
    if (S.chainStart) c.push("Head Start <b>+" + S.chainStart + "</b>");
    if (S.removed.length) c.push("Culled <b>" + S.removed.map(G.rname).join(",") + "</b>");
    const enh = {}; S.deck.forEach((d) => { if (d.e) enh[d.e] = (enh[d.e] || 0) + 1; });
    Object.keys(enh).forEach((k) => c.push(G.ENH[k].name + " <b>" + enh[k] + "</b>"));
    return c.length ? c.map((x) => '<span class="chip">' + x + '</span>').join("") : '<span class="chip">none yet</span>';
  }
  function offersHTML() {
    return S.offers.map((o, i) => {
      const cost = G.offerCost(S, o), dis = o.bought || cost > S.money ? " disabled" : "";
      if (o.kind === "card") {
        const c = o.card, su = G.SUITS[c.si];
        return '<button class="offer offer--card' + (o.bought ? " bought" : "") + '" data-buy="' + i + '"' + dis + '>' +
          '<span class="offer__card">' + cardHTML(c, null, false, true, 0, 1) + '</span>' +
          '<strong>' + G.ENH[c.e].name + ' ' + (c.e === "wild" ? "card" : G.rname(c.r) + su.s) + '</strong><em>' + cost + '◎</em><span>' + G.ENH[c.e].desc + '</span></button>';
      }
      const it = G.poolById[o.id];
      return '<button class="offer' + (o.bought ? " bought" : "") + '" data-buy="' + i + '"' + dis + '><strong>' + it.name + '</strong><em>' + cost + '◎</em><span>' + it.desc + '</span></button>';
    }).join("");
  }
  function sheetShop(earn, ex, rr) {
    const T = G.target(S), up = G.upcoming(S);
    openS('<h2>Ante ' + (S.ante + 1) + ' cleared</h2><p class="sub">' + S.score + ' of ' + T + (rr === "won" ? " · raise made" : rr === "lost" ? " · raise missed" : "") + '</p>' +
      '<div class="tally"><div>Round<b>' + S.score + '</b></div>' +
      (ex != null ? '<div>Over target<b>+' + ex + '</b></div>' +
        (rr === "won" ? '<div>Raise<b class="good">×' + G.CFG.raisePayout + '</b></div>' : rr === "lost" ? '<div>Raise<b class="bad">missed · ×0</b></div>' : "") +
        '<div>Payout<b>+' + earn + '◎</b></div>' : "") +
      '<div>Chips<b id="mn">' + S.money + '◎</b></div></div>' +
      (up ? '<div class="chalnext"><span class="lbl">Next · Challenge</span><b>' + up.name + '</b><span>' + up.desc + '</span></div>' : "") +
      '<span class="lbl">Shop</span><div class="offers" id="offers">' + offersHTML() + '</div>' +
      '<button class="big" data-next="1">Ante ' + (S.ante + 2) + ' · target ' + G.nextTarget(S) + '</button>');
  }
  function sheetLose() {
    openS('<h2 class="bad">Busted</h2><p class="sub">Ante ' + (S.ante + 1) + ' · ' + S.score + ' of ' + G.target(S) + ' · ' + S.hand.length + ' cards left</p>' +
      '<div class="tally"><div>Antes cleared<b>' + S.ante + '</b></div><div>Seed<b>' + S.seed + '</b></div></div>' +
      '<p class="sub" style="margin-bottom:1rem">Orphans kill rounds, not weak cards.</p>' +
      '<button class="big" data-restart="1">Same seed, again</button><button class="big ghost" data-fresh="1">New seed</button>');
  }
  function sheetWin() {
    openS('<h2 class="good">The Summit</h2><p class="sub">Last hand: ' + S.score + ' of ' + G.target(S) + '</p>' +
      '<div class="tally"><div>Chips<b>' + S.money + '◎</b></div><div>Seed<b>' + S.seed + '</b></div></div>' +
      '<span class="lbl">Your build</span><div class="chips">' + chipsHTML() + '</div>' +
      '<button class="big" data-fresh="1" style="margin-top:1rem">New run</button>');
  }
  function sheetMenu() {
    openS('<h2>This round</h2>' +
      '<div class="log" style="margin-top:.5rem">' + (S.log.length ? S.log.slice().reverse().map((e) =>
        '<div class="' + (e.cls || "") + '"><span>' + e.t + '</span><em>' + e.c + '</em><b>' + (typeof e.p === "number" ? "+" + e.p : e.p) + '</b></div>').join("")
        : '<div style="border:0;color:var(--muted)">no plays yet</div>') + '</div>' +
      '<div class="sec"><span class="lbl">Build</span><div class="chips">' + chipsHTML() + '</div></div>' +
      '<div class="sec"><span class="lbl">Paytable</span><div class="rtab">' +
        G.TIERS.slice(1).map((t, i) => '<div><span>' + t.name + '</span><b>' + (t.base * S.mult[i + 1]) + '</b></div>').join("") + '</div></div>' +
      '<div class="sec"><span class="lbl">Rules</span><div class="rulz">' +
        '<p><b>Every hand must climb</b> — higher rank, or a higher hand.</p>' +
        '<p>Score = <b>base × chain</b>. Pass resets both and costs a breath.</p>' +
        '<p><b>An Ace alone</b> resets the rung and keeps the chain. <b>Step Down</b> keeps half.</p>' +
        '<p>Cleared the target? <b>Raise</b>: reach ×' + G.CFG.raiseMul + ' with the cards left for a ×' + G.CFG.raisePayout + ' payout — miss and the payout is gone.</p>' +
        '<p>Challenges at antes 3, 6, 9. Ante 12 is <b>the Summit</b>: no Pass, no Step Down.</p>' +
        '<p>Empty your hand: <b>+50%</b>. Straight flush counts as flush. Ace is high only.</p>' +
        '<p><b>Swipe up</b> to play, <b>swipe down</b> to clear.</p></div></div>' +
      '<div class="sec"><span class="lbl">Seed · ' + S.seed + '</span><div class="seedrow">' +
        '<input id="sd" value="" placeholder="custom seed" spellcheck="false" aria-label="Seed"><button data-seed="1">Go</button></div>' +
        '<div class="row2"><button class="big ghost" data-today="1">Daily · ' + G.todaySeed() + '</button><button class="big ghost" data-fresh="1">Random</button></div></div>' +
      '<div class="row2" style="margin-top:1.1rem"><button class="big ghost" data-sound="1">Sound · ' + (FX.isMuted() ? "off" : "on") + '</button>' +
      (installEvt ? '<button class="big ghost" data-install="1">Add to home</button>' : "") + '</div>' +
      '<button class="big ghost" data-close="1" style="margin-top:.5rem">Back</button>');
  }

  /* ---------- events ---------- */
  let swipe = { y0: 0, t0: 0, did: false };
  const hand = $("hand");
  hand.addEventListener("pointerdown", (e) => { swipe = { y0: e.clientY, t0: Date.now(), did: false }; });
  hand.addEventListener("pointerup", (e) => {
    const dy = e.clientY - swipe.y0;
    if (Math.abs(dy) < 45 || Date.now() - swipe.t0 > 700) return;
    swipe.did = true;
    if (dy < 0 && !$("bPlay").disabled && ($("bPlay").classList.contains("ok") || $("bPlay").classList.contains("ace"))) doPlay();
    else if (dy > 0 && S.sel.length) { S.sel = []; render(); }
  });
  hand.addEventListener("click", (e) => {
    if (swipe.did) { swipe.did = false; return; }
    const b = e.target.closest("[data-i]"); if (!b || S.phase !== "round") return;
    const i = +b.dataset.i; ui.note = null;
    if (ui.chisel) { if (!G.isWild(S.hand[i])) { S.sel = [i]; render(); } return; }
    if (G.toggle(S, i)) { FX.sfx.tick(); FX.buzz(6); render(); }
  });
  $("tools").addEventListener("click", (e) => {
    const rk = e.target.closest("[data-rank]");
    if (rk) { if (G.chisel(S, S.sel[0], +rk.dataset.rank)) { ui.chisel = false; FX.sfx.buy(); FX.buzz(12); render(); save(); } return; }
    const a = e.target.closest("[data-act]"); if (!a) return;
    if (a.dataset.act === "chisel") { ui.chisel = !ui.chisel; S.sel = []; render(); }
    if (a.dataset.act === "descend") doDescend();
    if (a.dataset.act === "raise") { if (G.raise(S)) { FX.sfx.raise(); FX.buzz([10, 30, 10]); FX.burstAt($("bPlay"), 26, 3.5); render(); save(); } }
  });
  $("bPlay").addEventListener("click", () => { if ($("bPlay").classList.contains("done")) { end(); return; } doPlay(); });
  $("bPass").addEventListener("click", doPass);
  $("bHint").addEventListener("click", doHint);
  $("bMenu").addEventListener("click", sheetMenu);
  $("veil").addEventListener("click", (e) => {
    const buy = e.target.closest("[data-buy]");
    if (buy) {
      if (G.buy(S, +buy.dataset.buy)) { FX.sfx.buy(); FX.buzz(10); save(); $("offers").innerHTML = offersHTML(); const mn = $("mn"); if (mn) mn.textContent = S.money + "◎"; }
      return;
    }
    if (e.target.closest("[data-next]")) { G.nextAnte(S); ui.chisel = false; closeS(); render(); save(); return; }
    if (e.target.closest("[data-restart]")) { closeS(); begin(S.seed); return; }
    if (e.target.closest("[data-fresh]")) { closeS(); begin(""); return; }
    if (e.target.closest("[data-today]")) { closeS(); begin(G.todaySeed()); return; }
    if (e.target.closest("[data-seed]")) { const v = $("sd").value.trim(); if (v) { closeS(); begin(v); } return; }
    if (e.target.closest("[data-sound]")) { FX.toggleMute(); FX.sfx.tick(); sheetMenu(); return; }
    if (e.target.closest("[data-install]")) { if (installEvt) { installEvt.prompt(); installEvt = null; } closeS(); return; }
    if (e.target.closest("[data-close]") || e.target === $("veil")) { if (S.phase === "round") closeS(); }
  });
  addEventListener("resize", () => { if (S) render(); });
  addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; });
  document.addEventListener("visibilitychange", () => { if (document.hidden && S) save(); });

  resumeOrBegin();
})();
