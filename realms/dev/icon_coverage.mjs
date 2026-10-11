// Coverage check for the painted icons (agent "icons"): every id the game can show must map to an art file that exists.
// node realms/dev/icon_coverage.mjs   -> prints per-kind counts and every missing id; exit code 1 if anything is missing.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { artFile } = await import(path.join(ROOT, 'icons.js'));
const D = await import(path.join(ROOT, 'data.js'));
const C = await import(path.join(ROOT, 'crown.js'));

// glyph names the code draws with icon('…') that are SVG on purpose (vector reads better, see icons.js)
const SVG_ONLY = new Set(['close', 'check', 'more', 'info', 'menu', 'logo', 'x']);
const checks = {}; // kind -> [[label, kind, id]]
const add = (group, kind, id) => (checks[group] ||= []).push([kind, id]);

for (const id of Object.keys(D.UNITS)) add('units (all factions, upgrades, neutrals)', 'unit', id);
for (const f of Object.keys(D.FACTIONS)) { add('faction heroes', 'hero', f); add('faction crests', 'faction', f); }
for (const f of Object.keys(D.FACTIONS)) for (const b of D.BUILDINGS) add('town buildings × factions (incl. dwellings, upgrades)', 'building', `${f}:${b.id}`);
for (const id of Object.keys(D.SPELLS)) add('spells', 'spell', id);
for (const id of Object.keys(D.SKILLS)) add('skills', 'skill', id);
for (const a of D.ARTIFACTS) add('Free Play artifacts', 'fpart', a.id);
for (const id of Object.keys(D.OBJECTS)) add('map objects', 'object', id);
for (const id of Object.keys(C.ARTIFACTS)) add('Crown Run artifacts', 'artifact', id);
for (const id of Object.keys(C.SETS)) add('artifact sets', 'set', id);
for (const id of Object.keys(C.GUARDIANS)) add('Legendary Heroes', 'guardian', id);
for (const id of Object.keys(C.BACKGROUNDS)) add('hero backgrounds', 'background', id);
for (const id of ['pandora', 'witchhut', 'scholar', 'seer', 'merchant', 'blackmarket', 'tradingpost', 'grail', 'keymaster', 'border']) add('Crown Run sites', 'site', id);
for (const r of D.RES) add('resources', 'glyph', r);
// every glyph name the game's own fields and code ask icon() for
const glyphs = new Set();
for (const T of [C.TROPHIES, C.PERKS, C.GUARDIANS, C.BACKGROUNDS, C.SETS, C.ARTIFACTS]) for (const x of Object.values(T)) if (x.icon) glyphs.add(x.icon);
for (const f of ['main.js', 'crown_ui.js', 'index.html']) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of src.matchAll(/\bicon\('([a-z0-9_]+)'/g)) glyphs.add(m[1]);
  for (const m of src.matchAll(/data-ic="([a-z0-9_]+)"/g)) glyphs.add(m[1]);
}
for (const g of glyphs) if (!SVG_ONLY.has(g)) add('UI / stat glyphs used by the code', 'glyph', g);

let missing = 0, total = 0;
for (const [group, list] of Object.entries(checks)) {
  const bad = list.filter(([k, id]) => { const f = artFile(k, id); return !f || !fs.existsSync(path.join(ROOT, 'art/icons', f + '.webp')); });
  total += list.length; missing += bad.length;
  console.log(`${bad.length ? 'MISSING' : 'ok     '} ${String(list.length - bad.length).padStart(3)}/${String(list.length).padEnd(3)} ${group}${bad.length ? ': ' + bad.map(([k, id]) => `${k}:${id}`).join(', ') : ''}`);
}
const files = fs.readdirSync(path.join(ROOT, 'art/icons')).filter((f) => f.endsWith('.webp'));
const kb = files.reduce((a, f) => a + fs.statSync(path.join(ROOT, 'art/icons', f)).size, 0) / 1024;
console.log(`\n${total - missing}/${total} ids covered, ${missing} missing · ${files.length} WebP files, ${Math.round(kb)} KB`);
process.exit(missing ? 1 : 0);
