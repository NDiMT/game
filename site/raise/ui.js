/* RAISE — UI v3. DOM και είσοδος· η λογική ζει στο game.js (window.RAISE). */
(function () {
  "use strict";
  const G = window.RAISE, FX = window.FX, IC = window.ICONS;
  const $ = (id) => document.getElementById(id);
  const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
  const KEY = "raise.run.v6", LIFE = "raise.life.v1";
  let S = null, shown = 0, ui = { note: null, noteT: 0 }, installEvt = null;

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
  function begin(seed) { S = G.newRun(seed, unlockedFrom(life()), deckPick()); ui.note = null; shown = 0; save(); hideStart(); render(); }
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
    $("hand").style.maxWidth = (per * (cw + 4) + 2) + "px";
  }
  const pips = (n, max, cls) => { let h = ""; for (let i = 0; i < max; i++) h += '<i class="' + (i < n ? "" : "spent") + '"></i>'; return h; };
  const charmToken = (id, extra) => { const c = G.charmById[id]; return '<button class="charm" data-charm="' + id + '" aria-label="' + c.name + '" style="--h:' + IC.hue(id) + '"' + (extra || "") + '>' + IC.svg(id) + '</button>'; };

  /* ---------- render ---------- */
  function render(keepHand) {
    const T = G.goal(S), e = G.evalSel(S), ch = G.current(S), pos = G.chainPos(S), cleared = S.score >= T;

    FX.countUp($("score"), shown, S.score); shown = S.score;
    $("score").classList.toggle("on", cleared);
    $("tgt").textContent = "/ " + T + (S.raised ? " ↑" : ""); $("tgt").classList.toggle("raised", !!S.raised);
    $("ante").textContent = S.ante + 1; $("anteN").textContent = S.endless && S.ante >= G.TARGETS.length ? "∞" : G.TARGETS.length;
    const f = $("fill"); f.style.width = Math.min(100, S.score / T * 100) + "%"; f.classList.toggle("done", cleared);

    const playsMax = S.playsMax - (ch && ch.id === "fewplays" ? 1 : 0);
    $("plays").innerHTML = pips(S.playsLeft, playsMax);
    const dmax = S.discMax == null ? G.discMaxOf(S) : S.discMax, dleft = G.discardsLeft(S);
    $("discards").hidden = false;
    $("discards").innerHTML = dmax ? pips(dleft, dmax) : '<b>none</b>';
    $("discards").classList.toggle("off", dmax === 0);
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
    if (ct) { $("contractName").textContent = ct.name + " · +" + ct.pct + "%"; $("contractSt").textContent = cst === "broken" ? "✕" : cst === "done" ? "✓" : cst === "ok" ? "…" : "○"; $("contract").className = "chal contract " + cst; }
    document.body.classList.toggle("lastplay", S.playsLeft >= 1 && S.playsLeft < 2 && !cleared);
    $("chainN").textContent = "×" + pos;
    $("chain").classList.toggle("cold", pos <= 1);
    document.body.dataset.heat = pos >= 7 ? 3 : pos >= 5 ? 2 : pos >= 3 ? 1 : 0;
    $("chain").style.setProperty("--pos", Math.min(pos, 12));
    const pk = G.peek(S); $("peek").hidden = !pk; if (pk) $("peekCard").innerHTML = pk.map((c) => cardHTML(c, null, false, true, 0, 1)).join("");
    const tc = $("tcards");
    tc.innerHTML = S.played.map((c, i) => cardHTML(c, null, false, true, i, S.played.length)).join("");
    { const tn = S.played.length, tw = ($("table").clientWidth || 340) - 28, cw = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--cw")) || 44;
      tc.style.setProperty("--tcw", Math.max(26, Math.min(Math.round(cw * 0.9), tn ? Math.floor((tw - (tn - 1) * 4) / tn) : 99)) + "px"); }
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
      S.hand.forEach((c) => { delete c.n; delete c.x; });
    }

    let tools = "";
    if (G.canRaise(S)) tools += '<button class="tb raise" data-act="raise">Raise to ' + Math.round(G.target(S) * G.raiseMulFor(S)) + ' <em>+' + (G.has(S, "gambler") ? 2 : 1) + ' pick</em></button>';
    if (S.raised) tools += '<span class="toast gold raised" style="flex:1">RAISED · reach ' + S.raiseTarget + ' or lose a pick</span>';
    if (cleared && S.playsLeft >= 1 && !S.raised) tools += '<button class="tb" data-act="end">Bank it · end round</button>';
    $("tools").innerHTML = tools;
    /* Σημειώσεις/tooltips: αιωρούμενη κάρτα πάνω από το dock, δεν μετακινεί τίποτα· κλείνει με άγγιγμα. */
    const tipOn = !!ui.note && Date.now() < ui.noteT;
    $("tip").hidden = !tipOn; if (tipOn) $("tip").innerHTML = '<div class="tip__in">' + ui.note + '</div>';

    const go = $("bPlay"); go.className = "go";
    const pv = $("preview"); pv.className = "preview"; let pvt = "";
    if (S.playsLeft < 1) { go.classList.add("done"); go.disabled = false; go.innerHTML = '<span class="go__t">Round over</span><span class="go__s">' + (cleared ? "Cleared · tap for your bonus" : "Short by " + (T - S.score)) + '</span>'; }
    else if (!S.sel.length) {
      go.classList.add("idle"); go.disabled = true; pvt = G.beatText(S) + (S.playsLeft < 2 ? " · last play" : ""); pv.classList.add("hint");
      go.innerHTML = '<span class="go__t">Pick cards</span><span class="go__s">' + (S.rung ? "Climb over " + G.clabel(S.rung) : "Any hand opens") + (S.playsLeft < 2 ? " · last play" : "") + '</span>';
    }
    else if (e.ace) { go.classList.add("ace"); go.disabled = false; go.innerHTML = '<span class="go__t">Ace in the Hole</span><span class="go__s">Open the rung · keep chain ×' + pos + '</span><span class="go__p">↺</span>'; pvt = "Ace in the Hole · the rung opens and the chain stays at ×" + pos + " · it costs no play, but your hand is one card shorter for the rest of the round"; pv.classList.add("ace"); }
    else if (!e.k) { go.classList.add("no"); go.disabled = true; go.innerHTML = '<span class="go__t">Not a hand</span><span class="go__s">' + (G.canDiscard(S) ? "Discard these instead?" : "Pick a pair, a run or a set") + '</span>'; pvt = S.sel.length + (S.sel.length === 1 ? " card" : " cards") + " · these make no hand" + (G.canDiscard(S) ? " · swipe down to discard them" : ""); pv.classList.add("bad"); }
    else {
      go.classList.add(e.up ? "ok" : "down"); go.disabled = false; go.style.setProperty("--kh", IC.kindHue(e.k.kind)); pv.style.setProperty("--kh", IC.kindHue(e.k.kind)); pv.classList.add(e.up ? "ok" : "warn");
      const calc = e.chips + " × " + e.mult;
      go.innerHTML = '<span class="go__t go__t--pts">+' + e.pts + '</span><span class="go__s">' + (e.up ? goLabel(e.k) + ' · ' + calc : 'Breaks the chain · ' + calc) + '</span>';
      /* Η προεπισκόπηση δείχνει το άθροισμα και το πολύ τρεις λόγους — αλλιώς γίνεται σεντόνι. */
      const why = e.notes.slice(0, 3).concat(e.notes.length > 3 ? ["+" + (e.notes.length - 3) + " more"] : []);
      pvt = G.clabel(e.k) + (G.crange(e.k) ? " · " + G.crange(e.k) : "") + " · " + calc + " = " + e.pts + (e.up ? "" : " · the chain breaks back to ×1") + (why.length ? " · " + why.join(", ") : "");
    }
    pv.innerHTML = !pvt ? "" : pv.classList.contains("hint") ? cap(pvt).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      : cap(pvt).split(" · ").map((x) => "<span>" + x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/ /g, "\u00a0") + "</span>").join(' <i>·</i> ');
    Array.prototype.forEach.call(go.querySelectorAll(".go__s"), (el) => { el.textContent = cap(el.textContent); });
    /* Τα φύλλα του τραπεζιού χωράνε και σε ύψος: μετά το preview, μέτρα τον ελεύθερο χώρο και ψαλίδισε. */
    { const tn = S.played.length; if (tn) { const free = tc.clientHeight, cur = parseInt(tc.style.getPropertyValue("--tcw")) || 40;
      if (free > 0) tc.style.setProperty("--tcw", Math.max(24, Math.min(cur, Math.floor((free - 6) / 1.42))) + "px"); } }
    $("bDisc").disabled = !G.canDiscard(S); $("discN").textContent = G.deadHand(S) && dleft <= 0 ? "Free" : dleft;
    $("bHint").disabled = S.playsLeft < 1;
  }
  /* Συμπαγής ετικέτα για το κουμπί: το εύρος φαίνεται στη δεύτερη γραμμή. */
  const goLabel = (k) => k.kind === 3 ? "Stairs " + k.size / 2 : k.kind === 4 ? "Straight " + k.size : k.kind === 7 ? "Str. Flush " + k.size : k.kind === 8 ? G.clabel(k).replace(/ \S+$/, "") : G.clabel(k);
  function note(msg, ms) { ui.note = cap(msg); ui.noteT = Date.now() + (ms || 3800); render(); setTimeout(() => { if (Date.now() >= ui.noteT) render(); }, (ms || 3800) + 100); }
  function callout(t) { if (!t) return; const el = $("callout"); el.textContent = t; el.classList.toggle("bomb", t === "Bomb!"); el.classList.toggle("target", t === "Target!"); FX.pulse(el, "show"); }
  function selRects() { return S.sel.map((i) => { const el = $("hand").querySelector('[data-i="' + i + '"]'); return el ? el.getBoundingClientRect() : null; }); }
  function afterMove() {
    save();
    if (G.stuck(S)) { note(G.stuckReason(S) || "Round over.", 1800); setTimeout(end, 1500); }
  }

  /* ---------- actions ---------- */
  function doPlay() {
    if (S.playsLeft < 1) { end(); return; }
    const from = selRects();
    const ev = G.play(S); if (!ev) return;
    ui.note = null;
    if (ev.type === "ace") { FX.sfx.ace(); FX.buzz(14); }
    else if (ev.bomb) { FX.sfx.bomb(); FX.buzz([30, 40, 120]); FX.boom($("table")); FX.flash(); FX.pulse($("app"), "shake"); FX.floatIn($("table"), "+" + ev.pts); document.body.classList.add("boom"); setTimeout(() => document.body.classList.remove("boom"), 900); }
    else if (!ev.up) { FX.sfx.pass(); FX.buzz(40); FX.floatIn($("table"), "+" + ev.pts); }
    else { FX.sfx.climb(ev.pos); FX.buzz(18); FX.burstAt($("table"), Math.min(50, 10 + Math.round(ev.pts / 24)), 2.4 + Math.min(3, ev.pts / 300), ["#ffd166", "#ff6b6b", "#4ecdc4", "#c77dff", "#ffffff", "hsl(" + IC.kindHue(ev.k.kind) + " 90% 70%)"]); FX.floatIn($("table"), "+" + ev.pts); $("callout").style.setProperty("--kh", IC.kindHue(ev.k.kind)); }
    if (ev.shattered) { FX.sfx.shatter(); FX.burstAt($("table"), 18, 3.2, "#cfe9f2"); }
    const crossed = S.score >= G.goal(S) && S.score - ev.pts < G.goal(S);
    render();
    if (crossed) { setTimeout(() => { callout("Target!"); FX.sfx.clear(); FX.burstAt($("score"), 30, 4, ["#8ff0bf", "#ffffff", "#ffd166"]); }, 420); }
    FX.fly(from, Array.prototype.slice.call($("tcards").children));
    if (ev.drawn) setTimeout(() => FX.sfx.draw(), 180);
    enhPop();
    FX.pulse($("chain"), "bump");
    callout(ev.tags[0]);
    afterMove();
  }
  /* Ένα φύλλο που τράβηξες «έσκασε» σε Gold/Glass/Steel: μικρή γιορτή. */
  function enhPop() {
    const e = S.enhNew && S.enhNew.length ? S.enhNew : null; S.enhNew = [];
    if (!e) return;
    setTimeout(() => { callout(e[0] === "wild" ? "Joker!" : G.ENH[e[0]].name + " card!"); FX.sfx.unlock(); FX.burstAt($("hand"), 26, 3.5, e[0] === "gold" ? ["#f5cf6a", "#fff1bf"] : e[0] === "glass" ? ["#dff5fa", "#8fd0e2"] : ["#e2e6ea", "#a9b2bb"]); }, 520);
  }
  function doDiscard() {
    if (!G.canDiscard(S)) return;
    const rects = selRects();
    if (G.discard(S)) { FX.sfx.discard(); FX.buzz(10); FX.ghostTo(rects, $("dpile")); ui.note = null; render(); setTimeout(() => FX.sfx.draw(), 160); enhPop(); afterMove(); }
  }
  function doHint() {
    const m = G.suggest(S);
    if (m) { S.sel = m.idx.slice(); ui.note = null; FX.sfx.tick(); render(true); return; }
    const o = G.orphans(S);
    if (G.canDiscardAny(S) && o.length) { S.sel = o.slice(0, Math.min(4, o.length)); note("These fit no hand — swipe down or tap Discard to swap them."); return; }
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
    G.BY_TIER.forEach((t) => { const m = S.mult[G.KINDS.indexOf(t)]; if (m > 0) c.push(t.short + " <b>+" + m + " mult</b>"); });
    if (S.playsMax > G.CFG.plays) c.push("Plays <b>" + S.playsMax + "</b>");
    if (S.handSize > G.CFG.handSize) c.push("Hand <b>" + S.handSize + "</b>");
    if (S.chainStart) c.push("Head Start <b>+" + S.chainStart + "</b>");
    if (S.discMore) c.push("Discards <b>" + (G.CFG.discards + S.discMore) + "</b>");
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
  function offersHTML() {
    const left = G.picksLeft(S);
    return S.offers.map((o, i) => {
      const cb = G.canTake(S, i), dis = o.bought || !cb.ok ? " disabled" : "";
      const it = o.kind === "charm" ? G.charmById[o.id] : G.poolById[o.id];
      const tag = o.kind === "charm" ? "Charm" : "Upgrade";
      const why = !o.bought && !cb.ok && cb.why === "full" ? '<span class="why">Charm slots full</span>' : "";
      return '<button class="offer offer--pick' + (o.bought ? " bought" : "") + (left > 0 && !o.bought && cb.ok ? " open" : "") + '" data-take="' + i + '"' + dis + '>' +
        IC.bubble(o.id, "charm charm--s") + '<strong>' + it.name + '</strong><em>' + (o.bought ? "✓" : tag) + '</em><span>' + it.desc + why + (o.kind === "charm" ? synHint(o.id) : "") + '</span></button>';
    }).join("");
  }
  /* Τα charms που κρατάς, σαν σειρά από εικονίδια — δεν πωλούνται, δεν χρειάζονται λίστα. */
  function ownedRowHTML() {
    if (!S.charms.length) return "";
    let h = S.charms.map((id) => '<button class="charm charm--s" data-charm="' + id + '" aria-label="' + G.charmById[id].name + '" style="--h:' + IC.hue(id) + '"' + (G.synergyFor(S, id).length ? ' data-syn="1"' : "") + '>' + IC.svg(id) + '</button>').join("");
    for (let i = S.charms.length; i < S.charmSlots; i++) h += '<span class="charm charm--s charm--empty"></span>';
    return '<div class="sec"><span class="lbl">Your charms · ' + S.charms.length + '/' + S.charmSlots + ' · tap to read</span><div class="ownedrow">' + h + '</div></div>';
  }
  function contractHTML() {
    const c = G.upcomingContract(S); if (!c) return "";
    return '<div class="chalnext ctrnext"><span class="lbl">Next · Contract</span><b>' + c.name + ' · +' + c.pct + '% of the round</b><span>' + c.desc + ' Optional — miss it and you simply do not get the bonus.</span></div>';
  }
  const synHint = (id) => G.synergyFor(S, id).map((s) => { const p = G.charmById[s.a === id ? s.b : s.a]; return '<i class="syn">⚡ ' + s.name + ' with ' + p.name + ' — ' + s.desc + '</i>'; }).join("");
  function shopBody() {
    const left = G.picksLeft(S);
    return '<div class="picks' + (left ? " on" : "") + '">' + (left > 1 ? "Pick " + left : left ? "Pick one" : "Picked") + '</div>' +
      '<div class="offers" id="offers">' + offersHTML() + '</div>' + ownedRowHTML();
  }
  function sheetShop(r, fresh) {
    const T = G.target(S), up = G.upcoming(S), rr = r && r.raiseResult;
    const bonus = [];
    if (r) {
      if (rr === "won") bonus.push("raise made");
      if (rr === "lost") bonus.push("raise missed");
      if (r.perfect) bonus.push("perfect round");
      if (r.contract && r.contract.met) bonus.push(r.contract.name + " +" + r.contract.bonus);
    }
    openS('<h2>Ante ' + (S.ante + 1) + ' cleared</h2><p class="sub">' + S.score + ' of ' + T + (bonus.length ? ' · ' + bonus.join(' · ') : '') + '</p>' +
      (fresh && fresh.length ? '<div class="unlocked">✦ Unlocked · ' + fresh.map((id) => G.charmById[id].name).join(", ") + '</div>' : "") +
      '<div id="shopBody">' + shopBody() + '</div>' +
      (up ? '<div class="chalnext bossnext">' + IC.bubble(up.id, "charm charm--s") + '<div><span class="lbl">Next · Boss ante</span><b>' + up.name + '</b><span>' + up.desc + '</span><em>' + up.tell + ' ' + up.tip + '</em></div></div>' : (G.upcomingRule(S) ? '<div class="chalnext rulenext"><span class="lbl">Next · Table rule</span><b>' + G.upcomingRule(S).name + '</b><span>' + G.upcomingRule(S).desc + '</span></div>' : "")) +
      contractHTML() +
      '<button class="big" data-next="1" style="margin-top:.9rem">Ante ' + (S.ante + 2) + ' · target ' + G.nextTarget(S) + '</button>');
    if (fresh && fresh.length) FX.sfx.unlock();
  }
  const refreshShop = () => { $("shopBody").innerHTML = shopBody(); };
  const shareText = () => "RAISE · " + S.seed + (S.deckId && S.deckId !== "classic" ? " · " + G.deckById[S.deckId].name : "") + " · " + (S.phase === "won" ? "Summit ▲" : (S.endless ? "Endless ante " : "Ante ") + (S.ante + 1)) + " · " + S.score + " pts" + (S.charms.length ? " · " + S.charms.map((id) => G.charmById[id].name).join(", ") : "");
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
    "Every step of chain is +1 Mult. Four cheap hands that climb beat one fat hand that does not.",
    "A hand that does not climb still scores — it just scores flat. Sometimes that is the right call.",
    "Discards do not cost you a play. Two hands you cannot use are two hands you should throw.",
    "Clear the target with plays to spare and Raise: an extra bonus is worth more than a safe round.",
    "A lone Ace opens the table and keeps the chain. It costs a card, not a play.",
    "Bombs beat anything and the chain carries on through them. Save one for a wall.",
    "The shape of the hand matters far more than the rank of the cards. Build shapes.",
  ];
  function sheetLose(newBest) {
    const rec = (life().seeds || {})[S.seed];
    openS('<h2 class="bad">Busted</h2><p class="sub">Ante ' + (S.ante + 1) + ' · ' + S.score + ' of ' + G.target(S) + '</p>' + missHTML() +
      (newBest && S.ante > 0 ? '<div class="unlocked">✦ New best on this seed</div>' : "") +
      '<div class="tally"><div>Antes cleared<b>' + S.ante + '</b></div><div>Best chain<b>×' + S.stats.maxChain + '</b></div>' + (rec && !newBest ? '<div>Best on this seed<b>Ante ' + rec.ante + ' · ' + rec.score + '</b></div>' : "") + '<div>Seed<b>' + S.seed + '</b></div></div>' +
      (S.charms.length ? '<span class="lbl">Your build</span><div class="chips">' + S.charms.map((id) => '<span class="chip">' + G.charmById[id].name + '</span>').join("") + chipsHTML() + '</div>' : "") +
      '<p class="sub" style="margin:.9rem 0">' + BUSTED_TIPS[(S.ante + S.stats.plays) % BUSTED_TIPS.length] + '</p>' +
      '<button class="big" data-restart="1">Same seed, again</button><div class="row2"><button class="big ghost" data-fresh="1">New seed</button><button class="big ghost" data-share="1">Share</button></div>');
  }
  function sheetWin() {
    openS('<h2 class="good">The Summit</h2><p class="sub">All thirty · last hand ' + S.score + ' of ' + G.target(S) + '</p>' +
      '<div class="tally"><div>Charms<b>' + S.charms.length + '</b></div><div>Best chain<b>×' + S.stats.maxChain + '</b></div><div>Seed<b>' + S.seed + '</b></div></div>' +
      '<span class="lbl">Your build</span><div class="chips">' + S.charms.map((id) => '<span class="chip">' + G.charmById[id].name + '</span>').join("") + chipsHTML() + '</div>' +
      '<button class="big" data-endless="1" style="margin-top:1rem">Keep climbing · Endless</button>' +
      '<div class="row2"><button class="big ghost" data-fresh="1">New run</button><button class="big ghost" data-share="1">Share</button></div>');
  }
  function sheetMenu() {
    openS('<h2>This round</h2>' +
      '<div class="log" style="margin-top:.5rem">' + (S.log.length ? S.log.slice().reverse().map((e) => '<div class="' + (e.cls || "") + '"><span>' + e.t + '</span><em>' + cap(e.c) + '</em><b>' + (typeof e.p === "number" ? "+" + e.p : e.p) + '</b></div>').join("") : '<div style="border:0;color:var(--muted)">No plays yet</div>') + '</div>' +
      '<div class="sec"><span class="lbl">Charms</span>' + ownedCharmsHTML() + '</div>' +
      '<div class="sec"><span class="lbl">Build</span><div class="chips">' + chipsHTML() + '</div></div>' +
      '<div class="sec"><span class="lbl">Paytable · chips × mult, before cards and chain</span><div class="rtab">' + G.BY_TIER.map((t) => { const ki = G.KINDS.indexOf(t), k = { kind: ki, size: t.size || t.min, rank: 14 };
        return '<div><span>' + t.name + (t.min ? ' <em>' + (t.id === "stairs" ? 'Two pairs in a row · longer pays more' : t.id === "pairs" ? 'Up to 4 pairs · more pay more' : '5 cards · longer pays more') + '</em>' : '') + '</span><b>' + G.kchips(k) + ' × ' + (G.kmult(k) + S.mult[ki]) + '</b></div>'; }).join("") + '</div></div>' +
      '<div class="sec"><span class="lbl">Seed · ' + S.seed + '</span><div class="seedrow"><input id="sd" value="" placeholder="custom seed" spellcheck="false" aria-label="Seed"><button data-seed="1">Go</button></div>' +
      '<div class="row2"><button class="big ghost" data-today="1">Daily · ' + G.todaySeed() + '</button><button class="big ghost" data-fresh="1">Random</button></div></div>' +
      '<div class="row2" style="margin-top:1.1rem"><button class="big ghost" data-howto="1">How to play</button><button class="big ghost" data-collection="1">Collection</button></div>' +
      '<div class="row2"><button class="big ghost" data-sound="1">Sound · ' + (FX.isMuted() ? "off" : "on") + '</button><button class="big ghost" data-title="1">Title screen</button></div>' +
      (installEvt ? '<button class="big" data-install="1" style="margin-top:.4rem">Add to home screen</button>' : "") +
      '<button class="big ghost" data-close="1" style="margin-top:.5rem">Back</button>');
  }
  function sheetHowTo() {
    openS('<h2>How to play</h2><div class="rulz" style="margin-top:.6rem;font-size:.9rem">' +
      '<p><b>One round, five plays, two discards.</b> Pick cards from your hand, make a hand, play it. You draw back up to eight after every play. Reach the target before the plays run out.</p>' +
      '<p>The hand sitting on the table is the <b>rung</b>. Everything in the game is about whether your next hand goes over it.</p>' +
      '<p><b>The hands</b>, weakest to strongest: pair · two, three or four pairs · trips · <b>stairs</b> (pairs in a row, 22 33 44) · <b>straight</b> of five or more · full house · then the two bombs, quads and straight flush. <b>Jokers</b> stand in for any card.</p>' +
      '<p><b>Score = Chips × Mult.</b> The shape sets both — a pair is 30 × 2, a full house 65 × 4, a straight flush 100 × 6. Then every card adds chips: 2 to 10 as printed, J Q K ten, an Ace eleven. Two Aces make 104 and two 3s make 72 — the card matters, it does not decide the round.</p>' +
      '<p><b>The chain is where the points are.</b> Beat the hand on the table — a stronger kind, or the same kind Tichu-style (same length, higher rank, or a longer run) — and the chain climbs one step. <b>Every step above the first is +1 Mult</b>, up to ×8. Play something lower and it still scores its plain Chips × Mult, but you get no chain bonus and the chain drops back to ×1.</p>' +
      '<p>So the round is one question, five times over: <b>climb for the multiplier, or cash in a big hand and start again.</b></p>' +
      '<p>A lone <b>Ace</b> is the escape hatch: it opens the table and keeps your chain, costs no play, but leaves your hand one card shorter for the rest of the round. <b>Bombs</b> beat anything, open the table, and keep the chain climbing.</p>' +
      '<p><b>Discards</b> are their own resource — two a round, they never cost you a play. Throw any number of cards and draw the same number back. If your hand makes no combination at all, the discard is free.</p>' +
      '<p><b>Cleared it early? Raise.</b> The target goes up — ×1.8 with two plays left, ×2 with one — and if you make it you leave with an extra bonus. Miss it and you leave with one fewer.</p>' +
      '<p><b>Clear an ante, pick one bonus.</b> Three on offer, upgrades and <b>charms</b> together. No money, no prices, no selling — one tap and you are back at the table. Double the target and a fourth appears; a perfect round (chain never broken, no discard, every play used) gives a second pick. Charms are passive and permanent: five slots to start.</p>' +
      '<p><b>Your hand carries over</b> between antes and tidies itself — cards that fit no combination are swapped for fresh ones. Cards are never for sale, but about one card in sixteen that you draw turns out enhanced, for the rest of the run: <b>Gold</b> (Mult ×2, and two of them is ×4), <b>Glass</b> (Mult ×3, then it shatters), <b>Steel</b> (+20 Chips and it always comes back to your hand) or a <b>Joker</b>.</p>' +
      '<p>Most antes carry a <b>table rule</b> — Red Night, Cheap Pairs, Runway — and every one carries a <b>contract</b>, an optional side goal worth a slice of your round score. Tap either ribbon to read it. Every fifth ante is a <b>boss</b> with a rule that bites and a target three quarters as high.</p>' +
      '<p>Thirty antes. Gentle at first, steep at the end. The Summit at 30 — and Endless after that.</p></div>' +
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
  $("tip").addEventListener("click", () => { ui.noteT = 0; render(); });

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
    else if (dy > 0 && S.sel.length) { if (G.canDiscard(S)) doDiscard(); else { S.sel = []; render(true); } }
  });
  hand.addEventListener("click", (e) => {
    if (swipe.did) { swipe.did = false; return; }
    const b = e.target.closest("[data-i]"); if (!b || S.phase !== "round") return;
    const i = +b.dataset.i; ui.note = null;
    if (G.toggle(S, i)) { FX.sfx.tick(); FX.buzz(6); render(true); }
  });
  $("tools").addEventListener("click", (e) => {
    const a = e.target.closest("[data-act]"); if (!a) return;
    const act = a.dataset.act;
    if (act === "hint") doHint();
    if (act === "end") end();
    if (act === "raise") { if (G.raise(S)) { FX.sfx.raise(); FX.buzz([10, 30, 10]); FX.burstAt($("bPlay"), 26, 3.5); render(); save(); } }
  });
  $("charms").addEventListener("click", (e) => { const c = e.target.closest("[data-charm]"); if (c) sheetCharm(c.dataset.charm); });
  $("chal").addEventListener("click", () => { const c = G.current(S); if (c) note(c.name + " — " + c.desc, 4500); });
  $("rule").addEventListener("click", () => { const r = G.currentRule(S); if (r) note(r.name + " — " + r.desc, 4500); });
  $("contract").addEventListener("click", () => { const c = S.contract && G.contractById[S.contract]; if (c) note("Contract · " + c.name + " — " + c.desc + " Reward: +" + c.pct + "% of the round score, added before the target is checked.", 5000); });
  $("bPlay").addEventListener("click", doPlay);
  $("bDisc").addEventListener("click", doDiscard);
  $("bMenu").addEventListener("click", sheetMenu);
  $("bHint").addEventListener("click", doHint);
  $("veil").addEventListener("click", (e) => {
    const t = e.target;
    const pick = t.closest("[data-take]");
    if (pick) { if (G.take(S, +pick.dataset.take)) { FX.sfx.buy(); FX.buzz(10); FX.burstAt(pick, 22, 3, ["#ffd166", "#fff6d4"]); save(); refreshShop(); } return; }
    const cm = t.closest("[data-charm]");
    if (cm) { sheetCharm(cm.dataset.charm); return; }
    if (t.closest("[data-next]")) { G.nextAnte(S); closeS(); render(); save(); const bc = G.current(S); if (bc) bossIntro(bc); return; }
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
