// =====================================================================
// ORBIS · Crown Run screens (agent "crown"): the equipment button, region key and invasion warning in the HUD,
// the hero's paper doll (equipment slots, backpack, artifact sets), choices at map sites (Pandora's Box,
// Treasure Chest, Witch Hut, Scholar, Shrine, spoils of war), the Artifact Merchant and Black Market, the Trading
// Post, the Seer's Hut, Legendary Heroes and invasions, the hero picker, the end of the run and the Collection.
// DOM only: main.js passes in what it owns (icons, unit portraits, hero portrait, sound) and applies the effects.
// Landscape first, with a portrait fallback in style.css ("crown" block).
// =====================================================================
import * as C from './crown.js?v=2.7';
import { UNITS, SPELLS, SKILLS, FACTIONS } from './data.js?v=2.7';
import { landscape } from './vport.js?v=2.7';
import { artIcon } from './icons.js'; // icons: painted art per artifact / skill / Legendary Hero / background / set / crest // fullscreen: the game frame's orientation (it may be turned on a portrait screen)

export function createCrownUI({ icon, unitIcon, sfx = {}, onChange = () => {}, facCrest = null }) {
  // the faction crests of the title / Free Play setup (main.js FAC_CREST); the same fallback here for the dev harness
  const CREST = { haven: 'defense', necro: 'necromancy', sylvan: 'luck', inferno: 'fireball', dungeon: 'sorcery' };
  const crestOf = (f) => (facCrest && facCrest(f)) || CREST[f] || 'banner';
  const S = (n, o) => { try { sfx[n]?.(o); } catch { /* sound is optional */ } };
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const gold = (n) => `<span class="cr-g">${icon('gold', 15)}<b>${fmt(n)}</b></span>`;
  function tick(node, from, to, ms = 600, sound = true) {
    return new Promise((res) => {
      if (reduce || from === to) { node.textContent = fmt(to); res(); return; }
      const t0 = performance.now(); let last = from;
      const f = (now) => {
        const u = Math.max(0, Math.min(1, (now - t0) / ms)), v = Math.round(from + (to - from) * (1 - (1 - u) ** 3));
        if (v !== last) { node.textContent = fmt(v); last = v; if (sound) S('tab', { vol: 0.25, pitch: 1.2 + u * 0.6 }); }
        if (u < 1) requestAnimationFrame(f); else res();
      };
      requestAnimationFrame(f);
    });
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, reduce ? 0 : ms));
  function replayCls(node, cls) { if (!node) return; node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); }

  // ---------------------------------------------------------------- cards (artifacts and choices)
  function artText(inst) { const A = C.ARTIFACTS[inst.id || inst]; return A.text + (A.grows && inst.n ? ` (now ${inst.n})` : ''); }
  function setLine(id) { const A = C.ARTIFACTS[id]; if (!A.set) return ''; const St = C.SETS[A.set]; return `<small class="cr-set">${artIcon('set', A.set, 12, St.icon)} ${St.name}</small>`; }
  function cardHTML(item, o = {}) {
    const k = item.kind;
    let rar = 'treasure', name = '', body = '', art = '', tag = '', foot = '';
    if (k === 'artifact') { const A = C.ARTIFACTS[item.id]; rar = A.rarity; name = A.name; art = artIcon('artifact', item.id, 52, A.icon); tag = C.SLOT_NAME[A.slot] || A.slot; body = esc(artText(item)); foot = `${setLine(item.id)}<small class="cr-rar">${C.RARITY[rar].name} artifact</small>`; }
    else if (k === 'gold') { rar = 'gold'; name = `${fmt(item.n)} gold`; art = icon('gold', 56); tag = 'Gold'; body = 'Into your treasury.'; }
    else if (k === 'xp') { rar = 'xp'; name = `${fmt(item.n)} experience`; art = icon('experience', 56); tag = 'Wisdom'; body = 'Your hero grows wiser.'; }
    else if (k === 'spell') { const Sp = SPELLS[item.id]; rar = 'spell'; name = Sp.name; art = icon(item.id, 52); tag = `Circle ${Sp.circle}`; body = `${Sp.desc} Learnt for good.`; }
    else if (k === 'skill') { const Sk = SKILLS[item.id]; rar = 'skill'; name = `${Sk.name} ${['', 'I', 'II', 'III'][item.lvl] || ''}`; art = artIcon('skill', item.id, 52); tag = 'Skill'; body = Sk.desc; }
    else if (k === 'stat') { rar = 'skill'; const nm = { att: 'Attack', def: 'Defence', pow: 'Power', know: 'Knowledge' }[item.id]; name = `+${item.n} ${nm}`; art = icon(item.id, 52); tag = 'Lesson'; body = `The scholar teaches your hero +${item.n} ${nm}.`; }
    else if (k === 'troops') { const U = UNITS[item.id]; rar = 'unit'; name = `${item.n} ${U.name}`; art = `<span class="cr-pt">${unitIcon(item.id, 64)}</span>`; tag = `Tier ${U.tier}`; body = `${icon('attack', 13)}${U.att} ${icon('defense', 13)}${U.def} ${icon('hp', 13)}${U.hp}${U.ranged ? ` ${icon('shots', 13)}` : ''}${U.fly ? ` ${icon('fly', 13)}` : ''}<br>They join your army.`; }
    const price = o.price != null ? `<span class="cr-price${o.poor ? ' poor' : ''}">${icon('gold', 14)}${fmt(o.price)}</span>` : '';
    return `<div class="cr-card r-${rar}${o.sold ? ' sold' : ''}${o.back ? ' back' : ''} ${o.cls || ''}" ${o.attrs || ''}>
      <div class="cr-in"><div class="cr-face"><span class="cr-tag">${tag}</span><span class="cr-art">${art}</span><b class="cr-name">${esc(name)}</b><p class="cr-txt">${body}</p>${foot}</div>
      <div class="cr-back"><span>${icon(o.backIcon || 'chest', 44)}</span></div></div>${price}</div>`;
  }

  // ---------------------------------------------------------------- HUD: equipment, region key, invasion warning
  let hud = null;
  function mountHud(parent) {
    if (hud && hud.isConnected) return hud;
    hud = el('div', ''); hud.id = 'crown-hud';
    hud.innerHTML = '<button class="cr-eq" id="cr-eq" aria-label="Equipment"></button><button class="cr-pill k-region" id="cr-reg"></button><button class="cr-pill k-inv" id="cr-inv" hidden></button>';
    parent.appendChild(hud);
    return hud;
  }
  // landscape (agent "landscape"): the chips are icons down the left edge; the first tap expands one (its label slides
  // out, collapsing again after 4 s), a tap on the expanded chip opens it. Portrait shows the labels and acts at once.
  let openT = 0;
  const compact = () => landscape();
  function tapChip(node, act) {
    S('click');
    if (compact() && !node.classList.contains('open')) {
      for (const c of hud.querySelectorAll('.open')) c.classList.remove('open');
      node.classList.add('open'); clearTimeout(openT); openT = setTimeout(() => node.classList.remove('open'), 4000);
      return;
    }
    node.classList.remove('open'); act?.();
  }
  // h: { day, invasion: { dir, days, week } | null, onEquip, onRegion, onInvasion }
  function renderHud(run, h = {}) {
    if (!hud) return;
    hud.hidden = !run; if (!run) return;
    const n = C.equippedIds(run).length, sets = C.activeSets(run);
    const eq = `<span class="cr-sig">${icon('artifact', 24)}</span><span class="cr-pt2"><small>Equipment</small><b>${n} worn${run.backpack.length ? ` · ${run.backpack.length} packed` : ''}</b></span>${sets.length ? `<em class="cr-setglow" title="${esc(sets.map((s) => s.name).join(', '))}">${icon(sets[0].icon, 14)}</em>` : ''}`;
    const E = hud.querySelector('#cr-eq'); if (E.__h !== eq) { E.innerHTML = eq; E.__h = eq; E.classList.toggle('set', !!sets.length); }
    E.onclick = () => tapChip(E, h.onEquip);
    const G = C.GUARDIANS[run.guardians[run.region - 1]];
    const R = hud.querySelector('#cr-reg');
    const rg = `<span class="cr-sig">${icon('lock', 20)}</span><span class="cr-pt2"><small>Region ${run.region}/${run.regions}${run.keys.length ? ` · ${run.keys.length} key${run.keys.length > 1 ? 's' : ''}` : ''}</small><b>${run.region >= run.regions ? 'The Crown' : 'Key'}: ${esc(G.name.split(',')[0])}</b></span>`;
    if (R.__h !== rg) { R.innerHTML = rg; R.__h = rg; }
    R.onclick = () => tapChip(R, h.onRegion);
    const I = hud.querySelector('#cr-inv'), inv = h.invasion;
    I.hidden = !inv;
    if (inv) {
      const t = inv.days <= 0 ? 'At your walls tonight!' : inv.days === 1 ? 'Arrives tomorrow night' : `${inv.days} days away`;
      const ih = `<span class="cr-sig">${icon('attack', 22)}</span><span class="cr-pt2"><small>Invasion from the ${inv.dir}</small><b>${t}</b></span>`;
      if (I.__h !== ih) { I.innerHTML = ih; I.__h = ih; }
      I.className = `cr-pill k-inv${inv.days <= 1 ? ' due' : ' soon'}${I.classList.contains('open') ? ' open' : ''}`;
      I.onclick = () => tapChip(I, h.onInvasion);
    }
  }

  // ---------------------------------------------------------------- full-screen layer
  let layer = null;
  function open(cls, html) {
    close(true);
    layer = el('div', `crown-layer ${cls}`, html); layer.id = 'crown-layer';
    document.body.appendChild(layer);
    return layer;
  }
  function close(now = false) {
    const L = layer; layer = null; if (!L) return;
    if (now || reduce) { L.remove(); return; }
    L.classList.add('closing'); setTimeout(() => L.remove(), 220);
  }
  const isOpen = () => !!layer;
  function flash(L, msg) { const f = el('div', 'cr-flash', esc(msg)); L.appendChild(f); setTimeout(() => f.remove(), 2200); }

  // ---------------------------------------------------------------- the paper doll: equipment slots + backpack
  // h: { heroName, heroPic, heroStats: { att, def, pow, know }, onClose, extra: (inst, where) -> [label, fn] (e.g. sell at a merchant) }
  function paperDoll(run, h = {}) {
    let sel = null; // { where: 'slot'|'pack', key }
    const L = open('cr-doll', '');
    const render = () => {
      const st = C.heroStats(run), hs = h.heroStats || {};
      const slot = (s) => { const inst = run.equip[s], A = inst && C.ARTIFACTS[inst.id], locked = run.locked.includes(s), on = sel?.where === 'slot' && sel.key === s;
        return `<button class="cr-slot2 s-${s}${A ? ` r-${A.rarity}` : ''}${locked ? ' locked' : ''}${on ? ' on' : ''}" data-s="${s}" style="grid-area:${s}" ${locked ? 'disabled' : ''}>${A ? artIcon('artifact', A.id, 30, A.icon) : `<i>${icon(locked ? 'lock' : 'artifact', 18)}</i>`}<small>${A ? esc(A.name) : C.SLOT_NAME[s]}</small>${A?.set ? '<em class="cr-pip"></em>' : ''}</button>`; };
      const sets = C.setProgress(run).filter((p) => p.have > 0);
      const cur = sel && (sel.where === 'slot' ? run.equip[sel.key] : run.backpack[sel.key]);
      const A = cur && C.ARTIFACTS[cur.id];
      let detail = '<p class="cr-hint">Tap an artifact to see what it does. Artifacts in the backpack do nothing until worn.</p>';
      if (A) {
        const btns = [];
        if (sel.where === 'slot') btns.push(`<button class="btn ghost" data-act="off">Unequip</button>`);
        else if (C.slotsFor(run, cur.id).length) btns.push(`<button class="btn gold" data-act="on">Equip (${C.SLOT_NAME[A.slot] || A.slot})</button>`);
        const ex = h.extra?.(cur, sel); if (ex) btns.push(`<button class="btn" data-act="extra">${ex[0]}</button>`);
        detail = `<div class="cr-det r-${A.rarity}"><b>${artIcon('artifact', A.id, 22, A.icon)} ${esc(A.name)}</b><small>${C.RARITY[A.rarity].name} · ${C.SLOT_NAME[A.slot] || A.slot}${A.set ? ` · ${C.SETS[A.set].name}` : ''}</small><p>${esc(artText(cur))}</p><div class="cr-detb">${btns.join('')}</div></div>`;
      }
      L.innerHTML = `<div class="cr-dollwrap"><header><h2>${esc(h.heroName || 'Your hero')}</h2><small>Equipment</small>${h.onSheet ? `<button class="btn ghost cr-sheet" id="cr-sheet">${icon('hero', 18)} Skills &amp; army</button>` : ''}<button class="x" id="cr-x" aria-label="Close">${icon('close', 18)}</button></header>
        <div class="cr-dollcols"><div class="cr-doll-grid">${C.SLOTS.map(slot).join('')}<div class="cr-hero" style="grid-area:hero">${h.heroPic || icon('hero', 96)}<div class="cr-hst"><span>${icon('attack', 15)}${(hs.att || 0) + st.att}</span><span>${icon('defense', 15)}${(hs.def || 0) + st.def}</span><span>${icon('power', 15)}${(hs.pow || 0) + st.pow}</span><span>${icon('knowledge', 15)}${hs.know || 0}</span>${st.luck ? `<span>${icon('luck', 15)}+${st.luck}</span>` : ''}${st.morale ? `<span>${icon('morale', 15)}+${st.morale}</span>` : ''}</div></div></div>
        <div class="cr-dollside">${detail}
          <div class="cr-sets">${sets.length ? sets.map((p) => `<div class="cr-setrow${p.active ? ' on' : ''}"><b>${artIcon('set', p.set.id, 16, p.set.icon)} ${p.set.name} <em>${p.have}/${p.need}</em></b><small>${esc(p.set.text)}</small><span>${p.set.pieces.map((id) => `<i class="${C.equippedIds(run).includes(id) ? 'have' : ''}" title="${esc(C.ARTIFACTS[id].name)}">${artIcon('artifact', id, 16, C.ARTIFACTS[id].icon)}</i>`).join('')}</span></div>`).join('') : '<p class="cr-hint">Wear every piece of an artifact set to unlock its bonus.</p>'}</div>
          <h3>${icon('chest', 16)} Backpack</h3><div class="cr-pack">${run.backpack.length ? run.backpack.map((b, i) => { const B = C.ARTIFACTS[b.id]; return `<button class="cr-slot2 r-${B.rarity}${sel?.where === 'pack' && sel.key === i ? ' on' : ''}" data-b="${i}">${artIcon('artifact', b.id, 26, B.icon)}<small>${esc(B.name)}</small></button>`; }).join('') : '<p class="cr-hint">Empty.</p>'}</div></div></div></div>`;
      L.querySelectorAll('[data-s]').forEach((b) => b.onclick = () => { if (!run.equip[b.dataset.s]) { sel = null; render(); return; } sel = { where: 'slot', key: b.dataset.s }; S('select'); render(); });
      L.querySelectorAll('[data-b]').forEach((b) => b.onclick = () => { sel = { where: 'pack', key: +b.dataset.b }; S('select'); render(); });
      const act = (a) => L.querySelector(`[data-act="${a}"]`);
      act('off') && (act('off').onclick = () => { C.unequip(run, sel.key); sel = { where: 'pack', key: run.backpack.length - 1 }; S('close'); onChange(); render(); });
      act('on') && (act('on').onclick = () => { const was = C.activeSets(run).length; const s = C.equip(run, sel.key); sel = s ? { where: 'slot', key: s } : null; S('artifact'); onChange(); render(); if (C.activeSets(run).length > was) { replayCls(L.querySelector('.cr-setrow.on'), 'shine'); S('fanfare'); flash(L, `Set complete: ${C.activeSets(run).slice(-1)[0].name}!`); } });
      act('extra') && (act('extra').onclick = () => { if (h.extra(cur, sel)?.[1]()) { sel = null; onChange(); render(); } });
      L.querySelector('#cr-x').onclick = () => { S('close'); close(); h.onClose?.(); };
      if (h.onSheet) L.querySelector('#cr-sheet').onclick = () => { S('click'); close(true); h.onSheet(); };
    };
    render(); S('open');
    return { refresh: render };
  }

  // ---------------------------------------------------------------- a site with a choice: pick 1 of N
  // h: { title, sub, icon, choices, onPick(choice) -> bool, onDone, leave: label | null }
  function choice(h) {
    const L = open('cr-choice', `<div class="cr-packwrap"><header><span class="cr-pk">${h.site ? artIcon('site', h.site, 40, h.icon || 'chest') : icon(h.icon || 'chest', 40)}</span><div><h2>${esc(h.title)}</h2><small>${h.sub || 'Choose one. Tap a card to look, tap it again to take it.'}</small></div></header>
      <div class="cr-row" id="cr-pick">${h.choices.map((c, i) => cardHTML(c, { back: true, backIcon: h.icon, attrs: `data-i="${i}"` })).join('')}</div>
      ${h.leave === null ? '' : `<footer><button class="btn ghost" id="cr-skip">${h.leave || 'Leave'}</button></footer>`}</div>`);
    const cards = [...L.querySelectorAll('#cr-pick .cr-card')];
    cards.forEach((c, i) => setTimeout(() => { c.classList.remove('back'); c.classList.add('flipped'); S('tab', { pitch: 1 + i * 0.15 }); if (/r-(major|relic)/.test(c.className)) { c.classList.add('shine'); S('artifact'); } }, reduce ? 0 : 380 + i * 240));
    let taken = false, up = null;
    L.querySelector('#cr-pick').addEventListener('click', (e) => {
      const c = e.target.closest('.cr-card'); if (!c || taken || c.classList.contains('back')) return;
      if (up !== c) { cards.forEach((x) => x.classList.toggle('up', x === c)); up = c; S('select'); return; }
      if (!h.onPick(h.choices[+c.dataset.i])) { S('deny'); replayCls(c, 'shake'); return; }
      taken = true; c.classList.add('taken'); cards.forEach((x) => x !== c && x.classList.add('gone')); S('fanfare');
      setTimeout(() => { close(); h.onDone?.(); }, reduce ? 0 : 650);
    });
    const sk = L.querySelector('#cr-skip'); if (sk) sk.onclick = () => { if (taken) return; taken = true; S('close'); close(); h.onDone?.(); };
    S('chest');
  }

  // ---------------------------------------------------------------- Artifact Merchant / Black Market
  // h: { title, black, stock, gold: () => n, onBuy(item) -> bool, sellList: () => [{inst, where, price}], onSell(entry) -> bool, onClose }
  function merchant(run, h) {
    const L = open('cr-merchant', '');
    let tab = 'buy';
    const render = () => {
      const g = h.gold(), sells = h.sellList();
      L.innerHTML = `<div class="cr-shopwrap2"><header><span class="cr-pk ${h.black ? 'pk-black' : ''}">${artIcon('site', h.black ? 'blackmarket' : 'merchant', 40, h.black ? 'tavern' : 'market')}</span><div><h2>${esc(h.title)}</h2><small>${h.black ? 'Rare goods, no questions asked. The stock changes every week.' : 'Artifacts bought and sold. New stock every week.'}</small></div><span class="cr-wallet2">${gold(g)}</span><button class="x" id="cr-x" aria-label="Close">${icon('close', 18)}</button></header>
        <nav class="tabs2"><button data-t="buy" class="${tab === 'buy' ? 'on' : ''}">${icon('gold', 18)}Buy</button><button data-t="sell" class="${tab === 'sell' ? 'on' : ''}">${icon('artifact', 18)}Sell</button></nav>
        <div class="cr-row" id="cr-cards">${tab === 'buy' ? (h.stock.length ? h.stock.map((it, i) => cardHTML(it, { price: it.price, sold: it.sold, poor: g < it.price, cls: 'deal', attrs: `data-i="${i}"` })).join('') : '<p class="cr-hint">Sold out until next week.</p>')
          : (sells.length ? sells.map((e, i) => cardHTML({ kind: 'artifact', id: e.inst.id, n: e.inst.n }, { price: e.price, cls: 'deal sellc', attrs: `data-i="${i}"` })).join('') : '<p class="cr-hint">Nothing to sell: your backpack is empty.</p>')}</div>
        <p class="cr-hint">${tab === 'buy' ? 'Tap a card to look, tap it again to buy.' : 'Only artifacts in your backpack can be sold. Tap twice to sell for half their worth.'}</p></div>`;
      L.querySelectorAll('[data-t]').forEach((b) => b.onclick = () => { tab = b.dataset.t; S('tab'); render(); });
      let up = null;
      L.querySelector('#cr-cards').onclick = (e) => {
        const c = e.target.closest('.cr-card'); if (!c || c.classList.contains('sold')) return;
        if (up !== c) { L.querySelectorAll('.cr-card.up').forEach((x) => x.classList.remove('up')); c.classList.add('up'); up = c; S('select'); return; }
        const i = +c.dataset.i;
        if (tab === 'buy') { const it = h.stock[i]; if (h.gold() < it.price) { S('deny'); replayCls(c, 'shake'); return; } if (h.onBuy(it)) { it.sold = true; S('coin'); c.classList.add('bought'); setTimeout(render, 380); } else { S('deny'); replayCls(c, 'shake'); } }
        else if (h.onSell(sells[i])) { S('coin'); c.classList.add('bought'); setTimeout(render, 380); }
      };
      L.querySelector('#cr-x').onclick = () => { S('close'); close(); h.onClose?.(); };
    };
    render(); S('open');
  }
  // ---------------------------------------------------------------- Trading Post (resources for gold, fixed rates)
  // h: { res: () => ({gold, wood, ore, gems}), trade(res, dir) -> bool, onClose }
  function tradingPost(h) {
    const L = open('cr-trade', '');
    const render = () => {
      const r = h.res();
      L.innerHTML = `<div class="cr-panel ornate"><div class="cr-tradewrap"><header><span class="cr-pk">${artIcon('site', 'tradingpost', 40, 'market')}</span><div><h2>Trading Post</h2><small>Caravans buy and sell at fixed rates.</small></div><span class="cr-wallet2">${gold(r.gold)}</span></header>
        <div class="cr-trades">${Object.entries(C.TRADE).map(([k, t]) => `<div class="cr-trow"><span>${icon(k, 30)}<b>${r[k]}</b></span><button class="btn" data-k="${k}" data-d="buy" ${r.gold < t.buy ? 'disabled' : ''}>Buy 1 <small>${fmt(t.buy)}</small></button><button class="btn ghost" data-k="${k}" data-d="sell" ${r[k] < 1 ? 'disabled' : ''}>Sell 1 <small>${fmt(t.sell)}</small></button></div>`).join('')}</div>
        <button class="btn gold" id="cr-ok">Done</button></div></div>`;
      L.querySelectorAll('[data-k]').forEach((b) => b.onclick = () => { if (h.trade(b.dataset.k, b.dataset.d)) { S('coin'); render(); } else S('deny'); });
      L.querySelector('#cr-ok').onclick = () => { S('close'); close(); h.onClose?.(); };
    };
    render(); S('open');
  }
  // ---------------------------------------------------------------- a notice card: Seer's Hut, Keymaster, Border Guard, Grail…
  // h: { icon, title, sub, body, cls, card (artifact item) , buttons: [[label, fn, cls]] }
  function notice(h) {
    const L = open('cr-notice', `<div class="cr-panel ornate ${h.cls || ''}"><div class="cr-cols">
      <div class="cr-crest"><span class="cr-rays"></span>${h.crest || icon(h.icon || 'artifact', 92)}<h2>${esc(h.title)}</h2>${h.sub ? `<small>${h.sub}</small>` : ''}</div>
      <div class="cr-side">${h.body || ''}${h.card ? `<div class="cr-row">${cardHTML(h.card, { cls: 'flip-in shine' })}</div>` : ''}<div class="cr-endbtns">${(h.buttons || [['OK', null, 'gold']]).map(([t, , c], i) => `<button class="btn ${c || ''}" data-i="${i}">${t}</button>`).join('')}</div></div></div></div>`);
    setTimeout(() => L.querySelector('.flip-in')?.classList.remove('flip-in'), 60);
    L.querySelectorAll('[data-i]').forEach((b) => b.onclick = () => { const f = (h.buttons || [['OK', null]])[+b.dataset.i][1]; S('click'); close(); f?.(); });
    S(h.sound || 'open');
  }
  // the Legendary Hero of a region (tap the region pill, or meet him at the Keymaster's Tent)
  function guardianCard(run, region, army, { onFight = null, onClose = null } = {}) {
    const id = run.guardians[region - 1], Gd = C.GUARDIANS[id];
    const rules = [Gd.rule]; if (run.diff >= 7 && run.secondRule?.[id]) rules.push(C.GUARDIANS[run.secondRule[id]].rule);
    notice({ crest: artIcon('guardian', Gd.id, 92, Gd.icon), title: Gd.name, sub: `${Gd.title} · Legendary Hero of region ${region}`, cls: 'k-guardian',
      body: `<p class="cr-rule"><em>Specialty</em>${rules.map(esc).join('<br>')}</p>${Gd.unlocks ? `<p class="cr-unl">${icon('lock', 16)} Defeat her to unlock <b>${FACTIONS[Gd.unlocks].name}</b></p>` : ''}
        <div class="cr-army"><small>${region >= run.regions ? 'Guards the Crown' : "Guards the Keymaster's Tent"}</small>${army.army.map(([u, n]) => `<span>${unitIcon(u, 48)}<em>${n}</em></span>`).join('')}</div>`,
      buttons: onFight ? [[`${icon('attack', 20)} To battle!`, onFight, 'gold'], ['Retreat', onClose, 'ghost']] : [['Got it', onClose, 'gold']], sound: onFight ? 'alarm' : 'open' });
  }
  function invasionCard(run, inv, { days, dir, onFight = null, onFly = null, onClose = null }) {
    notice({ crest: icon('attack', 92), title: `Invasion from the ${dir}`, sub: `Week ${inv.week} · led by ${esc(inv.hero.name)}`, cls: 'k-invasion',
      body: `<p>${onFight ? 'The invaders are upon you. Win, or your crown falls.' : days <= 0 ? 'They reach your capital tonight.' : `They march on your capital: <b>${days} day${days > 1 ? 's' : ''}</b> away. Meet them in the field, or be home to hold the walls: alone, your garrison and the creatures waiting in your dwellings must fight.`}</p>
        <div class="cr-army"><small>Invading army</small>${inv.army.map(([u, n]) => `<span>${unitIcon(u, 48)}<em>${n}</em></span>`).join('')}</div>`,
      buttons: onFight ? [[`${icon('attack', 20)} To battle!`, onFight, 'gold']] : [...(onFly ? [[`${icon('movement', 18)} Show me`, onFly, '']] : []), ['Got it', onClose, 'gold']], sound: 'alarm' });
  }

  // ---------------------------------------------------------------- hero background + difficulty picker (a new run)
  function heroPick(meta, { onStart, onBack, onCollection = null }) {
    let bg = 'knight', diff = 1, fac = 'haven';
    const L = open('cr-origin', '');
    const render = () => {
      const facs = Object.keys(FACTIONS), maxD = meta.unlocks.diffs[fac] || 1;
      L.innerHTML = `<div class="cr-originwrap"><header><span>${icon('victory', 40)}</span><div><small>Crown Run · ${C.TUNE.regions} regions</small><h2>Choose your hero</h2></div><span class="cr-glory">${icon('experience', 18)} ${meta.glory} Glory</span></header>
        <div class="cr-facs">${facs.map((f) => { const ok = meta.unlocks.factions.includes(f); return `<button class="cr-fac${f === fac ? ' on' : ''}${ok ? '' : ' locked'}" data-f="${f}" style="--fc:${FACTIONS[f].css}"><span class="fc-crest mini">${artIcon('faction', f, 18, crestOf(f))}</span><span class="cr-fn"><b>${FACTIONS[f].name}</b>${ok ? '' : `<small>${icon('lock', 12)} ${C.FAC_UNLOCK[f].text}</small>`}</span></button>`; }).join('')}</div>
        <div class="cr-row cr-origins">${Object.values(C.BACKGROUNDS).map((o) => { const ok = meta.unlocks.backgrounds.includes(o.id) && (!o.fac || meta.unlocks.factions.includes(o.fac)); return `<button class="cr-card r-origin${o.id === bg ? ' on' : ''}${ok ? '' : ' locked'}" data-o="${o.id}"><div class="cr-in"><div class="cr-face"><span class="cr-art">${ok ? artIcon('background', o.id, 46, o.icon) : icon('lock', 46)}</span><b class="cr-name">${o.name}</b><p class="cr-txt">${ok ? o.text : o.unlock}</p></div></div></button>`; }).join('')}</div>
        <div class="cr-stakes">${C.DIFFS.slice(1).map((s, i) => `<button class="cr-stake${i + 1 === diff ? ' on' : ''}${i + 1 > maxD ? ' locked' : ''}" data-s="${i + 1}" style="--sc:${s.col}" title="${esc(s.text)}"><i></i><small>${s.name}</small></button>`).join('')}<p>${esc(C.DIFFS[diff].text)}</p></div>
        <footer><button class="btn ghost" id="cr-back">Back</button>${onCollection ? `<button class="btn" id="cr-coll">${icon('chest', 18)} Collection</button>` : ''}<button class="btn gold" id="cr-go">${icon('attack', 20)} Begin the run</button></footer></div>`;
      L.querySelectorAll('[data-f]').forEach((b) => b.onclick = () => { if (!meta.unlocks.factions.includes(b.dataset.f)) { S('deny'); replayCls(b, 'shake'); return; } fac = b.dataset.f; if (C.BACKGROUNDS[bg].fac && C.BACKGROUNDS[bg].fac !== fac) bg = 'knight'; diff = Math.min(diff, meta.unlocks.diffs[fac] || 1); S('click'); render(); });
      L.querySelectorAll('[data-o]').forEach((b) => b.onclick = () => { const o = C.BACKGROUNDS[b.dataset.o]; if (b.classList.contains('locked')) { S('deny'); replayCls(b, 'shake'); return; } bg = o.id; if (o.fac) fac = o.fac; S('select'); render(); });
      L.querySelectorAll('[data-s]').forEach((b) => b.onclick = () => { if (+b.dataset.s > maxD) { S('deny'); replayCls(b, 'shake'); return; } diff = +b.dataset.s; S('click'); render(); });
      L.querySelector('#cr-back').onclick = () => { S('close'); close(); onBack?.(); };
      if (onCollection) L.querySelector('#cr-coll').onclick = () => { S('click'); close(true); onCollection(); };
      L.querySelector('#cr-go').onclick = () => { S('confirm'); close(true); onStart({ background: bg, diff, fac }); };
    };
    render(); S('open');
  }

  // ---------------------------------------------------------------- end of the run: score tally, Glory, unlocks
  async function endScreen(run, res, meta, { onNew, onCollection, onTitle, reason = '' }) {
    const won = run.won;
    const L = open('cr-end', `<div class="cr-panel ornate ${won ? 'win' : 'lose'}"><div class="cr-cols">
      <div class="cr-crest"><span class="cr-rays"></span>${icon(won ? 'victory' : 'defeat', 96)}<h2>${won ? 'Crowned!' : 'The run ends'}</h2><small>${won ? `All ${run.regions} regions conquered` : esc(reason || `In region ${run.region}`)}</small>
        <div class="cr-stats"><span><b>${fmt(run.stats.bestHit)}</b><small>Best strike</small></span><span><b>${run.stats.stacksKilled}</b><small>Stacks slain</small></span><span><b>${run.invasionsBeaten}</b><small>Invasions</small></span><span><b>${run.stats.guardians.length}</b><small>Legends</small></span></div></div>
      <div class="cr-side"><ul class="cr-score" id="cr-score"></ul>
        <div class="cr-sum"><span><small>Score${res.best ? ' <em class="cr-best">New best!</em>' : ''}</small><b id="cr-sc">0</b></span><span><small>Glory</small><b id="cr-gl">+0</b></span></div>
        <div class="cr-unlocks" id="cr-unl"></div>
        <div class="cr-endbtns"><button class="btn gold" id="cr-new">New run</button><button class="btn" id="cr-col">Collection</button><button class="btn ghost" id="cr-title">Title</button></div></div></div></div>`);
    L.querySelector('#cr-new').onclick = () => { S('confirm'); close(); onNew(); };
    L.querySelector('#cr-col').onclick = () => { S('click'); close(true); onCollection(); };
    L.querySelector('#cr-title').onclick = () => { S('close'); close(); onTitle(); };
    S(won ? 'victory' : 'defeat');
    const ul = L.querySelector('#cr-score');
    await wait(500);
    for (const r of res.rows) { if (!r.n && r.k !== 'guardians') continue; const li = el('li', 'pop', `<span>${esc(r.label)}</span><b>0</b>`); ul.appendChild(li); await tick(li.querySelector('b'), 0, r.n, 520); await wait(120); }
    if (res.mult !== 1) { const li = el('li', 'pop mult', `<span>${C.DIFFS[run.diff].name} difficulty</span><b>×${res.mult}</b>`); ul.appendChild(li); S('luck'); await wait(300); }
    await tick(L.querySelector('#cr-sc'), 0, res.score, 900); replayCls(L.querySelector('#cr-sc'), 'bump'); S('fanfare');
    await wait(250);
    const gl = L.querySelector('#cr-gl'); await tick({ set textContent(v) { gl.textContent = `+${v}`; } }, 0, res.glory, 700);
    const unl = L.querySelector('#cr-unl');
    const items = [...res.unlocks.map((u) => ({ t: u.kind === 'faction' ? `${FACTIONS[u.id].name} unlocked!` : u.kind === 'background' ? `Hero: ${u.name}` : u.name, ic: u.kind === 'background' ? C.BACKGROUNDS[u.id].icon : 'victory', unit: u.kind === 'faction' ? FACTIONS[u.id].units[6] : null, cls: u.kind })), ...res.trophies.map((t) => ({ t: `Trophy: ${C.TROPHIES[t].name}`, ic: C.TROPHIES[t].icon, cls: 'trophy' }))];
    for (const it of items) {
      await wait(350);
      const c = el('div', `cr-unl back u-${it.cls}`, `<div class="cr-in"><div class="cr-face">${it.unit ? unitIcon(it.unit, 64) : icon(it.ic, 44)}<b>${esc(it.t)}</b></div><div class="cr-back">${icon('lock', 34)}</div></div>`);
      unl.appendChild(c); await wait(60); c.classList.remove('back'); c.classList.add('flipped', 'shine'); S(it.cls === 'faction' ? 'fanfare' : 'artifact');
    }
  }

  // ---------------------------------------------------------------- the Collection (+ Glory perks, trophies)
  function collection(meta, { onClose }) {
    let tab = 'artifacts';
    const L = open('cr-coll', '');
    const render = () => {
      const c = meta.collection;
      let grid = '';
      if (tab === 'artifacts') grid = Object.values(C.ARTIFACTS).map((a) => { const seen = c.seen[a.id] || c.artifacts[a.id]; return seen ? cardHTML({ kind: 'artifact', id: a.id }, { cls: 'coll' }).replace('</div></div>', `</div></div>${c.artifacts[a.id] ? `<em class="cr-owned">×${c.artifacts[a.id]}</em>` : ''}`) : `<div class="cr-card coll unknown r-${a.rarity}"><div class="cr-in"><div class="cr-face"><span class="cr-art">${icon('artifact', 46)}</span><b class="cr-name">???</b><p class="cr-txt">${C.RARITY[a.rarity].name}</p></div></div></div>`; }).join('');
      if (tab === 'guardians') grid = Object.values(C.GUARDIANS).map((b) => c.guardians[b.id] ? `<div class="cr-card coll r-boss"><div class="cr-in"><div class="cr-face"><span class="cr-art">${artIcon('guardian', b.id, 50, b.icon)}</span><b class="cr-name">${b.name}</b><p class="cr-txt">${esc(b.rule)}</p></div></div></div>` : `<div class="cr-card coll unknown r-boss"><div class="cr-in"><div class="cr-face"><span class="cr-art">${icon('hero', 46)}</span><b class="cr-name">???</b><p class="cr-txt">Meet this Legendary Hero to learn more.</p></div></div></div>`).join('');
      if (tab === 'units') grid = Object.keys(UNITS).filter((u) => !UNITS[u].up).map((u) => `<div class="cr-unit${c.units[u] ? '' : ' unknown'}">${unitIcon(u, 56)}<small>${c.units[u] ? UNITS[u].name : '???'}</small></div>`).join('');
      if (tab === 'perks') grid = Object.entries(C.PERKS).map(([id, p]) => { const lv = meta.perks[id] || 0; return `<button class="cr-card coll r-perk" data-p="${id}"><div class="cr-in"><div class="cr-face"><span class="cr-art">${icon(p.icon, 46)}</span><b class="cr-name">${p.name} ${lv}/${p.max}</b><p class="cr-txt">${p.text}</p></div></div><span class="cr-price${meta.glory < p.cost || lv >= p.max ? ' poor' : ''}">${lv >= p.max ? 'Max' : `${icon('experience', 14)}${p.cost}`}</span></button>`; }).join('') +
        Object.entries(C.TROPHIES).map(([id, t]) => `<div class="cr-card coll r-trophy${meta.trophies.includes(id) ? '' : ' unknown'}"><div class="cr-in"><div class="cr-face"><span class="cr-art">${icon(t.icon, 42)}</span><b class="cr-name">${t.name}</b><p class="cr-txt">${t.text}</p></div></div></div>`).join('');
      const n = C.discoveredCount(meta), tot = Object.keys(C.ARTIFACTS).length + Object.keys(C.GUARDIANS).length + Object.keys(UNITS).filter((u) => !UNITS[u].up).length;
      L.innerHTML = `<div class="cr-collwrap"><header><h2>Collection</h2><small>${n}/${tot} discovered · best score ${fmt(meta.best.score)} · ${meta.runs} runs, ${meta.wins} won</small><span class="cr-glory">${icon('experience', 18)} ${meta.glory} Glory</span><button class="x" id="cr-x" aria-label="Close">${icon('close', 18)}</button></header>
        <nav class="tabs2">${[['artifacts', 'artifact', 'Artifacts'], ['guardians', 'hero', 'Legends'], ['units', 'army', 'Creatures'], ['perks', 'experience', 'Glory']].map(([k, ic, t]) => `<button data-t="${k}" class="${k === tab ? 'on' : ''}">${icon(ic, 18)}${t}</button>`).join('')}</nav>
        <div class="cr-grid g-${tab}">${grid}</div></div>`;
      L.querySelectorAll('[data-t]').forEach((b) => b.onclick = () => { tab = b.dataset.t; S('tab'); render(); });
      L.querySelectorAll('[data-p]').forEach((b) => b.onclick = () => { if (C.buyPerk(meta, b.dataset.p)) { S('fanfare'); onChange('meta'); render(); } else { S('deny'); replayCls(b, 'shake'); } });
      L.querySelector('#cr-x').onclick = () => { S('close'); close(); onClose?.(); };
    };
    render(); S('open');
  }

  return { mountHud, renderHud, paperDoll, choice, merchant, tradingPost, notice, guardianCard, invasionCard, heroPick, endScreen, collection, close, isOpen, cardHTML };
}
