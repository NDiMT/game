// =====================================================================
// Crownforge · one modal at a time (agent "ui3", v2.8).
// Every full-screen modal (main.js: the #dialog card queue; crown_ui.js: the Crown Run layer) holds this gate while it
// is visible. A modal that wants to show while another one holds the gate waits in line and appears when the gate is
// free, so a level-up never lands on a merchant, a notice never lands on the week card, and so on.
// The line is pumped on the next tick after a release: a modal opened by the closing one's own button (the follow-up
// the player just asked for) shows first, and whatever was waiting comes after it.
// Toasts read modalBusy() too: they wait while a modal is up instead of covering its title ribbon.
// =====================================================================
const held = new Set();
const line = []; // [{ key, show }]
const subs = new Set();
let pumpT = 0;

/** is a modal other than `key` on screen? */
export const modalBusy = (key = '') => { for (const k of held) if (k !== key) return true; return false; };
/** show the modal `key` now (returns true) or when the gate frees (returns false; `show` runs then) */
export function modalShow(key, show) {
  if (held.has(key) || !modalBusy(key)) { held.add(key); show(); return true; }
  const i = line.findIndex((x) => x.key === key);
  if (i >= 0) line[i].show = show; else line.push({ key, show });
  return false;
}
/** the modal `key` is gone (or no longer wants to show) */
export function modalFree(key) {
  const i = line.findIndex((x) => x.key === key); if (i >= 0) line.splice(i, 1);
  if (!held.delete(key)) return;
  clearTimeout(pumpT); pumpT = setTimeout(pump, 0);
}
function pump() {
  while (line.length && !modalBusy(line[0].key)) {
    const { key, show } = line.shift(); held.add(key);
    try { show(); } catch (e) { held.delete(key); console.error('modal failed to show', e); }
  }
  if (!held.size) for (const f of subs) { try { f(); } catch { /* a listener must not break the line */ } }
}
/** fn() whenever the gate becomes completely free (e.g. queued toasts) */
export function onModalFree(fn) { subs.add(fn); return () => subs.delete(fn); }
if (typeof window !== 'undefined') window.__modal = { held, line, modalBusy }; // test hook
