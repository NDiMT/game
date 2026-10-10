// =====================================================================
// ORBIS · Crown Run screens (agent "crown"): the banner bar and Blind pill in the HUD, the shop, pack opening,
// the boss preview, the Blind intro, the end-of-run rewards, the Collection and the origin picker.
// DOM only: main.js passes in what it owns (icons, unit portraits, sound) and does the game-side effects.
// Landscape first (cards in a wide row), with a portrait fallback in style.css ("crown" block).
// =====================================================================
import * as C from './crown.js?v=1.10';
import { UNITS, SPELLS, FACTIONS } from './data.js?v=1.10';

export function createCrownUI({ icon, unitIcon, sfx = {}, onChange = () => {} }) {
  const S = (n, o) => { try { sfx[n]?.(o); } catch { /* sound is optional */ } };
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const crowns = (n) => `<span class="cr-c">${icon('victory', 15)}<b>${n}</b></span>`;
  // a number that counts up (ease-out), with a soft tick per step
  function tick(node, from, to, ms = 600, sound = true) {
    return new Promise((res) => {
      if (reduce || from === to) { node.textContent = to; res(); return; }
      const t0 = performance.now(); let last = from;
      const f = (now) => {
        const u = Math.min(1, (now - t0) / ms), v = Math.round(from + (to - from) * (1 - (1 - u) ** 3));
        if (v !== last) { node.textContent = v; last = v; if (sound) S('tab', { vol: 0.25, pitch: 1.2 + u * 0.6 }); }
        if (u < 1) requestAnimationFrame(f); else res();
      };
      requestAnimationFrame(f);
    });
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, reduce ? 0 : ms));

  // ---------------------------------------------------------------- cards
  // a banner / voucher / pack / spell / unit as a card. o: { price, sold, back, cls }
  function cardHTML(item, o = {}) {
    const k = item.kind;
    let rar = 'common', name = '', body = '', art = '', tag = '', foot = '';
    if (k === 'banner') {
      const B = C.BANNERS[item.id]; rar = B.rarity; name = B.name; art = icon(B.icon, 54); tag = B.tag === '×' || B.tag === '+' ? B.tag : B.tag === 'rule' ? 'Rule' : B.tag === 'copy' ? 'Copy' : B.tag === 'econ' ? '₵' : B.tag === 'build' ? 'Build' : 'Grows';
      body = esc(C.bannerText({ id: item.id, gilded: item.gilded, n: item.n || 0 }));
      foot = `<small class="cr-rar">${C.RARITY[rar].name}${item.gilded ? ' · Gilded' : ''}${item.tattered ? ' · Tattered' : ''}</small>`;
    } else if (k === 'voucher') { const V = C.VOUCHERS[item.id]; rar = 'voucher'; name = V.name; art = icon(V.icon, 54); tag = 'Voucher'; body = V.text; foot = '<small class="cr-rar">For the rest of the run</small>'; }
    else if (k === 'pack') { const P = C.PACKS[item.id]; rar = 'pack-' + item.id; name = P.name; art = icon(P.icon, 58); tag = 'Pack'; body = P.text; }
    else if (k === 'scroll' || k === 'spell') { const Sp = SPELLS[item.id]; rar = 'spell'; name = Sp.name; art = icon(item.id, 54); tag = k === 'scroll' ? 'Scroll' : `Circle ${Sp.circle}`; body = `${Sp.desc} Your hero learns it for good.`; }
    else if (k === 'upgrade') { rar = 'upgrade'; name = `Upgrade: ${UNITS[item.to].name}`; art = `<span class="cr-pt">${unitIcon(item.to, 64)}</span>`; tag = 'Upgrade'; body = `Your ${UNITS[item.id].name} stack becomes ${UNITS[item.to].name}.`; }
    else if (k === 'unit') { const U = UNITS[item.id]; rar = 'unit'; name = `${item.n} ${U.name}`; art = `<span class="cr-pt">${unitIcon(item.id, 64)}</span>`; tag = `Tier ${U.tier}`; body = `${icon('attack', 13)}${U.att} ${icon('defense', 13)}${U.def} ${icon('hp', 13)}${U.hp}${U.ranged ? ` ${icon('shots', 13)}` : ''}${U.fly ? ` ${icon('fly', 13)}` : ''}${item.seal ? `<br><b class="cr-seal">${icon(C.SEALS[item.seal].icon, 14)} ${C.SEALS[item.seal].name}</b>: ${C.SEALS[item.seal].text}` : ''}`; }
    const price = o.price != null ? `<span class="cr-price${o.poor ? ' poor' : ''}">${o.price === 0 ? 'Free' : `${icon('victory', 14)}${o.price}`}</span>` : '';
    return `<div class="cr-card r-${rar}${item.gilded ? ' gilded' : ''}${o.sold ? ' sold' : ''}${o.back ? ' back' : ''} ${o.cls || ''}" ${o.attrs || ''}>
      <div class="cr-in"><div class="cr-face"><span class="cr-tag">${tag}</span><span class="cr-art">${art}</span><b class="cr-name">${esc(name)}</b><p class="cr-txt">${body}</p>${foot}</div>
      <div class="cr-back"><span>${icon(k === 'pack' ? C.PACKS[item.id].icon : 'banner', 44)}</span></div></div>${price}</div>`;
  }

  // ---------------------------------------------------------------- HUD: banner bar + Blind pill
  let hud = null, tip = null;
  function mountHud(parent) {
    if (hud && hud.isConnected) return hud;
    hud = el('div', '', ''); hud.id = 'crown-hud';
    hud.innerHTML = '<div class="cr-bar" id="cr-bar"></div><button class="cr-pill" id="cr-pill"></button>';
    parent.appendChild(hud);
    hud.querySelector('#cr-bar').addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) showTip(b, +b.dataset.i); });
    return hud;
  }
  let hudRun = null, hudDay = 1;
  function renderHud(run, day, { onPill } = {}) {
    if (!hud) return; hudRun = run; hudDay = day;
    hud.hidden = !run;
    if (!run) return;
    const n = C.slotCount(run), bar = hud.querySelector('#cr-bar');
    let h = '';
    for (let i = 0; i < n; i++) {
      const b = run.banners[i], B = b && C.BANNERS[b.id];
      h += b ? `<button class="cr-slot r-${B.rarity}${b.gilded ? ' gilded' : ''}" data-i="${i}" aria-label="${esc(B.name)}">${icon(B.icon, 26)}${b.n ? `<em>${b.n}</em>` : ''}</button>` : `<span class="cr-slot empty"></span>`;
    }
    h += `<span class="cr-wallet">${crowns(run.crowns)}</span>`;
    if (bar.__h !== h) { bar.innerHTML = h; bar.__h = h; }
    const nb = C.nextBlind(run), pill = hud.querySelector('#cr-pill');
    if (nb) {
      const left = nb.day - day, boss = C.BOSSES[run.bosses[run.ante - 1]];
      pill.className = `cr-pill k-${nb.kind}${left <= 0 ? ' due' : left === 1 ? ' soon' : ''}`;
      pill.innerHTML = `<span class="cr-sig">${icon(nb.kind === 'boss' ? boss.icon : nb.kind === 'warlord' ? 'hero' : 'attack', 22)}</span><span class="cr-pt2"><small>Ante ${run.ante}/${run.antes} · ${C.BLIND_NAME[nb.kind]}</small><b>${left <= 0 ? 'Tonight!' : left === 1 ? 'Tomorrow night' : `In ${left} days`}</b></span>`;
      pill.onclick = () => { S('click'); onPill ? onPill() : bossPreview(run, day); };
    }
  }
  function showTip(btn, i) {
    const b = hudRun?.banners[i]; if (!b) return;
    const B = C.BANNERS[b.id];
    hideTip();
    tip = el('div', `cr-tip r-${B.rarity}`, `<b>${icon(B.icon, 18)} ${esc(B.name)}</b><small>${C.RARITY[B.rarity].name}${b.gilded ? ' · Gilded' : ''} · slot ${i + 1}</small><p>${esc(C.bannerText(b))}</p><p class="cr-combo">${esc(B.combo)}</p><small>Sells for ${C.sellValue(b)}₵ in the shop</small>`);
    document.body.appendChild(tip);
    const r = btn.getBoundingClientRect(), w = Math.min(260, innerWidth - 16);
    tip.style.width = w + 'px'; tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px'; tip.style.top = r.bottom + 8 + 'px';
    S('select'); setTimeout(() => addEventListener('pointerdown', hideTip, { once: true }), 0);
  }
  function hideTip() { tip?.remove(); tip = null; }

  // ---------------------------------------------------------------- full-screen layer
  let layer = null;
  function open(cls, html) {
    close(true);
    layer = el('div', `crown-layer ${cls}`, html); layer.id = 'crown-layer';
    document.body.appendChild(layer); hideTip();
    return layer;
  }
  function close(now = false) {
    const L = layer; layer = null; if (!L) return;
    if (now || reduce) { L.remove(); return; }
    L.classList.add('closing'); setTimeout(() => L.remove(), 220);
  }
  const isOpen = () => !!layer;

  // ---------------------------------------------------------------- boss preview (tap the Blind pill)
  function bossPreview(run, day, { threat = null, onClose = null } = {}) {
    const id = run.bosses[run.ante - 1], B = C.BOSSES[id], nb = C.nextBlind(run);
    const sched = C.BLINDS.map((k, i) => { const d = C.blindDay(run, k), done = i < run.blind, now = nb && nb.kind === k; return `<li class="${done ? 'done' : ''}${now ? ' now' : ''}"><span>${icon(done ? 'check' : k === 'boss' ? B.icon : k === 'warlord' ? 'hero' : 'attack', 20)}</span><b>${C.BLIND_NAME[k]}</b><small>Day ${d} · ×${C.TUNE.blind[k]}</small></li>`; }).join('');
    const L = open('cr-boss', `<div class="cr-panel ornate"><div class="cr-cols">
      <div class="cr-crest b-${id}"><span class="cr-rays"></span>${icon(B.icon, 96)}<h2>${B.name}</h2><small>Crown Boss of Ante ${run.ante}</small></div>
      <div class="cr-side"><p class="cr-rule"><em>Boss rule</em>${esc(B.text)}${id === 'usurper' ? `<br>${(run.usurperRules || []).map((r) => C.BOSSES[r].text).join('<br>')}` : ''}</p>
      ${B.unlocks ? `<p class="cr-unl">${icon('lock', 16)} Beat her to unlock <b>${FACTIONS[B.unlocks].name}</b></p>` : ''}
      <ol class="cr-sched">${sched}</ol>
      ${threat ? `<div class="cr-army"><small>${C.BLIND_NAME[threat.kind]} army</small>${threat.army.map(([u, n]) => `<span>${unitIcon(u, 48)}<em>${n}</em></span>`).join('')}</div>` : ''}
      <p class="cr-days">${nb ? (nb.day - day <= 0 ? 'The Blind comes <b>tonight</b>.' : `${C.BLIND_NAME[nb.kind]} in <b>${nb.day - day}</b> day${nb.day - day > 1 ? 's' : ''}.`) : ''}</p>
      <button class="btn gold" id="cr-ok">Got it</button></div></div></div>`);
    L.querySelector('#cr-ok').onclick = () => { S('close'); close(); onClose?.(); };
    S('open');
  }

  // ---------------------------------------------------------------- the Blind arrives (before the fight)
  function blindIntro(run, blind, threat, { onFight }) {
    const boss = blind.kind === 'boss' ? C.BOSSES[blind.boss] : null;
    const L = open('cr-intro', `<div class="cr-panel ornate k-${blind.kind}"><div class="cr-cols">
      <div class="cr-crest"><span class="cr-rays"></span>${icon(boss ? boss.icon : blind.kind === 'warlord' ? 'hero' : 'attack', 92)}<h2>${boss ? boss.name : C.BLIND_NAME[blind.kind]}</h2><small>Ante ${run.ante} · dusk of day ${blind.day}</small></div>
      <div class="cr-side">${boss ? `<p class="cr-rule"><em>Boss rule</em>${esc(boss.text)}</p>` : `<p>${blind.kind === 'raid' ? 'Raiders strike at your hero before nightfall.' : 'A warlord and his host march on you.'} Win, or the run ends here.</p>`}
      <div class="cr-army"><small>Enemy army${threat.hero ? ` · led by ${esc(threat.hero.name)}` : ''}</small>${threat.army.map(([u, n]) => `<span>${unitIcon(u, 48)}<em>${n}</em></span>`).join('')}</div>
      <p class="cr-pay">Victory pays ${crowns(blind.kind === 'raid' && run.stake >= 2 ? 0 : C.TUNE.pay[blind.kind])} and opens the shop.</p>
      <button class="btn gold" id="cr-fight">${icon('attack', 20)} To battle!</button></div></div></div>`);
    L.querySelector('#cr-fight').onclick = () => { S('click'); close(true); onFight(); };
    S('alarm');
  }

  // ---------------------------------------------------------------- the shop
  // h: { payout: {lines,total} | null, ctx: () => ({known, army}), meta, apply(item) -> Promise<bool> (scroll/upgrade/pack), onDone }
  function shop(run, h) {
    const L = open('cr-shop', `<div class="cr-shopwrap">
      <aside class="cr-pay ornate"><h3>${icon('victory', 20)} Payout</h3><ul id="cr-lines"></ul><div class="cr-total"><small>Crowns</small><b id="cr-wal">${run.crowns}</b></div></aside>
      <section class="cr-stock"><header><h2>The Crown Market</h2><small>Ante ${run.ante} · after the ${C.BLIND_NAME[C.BLINDS[(run.blind + 2) % 3]]}</small></header>
        <div class="cr-row" id="cr-cards"></div></section>
      <footer class="cr-foot"><div class="cr-bbar" id="cr-bbar"></div>
        <div class="cr-acts"><button class="btn ghost" id="cr-sell" disabled>${icon('gold', 18)} Sell</button><button class="btn" id="cr-reroll"></button><button class="btn gold" id="cr-done">Next ▶</button></div></footer></div>`);
    let sel = -1, busy = false;
    const wal = L.querySelector('#cr-wal');
    const setWallet = (from) => { tick(wal, from, run.crowns, 420, false); onChange(); };
    function stock() {
      const sh = run.shop, items = [...sh.cards.map((c, i) => ['card', i, c]), ...(sh.pack ? [['pack', 0, sh.pack]] : []), ...(sh.voucher ? [['voucher', 0, sh.voucher]] : [])];
      L.querySelector('#cr-cards').innerHTML = items.map(([w, i, it], j) => cardHTML(it, { price: it.price, sold: it.sold, poor: run.crowns < it.price, cls: `deal${reduce ? '' : ' flip-in'}`, attrs: `data-w="${w}" data-i="${i}" style="--d:${j * 90}ms"` })).join('');
      const rc = C.rerollCost(run);
      const rb = L.querySelector('#cr-reroll'); rb.innerHTML = `${icon('auto', 18)} Reroll <small>${rc ? `${rc}₵` : 'free'}</small>`; rb.disabled = run.crowns < rc;
      if (!reduce) setTimeout(() => L.querySelectorAll('.flip-in').forEach((c) => c.classList.remove('flip-in')), 30);
    }
    function bbar() {
      const n = C.slotCount(run);
      let s = '';
      for (let i = 0; i < n; i++) { const b = run.banners[i]; s += b ? cardHTML({ kind: 'banner', ...b }, { cls: `mini${i === sel ? ' on' : ''}`, attrs: `data-b="${i}"` }) : '<div class="cr-card mini empty"><div class="cr-in"><div class="cr-face"><span class="cr-art">' + icon('banner', 30) + '</span></div></div></div>'; }
      L.querySelector('#cr-bbar').innerHTML = s;
      const sb = L.querySelector('#cr-sell'), b = run.banners[sel];
      sb.disabled = !b || b.tattered; sb.innerHTML = `${icon('gold', 18)} Sell${b ? ` <small>+${C.sellValue(b)}₵</small>` : ''}`;
      onChange();
    }
    // payout tally: each line pops in and counts up, then the total
    (async () => {
      busy = true;
      const ul = L.querySelector('#cr-lines'), p = h.payout;
      if (p) {
        const start = run.crowns - p.total; wal.textContent = start;
        let acc = start;
        for (const ln of p.lines) {
          const li = el('li', 'pop', `<span>${esc(ln.label)}</span><b>+0</b>`); ul.appendChild(li);
          await wait(160); await tick(li.querySelector('b'), 0, ln.n, 260).then(() => { li.querySelector('b').textContent = `+${ln.n}`; });
          const a0 = acc; acc += ln.n; tick(wal, a0, acc, 260, false); if (ln.n) S('coin', { vol: 0.5 });
        }
        replayCls(wal.parentElement, 'bump');
      } else ul.innerHTML = '<li><span>No payout</span><b>—</b></li>';
      busy = false;
    })();
    stock(); bbar();
    // buy: tap a card to lift it, tap again (or its price) to buy
    let lifted = null;
    L.querySelector('#cr-cards').addEventListener('click', async (e) => {
      const c = e.target.closest('.cr-card'); if (!c || busy || c.classList.contains('sold')) return;
      if (lifted !== c) { L.querySelectorAll('#cr-cards .cr-card.up').forEach((x) => x.classList.remove('up')); c.classList.add('up'); lifted = c; S('select'); return; }
      const w = c.dataset.w, i = +c.dataset.i, item = w === 'card' ? run.shop.cards[i] : run.shop[w];
      if (run.crowns < item.price) { S('deny'); replayCls(c, 'shake'); return; }
      if (item.kind === 'banner' && run.banners.length >= C.slotCount(run)) { S('deny'); replayCls(L.querySelector('#cr-bbar'), 'shake'); flash(L, 'Your banner slots are full: sell one first.'); return; }
      busy = true;
      const from = run.crowns;
      if (item.kind === 'banner' || item.kind === 'voucher') { C.buy(run, w, i, h.meta); }
      else {
        // scrolls, upgrades and packs need the game: main.js applies them (a pack opens its own picker)
        const ok = await h.apply(item, () => C.buy(run, w, i, h.meta));
        if (!ok) { busy = false; return; }
      }
      S(item.kind === 'voucher' ? 'fanfare' : 'coin'); c.classList.add('bought'); setWallet(from);
      await wait(320); lifted = null; stock(); bbar(); busy = false;
      if (item.kind === 'banner') replayCls(L.querySelector(`#cr-bbar [data-b="${run.banners.length - 1}"]`), 'land');
    });
    // banner bar: tap to select (Sell), drag to reorder
    dragBar(L.querySelector('#cr-bbar'), run, (i) => { sel = sel === i ? -1 : i; S('select'); bbar(); }, () => { sel = -1; bbar(); S('tab'); });
    L.querySelector('#cr-sell').onclick = () => { if (sel < 0) return; const from = run.crowns; const v = C.sell(run, sel); if (v) { S('coin'); setWallet(from); sel = -1; stock(); bbar(); } };
    L.querySelector('#cr-reroll').onclick = () => { if (busy) return; const from = run.crowns; if (C.reroll(run, h.meta, h.ctx())) { S('shuffle'); S('tab'); setWallet(from); lifted = null; stock(); } else S('deny'); };
    L.querySelector('#cr-done').onclick = () => { if (busy) return; S('confirm'); close(); run.shop = null; h.onDone?.(); };
    S('open');
    return { refresh: () => { stock(); bbar(); } };
  }
  function flash(L, msg) { const f = el('div', 'cr-flash', esc(msg)); L.appendChild(f); setTimeout(() => f.remove(), 2200); }
  function replayCls(node, cls) { if (!node) return; node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); }
  // drag-to-reorder for the banner bar (pointer events; a short press without movement is a tap)
  function dragBar(bar, run, onTap, onMoved) {
    let d = null;
    bar.addEventListener('pointerdown', (e) => {
      const c = e.target.closest('[data-b]'); if (!c) return;
      d = { c, i: +c.dataset.b, x0: e.clientX, y0: e.clientY, on: false, id: e.pointerId };
    });
    bar.addEventListener('pointermove', (e) => {
      if (!d || e.pointerId !== d.id) return;
      const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
      if (!d.on && Math.hypot(dx, dy) > 8) { d.on = true; d.c.classList.add('drag'); try { bar.setPointerCapture(d.id); } catch { /* old browsers */ } }
      if (d.on) d.c.style.transform = `translate(${dx}px, ${dy * 0.3}px) rotate(${dx * 0.04}deg) scale(1.08)`;
    });
    const up = (e) => {
      if (!d || e.pointerId !== d.id) return;
      const D = d; d = null;
      if (!D.on) { onTap(D.i); return; }
      D.c.classList.remove('drag'); D.c.style.transform = '';
      const slots = [...bar.querySelectorAll('.cr-card')].map((x) => { const r = x.getBoundingClientRect(); return r.left + r.width / 2; });
      let to = 0; for (let k = 0; k < slots.length; k++) if (e.clientX > slots[k]) to = k;
      to = Math.min(run.banners.length - 1, to);
      if (C.moveBanner(run, D.i, to)) onMoved(); else onTap(-2);
    };
    bar.addEventListener('pointerup', up); bar.addEventListener('pointercancel', up);
  }

  // ---------------------------------------------------------------- pack opening: pick 1 of 3
  // h: { title, onPick(choice) -> bool (false: keep the picker open, e.g. no free slot), onSkip }
  function pack(run, pk, h) {
    const P = C.PACKS[pk.kind];
    const L = open('cr-pack', `<div class="cr-packwrap"><header><span class="cr-pk pk-${pk.kind}">${icon(P.icon, 40)}</span><div><h2>${h.title || P.name}</h2><small>${P.text} Tap a card to flip it, tap again to take it.</small></div></header>
      <div class="cr-row" id="cr-pick">${pk.choices.map((c, i) => cardHTML(c, { back: true, attrs: `data-i="${i}" style="--d:${i * 140}ms"` })).join('')}</div>
      <footer><button class="btn ghost" id="cr-skip">Skip <small>+1₵</small></button></footer></div>`);
    const cards = [...L.querySelectorAll('#cr-pick .cr-card')];
    // the cards turn over one after another
    cards.forEach((c, i) => setTimeout(() => { c.classList.remove('back'); c.classList.add('flipped'); S('tab', { pitch: 1 + i * 0.15 }); if (c.classList.contains('r-rare') || c.classList.contains('r-legendary') || c.classList.contains('gilded')) { c.classList.add('shine'); S('artifact'); } }, reduce ? 0 : 420 + i * 260));
    let taken = false, up = null;
    L.querySelector('#cr-pick').addEventListener('click', (e) => {
      const c = e.target.closest('.cr-card'); if (!c || taken || c.classList.contains('back')) return;
      if (up !== c) { cards.forEach((x) => x.classList.toggle('up', x === c)); up = c; S('select'); return; }
      const ch = pk.choices[+c.dataset.i];
      if (!h.onPick(ch)) { S('deny'); replayCls(c, 'shake'); return; }
      taken = true; c.classList.add('taken'); cards.forEach((x) => x !== c && x.classList.add('gone')); S('fanfare');
      setTimeout(() => { close(); h.onDone?.(); }, reduce ? 0 : 650);
    });
    L.querySelector('#cr-skip').onclick = () => { if (taken) return; taken = true; S('coin'); h.onSkip?.(); close(); h.onDone?.(); };
    S('chest');
  }

  // ---------------------------------------------------------------- origin + stake picker (new run)
  function originPick(meta, { onStart, onBack }) {
    let origin = 'banneret', stake = 1, fac = 'haven';
    const L = open('cr-origin', '');
    const render = () => {
      const facs = Object.keys(FACTIONS), maxStake = meta.unlocks.stakes[fac] || 1;
      L.innerHTML = `<div class="cr-originwrap"><header><span>${icon('victory', 40)}</span><div><small>Crown Run · ${C.TUNE.mvpAntes} Antes</small><h2>Choose your origin</h2></div><span class="cr-glory">${icon('experience', 18)} ${meta.glory} Glory</span></header>
        <div class="cr-facs">${facs.map((f) => { const ok = meta.unlocks.factions.includes(f); return `<button class="cr-fac${f === fac ? ' on' : ''}${ok ? '' : ' locked'}" data-f="${f}" style="--fc:${FACTIONS[f].css}" ${ok ? '' : 'aria-disabled="true"'}>${unitIcon(FACTIONS[f].units[0], 48)}<b>${FACTIONS[f].name}</b>${ok ? '' : `<small>${icon('lock', 12)} ${C.FAC_UNLOCK[f].text}</small>`}</button>`; }).join('')}</div>
        <div class="cr-row cr-origins">${Object.values(C.ORIGINS).map((o) => { const ok = meta.unlocks.origins.includes(o.id) && (!o.fac || meta.unlocks.factions.includes(o.fac)); return `<button class="cr-card r-origin${o.id === origin ? ' on' : ''}${ok ? '' : ' locked'}" data-o="${o.id}"><div class="cr-in"><div class="cr-face"><span class="cr-art">${icon(ok ? o.icon : 'lock', 46)}</span><b class="cr-name">${o.name}</b><p class="cr-txt">${ok ? o.text : o.unlock}</p></div></div></button>`; }).join('')}</div>
        <div class="cr-stakes">${C.STAKES.slice(1).map((s, i) => `<button class="cr-stake${i + 1 === stake ? ' on' : ''}${i + 1 > maxStake ? ' locked' : ''}" data-s="${i + 1}" style="--sc:${s.col}" title="${esc(s.text)}"><i></i><small>${s.name}</small></button>`).join('')}<p>${esc(C.STAKES[stake].text)}</p></div>
        <footer><button class="btn ghost" id="cr-back">Back</button><button class="btn gold" id="cr-go">${icon('attack', 20)} Begin the run</button></footer></div>`;
      L.querySelectorAll('[data-f]').forEach((b) => b.onclick = () => { if (!meta.unlocks.factions.includes(b.dataset.f)) { S('deny'); replayCls(b, 'shake'); return; } fac = b.dataset.f; if (C.ORIGINS[origin].fac && C.ORIGINS[origin].fac !== fac) origin = 'banneret'; stake = Math.min(stake, meta.unlocks.stakes[fac] || 1); S('click'); render(); });
      L.querySelectorAll('[data-o]').forEach((b) => b.onclick = () => { const o = C.ORIGINS[b.dataset.o]; if (b.classList.contains('locked')) { S('deny'); replayCls(b, 'shake'); return; } origin = o.id; if (o.fac) fac = o.fac; S('select'); render(); });
      L.querySelectorAll('[data-s]').forEach((b) => b.onclick = () => { if (+b.dataset.s > maxStake) { S('deny'); replayCls(b, 'shake'); return; } stake = +b.dataset.s; S('click'); render(); });
      L.querySelector('#cr-back').onclick = () => { S('close'); close(); onBack?.(); };
      L.querySelector('#cr-go').onclick = () => { S('confirm'); close(true); onStart({ origin, stake, fac }); };
    };
    render(); S('open');
  }

  // ---------------------------------------------------------------- end of run: score tally, Glory, unlocks
  async function endScreen(run, res, meta, { onNew, onCollection, onTitle }) {
    const won = run.won, boss = C.BOSSES[run.bosses[run.ante - 1]];
    const L = open('cr-end', `<div class="cr-panel ornate ${won ? 'win' : 'lose'}"><div class="cr-cols">
      <div class="cr-crest"><span class="cr-rays"></span>${icon(won ? 'victory' : 'defeat', 96)}<h2>${won ? 'Crowned!' : 'The run ends'}</h2><small>${won ? `All ${run.antes} Antes cleared` : `Ante ${run.ante} · ${C.BLIND_NAME[C.BLINDS[run.blind]]}${run.blind === 2 ? ` (${boss.name})` : ''}`}</small>
        <div class="cr-stats"><span><b>${run.stats.bestHit}</b><small>Best strike</small></span><span><b>${run.stats.stacksKilled}</b><small>Stacks slain</small></span><span><b>${run.stats.raised}</b><small>Raised</small></span><span><b>${run.stats.blindsWon}</b><small>Blinds</small></span></div></div>
      <div class="cr-side"><ul class="cr-score" id="cr-score"></ul>
        <div class="cr-sum"><span><small>Score</small><b id="cr-sc">0</b>${res.best ? '<em class="cr-best">New best!</em>' : ''}</span><span><small>Glory</small><b id="cr-gl">+0</b></span></div>
        <div class="cr-unlocks" id="cr-unl"></div>
        <div class="cr-endbtns"><button class="btn gold" id="cr-new">New run</button><button class="btn" id="cr-col">Collection</button><button class="btn ghost" id="cr-title">Title</button></div></div></div>
      <div class="cr-finalbar">${run.banners.map((b) => cardHTML({ kind: 'banner', ...b }, { cls: 'mini' })).join('')}</div></div>`);
    L.querySelector('#cr-new').onclick = () => { S('confirm'); close(); onNew(); };
    L.querySelector('#cr-col').onclick = () => { S('click'); close(true); onCollection(); };
    L.querySelector('#cr-title').onclick = () => { S('close'); close(); onTitle(); };
    S(won ? 'victory' : 'defeat');
    const ul = L.querySelector('#cr-score');
    await wait(500);
    for (const r of res.rows) { const li = el('li', 'pop', `<span>${esc(r.label)}</span><b>0</b>`); ul.appendChild(li); await tick(li.querySelector('b'), 0, r.n, 520); await wait(120); }
    if (res.mult !== 1) { const li = el('li', 'pop mult', `<span>Stake ${C.STAKES[run.stake].name}</span><b>×${res.mult}</b>`); ul.appendChild(li); S('luck'); await wait(300); }
    await tick(L.querySelector('#cr-sc'), 0, res.score, 900); replayCls(L.querySelector('#cr-sc'), 'bump'); S('fanfare');
    await wait(250);
    const gl = L.querySelector('#cr-gl'); await tick({ set textContent(v) { gl.textContent = `+${v}`; } }, 0, res.glory, 700);
    const unl = L.querySelector('#cr-unl');
    const items = [...res.unlocks.map((u) => ({ t: u.kind === 'faction' ? `${FACTIONS[u.id].name} unlocked!` : u.kind === 'origin' ? `Origin: ${u.name}` : u.name, ic: u.kind === 'faction' ? null : u.kind === 'origin' ? C.ORIGINS[u.id].icon : 'victory', unit: u.kind === 'faction' ? FACTIONS[u.id].units[6] : null, cls: u.kind })), ...res.trophies.map((t) => ({ t: `Trophy: ${C.TROPHIES[t].name}`, ic: C.TROPHIES[t].icon, cls: 'trophy' }))];
    for (const it of items) {
      await wait(350);
      const c = el('div', `cr-unl back u-${it.cls}`, `<div class="cr-in"><div class="cr-face">${it.unit ? unitIcon(it.unit, 64) : icon(it.ic, 44)}<b>${esc(it.t)}</b></div><div class="cr-back">${icon('lock', 34)}</div></div>`);
      unl.appendChild(c); await wait(60); c.classList.remove('back'); c.classList.add('flipped', 'shine'); S(it.cls === 'faction' ? 'fanfare' : 'artifact');
    }
  }

  // ---------------------------------------------------------------- the Collection (+ Glory perks, trophies)
  function collection(meta, { onClose }) {
    let tab = 'banners';
    const L = open('cr-coll', '');
    const render = () => {
      const c = meta.collection;
      let grid = '';
      if (tab === 'banners') grid = Object.values(C.BANNERS).map((b) => { const seen = c.seen[b.id] || c.banners[b.id]; return seen ? cardHTML({ kind: 'banner', id: b.id }, { cls: 'coll', price: null }).replace('</div></div>', `</div></div>${c.banners[b.id] ? `<em class="cr-owned">×${c.banners[b.id]}</em>` : ''}`) : `<div class="cr-card coll unknown r-${b.rarity}"><div class="cr-in"><div class="cr-face"><span class="cr-art">${icon('banner', 46)}</span><b class="cr-name">???</b><p class="cr-txt">${C.RARITY[b.rarity].name}</p></div></div></div>`; }).join('');
      if (tab === 'bosses') grid = Object.values(C.BOSSES).map((b) => c.bosses[b.id] ? `<div class="cr-card coll r-boss"><div class="cr-in"><div class="cr-face"><span class="cr-art">${icon(b.icon, 50)}</span><b class="cr-name">${b.name}</b><p class="cr-txt">${esc(b.text)}</p></div></div></div>` : `<div class="cr-card coll unknown r-boss"><div class="cr-in"><div class="cr-face"><span class="cr-art">${icon('defeat', 46)}</span><b class="cr-name">???</b><p class="cr-txt">Beat it to learn its rule.</p></div></div></div>`).join('');
      if (tab === 'units') grid = Object.keys(UNITS).filter((u) => !UNITS[u].up).map((u) => `<div class="cr-unit${c.units[u] ? '' : ' unknown'}">${unitIcon(u, 56)}<small>${c.units[u] ? UNITS[u].name : '???'}</small></div>`).join('');
      if (tab === 'perks') grid = Object.entries(C.PERKS).map(([id, p]) => { const lv = meta.perks[id] || 0; return `<button class="cr-card coll r-perk" data-p="${id}"><div class="cr-in"><div class="cr-face"><span class="cr-art">${icon(p.icon, 46)}</span><b class="cr-name">${p.name} ${lv}/${p.max}</b><p class="cr-txt">${p.text}</p></div></div><span class="cr-price${meta.glory < p.cost || lv >= p.max ? ' poor' : ''}">${lv >= p.max ? 'Max' : `${icon('experience', 14)}${p.cost}`}</span></button>`; }).join('') +
        Object.entries(C.TROPHIES).map(([id, t]) => `<div class="cr-card coll r-trophy${meta.trophies.includes(id) ? '' : ' unknown'}"><div class="cr-in"><div class="cr-face"><span class="cr-art">${icon(t.icon, 42)}</span><b class="cr-name">${t.name}</b><p class="cr-txt">${t.text}</p></div></div></div>`).join('');
      const n = C.discoveredCount(meta), tot = Object.keys(C.BANNERS).length + Object.keys(C.BOSSES).length + Object.keys(UNITS).filter((u) => !UNITS[u].up).length;
      L.innerHTML = `<div class="cr-collwrap"><header><h2>Collection</h2><small>${n}/${tot} discovered · best score ${meta.best.score} · ${meta.runs} runs, ${meta.wins} won</small><span class="cr-glory">${icon('experience', 18)} ${meta.glory} Glory</span><button class="x" id="cr-x" aria-label="Close">${icon('close', 18)}</button></header>
        <nav class="tabs2">${[['banners', 'banner', 'Banners'], ['bosses', 'defeat', 'Bosses'], ['units', 'army', 'Units'], ['perks', 'experience', 'Glory']].map(([k, ic, t]) => `<button data-t="${k}" class="${k === tab ? 'on' : ''}">${icon(ic, 18)}${t}</button>`).join('')}</nav>
        <div class="cr-grid g-${tab}">${grid}</div></div>`;
      L.querySelectorAll('[data-t]').forEach((b) => b.onclick = () => { tab = b.dataset.t; S('tab'); render(); });
      L.querySelectorAll('[data-p]').forEach((b) => b.onclick = () => { if (C.buyPerk(meta, b.dataset.p)) { S('fanfare'); onChange('meta'); render(); } else { S('deny'); replayCls(b, 'shake'); } });
      L.querySelector('#cr-x').onclick = () => { S('close'); close(); onClose?.(); };
    };
    render(); S('open');
  }

  return { mountHud, renderHud, bossPreview, blindIntro, shop, pack, originPick, endScreen, collection, close, isOpen, cardHTML, hideTip };
}
