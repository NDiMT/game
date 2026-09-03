/* RAISE — UI v3. DOM και είσοδος· η λογική ζει στο game.js (window.RAISE). */
(function () {
  "use strict";
  const G = window.RAISE, FX = window.FX, IC = window.ICONS;
  const $ = (id) => document.getElementById(id);
  const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
  const KEY = "raise.run.v4", LIFE = "raise.life.v1";
  let S = null, shown = 0, ui = { chisel: false, note: null, noteT: 0 }, installEvt = null;

  /* ---------- storage ---------- */
  const save = () => { try { localStorage.setItem(KEY, G.serialize(S)); } catch (e) {} };
  const load = () => { try { return G.restore(localStorage.getItem(KEY)); } catch (e) { return null; } };
  const life = () => { try { return Object.assign({ runs: 0, wins: 0, best: 0, bestScore: 0, gold: 0, glass: 0, quads: 0, raiseWon: 0, chain7: 0, plays: 0, aces: 0 }, JSON.parse(localStorage.getItem(LIFE) || "{}")); } catch (e) { return { runs: 0, wins: 0, best: 0, bestScore: 0, gold: 0, glass: 0, quads: 0, raiseWon: 0, chain7: 0, plays: 0, aces: 0 }; } };
  const saveLife = (l) => { try { localStorage.setItem(LIFE, JSON.stringify(l)); } catch (e) {} };
  const unlockedFrom = (l) => G.CHARMS.filter((c) => !c.lock || (l[c.lock.key] || 0) >= c.lock.n).map((c) => c.id);
  const DECK_KEY = "raise.deck.v1";
  const deckOpen = (l, d) => !d.lock || (l[d.lock.key] || 0) >= d.lock.n;
  const deckPick = () => { try { const id = localStorage.getItem(DECK_KEY) || "classic"; const d = G.deckById[id]; return d && deckOpen(life(), d) ? id : "classic"; } catch (e) { return "classic"; } };
  /* Το καλύτερο ανά seed (τοπικό ledger): ante, σκορ, τράπουλα. */
  const ledger = (l) => Object.keys(l.seeds || {}).map((seed) => Object.assign({ seed }, l.seeds[seed])).sort((a, b) => b.ante - a.ante || b.score - a.score);
  /* Μεταφέρει τα stats του run στα stats ζωής και ξεκλειδώνει charms. */
  function commitStats() {
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
    l.best = Math.max(l.best, ante); l.bestScore = Math.max(l.bestScore, S.score);
    l.seeds = l.seeds || {};
    const cur = l.seeds[S.seed], newBest = !cur || ante > cur.ante || (ante === cur.ante && S.score > cur.score);
    if (newBest) l.seeds[S.seed] = { ante, score: S.score, deck: S.deckId || "classic", at: Date.now() };
    saveLife(l);
    return newBest;
  }

  /* ---------- run lifecycle ---------- */
  function begin(seed) { S = G.newRun(seed, unlockedFrom(life()), deckPick()); ui.chisel = false; ui.note = null; shown = 0; save(); hideStart(); render(); }
  function resumeOrBegin() {
    const saved = load();
    if (saved) { S = saved; shown = S.score; render(); }
    showStart(saved && saved.phase !== "lost" && saved.phase !== "won" ? saved : null);
  }

  /* ---------- cards ---------- */
  function cardHTML(c, i, sel, tbl, idx, n) {
    let st = "";
    if (!tbl && n > 1) st = ' style="--rot:' + (((idx / (n - 1)) - 0.5) * 3).toFixed(2) + 'deg"';
    if (tbl) st = ' style="animation-delay:' + (idx * 60) + 'ms"';
    if (c.h && !tbl) return '<button class="card down" disabled aria-label="face down"' + st + '><span class="card__back"></span></button>';
    const wild = G.isWild(c), su = G.SUITS[c.si], e = c.e, face = c.r >= 11 && !e;
    const cls = "card" + (e ? " e-" + e : "") + (!wild && su.red ? " red" : "") + (wild ? "" : " s" + c.si) + (sel ? " sel" : "") + (face ? " face" : "") + (c.n && !tbl ? " new" : "");
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
    $("hand").style.maxWidth = (per * (cw + 4) + 2) + "px";
  }
  const pips = (n, max, cls) => { let h = ""; for (let i = 0; i < max; i++) h += '<i class="' + (i < n ? "" : "spent") + '"></i>'; return h; };
  const charmToken = (id, extra) => { const c = G.charmById[id]; return '<button class="charm" data-charm="' + id + '" aria-label="' + c.name + '" style="--h:' + IC.hue(id) + '"' + (extra || "") + '>' + IC.svg(id) + '</button>'; };

  /* ---------- render ---------- */
  function render() {
    const T = G.goal(S), e = G.evalSel(S), ch = G.current(S), pos = G.chainPos(S), cleared = S.score >= T;

    FX.countUp($("score"), shown, S.score); shown = S.score;
    $("score").classList.toggle("on", cleared);
    $("tgt").textContent = "/ " + T + (S.raised ? " ↑" : ""); $("tgt").classList.toggle("raised", !!S.raised);
    $("ante").textContent = S.ante + 1; $("anteN").textContent = S.endless && S.ante >= G.TARGETS.length ? "∞" : G.TARGETS.length;
    $("money").textContent = S.money;
    const f = $("fill"); f.style.width = Math.min(100, S.score / T * 100) + "%"; f.classList.toggle("done", cleared);

    const playsMax = S.playsMax - (ch && ch.id === "fewplays" ? 1 : 0);
    $("plays").innerHTML = pips(S.playsLeft, playsMax);
    $("breaths").innerHTML = pips(S.breaths, ch && ch.id === "onebreath" ? 1 : S.breathsMax);
    $("discards").innerHTML = pips(Math.min(S.discards, 5), 5) + (S.discards > 5 ? '<b>+' + (S.discards - 5) + '</b>' : '');
    $("discards").classList.toggle("off", !!(ch && ch.id === "nodiscard"));
    $("pileN").textContent = S.pile.length; $("dpileN").textContent = S.discardPile.length;

    let cm = S.charms.map((id) => charmToken(id, G.synergyFor(S, id).length ? ' data-syn="1"' : "")).join("");
    for (let i = S.charms.length; i < S.charmSlots; i++) cm += '<span class="charm charm--empty"></span>';
    $("charms").innerHTML = cm;

    const rv = $("rungVal");
    if (S.rung) { const lb = G.clabel(S.rung); rv.textContent = lb; rv.classList.remove("free"); rv.classList.toggle("long", lb.length > 11); rv.style.setProperty("--kh", IC.kindHue(S.rung.kind)); $("rungDots").style.setProperty("--kh", IC.kindHue(S.rung.kind)); }
    else { rv.textContent = "Open"; rv.classList.add("free"); rv.classList.remove("long"); }
    $("rungDots").innerHTML = S.rung ? Array.from({ length: S.rung.size }, () => '<i class="' + (G.isBomb(S.rung) ? "bomb" : "at") + '"></i>').join("") : "";
    $("chal").hidden = !ch; if (ch) $("chalName").innerHTML = IC.svg(ch.id) + ch.name;
    const rl = G.currentRule(S); $("rule").hidden = !rl; if (rl) $("ruleName").textContent = rl.name;
    const ct = S.contract ? G.contractById[S.contract] : null, cst = G.contractStatus(S);
    $("contract").hidden = !ct;
    if (ct) { $("contractName").textContent = ct.name + " · " + (ct.pct ? "+" + ct.pct + "%" : "+" + ct.flat); $("contractSt").textContent = cst === "broken" ? "✕" : cst === "done" ? "✓" : cst === "ok" ? "…" : "○"; $("contract").className = "chal contract " + cst; }
    document.body.classList.toggle("lastplay", S.playsLeft === 1 && !cleared);
    $("tnote").textContent = "";
    $("chainN").textContent = "×" + pos;
    document.body.dataset.heat = pos >= 7 ? 3 : pos >= 5 ? 2 : pos >= 3 ? 1 : 0;
    $("chain").style.setProperty("--pos", Math.min(pos, 12));
    const pk = G.peek(S); $("peek").hidden = !pk; if (pk) $("peekCard").innerHTML = pk.map((c) => cardHTML(c, null, false, true, 0, 1)).join("");
    const tc = $("tcards");
    tc.innerHTML = S.played.map((c, i) => cardHTML(c, null, false, true, i, S.played.length)).join("");
    { const tn = S.played.length, tw = ($("table").clientWidth || 340) - 28, cw = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--cw")) || 44;
      tc.style.setProperty("--tcw", Math.max(26, Math.min(Math.round(cw * 0.9), tn ? Math.floor((tw - (tn - 1) * 4) / tn) : 99)) + "px"); }
    tc.classList.toggle("fresh", S.ante === 0 && !S.rung && !S.log.length);

    const n = S.hand.length; fitHand(n);
    const hand = $("hand");
    hand.innerHTML = S.hand.map((c, i) => cardHTML(c, i, S.sel.includes(i), false, i, n)).join("");
    hand.classList.toggle("chisel", ui.chisel);
    S.hand.forEach((c) => { delete c.n; });

    let tools = "";
    if (ui.chisel) {
      tools = S.sel.length === 1
        ? '<div class="picker">' + rankButtons() + '</div><button class="tb on" data-act="chisel">Cancel</button>'
        : '<span class="toast gold" style="flex:1">Tap a card to rewrite.</span><button class="tb on" data-act="chisel">Cancel</button>';
    } else {
      if (ui.note && Date.now() < ui.noteT) tools += '<span class="toast" style="flex:1">' + ui.note + '</span>';
      else {
        if (G.canRaise(S)) tools += '<button class="tb raise" data-act="raise">Raise <em>×' + (G.has(S, "gambler") ? G.CFG.gamblerMul : G.CFG.raiseMul) + ' · pay ×' + (G.has(S, "gambler") ? 3 : G.CFG.raisePayout) + '</em></button>';
        if (S.raised) tools += '<span class="toast gold raised" style="flex:1">RAISED · reach ' + S.raiseTarget + '</span>';
        if (S.chiselMax) tools += '<button class="tb" data-act="chisel"' + (S.chisel <= 0 ? " disabled" : "") + '>Chisel <em>' + S.chisel + '</em></button>';
        if (cleared && S.playsLeft > 0 && !S.raised) tools += '<button class="tb" data-act="end">End round</button>';
      }
    }
    $("tools").innerHTML = tools;

    const go = $("bPlay"); go.className = "go";
    const pv = $("preview"); pv.className = "preview"; let pvt = "";
    const whyNot = () => (e.k.kind === S.rung.kind ? (e.k.size < S.rung.size ? (S.rung.kind === 8 ? "need " + S.rung.size / 2 + " pairs or more" : "too short · " + S.rung.size + " cards or more") : "not higher than " + G.rname(S.rung.rank)) : "lower hand than " + G.KINDS[S.rung.kind].name.toLowerCase());
    if (ui.chisel) { go.classList.add("idle"); go.disabled = true; go.innerHTML = '<span class="go__t">Chisel</span><span class="go__s">Pick a card, then a rank</span>'; }
    else if (S.playsLeft <= 0) { go.classList.add("done"); go.disabled = false; go.innerHTML = '<span class="go__t">Round over</span><span class="go__s">' + (cleared ? "Cleared" : "Short of the target") + '</span>'; }
    else if (!S.sel.length) {
      go.classList.add("idle"); go.disabled = true; pvt = G.beatText(S) + (S.playsLeft === 1 ? " · last play" : ""); pv.classList.add("hint");
      go.innerHTML = '<span class="go__t">Pick cards</span><span class="go__s">' + (S.rung ? "Beat " + G.clabel(S.rung) : "Any hand opens") + (S.playsLeft === 1 ? " · last play" : "") + '</span>';
    }
    else if (e.ace) { go.classList.add("ace"); go.disabled = false; go.innerHTML = '<span class="go__t">Ace in the Hole</span><span class="go__s">Keep chain ×' + pos + '</span><span class="go__p">↺</span>'; pvt = "Ace in the Hole · the rung opens, the chain stays at ×" + pos + ", no play used"; pv.classList.add("ace"); }
    else if (!e.k) { go.classList.add("no"); go.disabled = true; go.innerHTML = '<span class="go__t">Not a hand</span><span class="go__s">' + (S.sel.length > G.CFG.discardCards ? 'Discard up to ' + G.CFG.discardCards : 'Discard?') + '</span>'; pvt = S.sel.length + " cards · not a hand" + (G.canDiscard(S) ? " · swipe down to discard" : ""); pv.classList.add("bad"); }
    else if (!e.legal) { const w = whyNot(); go.classList.add("no"); go.disabled = true; go.innerHTML = '<span class="go__t">' + goLabel(e.k) + '</span><span class="go__s">' + cap(w.split(" · ")[0]) + '</span>'; pvt = G.clabel(e.k) + " won't beat " + G.clabel(S.rung) + " · " + w; pv.classList.add("bad"); }
    else {
      go.classList.add("ok"); go.disabled = false; go.style.setProperty("--kh", IC.kindHue(e.k.kind)); pv.style.setProperty("--kh", IC.kindHue(e.k.kind)); pv.classList.add("ok");
      const calc = e.base + (e.factor > 1 ? "×" + e.factor : "") + " × " + e.pos + (e.hm !== 1 ? " ×" + e.hm : "");
      go.innerHTML = '<span class="go__t go__t--pts">+' + e.pts + '</span><span class="go__s">' + goLabel(e.k) + ' · ' + calc + '</span>';
      pvt = G.clabel(e.k) + (G.crange(e.k) ? " · " + G.crange(e.k) : "") + " · " + calc + " = " + e.pts + (e.notes.length ? " · " + e.notes.join(", ") : "");
    }
    pv.innerHTML = !pvt ? "" : pv.classList.contains("hint") ? cap(pvt).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      : cap(pvt).split(" · ").map((x) => "<span>" + x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/ /g, "\u00a0") + "</span>").join(' <i>·</i> ');
    Array.prototype.forEach.call(go.querySelectorAll(".go__s"), (el) => { el.textContent = cap(el.textContent); });
    $("bPass").disabled = ui.chisel || !G.canPass(S); $("passN").textContent = S.breaths;
    $("bDisc").disabled = ui.chisel || !G.canDiscard(S); $("discN").textContent = S.discards;
    $("bHint").disabled = ui.chisel || S.playsLeft <= 0;
  }
  /* Συμπαγής ετικέτα για το κουμπί: το εύρος φαίνεται στη δεύτερη γραμμή. */
  const goLabel = (k) => k.kind === 3 ? "Stairs " + k.size / 2 : k.kind === 4 ? "Straight " + k.size : k.kind === 7 ? "Str. Flush " + k.size : k.kind === 8 ? G.clabel(k).replace(/ \S+$/, "") : G.clabel(k);
  function rankButtons() { let h = ""; for (let r = 2; r <= 14; r++) h += '<button data-rank="' + r + '">' + G.rname(r) + '</button>'; return h; }
  function note(msg, ms) { ui.note = cap(msg); ui.noteT = Date.now() + (ms || 3800); render(); setTimeout(() => { if (Date.now() >= ui.noteT) render(); }, (ms || 3800) + 100); }
  function callout(t) { if (!t) return; const el = $("callout"); el.textContent = t; el.classList.toggle("bomb", t === "Bomb!"); el.classList.toggle("target", t === "Target!"); FX.pulse(el, "show"); }
  function selRects() { return S.sel.map((i) => { const el = $("hand").querySelector('[data-i="' + i + '"]'); return el ? el.getBoundingClientRect() : null; }); }
  function afterMove() {
    save();
    if (G.stuck(S)) { note(G.stuckReason(S), 1800); setTimeout(end, 1500); }
  }

  /* ---------- actions ---------- */
  function doPlay() {
    if (S.playsLeft <= 0) { end(); return; }
    const from = selRects();
    const ev = G.play(S); if (!ev) return;
    ui.note = null;
    if (ev.type === "ace") { FX.sfx.ace(); FX.buzz(14); }
    else if (ev.bomb) { FX.sfx.bomb(); FX.buzz([30, 40, 120]); FX.boom($("table")); FX.flash(); FX.pulse($("app"), "shake"); FX.floatIn($("table"), "+" + ev.pts); document.body.classList.add("boom"); setTimeout(() => document.body.classList.remove("boom"), 900); }
    else { FX.sfx.climb(ev.pos); FX.buzz(18); FX.burstAt($("table"), Math.min(50, 10 + Math.round(ev.pts / 24)), 2.4 + Math.min(3, ev.pts / 300), ["#ffd166", "#ff6b6b", "#4ecdc4", "#c77dff", "#ffffff", "hsl(" + IC.kindHue(ev.k.kind) + " 90% 70%)"]); FX.floatIn($("table"), "+" + ev.pts); $("callout").style.setProperty("--kh", IC.kindHue(ev.k.kind)); }
    if (ev.shattered) { FX.sfx.shatter(); FX.burstAt($("table"), 18, 3.2, "#cfe9f2"); }
    const crossed = S.score >= G.goal(S) && S.score - ev.pts < G.goal(S);
    render();
    if (crossed) { setTimeout(() => { callout("Target!"); FX.sfx.clear(); FX.burstAt($("score"), 30, 4, ["#8ff0bf", "#ffffff", "#ffd166"]); }, 420); }
    FX.fly(from, Array.prototype.slice.call($("tcards").children));
    if (ev.drawn) setTimeout(() => FX.sfx.draw(), 180);
    FX.pulse($("chain"), "bump");
    callout(ev.tags[0]);
    afterMove();
  }
  function doDiscard() {
    if (S.sel.length > G.CFG.discardCards) { note("Discard up to " + G.CFG.discardCards + " cards at a time."); return; }
    if (!G.canDiscard(S)) return;
    const rects = selRects();
    if (G.discard(S)) { FX.sfx.discard(); FX.buzz(10); FX.ghostTo(rects, $("dpile")); ui.note = null; render(); setTimeout(() => FX.sfx.draw(), 160); afterMove(); }
  }
  function doPass() { if (G.pass(S)) { FX.sfx.pass(); FX.buzz(40); ui.note = null; render(); afterMove(); } }
  function doHint() {
    const m = G.suggest(S);
    if (m) { S.sel = m.idx.slice(); ui.note = null; FX.sfx.tick(); render(); return; }
    const o = G.orphans(S);
    if (S.discards > 0 && S.pile.length && o.length) { S.sel = o.slice(0, G.CFG.discardCards); note("Nothing beats it. These fit no hand — discard them and draw."); return; }
    note(G.stuckReason(S));
  }
  function end() {
    const r = G.finish(S); if (!r) return;
    const fresh = commitStats(); save();
    if (!r.cleared) { const nb = recordEnd(false); FX.sfx.bust(); FX.buzz([60, 40, 90]); sheetLose(nb); return; }
    FX.sfx.clear(); FX.flash(); FX.spark(innerWidth / 2, innerHeight * 0.42, 120, 6.5); FX.buzz([12, 60, 12]); FX.pulse($("app"), "shake");
    if (r.won) { recordEnd(true); sheetWin(); } else sheetShop(r, fresh);
  }

  /* ---------- sheets ---------- */
  const openS = (h) => { $("sheet").innerHTML = '<div class="grip"></div>' + h; $("veil").hidden = false; FX.sfx.open(); };
  const closeS = () => { $("veil").hidden = true; };
  function chipsHTML() {
    const c = [];
    G.BY_TIER.forEach((t) => { const m = S.mult[G.KINDS.indexOf(t)]; if (m > 1) c.push(t.short + " <b>×" + m + "</b>"); });
    if (S.playsMax > G.CFG.plays) c.push("Plays <b>" + S.playsMax + "</b>");
    if (S.breathsMax > G.CFG.breaths) c.push("Breaths <b>" + S.breathsMax + "</b>");
    c.push("Discards <b>" + S.discards + "</b>");
    if (S.chiselMax > 1) c.push("Chisel <b>" + S.chiselMax + "</b>");
    if (S.handSize > G.CFG.handSize) c.push("Hand <b>" + S.handSize + "</b>");
    if (S.chainStart) c.push("Head Start <b>+" + S.chainStart + "</b>");
    if (S.removed.length) c.push("Culled <b>" + S.removed.map(G.rname).join(",") + "</b>");
    const enh = {}; S.deck.forEach((d) => { if (d.e) enh[d.e] = (enh[d.e] || 0) + 1; });
    Object.keys(enh).forEach((k) => c.push(G.ENH[k].name + " <b>" + enh[k] + "</b>"));
    return c.length ? c.map((x) => '<span class="chip">' + x + '</span>').join("") : '<span class="chip">none yet</span>';
  }
  function ownedCharmsHTML(sellable) {
    if (!S.charms.length) return '<p class="sub">No charms yet · ' + S.charmSlots + ' slots</p>';
    return '<div class="owned">' + S.charms.map((id, i) => { const c = G.charmById[id]; return '<div class="owned__row">' + IC.bubble(id, "charm charm--s") + '<div><strong>' + c.name + '</strong><span>' + c.desc + '</span></div>' + (sellable ? '<button class="sellb" data-sell="' + i + '">Sell ' + Math.ceil(c.cost / 2) + '◎</button>' : "") + '</div>'; }).join("") + '</div>';
  }
  function offersHTML() {
    return S.offers.map((o, i) => {
      const cost = G.offerCost(S, o), cb = G.canBuy(S, i), dis = o.bought || !cb.ok ? " disabled" : "";
      const why = !o.bought && !cb.ok && cb.why === "full" ? '<span class="why">Slots full — sell one</span>' : "";
      if (o.kind === "card") {
        const c = o.card, su = G.SUITS[c.si];
        return '<button class="offer offer--card' + (o.bought ? " bought" : "") + '" data-buy="' + i + '"' + dis + '><span class="offer__card">' + cardHTML(c, null, false, true, 0, 1) + '</span><strong>' + G.ENH[c.e].name + (c.e === "wild" ? "" : " " + G.rname(c.r) + su.s) + '</strong><em>' + cost + '◎</em><span>' + G.ENH[c.e].desc + '</span></button>';
      }
      if (o.kind === "charm") {
        const c = G.charmById[o.id];
        return '<button class="offer offer--charm' + (o.bought ? " bought" : "") + '" data-buy="' + i + '"' + dis + '>' + IC.bubble(o.id, "charm charm--s") + '<strong>' + c.name + '</strong><em>' + cost + '◎</em><span>' + c.desc + why + synHint(o.id) + '</span></button>';
      }
      const it = G.poolById[o.id];
      return '<button class="offer offer--charm' + (o.bought ? " bought" : "") + '" data-buy="' + i + '"' + dis + '>' + IC.bubble(o.id, "charm charm--s") + '<strong>' + it.name + '</strong><em>' + cost + '◎</em><span>' + it.desc + '</span></button>';
    }).join("");
  }
  function keepHTML() {
    const k = S.keep || [], out = S.hand.length - k.length, fresh = G.freshCards(S);
    return '<div class="sec"><span class="lbl">Your hand carries over' + (out ? ' · swapping ' + out : '') + (fresh.length ? ' · +' + fresh.length + ' new' : '') + '</span><p class="sub" style="margin:.2rem 0 .45rem">Tap a card to swap it for a fresh one next round. Bought cards join your hand.</p><div class="keeprow">' +
      S.hand.map((c, i) => { const on = k.indexOf(i) >= 0; return '<button class="keepc' + (on ? " on" : " off") + '" data-keep="' + i + '" aria-pressed="' + on + '">' + cardHTML(c, null, false, true, 0, 1) + '</button>'; }).join("") +
      fresh.map((c) => '<span class="keepc new" title="New card">' + cardHTML(c, null, false, true, 0, 1) + '</span>').join("") + '</div></div>';
  }
  function contractHTML() {
    const c = G.upcomingContract(S); if (!c) return "";
    return '<div class="chalnext ctrnext"><span class="lbl">Next · Contract</span><b>' + c.name + ' · ' + (c.pct ? "+" + c.pct + "%" : "+" + c.flat) + '</b><span>' + c.desc + ' Optional side goal — miss it and you only lose the bonus.</span></div>';
  }
  const synHint = (id) => G.synergyFor(S, id).map((s) => { const p = G.charmById[s.a === id ? s.b : s.a]; return '<i class="syn">⚡ ' + s.name + ' with ' + p.name + ' — ' + s.desc + '</i>'; }).join("");
  function synergiesHTML() {
    const act = G.activeSynergies(S); if (!act.length) return "";
    return '<div class="sec"><span class="lbl">Synergies · ' + act.length + '</span><div class="synlist">' + act.map((s) => '<div class="synrow"><b>⚡ ' + s.name + '</b><span>' + G.charmById[s.a].name + ' + ' + G.charmById[s.b].name + ' — ' + s.desc + '</span></div>').join("") + '</div></div>';
  }
  function shopBody() {
    return keepHTML() + '<div class="shophead"><span class="lbl">Shop</span><button class="tb" data-reroll="1"' + (S.money < G.rerollCost(S) ? " disabled" : "") + '>Reroll <em>' + G.rerollCost(S) + '◎</em></button></div><div class="offers" id="offers">' + offersHTML() + '</div>' +
      '<div class="sec"><span class="lbl">Your charms · ' + S.charms.length + '/' + S.charmSlots + '</span>' + ownedCharmsHTML(true) + '</div>' + synergiesHTML();
  }
  function sheetShop(r, fresh) {
    const T = G.target(S), up = G.upcoming(S), rr = r && r.raiseResult;
    openS('<h2>Ante ' + (S.ante + 1) + ' cleared</h2><p class="sub">' + S.score + ' of ' + T + (rr === "won" ? " · raise made" : rr === "lost" ? " · raise missed" : "") + '</p>' +
      '<div class="tally"><div>Round<b>' + S.score + '</b></div>' +
      (r ? '<div>Over target<b>+' + r.ex + '</b></div>' + (rr === "won" ? '<div>Raise<b class="good">×' + (G.has(S, "gambler") ? 3 : G.CFG.raisePayout) + '</b></div>' : rr === "lost" ? '<div>Raise<b class="bad">missed · ×0</b></div>' : "") + (r.contract ? '<div>Contract · ' + r.contract.name + '<b class="' + (r.contract.met ? "good" : "bad") + '">' + (r.contract.met ? "+" + r.contract.bonus : "missed") + '</b></div>' : "") + (r.perfect ? '<div>Perfect round<b class="good">+' + r.perfectChips + '◎</b></div>' : "") + (r.interest ? '<div>Vault interest<b>+' + r.interest + '◎</b></div>' : "") + (r.tip ? '<div>Tip Jar<b>+' + r.tip + '◎</b></div>' : "") + '<div>Payout<b>+' + r.earn + '◎</b></div>' : "") +
      '<div>Chips<b id="mn">' + S.money + '◎</b></div></div>' +
      (fresh && fresh.length ? '<div class="unlocked">✦ Unlocked · ' + fresh.map((id) => G.charmById[id].name).join(", ") + '</div>' : "") +
      (up ? '<div class="chalnext bossnext">' + IC.bubble(up.id, "charm charm--s") + '<div><span class="lbl">Next · Boss ante</span><b>' + up.name + '</b><span>' + up.desc + '</span><em>' + up.tell + ' ' + up.tip + '</em></div></div>' : (G.upcomingRule(S) ? '<div class="chalnext rulenext"><span class="lbl">Next · Table rule</span><b>' + G.upcomingRule(S).name + '</b><span>' + G.upcomingRule(S).desc + '</span></div>' : "")) +
      contractHTML() + '<div id="shopBody">' + shopBody() + '</div>' +
      '<button class="big" data-next="1" style="margin-top:1rem">Ante ' + (S.ante + 2) + ' · target ' + G.nextTarget(S) + '</button>');
    if (fresh && fresh.length) FX.sfx.unlock();
  }
  const refreshShop = () => { $("shopBody").innerHTML = shopBody(); const mn = $("mn"); if (mn) mn.textContent = S.money + "◎"; };
  const shareText = () => "RAISE · " + S.seed + (S.deckId && S.deckId !== "classic" ? " · " + G.deckById[S.deckId].name : "") + " · " + (S.phase === "won" ? "Summit ▲" : (S.endless ? "Endless ante " : "Ante ") + (S.ante + 1)) + " · " + S.score + " pts" + (S.charms.length ? " · " + S.charms.map((id) => G.charmById[id].name).join(", ") : "");
  function missHTML() {
    const nm = G.nearMiss(S); if (!nm || !nm.close) return "";
    let body;
    if (nm.best && nm.enough) body = '<span>One more play and this would have made it:</span><div class="miss__cards">' + nm.best.idx.map((i) => cardHTML(S.hand[i], null, false, true, 0, 1)).join("") + '</div><em>' + G.clabel(nm.best.k) + ' · +' + nm.best.pts + '</em>';
    else if (nm.best) body = '<span>Your best hand left was worth ' + nm.best.pts + '. One step higher on the chain would have done it.</span><div class="miss__cards">' + nm.best.idx.map((i) => cardHTML(S.hand[i], null, false, true, 0, 1)).join("") + '</div>';
    else body = '<span>Nothing in your hand could beat the rung. A Pass or an Ace would have opened the table.</span>';
    return '<div class="miss"><b>Short by ' + nm.gap + '</b>' + body + '</div>';
  }
  function sheetLose(newBest) {
    const rec = (life().seeds || {})[S.seed];
    openS('<h2 class="bad">Busted</h2><p class="sub">Ante ' + (S.ante + 1) + ' · ' + S.score + ' of ' + G.target(S) + '</p>' + missHTML() +
      (newBest && S.ante > 0 ? '<div class="unlocked">✦ New best on this seed</div>' : "") +
      '<div class="tally"><div>Antes cleared<b>' + S.ante + '</b></div><div>Best chain<b>×' + S.stats.maxChain + '</b></div>' + (rec && !newBest ? '<div>Best on this seed<b>Ante ' + rec.ante + ' · ' + rec.score + '</b></div>' : "") + '<div>Seed<b>' + S.seed + '</b></div></div>' +
      (S.charms.length ? '<span class="lbl">Your build</span><div class="chips">' + S.charms.map((id) => '<span class="chip">' + G.charmById[id].name + '</span>').join("") + chipsHTML() + '</div>' : "") +
      '<p class="sub" style="margin:.9rem 0">Five plays. Every one of them should climb.</p>' +
      '<button class="big" data-restart="1">Same seed, again</button><div class="row2"><button class="big ghost" data-fresh="1">New seed</button><button class="big ghost" data-share="1">Share</button></div>');
  }
  function sheetWin() {
    openS('<h2 class="good">The Summit</h2><p class="sub">All thirty · last hand ' + S.score + ' of ' + G.target(S) + '</p>' +
      '<div class="tally"><div>Chips<b>' + S.money + '◎</b></div><div>Best chain<b>×' + S.stats.maxChain + '</b></div><div>Seed<b>' + S.seed + '</b></div></div>' +
      '<span class="lbl">Your build</span><div class="chips">' + S.charms.map((id) => '<span class="chip">' + G.charmById[id].name + '</span>').join("") + chipsHTML() + '</div>' +
      '<button class="big" data-endless="1" style="margin-top:1rem">Keep climbing · Endless</button>' +
      '<div class="row2"><button class="big ghost" data-fresh="1">New run</button><button class="big ghost" data-share="1">Share</button></div>');
  }
  function sheetMenu() {
    openS('<h2>This round</h2>' +
      '<div class="log" style="margin-top:.5rem">' + (S.log.length ? S.log.slice().reverse().map((e) => '<div class="' + (e.cls || "") + '"><span>' + e.t + '</span><em>' + cap(e.c) + '</em><b>' + (typeof e.p === "number" ? "+" + e.p : e.p) + '</b></div>').join("") : '<div style="border:0;color:var(--muted)">No plays yet</div>') + '</div>' +
      '<div class="sec"><span class="lbl">Charms</span>' + ownedCharmsHTML(false) + '</div>' +
      '<div class="sec"><span class="lbl">Build</span><div class="chips">' + chipsHTML() + '</div></div>' +
      '<div class="sec"><span class="lbl">Paytable</span><div class="rtab">' + G.BY_TIER.map((t) => '<div><span>' + t.name + (t.min ? ' <em>' + (t.id === "stairs" ? 'Two pairs in a row · longer pays more' : t.id === "pairs" ? 'Up to 4 pairs · more pay more' : '5 cards · longer pays more') + '</em>' : '') + '</span><b>' + (t.base * S.mult[G.KINDS.indexOf(t)]) + '</b></div>').join("") + '</div></div>' +
      '<div class="sec"><span class="lbl">Seed · ' + S.seed + '</span><div class="seedrow"><input id="sd" value="" placeholder="custom seed" spellcheck="false" aria-label="Seed"><button data-seed="1">Go</button></div>' +
      '<div class="row2"><button class="big ghost" data-today="1">Daily · ' + G.todaySeed() + '</button><button class="big ghost" data-fresh="1">Random</button></div></div>' +
      '<div class="row2" style="margin-top:1.1rem"><button class="big ghost" data-howto="1">How to play</button><button class="big ghost" data-collection="1">Collection</button></div>' +
      '<div class="row2"><button class="big ghost" data-sound="1">Sound · ' + (FX.isMuted() ? "off" : "on") + '</button><button class="big ghost" data-title="1">Title screen</button></div>' +
      (installEvt ? '<button class="big" data-install="1" style="margin-top:.4rem">Add to home screen</button>' : "") +
      '<button class="big ghost" data-close="1" style="margin-top:.5rem">Back</button>');
  }
  function sheetHowTo() {
    openS('<h2>How to play</h2><div class="rulz" style="margin-top:.6rem;font-size:.9rem">' +
      '<p><b>Five plays a round.</b> Pick cards, make a hand, play it. Draw back to eight. Two <b>Jokers</b> in the deck stand for any card.</p>' +
      '<p><b>Hands:</b> pair · two, three or four pairs · trips · <b>stairs</b> of consecutive pairs (22 33 44) · <b>straight</b> of five or more · full house · bombs: quads and straight flush.</p>' +
      '<p><b>Every hand must beat the last</b> — a higher kind of hand (pair &lt; pairs &lt; trips &lt; stairs &lt; straight &lt; full house), or the same kind Tichu-style: same length and higher rank, or a longer straight / stairs. Score = base × chain. Longer straights and stairs pay more.</p>' +
      '<p><b>Bombs</b> — quads and straight flush — go off on anything for a flat <b>1000</b> (no chain multiplier). The table opens and the chain carries on.</p>' +
      '<p><b>Discard</b> up to four cards and draw new ones. You get five discards for the whole run — spend them wisely, buy more in the shop. <b>Pass</b> resets the rung, keeps half the chain and costs a breath. A lone <b>Ace</b> resets for free and keeps the chain.</p>' +
      '<p><b>Reach the target</b> in five plays. Cleared early? <b>Raise</b> for double — or bust the payout.</p>' +
      '<p><b>Shop:</b> upgrades, enhanced cards, and <b>charms</b> — five slots, passive powers. Sell to make room. <b>Your hand carries over</b> to the next round — in the shop, tap any card to swap it for a fresh one.</p>' +
      '<p><b>Table rules</b> change most antes (Red Night, Cheap Pairs, Runway…). Tap the ribbon to read one. Every round also brings a <b>contract</b>: an optional side goal for a bonus — break it and you only lose the bonus. A round with no pass and no discard is a <b>Perfect round</b>: +3 chips.</p>' +
      '<p>Thirty antes, gentle at first, steep at the end. A challenge every five. The Summit at 30.</p></div>' +
      '<button class="big ghost" data-close="1" style="margin-top:1.1rem">Back</button>');
  }
  function sheetCollection() {
    const l = life(), un = unlockedFrom(l);
    openS('<h2>Collection</h2><p class="sub">' + un.length + ' of ' + G.CHARMS.length + ' charms</p>' +
      '<div class="coll">' + G.CHARMS.map((c) => { const ok = un.indexOf(c.id) >= 0; return '<div class="coll__i' + (ok ? "" : " locked") + '">' + (ok ? IC.bubble(c.id, "charm charm--s") : '<span class="charm charm--s charm--lock"><span>?</span></span>') + '<div><strong>' + c.name + '</strong><span>' + (ok ? c.desc : c.lock.text + " · " + Math.min(l[c.lock.key] || 0, c.lock.n) + "/" + c.lock.n) + '</span></div></div>'; }).join("") + '</div>' +
      '<span class="lbl" style="display:block;margin-top:1rem">Synergies · two charms, one more effect</span><div class="synlist">' + G.SYNERGIES.map((s) => '<div class="synrow"><b>⚡ ' + s.name + '</b><span>' + G.charmById[s.a].name + ' + ' + G.charmById[s.b].name + ' — ' + s.desc + '</span></div>').join("") + '</div>' +
      '<button class="big ghost" data-close="1" style="margin-top:1.1rem">Back</button>');
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

  /* ---------- start screen ---------- */
  const FAN = [{ r: 10, si: 0 }, { r: 11, si: 2 }, { r: 12, si: 3 }, { r: 13, si: 1 }, { r: 14, si: 0 }];
  function showStart(resume) {
    const l = life(), un = unlockedFrom(l);
    $("fan").innerHTML = FAN.map((c, i) => '<span class="fan__c" style="--i:' + i + '">' + cardHTML(c, null, false, true, i, 5) + '</span>').join("");
    $("startBtns").innerHTML =
      (resume ? '<button class="big" data-continue="1">Continue · ante ' + (resume.ante + 1) + ' · ' + resume.score + ' pts</button>' : "") +
      '<button class="big' + (resume ? " ghost" : "") + '" data-daily="1">Daily · ' + G.todaySeed() + (l.seeds && l.seeds[G.todaySeed()] ? ' · best ante ' + l.seeds[G.todaySeed()].ante : "") + '</button>' +
      '<div class="row2"><button class="big ghost" data-random="1">Random run</button><button class="big ghost" data-howto="1">How to play</button></div>' +
      '<button class="colllink" data-collection="1">Collection · ' + un.length + ' / ' + G.CHARMS.length + ' charms ›</button>';
    const pick = deckPick();
    $("decks").innerHTML = G.DECKS.map((d) => { const ok = deckOpen(l, d), on = d.id === pick; return '<button class="deckc' + (on ? " on" : "") + (ok ? "" : " locked") + '" data-deck="' + d.id + '"' + (ok ? "" : " disabled") + '><b>' + d.glyph + ' ' + d.name + '</b><span>' + (ok ? d.desc : "🔒 " + d.lock.text) + '</span></button>'; }).join("");
    const lg = ledger(l).slice(0, 5);
    $("ledger").innerHTML = lg.length ? '<span class="lbl">Ledger · best climbs</span>' + lg.map((r) => '<button class="ledg" data-replay="' + r.seed + '"><b>Ante ' + r.ante + '</b><span>' + r.seed + (r.deck && r.deck !== "classic" ? " · " + G.deckById[r.deck].name : "") + '</span><em>' + r.score + '</em></button>').join("") : "";
    $("stats").innerHTML = l.runs ? '<div><b>' + l.runs + '</b><span>runs</span></div><div><b>' + l.best + '</b><span>best ante</span></div><div><b>' + l.wins + '</b><span>summits</span></div><div><b>' + l.bestScore + '</b><span>best round</span></div>' : "";
    $("start").hidden = false; document.body.classList.add("on-start"); FX.embers(true);
  }
  function hideStart() { $("start").hidden = true; document.body.classList.remove("on-start"); FX.embers(false); }

  /* ---------- events ---------- */
  let swipe = { y0: 0, t0: 0, did: false };
  const hand = $("hand");
  hand.addEventListener("pointerdown", (e) => { swipe = { y0: e.clientY, t0: Date.now(), did: false }; });
  hand.addEventListener("pointerup", (e) => {
    const dy = e.clientY - swipe.y0;
    if (Math.abs(dy) < 45 || Date.now() - swipe.t0 > 700) return;
    swipe.did = true;
    const go = $("bPlay");
    if (dy < 0 && !go.disabled && (go.classList.contains("ok") || go.classList.contains("ace"))) doPlay();
    else if (dy > 0 && S.sel.length) { if (G.canDiscard(S) && !G.evalSel(S).legal) doDiscard(); else { S.sel = []; render(); } }
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
    const act = a.dataset.act;
    if (act === "chisel") { ui.chisel = !ui.chisel; S.sel = []; render(); }
    if (act === "hint") doHint();
    if (act === "end") end();
    if (act === "raise") { if (G.raise(S)) { FX.sfx.raise(); FX.buzz([10, 30, 10]); FX.burstAt($("bPlay"), 26, 3.5); render(); save(); } }
  });
  $("charms").addEventListener("click", (e) => { const c = e.target.closest("[data-charm]"); if (c) sheetCharm(c.dataset.charm); });
  $("chal").addEventListener("click", () => { const c = G.current(S); if (c) note(c.name + " — " + c.desc, 4500); });
  $("rule").addEventListener("click", () => { const r = G.currentRule(S); if (r) note(r.name + " — " + r.desc, 4500); });
  $("contract").addEventListener("click", () => { const c = S.contract && G.contractById[S.contract]; if (c) note("Contract · " + c.name + " — " + c.desc + " Reward " + (c.pct ? "+" + c.pct + "% of the round" : "+" + c.flat + " points") + ".", 5000); });
  $("bPlay").addEventListener("click", doPlay);
  $("bPass").addEventListener("click", doPass);
  $("bDisc").addEventListener("click", doDiscard);
  $("bMenu").addEventListener("click", sheetMenu);
  $("bHint").addEventListener("click", doHint);
  $("veil").addEventListener("click", (e) => {
    const t = e.target;
    const buy = t.closest("[data-buy]");
    if (buy) { if (G.buy(S, +buy.dataset.buy)) { FX.sfx.buy(); FX.buzz(10); save(); refreshShop(); } return; }
    const sellb = t.closest("[data-sell]");
    if (sellb) { if (G.sell(S, +sellb.dataset.sell)) { FX.sfx.discard(); save(); refreshShop(); } return; }
    const cb2 = t.closest("[data-contract]");
    if (cb2) { if (G.chooseContract(S, cb2.dataset.contract || null)) { FX.sfx.tick(); save(); refreshShop(); } return; }
    const kb = t.closest("[data-keep]");
    if (kb) { if (G.toggleKeep(S, +kb.dataset.keep)) { FX.sfx.tick(); save(); refreshShop(); } return; }
    if (t.closest("[data-reroll]")) { if (G.reroll(S)) { FX.sfx.discard(); save(); refreshShop(); } return; }
    if (t.closest("[data-next]")) { G.nextAnte(S); ui.chisel = false; closeS(); render(); save(); const bc = G.current(S); if (bc) bossIntro(bc); return; }
    if (t.closest("[data-endless]")) { if (G.goEndless(S)) { FX.sfx.open(); save(); sheetShop(null, []); } return; }
    if (t.closest("[data-restart]")) { closeS(); begin(S.seed); return; }
    if (t.closest("[data-fresh]")) { closeS(); begin(""); return; }
    if (t.closest("[data-today]")) { closeS(); begin(G.todaySeed()); return; }
    if (t.closest("[data-seed]")) { const v = $("sd").value.trim(); if (v) { closeS(); begin(v); } return; }
    if (t.closest("[data-sound]")) { FX.toggleMute(); FX.sfx.tick(); sheetMenu(); return; }
    if (t.closest("[data-howto]")) { sheetHowTo(); return; }
    if (t.closest("[data-collection]")) { sheetCollection(); return; }
    if (t.closest("[data-share]")) { const txt = shareText(); (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => { t.closest("[data-share]").textContent = "Copied"; }).catch(() => { prompt("Copy your result", txt); }); return; }
    if (t.closest("[data-title]")) { closeS(); showStart(S && (S.phase === "round" || S.phase === "shop") ? S : null); return; }
    if (t.closest("[data-install]")) { if (installEvt) { installEvt.prompt(); installEvt = null; } closeS(); return; }
    if (t.closest("[data-close]") || t === $("veil")) { if ((S && S.phase === "round") || !$("start").hidden) closeS(); }
  });
  $("start").addEventListener("click", (e) => {
    if (e.target.closest("[data-continue]")) { hideStart(); FX.sfx.open(); render(); if (S.phase === "shop") sheetShop(null, []); return; }
    const dk = e.target.closest("[data-deck]"); if (dk) { try { localStorage.setItem(DECK_KEY, dk.dataset.deck); } catch (x) {} FX.sfx.tick(); showStart(S && (S.phase === "round" || S.phase === "shop") ? S : null); return; }
    const rp = e.target.closest("[data-replay]"); if (rp) { FX.sfx.open(); begin(rp.dataset.replay); return; }
    if (e.target.closest("[data-daily]")) { FX.sfx.open(); begin(G.todaySeed()); return; }
    if (e.target.closest("[data-random]")) { FX.sfx.open(); begin(""); return; }
    if (e.target.closest("[data-howto]")) { sheetHowTo(); return; }
    if (e.target.closest("[data-collection]")) { sheetCollection(); return; }
  });
  addEventListener("resize", () => { if (S) render(); });
  addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; });
  document.addEventListener("visibilitychange", () => { if (document.hidden && S) save(); });

  resumeOrBegin();
})();
