// DOM HUD, menus and input (touch steering zone, DRIFT/JUMP buttons, keyboard).
import { CARS } from './cars.js';
import { LEVEL_T, SHOT_TIME } from './physics.js';

const $ = (id) => document.getElementById(id);

export function createUI(hooks) {
  const el = {
    hud: $('hud'), knob: $('knob'), steer: $('steer'), drift: $('bDrift'), jump: $('bJump'), cRing: $('cRing'), dLbl: $('dLbl'), dSub: $('dSub'),
    spd: $('spd'), speed: $('speed'), tRing: $('tRing'), tNum: $('tNum'), timer: $('timer'), round: $('round'),
    sYou: $('sYou'), sAi: $('sAi'), dYou: $('dYou'), dAi: $('dAi'), stN: $('stN'), stB: $('stB'),
    banner: $('banner'), bT: $('bT'), bS: $('bS'), toast: $('toast'), tag: $('tag'), skip: $('skip'), flash: $('flash'),
    menu: $('menu'), cName: $('cName'), cStats: $('cStats'), cLock: $('cLock'), cInfo: $('cInfo'), mStats: $('mStats'),
    bPlay: $('bPlay'), bStreak: $('bStreak'), bTheme: $('bTheme'), bSnd: $('bSnd'), bMute: $('bMute'),
    pause: $('pause'), result: $('result'), rT: $('rT'), rScore: $('rScore'), rS: $('rS'), tut: $('tut'), splash: $('splash'),
  };
  const input = { steer: 0, drift: false, jump: false, brake: false };
  const keys = { l: false, r: false, drift: false, jump: false, brake: false };
  let touchSteer = 0, steerId = -1, steerX0 = 0, driftIds = new Set(), jumpIds = new Set();
  const RANGE = 58;
  let usingKeys = false;

  // ---- touch / pointer
  function onDown(e) {
    hooks.unlock();
    if (e.target.closest('button')) return;
    if (!el.hud.classList.contains('on')) { hooks.tap(e); return; }
    if (hooks.tapToSkip()) return;
    const w = window.innerWidth;
    if (e.clientX < w * 0.6 && steerId < 0) {
      steerId = e.pointerId; steerX0 = e.clientX; touchSteer = 0; el.steer.classList.add('on');
      try { e.target.setPointerCapture?.(e.pointerId); } catch (_) { /* ignore */ }
    } else if (e.clientX >= w * 0.6) {
      // anywhere on the right also works as DRIFT
      driftIds.add(e.pointerId); el.drift.classList.add('held');
    }
  }
  function onMove(e) {
    if (e.pointerId !== steerId) return;
    let dx = e.clientX - steerX0;
    if (dx > RANGE) { steerX0 = e.clientX - RANGE; dx = RANGE; }
    if (dx < -RANGE) { steerX0 = e.clientX + RANGE; dx = -RANGE; }
    touchSteer = dx / RANGE;
  }
  function onUp(e) {
    if (e.pointerId === steerId) { steerId = -1; touchSteer = 0; el.steer.classList.remove('on'); }
    if (driftIds.delete(e.pointerId) && !driftIds.size) el.drift.classList.remove('held');
    if (jumpIds.delete(e.pointerId) && !jumpIds.size) el.jump.classList.remove('held');
  }
  const wrap = $('wrap');
  wrap.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  el.drift.addEventListener('pointerdown', (e) => { hooks.unlock(); e.stopPropagation(); if (hooks.tapToSkip()) return; driftIds.add(e.pointerId); el.drift.classList.add('held'); try { el.drift.setPointerCapture(e.pointerId); } catch (_) { /* */ } });
  el.jump.addEventListener('pointerdown', (e) => { hooks.unlock(); e.stopPropagation(); if (hooks.tapToSkip()) return; jumpIds.add(e.pointerId); el.jump.classList.add('held'); try { el.jump.setPointerCapture(e.pointerId); } catch (_) { /* */ } });
  for (const b of [el.drift, el.jump]) { b.addEventListener('pointerup', onUp); b.addEventListener('pointercancel', onUp); b.addEventListener('contextmenu', (e) => e.preventDefault()); }
  window.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---- keyboard
  const map = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', Space: 'drift', ShiftLeft: 'jump', ShiftRight: 'jump', KeyJ: 'jump', KeyW: 'jump', ArrowUp: 'jump', ArrowDown: 'brake', KeyS: 'brake' };
  window.addEventListener('keydown', (e) => {
    hooks.unlock();
    const k = map[e.code];
    if (e.code === 'Escape' || e.code === 'KeyP') { hooks.key('pause'); return; }
    if (e.code === 'Enter') { hooks.key('enter'); }
    if (k) {
      e.preventDefault();
      if (!usingKeys) { usingKeys = true; document.body.classList.add('kb'); }
      if (!keys[k] && hooks.tapToSkip()) return;
      keys[k] = true;
    }
  });
  window.addEventListener('keyup', (e) => { const k = map[e.code]; if (k) keys[k] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; driftIds.clear(); jumpIds.clear(); steerId = -1; touchSteer = 0; });

  const U = { el, input };
  U.readInput = () => {
    const ks = (keys.r ? 1 : 0) - (keys.l ? 1 : 0);
    input.steer = ks !== 0 ? ks : touchSteer;
    input.drift = keys.drift || driftIds.size > 0;
    input.jump = keys.jump || jumpIds.size > 0;
    input.brake = keys.brake;
    return input;
  };
  U.resetInput = () => { driftIds.clear(); jumpIds.clear(); el.drift.classList.remove('held'); el.jump.classList.remove('held'); };

  // ---- HUD values (only touch the DOM on change)
  const last = { knob: 99, spd: -1, t: -1, lv: -1, ring: -1, boost: -1, low: -1 };
  U.hud = (steer, speed, charge, level, boosting, timeLeft) => {
    const kx = Math.round(steer * 52);
    if (kx !== last.knob) { last.knob = kx; el.knob.style.transform = `translateX(${kx}px)`; }
    const s = Math.round(speed * 3.6);
    if (s !== last.spd) { last.spd = s; el.spd.textContent = s; }
    const b = boosting ? 1 : 0;
    if (b !== last.boost) { last.boost = b; el.speed.classList.toggle('boost', !!b); }
    const t = Math.max(0, timeLeft);
    const tr = Math.round(t * 20);
    if (tr !== last.t) {
      last.t = tr;
      el.tRing.style.strokeDashoffset = (119.4 * (1 - t / SHOT_TIME)).toFixed(1);
      el.tNum.textContent = Math.ceil(t);
      const low = t < 2 ? 1 : 0; if (low !== last.low) { last.low = low; el.timer.classList.toggle('low', !!low); }
    }
    // drift ring: progress towards the next level
    let p = 0;
    if (level >= 3) p = 1; else p = Math.min(1, (charge - LEVEL_T[level]) / (LEVEL_T[level + 1] - LEVEL_T[level])) * 0.33 + level * 0.333;
    const pr = Math.round(p * 100);
    if (pr !== last.ring) { last.ring = pr; el.cRing.style.strokeDashoffset = (339.3 * (1 - p)).toFixed(1); }
    if (level !== last.lv) {
      el.drift.classList.remove('l1', 'l2', 'l3');
      if (level > 0) { el.drift.classList.add('l' + level); el.drift.classList.remove('pop'); void el.drift.offsetWidth; el.drift.classList.add('pop'); }
      el.dSub.textContent = level > 0 ? 'RELEASE!' : 'HOLD';
      last.lv = level;
    }
  };
  U.showHud = (on, streak) => { el.hud.classList.toggle('on', on); el.hud.classList.toggle('streak', !!streak); };
  U.dots = (you, ai, sudden) => {
    const fill = (node, arr, isNow) => {
      const n = Math.max(5, arr.length + (isNow ? 1 : 0));
      const show = Math.min(n, 7), start = n - show;
      let h = '';
      for (let i = start; i < n; i++) h += `<i class="${i < arr.length ? (arr[i] ? 'g' : 'x') : (isNow && i === arr.length ? 'now' : '')}"></i>`;
      node.innerHTML = h;
    };
    fill(el.dYou, you, you.length === ai.length);
    fill(el.dAi, ai, ai.length < you.length);
    const sy = you.filter(Boolean).length, sa = ai.filter(Boolean).length;
    if (+el.sYou.textContent !== sy) { el.sYou.textContent = sy; tickEl(el.sYou); }
    if (+el.sAi.textContent !== sa) { el.sAi.textContent = sa; tickEl(el.sAi); }
  };
  function tickEl(n) { n.classList.remove('tick'); void n.offsetWidth; n.classList.add('tick'); }
  U.streak = (n, best) => { el.stN.textContent = n; el.stB.textContent = best; tickEl(el.stN); };
  U.round = (txt) => { el.round.textContent = txt; };

  let bannerT = 0;
  U.banner = (txt, sub, kind) => {
    el.bT.textContent = txt; el.bS.textContent = sub || '';
    el.banner.className = ''; void el.banner.offsetWidth;
    el.banner.className = 'show ' + (kind || '');
    clearTimeout(bannerT);
  };
  U.hideBanner = () => { if (el.banner.classList.contains('show')) { el.banner.className = 'hide ' + (el.banner.className.split(' ')[1] || ''); } };
  let toastT = 0;
  U.toast = (txt, gold, ms = 1600) => {
    el.toast.textContent = txt; el.toast.className = 'on' + (gold ? ' gold' : '');
    clearTimeout(toastT); toastT = setTimeout(() => { el.toast.className = gold ? 'gold' : ''; }, ms);
  };
  U.tag = (on) => el.tag.classList.toggle('on', on);
  U.skip = (on) => el.skip.classList.toggle('on', on);
  U.flash = () => { el.flash.classList.remove('on'); void el.flash.offsetWidth; el.flash.classList.add('on'); };

  // ---- menu
  U.showMenu = (on) => el.menu.classList.toggle('off', !on);
  U.carCard = (i, goals) => {
    const c = CARS[i];
    el.cName.textContent = c.name;
    const bar = (lbl, v) => `<span>${lbl}</span><u>${[1, 2, 3, 4, 5].map((k) => `<i class="${k <= v ? 'on' : ''}"></i>`).join('')}</u>`;
    el.cStats.innerHTML = bar('SPEED', c.bars.speed) + bar('POWER', c.bars.power) + bar('DRIFT', c.bars.drift) + bar('JUMP', c.bars.jump);
    const locked = goals < c.unlock;
    el.cInfo.classList.toggle('locked', locked);
    el.cLock.textContent = locked ? `🔒 SCORE ${c.unlock} GOALS (${goals}/${c.unlock})` : `${i + 1} / ${CARS.length}`;
    el.bPlay.disabled = locked; el.bStreak.disabled = locked;
  };
  U.menuStats = (goals, best) => { el.mStats.textContent = `GOALS SCORED ${goals} · BEST STREAK ${best}`; };
  U.theme = (name) => { el.bTheme.textContent = 'STADIUM: ' + name.toUpperCase(); };
  U.sound = (muted) => { el.bSnd.textContent = 'SOUND: ' + (muted ? 'OFF' : 'ON'); el.bMute.classList.toggle('muted', muted); };
  U.overlay = (name, on) => el[name].classList.toggle('on', on);
  U.resultCard = (title, score, sub) => { el.rT.textContent = title; el.rScore.innerHTML = score; el.rS.textContent = sub; };

  const click = (id, fn) => $(id).addEventListener('click', (e) => { e.stopPropagation(); hooks.unlock(); hooks.click(); fn(); });
  U.on = click;
  return U;
}
