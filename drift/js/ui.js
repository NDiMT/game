// DOM HUD, menus and input (touch steering slider, one-thumb gesture pedal, keyboard).
import { CARS } from './cars.js';
import { LEVEL_T, SHOT_TIME } from './physics.js';

const $ = (id) => document.getElementById(id);

export function createUI(hooks) {
  const el = {
    hud: $('hud'), knob: $('knob'), steer: $('steer'), pedal: $('pedal'), ptrack: $('ptrack'), pknob: $('pknob'), pAmt: $('pAmt'), pBrk: $('pBrk'), pChg: $('pChg'), dSub: $('dSub'), bSub: $('bSub'), gear: $('gear'), rpm: document.querySelector('#rpm u'), lines: $('lines'),
    spd: $('spd'), speed: $('speed'), tRing: $('tRing'), tNum: $('tNum'), timer: $('timer'), round: $('round'),
    sYou: $('sYou'), sAi: $('sAi'), dYou: $('dYou'), dAi: $('dAi'), stN: $('stN'), stB: $('stB'),
    banner: $('banner'), bT: $('bT'), bS: $('bS'), toast: $('toast'), tag: $('tag'), skip: $('skip'), flash: $('flash'),
    menu: $('menu'), cName: $('cName'), cStats: $('cStats'), cLock: $('cLock'), cInfo: $('cInfo'), mStats: $('mStats'),
    bPlay: $('bPlay'), bStreak: $('bStreak'), bTheme: $('bTheme'), bSnd: $('bSnd'), bMute: $('bMute'), bHow: $('bHow'),
    pause: $('pause'), result: $('result'), rT: $('rT'), rScore: $('rScore'), rS: $('rS'), tut: $('tut'), splash: $('splash'),
  };
  const input = { steer: 0, throttle: 0, brake: 0, drift: false };
  const keys = { l: false, r: false, gas: false, brake: false, drift: false };
  let touchSteer = 0, steerId = -1, steerX0 = 0;
  const RANGE = 58;
  let usingKeys = false;

  // ---- touch / pointer
  // Left part of the screen = steering slider (relative drag). Right part = the one-thumb pedal, read
  // relative to where the thumb landed: hold = gas, slide up past ~40 px = drift (still on gas),
  // back to neutral or lift = release the drift (boost), slide down past ~40 px = brake, then reverse.
  // Lifting entirely = coast. Hysteresis (enter 40 px, leave 28 px) stops zone flicker.
  const ENTER = 40, LEAVE = 28;
  const ped = { id: -1, y0: 0, dy: 0, zone: '' }; // zone: '' none, 'g' gas, 'd' drift, 'b' brake
  function splitX() { return window.innerWidth * (window.innerWidth > window.innerHeight ? 0.5 : 0.45); }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (_) { /* unsupported */ } }

  function onDown(e) {
    hooks.unlock();
    if (e.target.closest('button')) return;
    if (!el.hud.classList.contains('on')) { hooks.tap(e); return; }
    if (hooks.tapToSkip()) return;
    if (e.clientX < splitX()) {
      if (steerId < 0) { steerId = e.pointerId; steerX0 = e.clientX; touchSteer = 0; el.steer.classList.add('on'); }
    } else if (ped.id < 0) {
      ped.id = e.pointerId; ped.y0 = e.clientY; ped.dy = 0; setZone('g');
    }
    try { wrap.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    e.preventDefault();
  }
  function setZone(z) {
    if (z === ped.zone) return;
    if (z) buzz(z === 'd' ? [6, 30, 6] : z === 'b' ? 14 : 8);
    ped.zone = z;
  }
  function onMove(e) {
    if (e.pointerId === ped.id) {
      const dy = ped.y0 - e.clientY; ped.dy = dy;
      const z = ped.zone;
      if (z === 'g') { if (dy > ENTER) setZone('d'); else if (dy < -ENTER) setZone('b'); }
      else if (z === 'd') { if (dy < -ENTER) setZone('b'); else if (dy < LEAVE) setZone('g'); }
      else if (z === 'b') { if (dy > ENTER) setZone('d'); else if (dy > -LEAVE) setZone('g'); }
      return;
    }
    if (e.pointerId !== steerId) return;
    let dx = e.clientX - steerX0;
    if (dx > RANGE) { steerX0 = e.clientX - RANGE; dx = RANGE; }
    if (dx < -RANGE) { steerX0 = e.clientX + RANGE; dx = -RANGE; }
    touchSteer = dx / RANGE;
  }
  function onUp(e) {
    if (e.pointerId === steerId) { steerId = -1; touchSteer = 0; el.steer.classList.remove('on'); }
    if (e.pointerId === ped.id) { ped.id = -1; ped.dy = 0; ped.zone = ''; }
  }
  const wrap = $('wrap');
  wrap.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  window.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---- keyboard
  const map = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', KeyW: 'gas', ArrowUp: 'gas', KeyS: 'brake', ArrowDown: 'brake', Space: 'drift' };
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
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; ped.id = -1; ped.zone = ''; steerId = -1; touchSteer = 0; });

  const U = { el, input };
  // pedal visuals: zone highlight, fills, knob (only touch the DOM on change)
  const pv = { zone: '?', on: -1, kn: 1e9, thr: -1, brk: -1 };
  function paint(zone, on, thr, brk, dy) {
    if (zone !== pv.zone) { el.pedal.classList.remove('zg', 'zd', 'zb'); if (zone) el.pedal.classList.add('z' + zone); pv.zone = zone; }
    if (+on !== pv.on) { pv.on = +on; el.pedal.classList.toggle('on', on); }
    const h = el.ptrack.clientHeight || 300, lim = h / 2 - 32;
    const kn = Math.round(Math.max(-lim, Math.min(lim, -dy * 1.5)));
    if (kn !== pv.kn) { pv.kn = kn; el.pknob.style.transform = `translateY(${kn}px)`; }
    const t = zone === 'g' ? Math.round(thr * 20) : 0, b = Math.round(brk * 20);
    if (t !== pv.thr) { pv.thr = t; el.pAmt.style.transform = `scaleY(${(t / 20).toFixed(2)})`; }
    if (b !== pv.brk) { pv.brk = b; el.pBrk.style.transform = `scaleY(${(b / 20).toFixed(2)})`; }
  }
  U.readInput = () => {
    const ks = (keys.r ? 1 : 0) - (keys.l ? 1 : 0);
    input.steer = ks !== 0 ? ks : touchSteer;
    let thr = 0, brk = 0, dr = false;
    const z = ped.zone, dy = ped.dy;
    // analogue: how far into the gas / brake zone the thumb sits scales the pedal
    if (z === 'g') thr = 0.7 + 0.3 * Math.max(0, Math.min(1, (dy + LEAVE) / (2 * LEAVE)));
    else if (z === 'd') { thr = 1; dr = true; }
    else if (z === 'b') brk = Math.max(0.45, Math.min(1, 0.45 + (-dy - ENTER) / 70));
    input.throttle = keys.gas ? 1 : thr;
    input.brake = keys.brake ? 1 : brk;
    input.drift = keys.drift || dr;
    if (ped.id >= 0) paint(z, true, thr, brk, dy);
    else U.reflect(input);
    return input;
  };
  // show keyboard / scripted / bot input on the pedal
  U.reflect = (inp) => {
    const zone = inp.drift ? 'd' : inp.brake > 0 ? 'b' : inp.throttle > 0 ? 'g' : '';
    paint(zone, !!zone, inp.throttle || 0, inp.brake || 0, zone === 'd' ? 60 : zone === 'b' ? -60 : 0);
    if (inp !== input) input.steer = inp.steer;
  };
  U.resetInput = () => { ped.id = -1; ped.zone = ''; ped.dy = 0; paint('', false, 0, 0, 0); };
  U.relayout = () => { pv.kn = 1e9; };

  // ---- HUD values (only touch the DOM on change)
  const last = { knob: 99, spd: -1, t: -1, lv: -1, ring: -1, boost: -1, low: -1, rpm: -1, rev: -1, lines: -1 };
  U.hud = (steer, speed, charge, level, boosting, timeLeft, rpm, reverse, lines) => {
    const rp = Math.round((rpm || 0) * 40);
    if (rp !== last.rpm) { last.rpm = rp; el.rpm.style.transform = `scaleX(${(rp / 40).toFixed(3)})`; }
    const rv = reverse ? 1 : 0;
    if (rv !== last.rev) { last.rev = rv; el.gear.textContent = rv ? 'R' : 'D'; el.gear.classList.toggle('r', !!rv); }
    const ln = Math.round((lines || 0) * 20);
    if (ln !== last.lines) { last.lines = ln; el.lines.style.opacity = (ln / 20).toFixed(2); }
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
      const low = t < 3 ? 1 : 0; if (low !== last.low) { last.low = low; el.timer.classList.toggle('low', !!low); }
    }
    // drift charge: fills the DRIFT zone, colour = level
    let p = 0;
    if (level >= 3) p = 1; else p = Math.min(1, Math.max(0, (charge - LEVEL_T[level]) / (LEVEL_T[level + 1] - LEVEL_T[level]))) * 0.33 + level * 0.333;
    const pr = Math.round(p * 50);
    if (pr !== last.ring) { last.ring = pr; el.pChg.style.transform = `scaleY(${(pr / 50).toFixed(2)})`; }
    if (level !== last.lv) {
      el.pedal.classList.remove('l1', 'l2', 'l3');
      if (level > 0) { el.pedal.classList.add('l' + level); el.pedal.classList.remove('pop'); void el.pedal.offsetWidth; el.pedal.classList.add('pop'); }
      el.dSub.textContent = level > 0 ? 'BACK DOWN = BOOST' : 'SLIDE UP';
      last.lv = level;
    }
    if (rv !== last.rv2) { last.rv2 = rv; el.bSub.textContent = rv ? 'REVERSING' : 'REVERSE'; }
  };
  U.showHud = (on, streak) => { el.hud.classList.toggle('on', on); el.hud.classList.toggle('streak', !!streak); pv.kn = 1e9; };
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
    el.cStats.innerHTML = bar('SPEED', c.bars.speed) + bar('POWER', c.bars.power) + bar('DRIFT', c.bars.drift);
    const locked = goals < c.unlock;
    el.cInfo.classList.toggle('locked', locked);
    el.cLock.textContent = locked ? `🔒 SCORE ${c.unlock} GOALS (${goals}/${c.unlock})` : `${i + 1} / ${CARS.length}`;
    el.bPlay.disabled = locked; el.bStreak.disabled = locked;
  };
  U.menuStats = (goals, best) => { el.mStats.textContent = `GOALS SCORED ${goals} · BEST STREAK ${best}`; };
  U.theme = (name) => { el.bTheme.textContent = name === 'day' ? 'DAY' : 'NIGHT'; };
  U.sound = (muted) => { el.bSnd.textContent = 'SOUND ' + (muted ? 'OFF' : 'ON'); el.bMute.classList.toggle('muted', muted); };
  U.overlay = (name, on) => el[name].classList.toggle('on', on);
  U.resultCard = (title, score, sub) => { el.rT.textContent = title; el.rScore.innerHTML = score; el.rS.textContent = sub; };

  const click = (id, fn) => $(id).addEventListener('click', (e) => { e.stopPropagation(); hooks.unlock(); hooks.click(); fn(); });
  U.on = click;
  return U;
}
