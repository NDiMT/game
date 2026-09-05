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
    scout: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
    goldsmith: '<path d="M12 3l2.8 6 6.2.7-4.6 4.3 1.3 6.4L12 17.3 6.3 20.4l1.3-6.4L3 9.7 9.2 9z"/>',
    glassblower: '<path d="M12 3l7 7-7 11-7-11zM5 10h14M12 3l-3 7 3 11 3-11z"/>',
    summiteer: '<path d="M3 20l6-11 4 6 2-3 6 8zM9 9l2-4 3 5"/>',
    ember: '<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-6 1 1 2 2 2 4 1-2 1-5 1-8z"/>',
    kingmaker: '<path d="M5 20L12 4l7 16M8 14h8"/><path d="M4 20h16"/>',
    afterburner: '<path d="M4 6l7 6-7 6M12 6l7 6-7 6"/>',
    climber: '<path d="M6 19l6-6 6 6M6 12l6-6 6 6"/>',
    patient: '<circle cx="12" cy="13" r="7.5"/><path d="M12 8.5v5l3.5 2M4.6 5.2l2.8 2.8M19.4 5.2l-2.8 2.8"/>',
    sl: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>',
    gt: '<path d="M12 3l2.8 6 6.2.7-4.6 4.3 1.3 6.4L12 17.3 6.3 20.4l1.3-6.4L3 9.7 9.2 9z" fill="currentColor"/>',
    /* boss antes */
    noace: '<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    short: '<path d="M6 20l3-12h6l3 12M9 12h6"/>',
    blind: '<path d="M3 3l18 18M2 12s4-7 10-7c2 0 3.5.5 5 1.3M22 12s-4 7-10 7c-2 0-3.5-.5-5-1.3"/>',
    highground: '<path d="M3 20h18M6 20V10l6-6 6 6v10M12 4v16"/>',
    onedisc: '<path d="M12 3c-3 4-6 6-6 10a6 6 0 0 0 12 0c0-4-3-6-6-10z"/>',
    thinair: '<path d="M3 20l5-10 4 5 3-3 6 8zM3 8h5M16 5h5M9 3h3"/>',
    richair: '<circle cx="12" cy="12" r="8"/><path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4"/>',
    nodiscard: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M3 3l18 18"/>',
    fewplays: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
    sticky: '<path d="M4 20L20 4M8 4h12v12M4 12l8 8"/>',
    summit: '<path d="M3 20l7-13 3 5 2-3 6 11zM10 7l3-4 3 5"/>',
    m1: '<rect x="3" y="6" width="9" height="13" rx="1.5"/><rect x="12" y="4" width="9" height="13" rx="1.5"/>',
    m2: '<rect x="2" y="7" width="8" height="12" rx="1.5"/><rect x="8" y="5" width="8" height="12" rx="1.5"/><rect x="14" y="3" width="8" height="12" rx="1.5"/>',
    pl: '<circle cx="12" cy="12" r="9"/><path d="M10 8l6 4-6 4z" fill="currentColor"/>',
    di: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    wi: '<path d="M4 12h16M4 12l4-4M4 12l4 4M20 12l-4-4M20 12l-4 4"/>',
    cs: '<path d="M6 21V4h11l-2 4 2 4H6"/>',
    th: '<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M9 9l6 6M15 9l-6 6"/>',
  };
  const HUE = {
    climber: 88, patient: 250, ladder: 45, leap: 20, lowroad: 200, court: 48, loyal: 230, cheap: 170, wind: 195, sleight: 350, encore: 280, mirror: 260, thrift: 130,
    scout: 190, goldsmith: 50, glassblower: 185, summiteer: 210, ember: 15, kingmaker: 48, afterburner: 10, sl: 265, gt: 45,
    noace: 350, short: 350, blind: 350, highground: 350, onedisc: 350, thinair: 350, richair: 350, nodiscard: 350, fewplays: 350, sticky: 350, summit: 45,
    m1: 45, m2: 150, pl: 120, di: 200, wi: 260, cs: 100, th: 350,
  };
  /* χρώμα ανά είδος χεριού (kind id) */
  const KIND_HUE = { 9: 55, 1: 45, 8: 30, 2: 200, 3: 280, 4: 330, 5: 150, 6: 5, 7: 5 };
  const svg = (id) => '<svg viewBox="0 0 24 24" aria-hidden="true">' + (P[id] || '<circle cx="12" cy="12" r="6"/>') + '</svg>';
  /* Καραμελένια φουσκάλα με εικονίδιο. cls: "charm" | "charm charm--s" */
  const bubble = (id, cls, attrs) => '<span class="' + cls + '" style="--h:' + (HUE[id] == null ? 45 : HUE[id]) + '"' + (attrs || "") + '>' + svg(id) + '</span>';
  root.ICONS = { svg, bubble, hue: (id) => (HUE[id] == null ? 45 : HUE[id]), kindHue: (k) => KIND_HUE[k] == null ? 45 : KIND_HUE[k] };
})(window);
