/* Εικονίδια (inline SVG, 24×24, stroke) και χρώμα ανά charm / αναβάθμιση / είδος χεριού. */
(function (root) {
  "use strict";
  const P = {
    ladder: '<path d="M8 3v18M16 3v18M8 7h8M8 12h8M8 17h8"/>',
    leap: '<path d="M12 21V8M6 14l6-6 6 6M5 4h14"/>',
    lowroad: '<path d="M8 8.5a4 3.5 0 1 1 8 0c0 3.5-8 5-8 9.5h8"/>',
    court: '<path d="M4 17h16l1-9-5 4-4-6-4 6-5-4zM4 17v3h16v-3"/>',
    loyal: '<path d="M12 3C8 8 4 10 4 14a4 4 0 0 0 7 2c0 2-1 4-3 5h8c-2-1-3-3-3-5a4 4 0 0 0 7-2c0-4-4-6-8-11z"/>',
    cheap: '<circle cx="12" cy="12" r="8"/><path d="M12 4v16A8 8 0 0 0 12 4z" fill="currentColor"/>',
    wind: '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h8a2 2 0 1 1-2 2"/>',
    sleight: '<circle cx="7" cy="17" r="3"/><circle cx="17" cy="17" r="3"/><path d="M9 15L20 4M15 15L4 4"/>',
    encore: '<path d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9"/>',
    mirror: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>',
    vault: '<ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v10c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
    thrift: '<path d="M3 12V4h8l10 10-8 8L3 12z"/><circle cx="7.5" cy="8.5" r="1.5" fill="currentColor"/>',
    scout: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
    goldsmith: '<path d="M12 3l2.8 6 6.2.7-4.6 4.3 1.3 6.4L12 17.3 6.3 20.4l1.3-6.4L3 9.7 9.2 9z"/>',
    glassblower: '<path d="M12 3l7 7-7 11-7-11zM5 10h14M12 3l-3 7 3 11 3-11z"/>',
    summiteer: '<path d="M3 20l6-11 4 6 2-3 6 8zM9 9l2-4 3 5"/>',
    gambler: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="8.5" cy="8.5" r="1.4" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.4" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.4" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/>',
    ember: '<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-6 1 1 2 2 2 4 1-2 1-5 1-8z"/>',
    m1: '<rect x="3" y="6" width="9" height="13" rx="1.5"/><rect x="12" y="4" width="9" height="13" rx="1.5"/>',
    m2: '<rect x="2" y="7" width="8" height="12" rx="1.5"/><rect x="8" y="5" width="8" height="12" rx="1.5"/><rect x="14" y="3" width="8" height="12" rx="1.5"/>',
    m3: '<path d="M3 19h4v-4h4v-4h4V7h6"/>',
    m4: '<path d="M3 20h5v-5h5v-5h5V5h3M3 15h5v-5h5V5"/>',
    m5: '<path d="M4 11l8-7 8 7v9H4zM10 20v-6h4v6"/>',
    m6: '<circle cx="12" cy="14" r="7"/><path d="M12 7V4M14 5l2-2M17 5l2-1"/>',
    pl: '<circle cx="12" cy="12" r="9"/><path d="M10 8l6 4-6 4z" fill="currentColor"/>',
    br: '<path d="M4 12a4 4 0 0 1 4-4 5 5 0 0 1 9.5 1.5A3.5 3.5 0 0 1 17 16H8a4 4 0 0 1-4-4z"/>',
    di: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    ch: '<path d="M14 3l7 7-9 9-7-7zM5 12l-2 9 9-2"/>',
    wi: '<path d="M4 12h16M4 12l4-4M4 12l4 4M20 12l-4-4M20 12l-4 4"/>',
    cs: '<path d="M6 21V4h11l-2 4 2 4H6"/>',
    th: '<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M9 9l6 6M15 9l-6 6"/>',
  };
  const HUE = {
    ladder: 45, leap: 20, lowroad: 200, court: 48, loyal: 230, cheap: 170, wind: 195, sleight: 350, encore: 280, mirror: 260, vault: 40, thrift: 130,
    scout: 190, goldsmith: 50, glassblower: 185, summiteer: 210, gambler: 330, ember: 15,
    m1: 45, m2: 30, m3: 330, m4: 280, m5: 150, m6: 5, pl: 120, br: 195, di: 200, ch: 30, wi: 260, cs: 100, th: 350,
  };
  /* χρώμα ανά είδος χεριού (kind id) */
  const KIND_HUE = { 1: 45, 8: 30, 2: 200, 3: 280, 4: 330, 5: 150, 6: 5, 7: 5 };
  const svg = (id) => '<svg viewBox="0 0 24 24" aria-hidden="true">' + (P[id] || '<circle cx="12" cy="12" r="6"/>') + '</svg>';
  /* Καραμελένια φουσκάλα με εικονίδιο. cls: "charm" | "charm charm--s" */
  const bubble = (id, cls, attrs) => '<span class="' + cls + '" style="--h:' + (HUE[id] == null ? 45 : HUE[id]) + '"' + (attrs || "") + '>' + svg(id) + '</span>';
  root.ICONS = { svg, bubble, hue: (id) => HUE[id], kindHue: (k) => KIND_HUE[k] == null ? 45 : KIND_HUE[k] };
})(window);
