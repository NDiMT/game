// ORBIS · Five Crowns: hand-crafted inline SVG icon set (painted fantasy style, bright and readable at 14–32 px).
// icon(name, size = 20, cls = '') -> HTML string of an <svg class="ic">.
// icon('logo', 96) is the ORBIS emblem; logoSVG(size) returns a standalone copy (own gradients) for favicons.
// Shared gradients live in one hidden <svg> injected into <body> on import (ensureDefs()).
// Elements with data-ic="name" (and optional data-size) are filled by hydrateIcons(root).

const VB = 32;
const INK = '#5a3214'; // warm outline, never black
const O = `stroke="${INK}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"`;
const O2 = `stroke="${INK}" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round"`;
const HL = 'fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="1.3" stroke-linecap="round"';

// ---------------------------------------------------------------- gradients
const LIN = {
  gold: ['#fff7c2', '#ffd447', '#d88a17'],
  goldD: ['#ffd45e', '#c27a14'],
  silver: ['#ffffff', '#cdd8e8', '#8592ac'],
  steel: ['#f6f9ff', '#b4c2d8', '#6d7b98'],
  wood: ['#e9ae68', '#b46b2e', '#7e461c'],
  woodL: ['#ffe0a8', '#e7b06a'],
  stone: ['#eef0f6', '#b6bccb', '#7f879c'],
  red: ['#ffb2a2', '#f0453a', '#a81e22'],
  blue: ['#c9eeff', '#4aa8ff', '#1f55c8'],
  green: ['#d6ffbc', '#5bd352', '#21893a'],
  purple: ['#f0d4ff', '#b36bff', '#6430b8'],
  teal: ['#c8fff4', '#36d1c0', '#16857e'],
  leather: ['#e3a46a', '#a8622c', '#6e3a16'],
  parch: ['#fffaf0', '#f3dfaa', '#ddbc78'],
  bone: ['#ffffff', '#f2ead2', '#cdbf98'],
  pink: ['#ffd6e6', '#ff6f9f', '#c32a64'],
  orange: ['#ffe7a6', '#ffa52e', '#d8541a'],
  sky: ['#fff4b8', '#ffd25a'],
  night: ['#9fb8ff', '#4a5fd8'],
};
const RAD = {
  fire: ['#fffbd0', '#ffd23a', '#ff7a1a', '#d8301a'],
  mana: ['#ffffff', '#8fd8ff', '#3a8cff', '#2a4fc8'],
  orb: ['#ffffff', '#e2b8ff', '#9a52ff', '#5a2aa8'],
  glowG: ['#f0ffe0', '#7dff8a', 'rgba(60,220,90,0)'],
  glowY: ['#fffde8', '#ffe46a', 'rgba(255,200,40,0)'],
  glowB: ['#ffffff', '#a8e4ff', 'rgba(80,170,255,0)'],
};
function defsMarkup() {
  let s = logoDefs('hri-orl');
  for (const [k, c] of Object.entries(LIN)) s += `<linearGradient id="hri-${k}" x1="0" y1="0" x2=".35" y2="1">${c.map((col, i) => `<stop offset="${c.length === 1 ? 0 : i / (c.length - 1)}" stop-color="${col}"/>`).join('')}</linearGradient>`;
  for (const [k, c] of Object.entries(RAD)) s += `<radialGradient id="hri-${k}" cx=".38" cy=".34" r=".72">${c.map((col, i) => `<stop offset="${i / (c.length - 1)}" stop-color="${col}"/>`).join('')}</radialGradient>`;
  return s;
}
const g = (k) => `url(#hri-${k})`;
let defsDone = false;
export function ensureDefs() {
  if (defsDone || typeof document === 'undefined' || !document.body) return;
  defsDone = true;
  const d = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  d.setAttribute('aria-hidden', 'true');
  d.setAttribute('width', '0'); d.setAttribute('height', '0');
  d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
  d.innerHTML = `<defs>${defsMarkup()}</defs>`;
  document.body.prepend(d);
}

// ---------------------------------------------------------------- small builders
const gemShape = (cx, cy, s, grad) => {
  const p = (x, y) => `${(cx + x * s).toFixed(2)},${(cy + y * s).toFixed(2)}`;
  return `<polygon points="${p(-6, -2)} ${p(-3, -6)} ${p(3, -6)} ${p(6, -2)} ${p(0, 7)}" fill="${g(grad)}" ${O2}/>` +
    `<polyline points="${p(-6, -2)} ${p(6, -2)}" fill="none" stroke="${INK}" stroke-width="${0.8}" stroke-opacity=".55"/>` +
    `<polyline points="${p(-3, -6)} ${p(-2, -2)} ${p(0, 7)} ${p(2, -2)} ${p(3, -6)}" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width=".8"/>` +
    `<polygon points="${p(-3, -6)} ${p(-1, -6)} ${p(-4, -2)} ${p(-6, -2)}" fill="#fff" fill-opacity=".7"/>`;
};
const log = (cx, cy, r) =>
  `<line x1="${cx - 7}" y1="${cy - 6}" x2="${cx}" y2="${cy}" stroke="${INK}" stroke-width="${2 * r + 3}" stroke-linecap="round"/>` +
  `<line x1="${cx - 7}" y1="${cy - 6}" x2="${cx}" y2="${cy}" stroke="${g('wood')}" stroke-width="${2 * r}" stroke-linecap="round"/>` +
  `<line x1="${cx - 8.5}" y1="${cy - 5.2 - r * 0.55}" x2="${cx - 2}" y2="${cy - r * 0.6}" stroke="#ffd29a" stroke-opacity=".55" stroke-width="1.2" stroke-linecap="round"/>` +
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${g('woodL')}" ${O}/>` +
  `<circle cx="${cx}" cy="${cy}" r="${r * 0.55}" fill="none" stroke="#c98a48" stroke-width="1"/><circle cx="${cx}" cy="${cy}" r="${r * 0.18}" fill="#c98a48"/>`;
const sparkle = (x, y, r, col = '#fff') => `<path d="M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z" fill="${col}"/>`;
const shieldPath = 'M16 3.5 L26.5 7 V15.5 C26.5 22 21.5 26.5 16 29 C10.5 26.5 5.5 22 5.5 15.5 V7 Z';
const star = (cx, cy, R, r, n = 5, rot = -90) => {
  const pts = [];
  for (let i = 0; i < n * 2; i++) { const a = ((rot + (i * 180) / n) * Math.PI) / 180, q = i % 2 ? r : R; pts.push(`${(cx + Math.cos(a) * q).toFixed(2)},${(cy + Math.sin(a) * q).toFixed(2)}`); }
  return pts.join(' ');
};
const sword = (rot = 45, blade = 'steel', hilt = 'gold') =>
  `<g transform="rotate(${rot} 16 16)"><path d="M14.4 3.5 L16 1.5 L17.6 3.5 V20 H14.4 Z" fill="${g(blade)}" ${O2}/><line x1="16" y1="4" x2="16" y2="19" stroke="#fff" stroke-opacity=".7" stroke-width=".8"/>` +
  `<rect x="10" y="20" width="12" height="3" rx="1.5" fill="${g(hilt)}" ${O2}/><rect x="14.6" y="23" width="2.8" height="5.2" rx="1" fill="${g('leather')}" ${O2}/><circle cx="16" cy="29.4" r="1.9" fill="${g(hilt)}" ${O2}/></g>`;


// ---------------------------------------------------------------- the ORBIS emblem (drawn on a 64 grid)
// A hex-faceted planet on an orbit ring, crowned by a five-point crown whose jewels are the five factions.
const CROWN_JEWELS = ['#3ac84a', '#e0443a', '#4a86ff', '#ff8a1a', '#b05ae0']; // sylvan, necro, haven (centre), inferno, dungeon
function logoDefs(p) {
  const stops = (c) => c.map(([o, col, a = 1]) => `<stop offset="${o}" stop-color="${col}" stop-opacity="${a}"/>`).join('');
  return `<radialGradient id="${p}-sea" cx=".36" cy=".3" r=".8">${stops([[0, '#9cc6ff'], [0.45, '#3f74e6'], [1, '#162f86']])}</radialGradient>` +
    `<linearGradient id="${p}-land" x1="0" y1="0" x2=".3" y2="1">${stops([[0, '#c6f59a'], [0.5, '#4fc46e'], [1, '#1e7a4c']])}</linearGradient>` +
    `<radialGradient id="${p}-shade" cx=".34" cy=".28" r=".78">${stops([[0, '#ffffff', 0.55], [0.38, '#ffffff', 0], [0.75, '#0b1440', 0.12], [1, '#0b1440', 0.62]])}</radialGradient>` +
    `<linearGradient id="${p}-gold" x1="0" y1="0" x2=".25" y2="1">${stops([[0, '#fff8cc'], [0.35, '#ffd447'], [0.75, '#e0961e'], [1, '#a8620e']])}</linearGradient>` +
    `<linearGradient id="${p}-band" x1="0" y1="0" x2="0" y2="1">${stops([[0, '#ffe27a'], [1, '#b8700e']])}</linearGradient>`;
}
function logoBody(p) {
  const cx = 32, cy = 39, R = 19.5, s = 7.4, hh = Math.sqrt(3) * s, ox = -3.5, oy = 2.2;
  // project a flat hex grid onto the visible hemisphere (orthographic), so the facets curve like a globe
  const proj = (x, y) => { const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy) || 1e-6, a = Math.min(Math.PI / 2, d / R), k = (R * Math.sin(a)) / d; return [cx + dx * k, cy + dy * k]; };
  const land = (i, j) => ['0,0', '-1,-1', '-1,0', '0,1', '2,0', '2,-1', '3,0', '1,2'].includes(`${i},${j}`);
  let facets = '';
  for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) {
    const x = cx + ox + i * 1.5 * s, y = cy + oy + j * hh + (i & 1 ? hh / 2 : 0);
    if (Math.hypot(x - cx, y - cy) > R * 1.5) continue;
    const pts = [];
    for (let k = 0; k < 6; k++) { const an = (k * Math.PI) / 3; pts.push(proj(x + Math.cos(an) * s * 0.9, y + Math.sin(an) * s * 0.9)); }
    facets += `<polygon points="${pts.map(([a, b]) => `${+a.toFixed(1)},${+b.toFixed(1)}`).join(' ')}" fill="url(#${p}-${land(i, j) ? 'land' : 'sea'})"/>`;
  }
  const ring = (half) => `<path d="M3.5 ${half ? 44.5 : 44.5}A29 8.5 -12 0 ${half ? 0 : 1} 60.5 32.5" fill="none" stroke="#10183c" stroke-width="4.6" stroke-linecap="round"/>` +
    `<path d="M3.5 44.5A29 8.5 -12 0 ${half ? 0 : 1} 60.5 32.5" fill="none" stroke="url(#${p}-gold)" stroke-width="2.4" stroke-linecap="round"/>`;
  const tips = [[14.5, 9.5], [23, 5.5], [32, 2.8], [41, 5.5], [49.5, 9.5]];
  return ring(false) +
    `<circle cx="${cx}" cy="${cy}" r="${R + 1.4}" fill="#10183c"/><circle cx="${cx}" cy="${cy}" r="${R}" fill="#132a78"/>${facets}` +
    `<circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#${p}-shade)"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${R - 0.6}" fill="none" stroke="url(#${p}-gold)" stroke-width="1.3"/>` +
    `<path d="M19.5 31a14 14 0 0 1 8-8" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.6" stroke-linecap="round"/>` +
    ring(true) +
    // the crown
    `<path d="M18 22.5L14.5 9.5L19.8 15.5L23 5.5L27.6 13.2L32 2.8L36.4 13.2L41 5.5L44.2 15.5L49.5 9.5L46 22.5Q32 26.5 18 22.5Z" fill="url(#${p}-gold)" stroke="#4a2a0c" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<path d="M17.2 18.8Q32 22.6 46.8 18.8L46 22.5Q32 26.5 18 22.5Z" fill="url(#${p}-band)" stroke="#4a2a0c" stroke-width="1.2" stroke-linejoin="round"/>` +
    `<path d="M20.5 12.5l1.6 5M30.2 9l.9 8.5" stroke="#fff" stroke-opacity=".75" stroke-width="1.1" stroke-linecap="round"/>` +
    [24, 32, 40].map((x, i) => `<ellipse cx="${x}" cy="${21.6 + (i === 1 ? 0.9 : 0.3)}" rx="1.5" ry="1.1" fill="${['#e0443a', '#4a86ff', '#3ac84a'][i]}" stroke="#4a2a0c" stroke-width=".6"/>`).join('') +
    tips.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i === 2 ? 3.1 : 2.6}" fill="${CROWN_JEWELS[i]}" stroke="#2a1606" stroke-width="1.1"/><circle cx="${x - 0.8}" cy="${y - 0.9}" r="${i === 2 ? 1 : 0.85}" fill="#fff" fill-opacity=".85"/>`).join('');
}
// a standalone emblem (own gradients) for favicons and anywhere the shared defs are not available
// tile = true puts it on a rounded night-sky tile (home-screen / apple-touch icon)
export function logoSVG(size = 64, tile = false) {
  const bg = tile ? `<radialGradient id="orf-bg" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#2a3d8e"/><stop offset="1" stop-color="#0a1030"/></radialGradient>` : '';
  const body = tile ? `<rect width="64" height="64" rx="14" fill="url(#orf-bg)"/><g transform="translate(6.4 6.4) scale(.8)">${logoBody('orf')}</g>` : logoBody('orf');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64"><defs>${logoDefs('orf')}${bg}</defs>${body}</svg>`;
}

// ---------------------------------------------------------------- the icons (32×32)
const I = {
  logo: `<g transform="scale(.5)">${logoBody('hri-orl')}</g>`,
  // ---------- resources
  gold: `<path d="M3.5 15v8.5a9 3.6 0 0 0 18 0V15" fill="${g('goldD')}" ${O}/><path d="M3.5 18a9 3.6 0 0 0 18 0M3.5 21a9 3.6 0 0 0 18 0" fill="none" stroke="${INK}" stroke-width="1" stroke-opacity=".7"/>` +
    `<ellipse cx="12.5" cy="15" rx="9" ry="3.6" fill="${g('gold')}" ${O}/><ellipse cx="12.5" cy="15" rx="5.2" ry="1.9" fill="none" stroke="#c98a17" stroke-width="1"/>` +
    `<circle cx="22.5" cy="20.5" r="7.2" fill="${g('gold')}" ${O}/><circle cx="22.5" cy="20.5" r="4.6" fill="none" stroke="#c07a12" stroke-width="1.1"/><path d="M22.5 17.6v5.8M20.6 19h3.8" stroke="#a8620c" stroke-width="1.2" stroke-linecap="round"/>` +
    `<path d="M17.6 17.4a5.6 5.6 0 0 1 4-2.8" ${HL}/>${sparkle(27.5, 11, 2.6)}`,
  wood: `${log(13, 15, 4.6)}${log(9.5, 24, 4.6)}${log(20.5, 24, 4.6)}`,
  ore: `<polygon points="3.5,25 6.5,17 11,14.5 14,19 12,26.5" fill="${g('stone')}" ${O}/>` +
    `<polygon points="9,26.5 11,14 17,7 25,8.5 29,18 25.5,26.5" fill="${g('stone')}" ${O}/>` +
    `<polygon points="11,14 17,7 19,13 14.5,18" fill="#ffffff" fill-opacity=".6"/><polygon points="19,13 25,8.5 29,18 21,17" fill="#dfe4ef" fill-opacity=".6"/>` +
    `<polygon points="14.5,18 19,13 21,17 25.5,26.5 15,26.5" fill="#8a91a6" fill-opacity=".35"/><path d="M14.5 18L19 13l2 4" fill="none" stroke="${INK}" stroke-width=".9" stroke-opacity=".5"/>` +
    `<circle cx="22" cy="21" r="1.3" fill="#f5c642"/><circle cx="17" cy="23" r=".9" fill="#f5c642"/>`,
  gems: `${gemShape(9.5, 16, 0.9, 'green')}${gemShape(22.5, 15, 0.9, 'blue')}${gemShape(16, 19.5, 1.25, 'red')}${sparkle(26, 6, 2.4)}`,

  // ---------- map HUD
  hero: `<path d="M16 2.5c3 0 7 2 6.5 6.5-2.6-1.2-4.6-1.4-6.5-1.4" fill="${g('red')}" ${O2}/>` +
    `<path d="M7 18c0-7 4-10.5 9-10.5S25 11 25 18v5.5c0 2-1.5 4.5-4 5H11c-2.5-.5-4-3-4-5Z" fill="${g('steel')}" ${O}/>` +
    `<path d="M9.5 17.5h13" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/><path d="M9.5 17.5h13" stroke="#2c3a66" stroke-width="1.4" stroke-linecap="round"/>` +
    `<path d="M16 20v8" stroke="${INK}" stroke-width="1" stroke-opacity=".6"/><path d="M12.5 21.5v4M19.5 21.5v4" stroke="${INK}" stroke-width="1" stroke-opacity=".45" stroke-linecap="round"/>` +
    `<path d="M10 14c.6-3 2.8-5 5.5-5.4" ${HL}/><path d="M16 7.6V5" stroke="${g('gold')}" stroke-width="2.4" stroke-linecap="round"/>`,
  town: `<path d="M4 29V15h3v-2h2.5v2H11v14Z" fill="${g('stone')}" ${O}/><path d="M21 29V15h1.5v-2H25v2h3v14Z" fill="${g('stone')}" ${O}/>` +
    `<path d="M3.2 15 L7.5 6.5 L11.8 15Z" fill="${g('blue')}" ${O}/><path d="M20.2 15 L24.5 6.5 L28.8 15Z" fill="${g('blue')}" ${O}/>` +
    `<path d="M9 29V18h1.8v-2h2.4v2h1.6v-2h2.4v2h1.6v-2h2.4v2H23v11Z" fill="${g('stone')}" ${O}/>` +
    `<path d="M13 29v-5a3 3 0 0 1 6 0v5Z" fill="${g('wood')}" ${O2}/><path d="M16 21.5V24" stroke="${INK}" stroke-width=".8"/>` +
    `<path d="M7.5 6.5V2.5" stroke="${INK}" stroke-width="1.2"/><path d="M7.7 2.5h4.2l-1.2 1.3 1.2 1.3H7.7Z" fill="${g('red')}" ${O2}/>` +
    `<rect x="6.6" y="18" width="1.8" height="3" rx=".9" fill="#ffd862" stroke="${INK}" stroke-width=".7"/><rect x="23.6" y="18" width="1.8" height="3" rx=".9" fill="#ffd862" stroke="${INK}" stroke-width=".7"/>`,
  end: `<circle cx="16" cy="16" r="13" fill="${g('night')}" ${O}/>` +
    `<path d="M19.5 7.2a9 9 0 1 0 5.3 12.6A8 8 0 0 1 19.5 7.2Z" fill="${g('sky')}" ${O2}/>` +
    `${sparkle(23.5, 10, 2.4)}${sparkle(9, 9.5, 1.6)}${sparkle(25, 22.5, 1.4)}`,
  menu: `<rect x="4" y="5.5" width="24" height="5" rx="2.5" fill="${g('gold')}" ${O}/><rect x="4" y="13.5" width="24" height="5" rx="2.5" fill="${g('gold')}" ${O}/><rect x="4" y="21.5" width="24" height="5" rx="2.5" fill="${g('gold')}" ${O}/>` +
    `<path d="M7 7.3h12M7 15.3h12M7 23.3h12" ${HL}/>`,
  close: `<path d="M8 8l16 16M24 8L8 24" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="M8 8l16 16M24 8L8 24" stroke="${g('gold')}" stroke-width="3.6" stroke-linecap="round"/>`,
  check: `<path d="M5.5 16.5l6.5 6.5L26.5 8.5" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.5 16.5l6.5 6.5L26.5 8.5" fill="none" stroke="${g('green')}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>`,
  lock: `<path d="M10.5 14v-3.5a5.5 5.5 0 0 1 11 0V14" fill="none" stroke="${INK}" stroke-width="4.2"/><path d="M10.5 14v-3.5a5.5 5.5 0 0 1 11 0V14" fill="none" stroke="${g('steel')}" stroke-width="2.2"/>` +
    `<rect x="7" y="13.5" width="18" height="14" rx="3" fill="${g('gold')}" ${O}/><circle cx="16" cy="19.5" r="2" fill="${INK}"/><path d="M16 20v4" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>`,
  day: `<g stroke="${INK}" stroke-width="1" fill="${g('orange')}">${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<polygon transform="rotate(${a} 16 16)" points="16,1.5 18.4,7.5 13.6,7.5"/>`).join('')}</g><circle cx="16" cy="16" r="8" fill="${g('fire')}" ${O}/><path d="M11.6 13.5a5 5 0 0 1 3.6-3.1" ${HL}/>`,
  calendar: `<rect x="4.5" y="6" width="23" height="22" rx="3" fill="${g('parch')}" ${O}/><path d="M4.5 9a3 3 0 0 1 3-3h17a3 3 0 0 1 3 3v3.5h-23Z" fill="${g('red')}" ${O2}/>` +
    `<path d="M10 3.5v5M22 3.5v5" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/><g fill="#b07a3a">${[0, 1, 2, 3].map((x) => [0, 1, 2].map((y) => `<rect x="${8 + x * 4.4}" y="${15 + y * 4}" width="2.6" height="2.4" rx=".6"/>`).join('')).join('')}</g>`,

  // ---------- battle bar
  wait: `<path d="M8 3.5h16M8 28.5h16" stroke="${INK}" stroke-width="4.4" stroke-linecap="round"/><path d="M8 3.5h16M8 28.5h16" stroke="${g('wood')}" stroke-width="2.6" stroke-linecap="round"/>` +
    `<path d="M10 5.5h12c0 6-5 8-5 10.5s5 4.5 5 10.5H10c0-6 5-8 5-10.5S10 11.5 10 5.5Z" fill="#e6f6ff" fill-opacity=".85" ${O}/>` +
    `<path d="M12.3 9h7.4c-.7 2.6-3.7 4-3.7 6-0 0-3-3.4-3.7-6Z" fill="${g('orange')}"/><path d="M11.4 26.4c.6-3 3.4-4.4 4.6-4.6 1.2.2 4 1.6 4.6 4.6Z" fill="${g('orange')}"/><path d="M16 16.5v5" stroke="#ffb030" stroke-width="1.2"/>` +
    `<path d="M11.8 7.2c.2 1.8 1 3 2 4" ${HL}/>`,
  defense: `<path d="${shieldPath}" fill="${g('blue')}" ${O}/><path d="M16 6.2 L24 8.9 V15.5 C24 20.6 20.3 24.2 16 26.3 C11.7 24.2 8 20.6 8 15.5 V8.9 Z" fill="none" stroke="${g('gold')}" stroke-width="1.8"/>` +
    `<path d="M16 8.5v15.5M10.5 14.5h11" stroke="${g('gold')}" stroke-width="2.8" stroke-linecap="round"/><path d="M9.6 10c.2 5 1.2 9 4 12.2" ${HL}/>`,
  attack: sword(45),
  spellbook: `<path d="M7 4.5h16.5a2 2 0 0 1 2 2V27a1.5 1.5 0 0 1-1.5 1.5H8.5A2.5 2.5 0 0 1 6 26V6.5a2 2 0 0 1 1-2Z" fill="${g('purple')}" ${O}/>` +
    `<path d="M8.5 28.5A2.5 2.5 0 0 1 6 26a2.5 2.5 0 0 1 2.5-2.5h17" fill="${g('parch')}" ${O2}/>` +
    `<polygon points="${star(16, 13.5, 6.2, 2.6)}" fill="${g('gold')}" ${O2}/><path d="M22.5 4.5h3v4.2l-3-1.2Z" fill="${g('gold')}" ${O2}/><path d="M9.5 6.5v15" stroke="#fff" stroke-opacity=".45" stroke-width="1.2" stroke-linecap="round"/>`,
  auto: `<g transform="translate(16 16)"><path d="${(() => { let d = ''; for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; const c = (r, da) => `${(Math.cos(a + da) * r).toFixed(2)} ${(Math.sin(a + da) * r).toFixed(2)}`; d += `${i ? 'L' : 'M'}${c(9.5, -0.32)}L${c(13, -0.2)}L${c(13, 0.2)}L${c(9.5, 0.32)}`; } return d + 'Z'; })()}" fill="${g('steel')}" ${O}/>` +
    `<circle r="5.4" fill="${g('gold')}" ${O}/><circle r="2" fill="${g('wood')}" stroke="${INK}" stroke-width=".9"/></g><path d="M8 11.5a9.5 9.5 0 0 1 5-4.4" ${HL}/>`,
  quick: `<path d="M3.5 7.5 L15 16 L3.5 24.5Z" fill="${g('gold')}" ${O}/><path d="M15 7.5 L26.5 16 L15 24.5Z" fill="${g('gold')}" ${O}/><path d="M27 7v18" stroke="${INK}" stroke-width="4.4" stroke-linecap="round"/><path d="M27 7v18" stroke="${g('gold')}" stroke-width="2.4" stroke-linecap="round"/>` +
    `<path d="M5.5 10.5l5 3.6M17 10.5l5 3.6" ${HL}/>`,

  // ---------- primary stats
  power: `<path d="M9.5 28.5L19 13" stroke="${INK}" stroke-width="4.2" stroke-linecap="round"/><path d="M9.5 28.5L19 13" stroke="${g('wood')}" stroke-width="2.4" stroke-linecap="round"/>` +
    `<circle cx="21" cy="10" r="9" fill="${g('glowY')}"/><path d="M15.5 12.5c-1-3.5 2-7 4.5-6.5M26.5 7.5c1 3.5-2 7-4.5 6.5" fill="none" stroke="${g('gold')}" stroke-width="1.8" stroke-linecap="round"/>` +
    `<circle cx="21" cy="10" r="4.4" fill="${g('orb')}" ${O2}/><circle cx="19.6" cy="8.6" r="1.3" fill="#fff"/>${sparkle(28, 18, 2.2, '#ffe680')}${sparkle(12.5, 5, 1.8, '#ffe680')}`,
  knowledge: `<path d="M16 9c-3-2.5-8-3-12.5-2v18c4.5-1 9.5-.5 12.5 2Z" fill="${g('parch')}" ${O}/><path d="M16 9c3-2.5 8-3 12.5-2v18c-4.5-1-9.5-.5-12.5 2Z" fill="${g('parch')}" ${O}/>` +
    `<path d="M3.5 25c4.5-1 9.5-.5 12.5 2 3-2.5 8-3 12.5-2v2.5c-4.5-1-9.5-.5-12.5 2-3-2.5-8-3-12.5-2Z" fill="${g('blue')}" ${O2}/>` +
    `<path d="M6.5 11.5c2.5-.4 4.8 0 6.6 1M6.5 15c2.5-.4 4.8 0 6.6 1M6.5 18.5c2.5-.4 4.8 0 6.6 1M19 12.5c1.8-1 4.1-1.4 6.5-1M19 16c1.8-1 4.1-1.4 6.5-1M19 19.5c1.8-1 4.1-1.4 6.5-1" stroke="#b08850" stroke-width="1" fill="none" stroke-linecap="round"/>`,
  mana: `<path d="M16 3C16 3 6.5 14 6.5 20a9.5 9.5 0 0 0 19 0C25.5 14 16 3 16 3Z" fill="${g('mana')}" ${O}/><path d="M10.5 19.5c0 2.6 1.6 4.6 3.6 5.4" ${HL}/>${sparkle(19.5, 17, 2.6)}`,
  movement: `<path d="M10 3.5h9v12.5l7.2 4.5c1.6 1 2.3 2.6 2.3 4.5v2.5H6.5V20c1.8-1 3.5-3 3.5-6Z" fill="${g('leather')}" ${O}/>` +
    `<path d="M9 3.5h11v3.4H9Z" fill="${g('wood')}" ${O2}/><path d="M6.5 25h22v2.5h-22Z" fill="${g('wood')}" ${O2}/><path d="M12.5 9.5v6.5c0 1.6-.8 3-2 4" ${HL}/>` +
    `<circle cx="20.5" cy="18.7" r="1" fill="${g('gold')}"/><circle cx="23.5" cy="20.6" r="1" fill="${g('gold')}"/>`,
  experience: `<polygon points="${star(16, 16.5, 13.5, 6)}" fill="${g('gold')}" ${O}/><path d="M11 11.6 L15.2 6.2" ${HL}/>${sparkle(26, 5.5, 2.6)}`,
  hp: `<path d="M16 28C8 22 3.5 17 3.5 11.5A6.5 6.5 0 0 1 16 8.5 6.5 6.5 0 0 1 28.5 11.5C28.5 17 24 22 16 28Z" fill="${g('red')}" ${O}/><path d="M7.5 10.5a3.5 3.5 0 0 1 3.5-2.5" ${HL}/>`,
  damage: `<polygon points="${star(16, 16, 14, 6, 8, -90)}" fill="${g('orange')}" ${O}/><polygon points="${star(16, 16, 7, 3.2, 8, -67)}" fill="#fff6c0"/>`,
  shots: `<g transform="rotate(-45 16 16)"><path d="M16 2.5l3.5 5h-7Z" fill="${g('steel')}" ${O2}/><path d="M16 7.5v18" stroke="${INK}" stroke-width="3"/><path d="M16 7.5v18" stroke="${g('wood')}" stroke-width="1.6"/>` +
    `<path d="M16 22l-3.5 6v-3.5L16 19l3.5 5.5V28Z" fill="${g('red')}" ${O2}/></g>`,
  fly: `<path d="M4 25C6 14 14 5.5 28 4c-3 3-4 6-3.5 7.5-3 1-4.5 3-4.5 4.5-2.5.5-4 2.5-4.5 4-3 1-6 3-11.5 5Z" fill="${g('silver')}" ${O}/>` +
    `<path d="M9 21c4.5-6 9.5-10.5 15-13M15.2 18.6l5-1.5M19.6 14.2l4.6-1.7" fill="none" stroke="#8592ac" stroke-width="1" stroke-linecap="round"/>`,
  morale: `<path d="M3.5 22.5C10 22 17 17 20.5 5.5L28.5 12C22 22 13 26.5 4.5 25.5Z" fill="${g('gold')}" ${O}/><ellipse cx="24.5" cy="8.75" rx="5.2" ry="2.3" transform="rotate(39 24.5 8.75)" fill="${g('goldD')}" ${O2}/>` +
    `<path d="M10.5 21.2l2.3 3.6M16 17.8l3.2 3.2" stroke="${g('wood')}" stroke-width="2.4"/><path d="M5.5 23c5.5-.6 10.5-4 14-11" ${HL}/><path d="M3.5 22.5c-1.2.6-1.3 2.4 1 3" stroke="${INK}" stroke-width="1.4" fill="none"/>` +
    `<path d="M11 25.3c1 2.6 4.5 3.6 8 2.4" stroke="${g('red')}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
  luck: `<g transform="translate(16 13.5)">${[0, 90, 180, 270].map((a) => `<path transform="rotate(${a + 45})" d="M0 0C-1.5-2-5.5-3.5-6.5-7.5-6.8-9.8-4.4-10.8-2.5-9.6-1-8.7 0-7 0-5.5 0-7 1-8.7 2.5-9.6 4.4-10.8 6.8-9.8 6.5-7.5 5.5-3.5 1.5-2 0 0Z" fill="${g('green')}" ${O2}/>`).join('')}</g>` +
    `<path d="M16 14c0 6 1.5 10 4.5 14.5" stroke="${INK}" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="M16 14c0 6 1.5 10 4.5 14.5" stroke="#4cbb3c" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,

  // ---------- secondary skills
  logistics: `<path d="M8 27V14a8 8 0 0 1 16 0v13h-5.2V14.5a2.8 2.8 0 0 0-5.6 0V27Z" fill="${g('steel')}" ${O}/>` +
    `<g fill="${INK}">${[[10.6, 24], [10.4, 19], [11.6, 13.5], [21.4, 24], [21.6, 19], [20.4, 13.5]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".9"/>`).join('')}</g><path d="M10.6 11.5a6 6 0 0 1 4.4-3.8" ${HL}/>` +
    `<path d="M3 9.5h4M2 14h3.5M3 18.5h3" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".9"/><path d="M3 9.5h4M2 14h3.5M3 18.5h3" stroke="${INK}" stroke-width="2.8" stroke-linecap="round" opacity=".25"/>`,
  offense: `<g transform="translate(1.6 1.6) scale(.9)">${sword(-45, 'steel', 'red')}${sword(45, 'steel', 'gold')}</g>`,
  archery: `<path d="M8 3.5C20 6 24 14 24 16s-4 10-16 12.5" fill="none" stroke="${INK}" stroke-width="4.4" stroke-linecap="round"/><path d="M8 3.5C20 6 24 14 24 16s-4 10-16 12.5" fill="none" stroke="${g('wood')}" stroke-width="2.6" stroke-linecap="round"/>` +
    `<path d="M8.5 4v24" stroke="#fff8e0" stroke-width="1"/><path d="M5 16h22" stroke="${INK}" stroke-width="2.8" stroke-linecap="round"/><path d="M5 16h22" stroke="${g('woodL')}" stroke-width="1.4"/>` +
    `<path d="M30 16l-5-3v6Z" fill="${g('steel')}" ${O2}/><path d="M3 13l4 3-4 3M6 13l4 3-4 3" fill="none" stroke="${g('red')}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
  armorer: `<path d="M9 4.5l4 2.5h6l4-2.5 5 3.5-2.5 7-2 .5V27c-3 2-11 2-14 0V15.5L7 15 4.5 8Z" fill="${g('steel')}" ${O}/>` +
    `<path d="M13 7c0 3 1.5 4.5 3 4.5s3-1.5 3-4.5" fill="none" stroke="${INK}" stroke-width="1.1"/><path d="M16 11.5v15.5" stroke="${INK}" stroke-width="1" stroke-opacity=".5"/>` +
    `<path d="M9.5 19.5c4 1.5 9 1.5 13 0M9.5 23.5c4 1.5 9 1.5 13 0" fill="none" stroke="${g('gold')}" stroke-width="1.6"/><path d="M11 13v6" ${HL}/>`,
  wisdom: `<path d="M8 6h16v18a3 3 0 0 1-3 3H6.5" fill="${g('parch')}" ${O}/><rect x="4" y="3.5" width="20" height="5" rx="2.5" fill="${g('woodL')}" ${O}/>` +
    `<path d="M6.5 27a3 3 0 0 1 0-6h14a3 3 0 0 0 0 6" fill="${g('parch')}" ${O2}/><path d="M11 12.5h9M11 15.5h9M11 18.5h6" stroke="#9a7442" stroke-width="1.2" stroke-linecap="round"/>` +
    `<circle cx="25" cy="22.5" r="3.4" fill="${g('red')}" ${O2}/>`,
  sorcery: `<path d="M10 28.5h12l-2-5h-8Z" fill="${g('wood')}" ${O}/><path d="M9 28.5h14" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/>` +
    `<circle cx="16" cy="13.5" r="10" fill="${g('orb')}" ${O}/><path d="M10.5 10a6.5 6.5 0 0 1 4.2-3.5" ${HL}/>${sparkle(18.5, 15, 3.2)}${sparkle(13, 18, 1.7, '#ffe6ff')}${sparkle(27.5, 5, 2.2, '#ffe680')}`,
  leadership: `<path d="M8.5 29V3" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/><path d="M8.5 29V3" stroke="${g('wood')}" stroke-width="1.8" stroke-linecap="round"/>` +
    `<path d="M10 5h16l-3.5 5.5L26 16H10Z" fill="${g('red')}" ${O}/><polygon points="${star(16.5, 10.5, 3.6, 1.6)}" fill="${g('gold')}"/><circle cx="8.5" cy="3" r="2" fill="${g('gold')}" ${O2}/>`,
  scouting: `<g transform="rotate(-32 16 16)"><rect x="2" y="12.6" width="9" height="6.8" rx="1.2" fill="${g('leather')}" ${O}/><rect x="10.5" y="11.5" width="9" height="9" rx="1.2" fill="${g('gold')}" ${O}/>` +
    `<rect x="19" y="10.4" width="10" height="11.2" rx="1.4" fill="${g('leather')}" ${O}/><ellipse cx="29" cy="16" rx="1.6" ry="5.4" fill="${g('blue')}" ${O2}/><path d="M12 13.5h6M21 12.6h6" ${HL}/></g>`,
  estates: `<path d="M11 9.5C6 13 4.5 18 4.5 21.5c0 4.5 4 7 11.5 7s11.5-2.5 11.5-7c0-3.5-1.5-8.5-6.5-12Z" fill="${g('leather')}" ${O}/>` +
    `<path d="M11.5 9.5l-2-5c2 1 4.5 1 6.5 0 2 1 4.5 1 6.5 0l-2 5Z" fill="${g('leather')}" ${O}/><path d="M10.5 9.6h11" stroke="${g('gold')}" stroke-width="2.4" stroke-linecap="round"/>` +
    `<circle cx="16" cy="19.5" r="5" fill="${g('gold')}" ${O2}/><path d="M16 16.8v5.4M14.4 18.2h3.2" stroke="#a8620c" stroke-width="1.1" stroke-linecap="round"/><path d="M8.5 16c-.8 1.6-1.2 3.2-1.2 4.8" ${HL}/>`,
  necromancy: `<circle cx="16" cy="15" r="14" fill="${g('glowG')}"/><path d="M16 3.5c-6.5 0-10.5 4.5-10.5 10 0 3.5 1.6 5.6 3.5 6.8V25a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4.7c1.9-1.2 3.5-3.3 3.5-6.8 0-5.5-4-10-10.5-10Z" fill="${g('bone')}" ${O}/>` +
    `<ellipse cx="11.5" cy="15" rx="3" ry="3.3" fill="#3a6a34"/><ellipse cx="20.5" cy="15" rx="3" ry="3.3" fill="#3a6a34"/><circle cx="11.5" cy="15" r="1.4" fill="#9dff8a"/><circle cx="20.5" cy="15" r="1.4" fill="#9dff8a"/>` +
    `<path d="M16 18.5l-1.6 3h3.2Z" fill="#8a7a5a"/><path d="M12.5 27v-3M16 27v-3M19.5 27v-3" stroke="${INK}" stroke-width="1" stroke-opacity=".7"/><path d="M8.5 10a7 7 0 0 1 4-3.6" ${HL}/>`,

  // ---------- spells
  arrow: `<path d="M3 29l7-7" stroke="#9fe2ff" stroke-width="5" stroke-linecap="round" opacity=".55"/><path d="M5 27L24 8" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/><path d="M5 27L24 8" stroke="${g('blue')}" stroke-width="1.8" stroke-linecap="round"/>` +
    `<path d="M29 3l-3.2 9.2-6-6Z" fill="${g('silver')}" ${O2}/><path d="M7 25.5l-4.5 0L5 21l3.4 1.6M6.5 25l0 4.5L11 27l-1.6-3.4" fill="${g('blue')}" ${O2}/>${sparkle(26, 18, 2.6, '#bff0ff')}${sparkle(13, 9, 2, '#bff0ff')}`,
  bless: `<ellipse cx="16" cy="9" rx="10" ry="3.6" fill="none" stroke="${INK}" stroke-width="4"/><ellipse cx="16" cy="9" rx="10" ry="3.6" fill="none" stroke="${g('gold')}" stroke-width="2.4"/>` +
    `<path d="M16 13.5 L18.6 20.6 L26 23 L18.6 25.4 L16 31 L13.4 25.4 L6 23 L13.4 20.6Z" fill="${g('sky')}" ${O2}/>${sparkle(6, 14.5, 2.4, '#fff3a0')}${sparkle(26.5, 15, 2, '#fff3a0')}`,
  stoneskin: `<path d="${shieldPath}" fill="${g('stone')}" ${O}/><path d="M16 3.5l-2 6 4 4-3 5 3 4-2 6.5M14 9.5l-5-1M18 13.5l7-1.5M15 18.5l-8 .5M18 22.5l5 1" fill="none" stroke="${INK}" stroke-width="1" stroke-opacity=".6" stroke-linejoin="round"/>` +
    `<path d="M8 9.5v6c0 3 1 6 3 8" ${HL}/>`,
  cure: `<path d="M16 28.5C8 22.5 3.5 17.5 3.5 12A6.5 6.5 0 0 1 16 9 6.5 6.5 0 0 1 28.5 12C28.5 17.5 24 22.5 16 28.5Z" fill="${g('green')}" ${O}/>` +
    `<path d="M16 12.5v10M11 17.5h10" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/><path d="M7.5 11a3.5 3.5 0 0 1 3.5-2.5" ${HL}/>`,
  haste: `<path d="M12 6h8v10.5l5.6 3.5c1.4.9 2.4 2.4 2.4 4V27H8v-5.5c1.5-1 4-2.5 4-5.5Z" fill="${g('green')}" ${O}/><path d="M8 24.5h20V27H8Z" fill="${g('gold')}" ${O2}/>` +
    `<path d="M12 9C8.5 7 5 7.5 2.5 9.5 5 10 7 11 8 12.5 5.5 12.5 3.8 13.6 3 15.5c2.8-.3 5.6.2 9 1.5" fill="${g('silver')}" ${O2}/><path d="M2 21h4M1 25h5" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>`,
  slow: `<path d="M4 26.5h21c2.5 0 3.5-2 3.5-3.5l-1-9.5" fill="${g('green')}" ${O}/><path d="M27.8 13.5l-1.8-6M28.5 13.5l2-6" stroke="${INK}" stroke-width="1.2" stroke-linecap="round"/><circle cx="26" cy="7" r="1.2" fill="${INK}"/><circle cx="30.5" cy="7.3" r="1.2" fill="${INK}"/>` +
    `<circle cx="14.5" cy="17" r="9" fill="${g('orange')}" ${O}/><path d="M14.5 17m-1.5 0a1.5 1.5 0 1 1 3 0 3 3 0 1 1-6 0 4.6 4.6 0 1 1 9.2 0 6.2 6.2 0 1 1-12.4 0" fill="none" stroke="#a8541a" stroke-width="1.2" stroke-linecap="round"/>`,
  bolt: `<circle cx="16" cy="16" r="15" fill="${g('glowB')}"/><path d="M19.5 2 L7.5 18 H14.5 L11.5 30 L25 12.5 H17.5 L21.5 2Z" fill="${g('sky')}" ${O}/><path d="M18.4 5 L11 15.5" ${HL}/>`,
  fireball: `<path d="M3.5 20.5a9.5 9.5 0 0 0 19 0c0-2.4-.8-4.6-2.2-6.4L30 2.5 17.6 9.6 22 3.5 12.6 11.2C7.5 11.8 3.5 15.8 3.5 20.5Z" fill="${g('orange')}" ${O}/>` +
    `<circle cx="13" cy="20.5" r="7" fill="${g('fire')}"/><circle cx="11.5" cy="19" r="3.4" fill="#fffbe0"/><path d="M6.4 17.5a7 7 0 0 1 3.4-4.2" ${HL}/>`,

  // ---------- town: tabs and building categories
  build: `<g transform="rotate(-40 16 16)"><rect x="14.5" y="10" width="3.4" height="19" rx="1.4" fill="${g('wood')}" ${O}/><path d="M7 4.5h15c1.5 0 2.5 1.2 2.5 2.5v3.5c0 1.3-1 2.5-2.5 2.5H11c-2 0-4-2-4-4Z" fill="${g('steel')}" ${O}/>` +
    `<path d="M10 6.5h11" ${HL}/></g>`,
  recruit: `<g transform="rotate(-38 16 16)"><path d="M16 1.5l3.4 6.5h-6.8Z" fill="${g('steel')}" ${O2}/><path d="M16 8v21" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/><path d="M16 8v21" stroke="${g('wood')}" stroke-width="1.8"/><path d="M12.5 9.5c1.5 2 5.5 2 7 0" stroke="${g('red')}" stroke-width="2" fill="none" stroke-linecap="round"/></g>` +
    `<path d="M15 14.5l10-2.5v8.5c0 4-3.5 7-6.5 8-3-1-6-3.5-6-7.5V14Z" fill="${g('red')}" ${O}/><path d="M19 15.2v11M14.3 19.8h9.4" stroke="${g('gold')}" stroke-width="1.8" stroke-linecap="round"/>`,
  army: `<path d="M7 29V3" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/><path d="M7 29V3" stroke="${g('wood')}" stroke-width="1.8" stroke-linecap="round"/>` +
    `<path d="M8.5 4.5h17v15l-8.5-3.5-8.5 3.5Z" fill="${g('blue')}" ${O}/><path d="M14 8.5l3 4 3-4" fill="none" stroke="${g('gold')}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7" cy="3" r="2" fill="${g('gold')}" ${O2}/>`,
  more: `<circle cx="7" cy="16" r="3.6" fill="${g('gold')}" ${O}/><circle cx="16" cy="16" r="3.6" fill="${g('gold')}" ${O}/><circle cx="25" cy="16" r="3.6" fill="${g('gold')}" ${O}/>`,
  hall: `<path d="M3.5 12.5 L16 4 L28.5 12.5Z" fill="${g('gold')}" ${O}/><rect x="4" y="12.5" width="24" height="3" fill="${g('stone')}" ${O2}/>` +
    `${[6.5, 12, 17.5, 23].map((x) => `<rect x="${x}" y="15.5" width="2.6" height="9.5" fill="${g('silver')}" stroke="${INK}" stroke-width=".9"/>`).join('')}` +
    `<path d="M3 25h26v3.5H3Z" fill="${g('stone')}" ${O}/><circle cx="16" cy="9.6" r="1.6" fill="${g('red')}"/>`,
  fort: `<path d="M3.5 29V13h3.5v3h3.5v-3h3.5v3h3.5v-3h3.5v3h3.5v-3h3.5v16Z" fill="${g('stone')}" ${O}/>` +
    `<path d="M3.5 21.5h25M9 13v8.5M16 21.5V29M22.5 13v8.5" stroke="${INK}" stroke-width=".9" stroke-opacity=".4"/>` +
    `<path d="M12.5 29v-4.5a3.5 3.5 0 0 1 7 0V29Z" fill="${g('wood')}" ${O2}/><path d="M16 13V3" stroke="${INK}" stroke-width="1.2"/><path d="M16.2 3h7l-2 2 2 2h-7Z" fill="${g('blue')}" ${O2}/>`,
  market: `<path d="M16 5v21" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/><path d="M16 5v21" stroke="${g('gold')}" stroke-width="1.8"/><path d="M10 28h12" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><path d="M10 28h12" stroke="${g('gold')}" stroke-width="2.4" stroke-linecap="round"/>` +
    `<path d="M5 8.5h22" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><path d="M5 8.5h22" stroke="${g('wood')}" stroke-width="1.6" stroke-linecap="round"/>` +
    `<path d="M5 9L2 17M5 9l3 8M27 9l-3 8M27 9l3 8" stroke="${INK}" stroke-width=".9"/>` +
    `<path d="M1 17h8a4 3 0 0 1-8 0ZM23 17h8a4 3 0 0 1-8 0Z" fill="${g('gold')}" ${O2}/><circle cx="16" cy="4.5" r="2.2" fill="${g('gold')}" ${O2}/>`,
  tavern: `<path d="M22 11h3a4 4 0 0 1 4 4v3a4 4 0 0 1-4 4h-3" fill="none" stroke="${INK}" stroke-width="4.4"/><path d="M22 11h3a4 4 0 0 1 4 4v3a4 4 0 0 1-4 4h-3" fill="none" stroke="${g('wood')}" stroke-width="2.4"/>` +
    `<path d="M5 9h17v17.5a2.5 2.5 0 0 1-2.5 2.5h-12A2.5 2.5 0 0 1 5 26.5Z" fill="${g('wood')}" ${O}/><path d="M5 14h17M5 23h17" stroke="${g('gold')}" stroke-width="1.6"/>` +
    `<path d="M4 10.5C3 6.5 6 4 9 5c1-2.5 5-3 7-1 2.5-1.5 6.5 0 6.5 3 1.5.7 1.5 3 0 3.5Z" fill="#fffaf0" ${O2}/><path d="M8.5 16.5v7" ${HL}/>`,
  mage: `<path d="M10 29V13.5h12V29Z" fill="${g('stone')}" ${O}/><path d="M8 13.5 L16 1.5 L24 13.5Z" fill="${g('purple')}" ${O}/>` +
    `<path d="M14 29v-4.5a2 2 0 0 1 4 0V29Z" fill="${g('wood')}" ${O2}/><rect x="14.4" y="16.5" width="3.2" height="4.4" rx="1.6" fill="#ffe46a" stroke="${INK}" stroke-width=".8"/>` +
    `${sparkle(16, 9, 2.6, '#ffe680')}${sparkle(26.5, 6, 2.2, '#e6c8ff')}${sparkle(5.5, 9, 1.8, '#e6c8ff')}`,
  dwelling: `<path d="M2.5 27 L14 5 L25.5 27Z" fill="${g('red')}" ${O}/><path d="M14 5 L20 27" stroke="${INK}" stroke-width=".9" stroke-opacity=".45"/><path d="M14 27 L14 17 L18.5 27Z" fill="#7a2418" ${O2}/>` +
    `<path d="M14 5V2" stroke="${INK}" stroke-width="1.2"/><path d="M14.2 2h5l-1.4 1.4L19.2 5h-5Z" fill="${g('gold')}" ${O2}/><path d="M1.5 28.5h29" stroke="${g('green')}" stroke-width="3" stroke-linecap="round"/><path d="M8 18l4-8" ${HL}/>`,
  upgrade: `<path d="M16 2.5 L28 15.5 H21 V29 H11 V15.5 H4Z" fill="${g('gold')}" ${O}/><path d="M16 6.5 L9 14" ${HL}/>`,

  // ---------- misc
  victory: `<path d="M5 24.5 L3 9 L10 15 L16 5 L22 15 L29 9 L27 24.5Z" fill="${g('gold')}" ${O}/><rect x="5" y="24" width="22" height="4.5" rx="1.2" fill="${g('goldD')}" ${O}/>` +
    `${gemShape(16, 19, 0.55, 'red')}<circle cx="9.5" cy="20" r="1.6" fill="${g('blue')}"/><circle cx="22.5" cy="20" r="1.6" fill="${g('green')}"/><circle cx="3" cy="9" r="1.6" fill="${g('gold')}" ${O2}/><circle cx="29" cy="9" r="1.6" fill="${g('gold')}" ${O2}/><circle cx="16" cy="5" r="1.8" fill="${g('gold')}" ${O2}/>`,
  defeat: `<path d="M16 3.5c-6.5 0-10.5 4.5-10.5 10 0 3.5 1.6 5.6 3.5 6.8V25a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4.7c1.9-1.2 3.5-3.3 3.5-6.8 0-5.5-4-10-10.5-10Z" fill="${g('bone')}" ${O}/>` +
    `<ellipse cx="11.5" cy="15" rx="3" ry="3.3" fill="#6a4a3a"/><ellipse cx="20.5" cy="15" rx="3" ry="3.3" fill="#6a4a3a"/><path d="M16 18.5l-1.6 3h3.2Z" fill="#8a7a5a"/><path d="M12.5 27v-3M16 27v-3M19.5 27v-3" stroke="${INK}" stroke-width="1" stroke-opacity=".7"/>`,
  chest: `<path d="M4 14.5h24V27a1.5 1.5 0 0 1-1.5 1.5h-21A1.5 1.5 0 0 1 4 27Z" fill="${g('wood')}" ${O}/><path d="M4 14.5C4 8 8 5.5 16 5.5S28 8 28 14.5Z" fill="${g('wood')}" ${O}/>` +
    `<path d="M8.5 6.8v21.7M23.5 6.8v21.7" stroke="${g('gold')}" stroke-width="2.4"/><path d="M4 14.5h24" stroke="${g('gold')}" stroke-width="2.2"/><rect x="13.5" y="12.5" width="5" height="6" rx="1" fill="${g('gold')}" ${O2}/><circle cx="16" cy="15.4" r=".9" fill="${INK}"/>`,
  music: `<path d="M12 23.5V7l15-3.5v16.5" fill="none" stroke="${INK}" stroke-width="3"/><path d="M12 23.5V7l15-3.5v16.5" fill="none" stroke="${g('gold')}" stroke-width="1.6"/><path d="M12 9.5l15-3.5" stroke="${INK}" stroke-width="3.4"/>` +
    `<ellipse cx="8.5" cy="24" rx="4.4" ry="3.4" fill="${g('gold')}" ${O}/><ellipse cx="23.5" cy="20.5" rx="4.4" ry="3.4" fill="${g('gold')}" ${O}/>`,
  save: `<path d="M6 4h16l5 5v17.5a1.5 1.5 0 0 1-1.5 1.5h-19A1.5 1.5 0 0 1 5 26.5V5.5A1.5 1.5 0 0 1 6 4Z" fill="${g('blue')}" ${O}/><rect x="9.5" y="4" width="12" height="8" rx="1" fill="${g('silver')}" ${O2}/><rect x="17" y="5.5" width="2.6" height="5" fill="${g('blue')}"/><rect x="8.5" y="17" width="15" height="11" rx="1" fill="${g('parch')}" ${O2}/><path d="M11 21h10M11 24h7" stroke="#b08850" stroke-width="1.1" stroke-linecap="round"/>`,
  artifact: `<path d="M16 3.5l3 3.5h-6Z" fill="${g('gold')}" ${O2}/><circle cx="16" cy="18" r="10" fill="${g('gold')}" ${O}/><circle cx="16" cy="18" r="6.5" fill="${g('teal')}" ${O2}/>${sparkle(14, 16, 3)}<path d="M16 7v1" stroke="${INK}" stroke-width="1.6"/>`,
  axe: `<path d="M9 29.5 L21 6" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><path d="M9 29.5 L21 6" stroke="${g('wood')}" stroke-width="2.2" stroke-linecap="round"/>` +
    `<path d="M17.5 9.5C14 5 16 1.5 20 1.5c1 3 4.5 5.5 9.5 5.5-1 4-4.5 7-9.5 6Z" fill="${g('steel')}" ${O}/><path d="M20.5 3.5c1.5 2.5 3.8 4 6.5 4.5" ${HL}/>`,
  ring: `<circle cx="16" cy="19" r="9" fill="none" stroke="${INK}" stroke-width="5.4"/><circle cx="16" cy="19" r="9" fill="none" stroke="${g('gold')}" stroke-width="3.4"/><path d="M9.5 15a7.5 7.5 0 0 1 3.5-4" ${HL}/>${gemShape(16, 9, 0.75, 'red')}`,
  cloak: `<path d="M11 4.5h10l2 3c3 5 4.5 12 5.5 21-4 1-7 0-9-1.5-2 1.5-5 1.5-7 0-2 1.5-5 2.5-9 1.5 1-9 2.5-16 5.5-21Z" fill="${g('purple')}" ${O}/><path d="M11 4.5c1 3 2.5 4 5 4s4-1 5-4" fill="${g('red')}" ${O2}/><circle cx="16" cy="8.5" r="1.8" fill="${g('gold')}" ${O2}/><path d="M9 13c-1.5 4-2.5 8-3 12" ${HL}/>`,
  banner: `<path d="M8.5 29V3" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/><path d="M8.5 29V3" stroke="${g('wood')}" stroke-width="1.8" stroke-linecap="round"/>` +
    `<path d="M10 5h16l-3.5 5.5L26 16H10Z" fill="${g('red')}" ${O}/><polygon points="${star(16.5, 10.5, 3.6, 1.6)}" fill="${g('gold')}"/><circle cx="8.5" cy="3" r="2" fill="${g('gold')}" ${O2}/>`,
  info: `<circle cx="16" cy="16" r="13" fill="${g('blue')}" ${O}/><circle cx="16" cy="9.5" r="2.2" fill="#fff"/><path d="M16 14.5v10" stroke="#fff" stroke-width="3.6" stroke-linecap="round"/>`,
};

// ---------------------------------------------------------------- aliases: game ids and synonyms
const ALIAS = {
  defend: 'defense', def: 'defense', att: 'attack', pow: 'power', know: 'knowledge', xp: 'experience', move: 'movement', mp: 'movement', spd: 'movement', speed: 'movement',
  spells: 'spellbook', spell: 'spellbook', magic: 'spellbook', x: 'close', dmg: 'damage', ranged: 'shots', heart: 'hp', week: 'calendar', crown: 'victory', skull: 'defeat',
  // building ids from data.js BUILDINGS (plus the base village hall)
  village: 'hall', hall2: 'hall', hall3: 'hall', mage1: 'mage', mage2: 'mage', mage3: 'mage', guild: 'mage',
  d1: 'dwelling', d2: 'dwelling', d3: 'dwelling', d4: 'dwelling', d5: 'dwelling', d6: 'dwelling', d7: 'dwelling',
  u1: 'upgrade', u2: 'upgrade', u3: 'upgrade', u4: 'upgrade', u5: 'upgrade', u6: 'upgrade', u7: 'upgrade', up: 'upgrade',
  // artifact ids from data.js ARTIFACTS
  sword: 'axe', shield: 'defense', staff: 'power', tome: 'knowledge', boots: 'movement', helm: 'hero', blade: 'attack', orb: 'sorcery', clover: 'luck',
  // map objects
  campfire: 'fireball', goldmine: 'gold', sawmill: 'wood', orepit: 'ore', gemmine: 'gems', treasure: 'chest',
};

export const ICON_NAMES = [...Object.keys(I), ...Object.keys(ALIAS)];
export const hasIcon = (name) => !!(I[name] || I[ALIAS[name]]);

// icon('gold', 18) -> '<svg class="ic ic-gold" ...>'. Unknown names give an empty-width spacer.
export function icon(name, size = 20, cls = '') {
  ensureDefs();
  const key = I[name] ? name : ALIAS[name];
  const body = I[key];
  if (!body) return `<span class="ic ic-missing" style="width:${size}px;height:${size}px"></span>`;
  return `<svg class="ic ic-${key}${cls ? ' ' + cls : ''}" width="${size}" height="${size}" viewBox="0 0 ${VB} ${VB}" aria-hidden="true" focusable="false">${body}</svg>`;
}

// Fill every [data-ic] element under root (default: document) with its icon. Safe to call repeatedly.
export function hydrateIcons(root) {
  if (typeof document === 'undefined') return;
  ensureDefs();
  for (const el of (root || document).querySelectorAll('[data-ic]')) {
    const n = el.dataset.ic, s = +el.dataset.size || 20;
    if (el.dataset.icDone === n + s) continue;
    el.innerHTML = icon(n, s); el.dataset.icDone = n + s;
  }
}

if (typeof document !== 'undefined') {
  if (document.body) hydrateIcons();
  else document.addEventListener('DOMContentLoaded', () => hydrateIcons(), { once: true });
}
