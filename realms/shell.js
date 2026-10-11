// =====================================================================
// ORBIS app shell (agent "fullscreen", v2.2): no browser chrome on phones.
//  - Android / Chrome tab: the first tap on the title screen asks for fullscreen (navigationUI 'hide') and then a
//    landscape orientation lock. Both need a user gesture and fail silently where unsupported. It is asked ONCE per
//    page load: leaving fullscreen is respected, and only an explicit tap on a fullscreen toggle (title screen, in-game
//    Menu) asks again. Never retried in a loop.
//  - Installable PWA (manifest.webmanifest, display fullscreen): Chrome's beforeinstallprompt adds an "Install" chip.
//  - iOS Safari cannot hide its bars in a tab and has no Fullscreen API on iPhone: a one-time hint card on the title
//    screen points to Share -> Add to Home Screen (the home-screen app runs standalone, without bars).
// When neither fullscreen nor an orientation lock is possible, vport.js turns the game frame so it is still landscape.
// =====================================================================
import { isTouch } from './vport.js?v=2.6';

const d = document, de = d.documentElement;
const mq = (q) => (typeof matchMedia === 'function' ? matchMedia(q) : { matches: false, addEventListener() {} });
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
export const standalone = () => navigator.standalone === true || mq('(display-mode: standalone)').matches || mq('(display-mode: fullscreen)').matches;
const ua = navigator.userAgent || '';
export const isIOS = /iP(hone|od|ad)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
/** the Fullscreen API is there (not on iPhone Safari) and the app is not already running as an installed app */
export const fsAvailable = () => !!(de.requestFullscreen || de.webkitRequestFullscreen) && !standalone() && d.fullscreenEnabled !== false;
export const fsActive = () => !!(d.fullscreenElement || d.webkitFullscreenElement);

let busy = false;
/** fullscreen, then lock to landscape. Must run inside a user gesture. Never throws. */
export async function enterFullscreen() {
  if (busy || fsActive()) return fsActive();
  busy = true;
  try {
    const p = de.requestFullscreen ? de.requestFullscreen({ navigationUI: 'hide' }) : de.webkitRequestFullscreen?.();
    if (p && typeof p.then === 'function') await p;
  } catch { busy = false; sync(); return false; }
  try { const l = screen.orientation?.lock?.('landscape'); if (l && typeof l.catch === 'function') await l.catch(() => {}); } catch { /* no lock on this browser */ }
  busy = false; sync();
  return true;
}
export function exitFullscreen() {
  try { screen.orientation?.unlock?.(); } catch { /* fine */ }
  try { const p = (d.exitFullscreen || d.webkitExitFullscreen)?.call(d); if (p && typeof p.catch === 'function') p.catch(() => {}); } catch { /* fine */ }
}
export function toggleFullscreen() { if (fsActive()) exitFullscreen(); else enterFullscreen(); }

// ---------------------------------------------------------------- icons (32 x 32, the game's ink + gold style)
const INK = '#5a3214';
const GOLD = 'url(#shl-g)';
const defs = '<defs><linearGradient id="shl-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff7c2"/><stop offset=".5" stop-color="#ffd447"/><stop offset="1" stop-color="#d88a17"/></linearGradient></defs>';
const svg = (body, s) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 32 32" aria-hidden="true" focusable="false">${defs}${body}</svg>`;
const stroke2 = (dd) => `<path d="${dd}" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="${dd}" fill="none" stroke="${GOLD}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`;
export const ICON = {
  fsOn: (s = 18) => svg(stroke2('M5 12V5h7M20 5h7v7M27 20v7h-7M12 27H5v-7'), s),
  fsOff: (s = 18) => svg(stroke2('M12 5v7H5M27 12h-7V5M20 27v-7h7M5 20h7v7'), s),
  install: (s = 18) => svg(stroke2('M16 4v15M9.5 13l6.5 6.5 6.5-6.5M6 27h20'), s),
  // iOS's own Share glyph (a box with an arrow out of the top), drawn in the system blue so it is recognised
  share: (s = 22) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M11 12H8.5A1.5 1.5 0 0 0 7 13.5v13A1.5 1.5 0 0 0 8.5 28h15a1.5 1.5 0 0 0 1.5-1.5v-13a1.5 1.5 0 0 0-1.5-1.5H21" fill="none" stroke="#3f9bff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 19V3.5M10.5 9 16 3.5 21.5 9" fill="none" stroke="#3f9bff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

// ---------------------------------------------------------------- title screen: toggle, install chip, iOS hint
const listeners = new Set();
/** fn() whenever the fullscreen state changes (to refresh a label) */
export function onFullscreen(fn) { listeners.add(fn); return () => listeners.delete(fn); }
let fsBtn = null, instBtn = null, deferred = null;
function sync() {
  if (fsBtn) {
    const on = fsActive();
    fsBtn.hidden = !fsAvailable() && !on;
    fsBtn.innerHTML = on ? ICON.fsOff() : ICON.fsOn();
    fsBtn.setAttribute('aria-label', on ? 'Exit fullscreen' : 'Fullscreen'); fsBtn.title = on ? 'Exit fullscreen' : 'Fullscreen';
    fsBtn.setAttribute('aria-pressed', String(on));
  }
  if (instBtn) instBtn.hidden = !deferred || standalone();
  for (const fn of listeners) { try { fn(fsActive()); } catch { /* ignore */ } }
}
d.addEventListener('fullscreenchange', sync);
d.addEventListener('webkitfullscreenchange', sync);

// Android: Chrome offers installation; keep the event for our own button (the mini-infobar is not shown then)
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; sync(); });
addEventListener('appinstalled', () => { deferred = null; sync(); });

const menuOpen = () => { const m = d.getElementById('menu'); return !!m && !m.hidden && !m.classList.contains('fading'); };
// the first tap on the title screen (a touch device in a browser tab): ask once, never again on its own
let asked = false;
function firstTap(e) {
  if (asked) return;
  asked = true;
  if (e && e.target && e.target.closest && e.target.closest('#m-fs, #m-install')) return; // the explicit chips act themselves
  d.removeEventListener('pointerup', firstTap, true); d.removeEventListener('click', firstTap, true);
  if (menuOpen() && isTouch() && fsAvailable() && !fsActive()) enterFullscreen();
}

function mount() {
  const foot = d.querySelector('#menu .mfoot');
  if (foot && !d.getElementById('m-fs')) {
    const box = d.createElement('span'); box.className = 'mchips';
    fsBtn = d.createElement('button'); fsBtn.id = 'm-fs'; fsBtn.className = 'chipbtn'; fsBtn.type = 'button'; fsBtn.setAttribute('aria-label', 'Fullscreen');
    // the explicit toggle: this tap itself is the gesture (stopPropagation keeps the one-shot auto request from also firing)
    fsBtn.addEventListener('click', (e) => { e.stopPropagation(); asked = true; toggleFullscreen(); });
    instBtn = d.createElement('button'); instBtn.id = 'm-install'; instBtn.className = 'chipbtn gold'; instBtn.type = 'button'; instBtn.hidden = true;
    instBtn.innerHTML = `${ICON.install()}<span>Install</span>`;
    instBtn.addEventListener('click', async (e) => {
      e.stopPropagation(); asked = true;
      const ev = deferred; if (!ev) return;
      deferred = null; sync();
      try { ev.prompt(); await ev.userChoice; } catch { /* dismissed */ }
    });
    const snd = d.getElementById('m-sound');
    if (snd && snd.parentNode === foot) { foot.insertBefore(box, snd); box.appendChild(snd); } else foot.prepend(box);
    box.append(fsBtn, instBtn);
  }
  // iOS Safari in a tab: one-time hint
  if (isIOS && !standalone() && !store.get('orbis.a2hs')) {
    const mb = d.querySelector('#menu .mbtns');
    if (mb && !d.getElementById('a2hs')) {
      store.set('orbis.a2hs', '1');
      const c = d.createElement('div'); c.id = 'a2hs'; c.className = 'a2hs'; c.setAttribute('role', 'note');
      c.innerHTML = `<span class="a2-ic">${ICON.share(24)}</span><p><b>Tap Share ${ICON.share(15)} → <em>Add to Home Screen</em></b><small>to play fullscreen, without the browser bars</small></p><button type="button" class="a2-x" aria-label="Dismiss">✕</button>`;
      c.querySelector('.a2-x').addEventListener('click', (e) => { e.stopPropagation(); c.remove(); });
      mb.appendChild(c);
    }
  }
  sync();
  d.addEventListener('pointerup', firstTap, true); d.addEventListener('click', firstTap, true);
}
if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
