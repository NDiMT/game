// DOM HUD, menus and input (touch steering slider, analogue GAS/BRAKE pedals, DRIFT/JUMP, keyboard).
import { CARS } from './cars.js';
import { LEVEL_T, SHOT_TIME } from './physics.js';

const $ = (id) => document.getElementById(id);

export function createUI(hooks) {
  const el = {
    hud: $('hud'), knob: $('knob'), steer: $('steer'), drift: $('bDrift'), jump: $('bJump'), gas: $('bGas'), brake: $('bBrake'), pads: $('pads'),
    cRing: $('cRing'), dLbl: $('dLbl'), dSub: $('dSub'), gear: $('gear'), rpm: document.querySelector('#rpm u'), lines: $('lines'),
    spd: $('spd'), speed: $('speed'), tRing: $('tRing'), tNum: $('tNum'), timer: $('timer'), round: $('round'),
    sYou: $('sYou'), sAi: $('sAi'), dYou: $('dYou'), dAi: $('dAi'), stN: $('stN'), stB: $('stB'),
    banner: $('banner'), bT: $('bT'), bS: $('bS'), toast: $('toast'), tag: $('tag'), skip: $('skip'), flash: $('flash'),
    menu: $('menu'), cName: $('cName'), cStats: $('cStats'), cLock: $('cLock'), cInfo: $('cInfo'), mStats: $('mStats'),
    bPlay: $('bPlay'), bStreak: $('bStreak'), bTheme: $('bTheme'), bSnd: $('bSnd'), bMute: $('bMute'), bHow: $('bHow'),
    pause: $('pause'), result: $('result'), rT: $('rT'), rScore: $('rScore'), rS: $('rS'), tut: $('tut'), splash: $('splash'),
  };
  const input = { steer: 0, throttle: 0, brake: 0, drift: false, jump: false };
  const keys = { l: false, r: false, gas: false, brake: false, drift: false, jump: false };
  let touchSteer = 0, steerId = -1, steerX0 = 0;
  const RANGE = 58;
  let usingKeys = false;

  // ---- touch / pointer
  // Left part of the screen = steering slider (relative drag). Right part = the pad cluster. The pads are
  // visual only: every right-side pointer is hit-tested against cached pad rects each frame, so a thumb can
  // slide from GAS onto DRIFT (or rest on the seam and press both), and GAS + DRIFT work as two touches.
  // Pedals are analogue: the higher the thumb sits on the pedal, the more gas/brake (bottom 25% = 40%).
  const ptr = new Map(); // pointerId -> { x, y }
  const rects = { gas: null, brake: null, drift: null, jump: null };
  let rectsOk = false;
  function cacheRects() {
    for (const k of ['gas', 'brake', 'drift', 'jump']) {
      const r = el[k].getBoundingClientRect();
      rects[k] = { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, cx: (r.left + r.right) / 2, cy: (r.top + r.bottom) / 2 };
    }
    rectsOk = rects.gas.w > 0;
  }
  window.addEventListener('resize', () => { rectsOk = false; });
  function inRect(q, x, y, m) { return x >= q.l - m && x <= q.r + m && y >= q.t - m && y <= q.b + m; }
  function inCircle(q, x, y, m) { const dx = x - q.cx, dy = y - q.cy, r = q.w / 2 + m; return dx * dx + dy * dy <= r * r; }
  function splitX() { return window.innerWidth * (window.innerWidth > window.innerHeight ? 0.45 : 0.4); }

  function onDown(e) {
    hooks.unlock();
    if (e.target.closest('button')) return;
    if (!el.hud.classList.contains('on')) { hooks.tap(e); return; }
    if (hooks.tapToSkip()) return;
    if (e.clientX < splitX()) {
      if (steerId < 0) { steerId = e.pointerId; steerX0 = e.clientX; touchSteer = 0; el.steer.classList.add('on'); }
    } else {
      ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    try { wrap.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    e.preventDefault();
  }
  function onMove(e) {
    const p = ptr.get(e.pointerId);
    if (p) { p.x = e.clientX; p.y = e.clientY; return; }
    if (e.pointerId !== steerId) return;
    let dx = e.clientX - steerX0;
    if (dx > RANGE) { steerX0 = e.clientX - RANGE; dx = RANGE; }
    if (dx < -RANGE) { steerX0 = e.clientX + RANGE; dx = -RANGE; }
    touchSteer = dx / RANGE;
  }
  function onUp(e) {
    if (e.pointerId === steerId) { steerId = -1; touchSteer = 0; el.steer.classList.remove('on'); }
    ptr.delete(e.pointerId);
  }
  const wrap = $('wrap');
  wrap.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  window.addEventListener('contextmenu', (e) => e.preventDefault());

  // pedal amount from the vertical position on the pedal
  const pedalAmt = (q, y) => Math.min(1, Math.max(0.4, 0.4 + (q.b - y) / q.h * 1.6));
  const touch = { gas: 0, brake: 0, drift: false, jump: false };
  function readTouch() {
    touch.gas = 0; touch.brake = 0; touch.drift = false; touch.jump = false;
    if (!ptr.size) return;
    if (!rectsOk) cacheRects();
    for (const p of ptr.values()) {
      const { x, y } = p;
      const onGas = inRect(rects.gas, x, y, 10), onDrift = inCircle(rects.drift, x, y, 12);
      if (onGas) touch.gas = Math.max(touch.gas, pedalAmt(rects.gas, y));
      if (onDrift) touch.drift = true;
      // the seam between DRIFT and GAS presses both (rocking thumb)
      if (!onGas && !onDrift && y > rects.gas.t && x > rects.drift.cx && x < rects.gas.l + 4) { touch.drift = true; touch.gas = Math.max(touch.gas, 0.85); }
      if (inRect(rects.brake, x, y, 10)) touch.brake = Math.max(touch.brake, pedalAmt(rects.brake, y));
      else if (inCircle(rects.jump, x, y, 12)) touch.jump = true;
    }
  }

  // ---- keyboard
  const map = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', KeyW: 'gas', ArrowUp: 'gas', KeyS: 'brake', ArrowDown: 'brake', Space: 'drift', ShiftLeft: 'jump', ShiftRight: 'jump', KeyJ: 'jump' };
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
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; ptr.clear(); steerId = -1; touchSteer = 0; });

  const U = { el, input };
  const held = { gas: -1, brake: -1, drift: -1, jump: -1 };
  function setHeld(k, on) { if (held[k] !== +on) { held[k] = +on; el[k].classList.toggle('held', on); } }
  const amt = { gas: -1, brake: -1 };
  function setAmt(k, v) { const r = Math.round(v * 20); if (amt[k] !== r) { amt[k] = r; el[k].style.setProperty('--amt', (r / 20).toFixed(2)); } }
  U.readInput = () => {
    readTouch();
    const ks = (keys.r ? 1 : 0) - (keys.l ? 1 : 0);
    input.steer = ks !== 0 ? ks : touchSteer;
    input.throttle = keys.gas ? 1 : touch.gas;
    input.brake = keys.brake ? 1 : touch.brake;
    input.drift = keys.drift || touch.drift;
    input.jump = keys.jump || touch.jump;
    setHeld('gas', input.throttle > 0); setHeld('brake', input.brake > 0); setHeld('drift', input.drift); setHeld('jump', input.jump);
    setAmt('gas', input.throttle); setAmt('brake', input.brake);
    return input;
  };
  // show scripted / bot input on the pads (test hooks, demo)
  U.reflect = (inp) => { setHeld('gas', inp.throttle > 0); setHeld('brake', inp.brake > 0); setHeld('drift', !!inp.drift); setHeld('jump', !!inp.jump); setAmt('gas', inp.throttle || 0); setAmt('brake', inp.brake || 0); input.steer = inp.steer; };
  U.resetInput = () => { ptr.clear(); rectsOk = false; for (const k in held) setHeld(k, false); setAmt('gas', 0); setAmt('brake', 0); };
  U.relayout = () => { rectsOk = false; };

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
  U.showHud = (on, streak) => { el.hud.classList.toggle('on', on); el.hud.classList.toggle('streak', !!streak); rectsOk = false; };
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
  U.theme = (name) => { el.bTheme.textContent = name === 'day' ? 'DAY' : 'NIGHT'; };
  U.sound = (muted) => { el.bSnd.textContent = 'SOUND ' + (muted ? 'OFF' : 'ON'); el.bMute.classList.toggle('muted', muted); };
  U.overlay = (name, on) => el[name].classList.toggle('on', on);
  U.resultCard = (title, score, sub) => { el.rT.textContent = title; el.rScore.innerHTML = score; el.rS.textContent = sub; };

  const click = (id, fn) => $(id).addEventListener('click', (e) => { e.stopPropagation(); hooks.unlock(); hooks.click(); fn(); });
  U.on = click;
  return U;
}
