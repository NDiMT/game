// =====================================================================
// ORBIS: Five Crowns soundtrack.
// Real sampled orchestra (FluidR3_GM, MIT, vendored in ./audio/*.bin) and
// written-out music: each piece is data below (chords, melody, counter-
// melody, form and orchestration). The engine voices the chords with
// smooth voice leading, plays them through a sampler with envelopes,
// stereo seating and one shared concert-hall reverb, and crossfades
// between pieces. Pieces loop with a varied orchestration on every pass.
//
//   const score = createScore(ac, outNode);
//   score.setScene('map', 'sylvan');   // menu|map|town|battle|victory|defeat
//   score.start(); score.stop();
//   score.setEra(n)                    // legacy: 1 town, 2 map, 3 battle
// =====================================================================

const AUDIO = new URL('./audio/', import.meta.url).href;
export const FACTIONS = ['haven', 'necro', 'sylvan', 'inferno', 'dungeon'];
export const SCENES = ['menu', 'map', 'town', 'battle', 'victory', 'defeat'];

// ------------------------------------------------------------ instruments
// g gain, att/rel seconds, sus = sustained (long notes crossfade-loop),
// ring = how long a struck/plucked note sounds, pan, rev = reverb send.
const INST = {
  strings: { g: 2.6, att: 0.14, rel: 0.55, sus: 1, pan: -0.18, rev: 0.5 },
  cello: { g: 2.5, att: 0.09, rel: 0.4, sus: 1, pan: 0.32, rev: 0.42 },
  horn: { g: 2.0, att: 0.06, rel: 0.4, sus: 1, pan: -0.28, rev: 0.6 },
  brass: { g: 1.9, att: 0.03, rel: 0.3, sus: 1, pan: 0.26, rev: 0.5 },
  choir: { g: 3.0, att: 0.45, rel: 0.9, sus: 1, pan: 0.04, rev: 0.65 },
  flute: { g: 1.75, att: 0.05, rel: 0.3, sus: 1, pan: 0.22, rev: 0.55 },
  oboe: { g: 1.75, att: 0.05, rel: 0.25, sus: 1, pan: 0.14, rev: 0.5 },
  harp: { g: 2.4, att: 0.004, rel: 0.6, ring: 2.6, pan: -0.38, rev: 0.55 },
  celesta: { g: 2.3, att: 0.003, rel: 0.7, ring: 2.6, pan: -0.12, rev: 0.65 },
  glock: { g: 1.5, att: 0.003, rel: 0.7, ring: 2.4, pan: 0.34, rev: 0.7 },
  bells: { g: 1.9, att: 0.003, rel: 1.0, ring: 3.1, pan: 0.3, rev: 0.7 },
  timpani: { g: 3.6, att: 0.003, rel: 0.5, ring: 2.0, pan: 0.06, rev: 0.45 },
  taiko: { g: 2.6, att: 0.003, rel: 0.4, ring: 1.6, pan: -0.04, rev: 0.4 },
  pizz: { g: 2.3, att: 0.003, rel: 0.3, ring: 0.9, pan: -0.08, rev: 0.45 },
};

// ------------------------------------------------------------ notation
// Melody: "D4:1.5 A4:.5 A4:2 | B4 ..." pitch:beats (duration sticky), r = rest.
// Chords: "Bb:4 F/A:4 Gm:4 ..." symbol:beats.
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const pcOf = (s) => (PC[s[0]] + (s[1] === '#' ? 1 : s[1] === 'b' ? -1 : 0) + 12) % 12;
function midi(s) {
  const m = /^([A-G][#b]?)(-?\d)$/.exec(s);
  if (!m) throw new Error('bad note ' + s);
  return (+m[2] + 1) * 12 + pcOf(m[1]);
}
function seq(str, tr = 0) {
  const out = []; let b = 0, d = 1;
  for (const tok of (str || '').split(/\s+/)) {
    if (!tok || tok === '|') continue;
    const [n, du] = tok.split(':'); if (du) d = parseFloat(du);
    if (n !== 'r') out.push({ b, d, m: midi(n) + tr });
    b += d;
  }
  return { notes: out, len: b };
}
const QUAL = {
  '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], m9: [0, 3, 7, 10, 14],
  add9: [0, 4, 7, 14], sus4: [0, 5, 7], sus2: [0, 2, 7], dim: [0, 3, 6], '+': [0, 4, 8], m6: [0, 3, 7, 9], 6: [0, 4, 7, 9],
  9: [0, 4, 7, 10, 14], 'maj7#11': [0, 4, 7, 11, 18],
};
function chords(str, tr = 0) {
  const out = []; let b = 0;
  for (const tok of str.split(/\s+/)) {
    if (!tok || tok === '|') continue;
    const [sym, du] = tok.split(':'), d = parseFloat(du);
    const m = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec(sym);
    if (!m || !QUAL[m[2]] || !(d > 0)) throw new Error('bad chord ' + tok);
    const root = (pcOf(m[1]) + tr + 120) % 12, iv = QUAL[m[2]];
    out.push({ b, d, root, iv, pcs: iv.map((x) => (root + x) % 12), bass: m[3] ? (pcOf(m[3]) + tr + 120) % 12 : root });
    b += d;
  }
  return { list: out, len: b };
}
const near = (pc, lo) => lo + ((pc - lo) % 12 + 12) % 12; // lowest note of pitch class pc >= lo

// voice a chord as n notes within [lo, lo+19], moving as little as possible from prev
function voicing(ch, prev, lo, n) {
  const iv = ch.iv, pcs = ch.pcs;
  const pri = [1, ...iv.map((_, i) => i).filter((i) => i >= 3), 0, 2].filter((i) => i < pcs.length);
  let pick = pri.slice(0, n).map((i) => pcs[i]);
  while (pick.length < n) pick.push(pcs[pick.length % 2 ? 2 % pcs.length : 0]);
  const hi = lo + 19, cands = [];
  const rec = (k, acc) => {
    if (k === pick.length) {
      const s = acc.slice().sort((a, b) => a - b);
      for (let i = 1; i < s.length; i++) if (s[i] - s[i - 1] < 1) return;
      if (s[s.length - 1] - s[0] > 17) return;
      cands.push(s); return;
    }
    for (let m = near(pick[k], lo); m <= hi; m += 12) { acc.push(m); rec(k + 1, acc); acc.pop(); }
  };
  rec(0, []);
  if (!cands.length) return pick.map((p) => near(p, lo));
  let best = cands[0], bc = 1e9;
  for (const c of cands) {
    let cost = 0;
    if (prev && prev.length === c.length) for (let i = 0; i < c.length; i++) cost += Math.abs(c[i] - prev[i]);
    else cost = Math.abs(c.reduce((a, x) => a + x, 0) / c.length - (lo + 9)) * 2;
    for (let i = 1; i < c.length; i++) if (c[i] < 55 && c[i] - c[i - 1] < 3) cost += 3; // no low mud
    if (cost < bc) { bc = cost; best = c; }
  }
  return best;
}

// ------------------------------------------------------------ layer helpers
const mel = (i, v, o = 0, x) => ({ k: 'mel', i, v, o, ...x });
const ctr = (i, v, o = 0, x) => ({ k: 'ctr', i, v, o, ...x });
const pad = (i, v, lo, n = 4, x) => ({ k: 'pad', i, v, lo, n, ...x });
const arp = (i, v, lo, p, div = 0.5, x) => ({ k: 'arp', i, v, lo, p, div, ...x });
const bass = (i, v, lo, p = 'long', x) => ({ k: 'bass', i, v, lo, p, ...x });
const ost = (i, v, lo, p, div = 0.5, x) => ({ k: 'ost', i, v, lo, p, div, ...x });
const perc = (i, v, p, x) => ({ k: 'perc', i, v, p, div: 0.25, lo: 38, ...x });
const roll = (i, v, beats = 2, x) => ({ k: 'roll', i, v, beats, lo: 38, ...x });
const stab = (i, v, lo, p, x) => ({ k: 'stab', i, v, lo, p, div: 0.5, ...x });
const bell = (i, v, lo, every = 2, x) => ({ k: 'bell', i, v, lo, every, ...x });
const spark = (i, v, lo, hi, n = 2, x) => ({ k: 'spark', i, v, lo, hi, n, ...x });

// harp / arpeggio figures (indices into the chord tones, ascending)
const SWEEP = [0, 1, 2, 3, 4, 3, 2, 1];
const ROLL6 = [0, 2, 4, 5, 4, 2];
const WIDE = [0, 2, 4, 6, 7, 6, 4, 2];
const GLISS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const OSTB = [0, 0, 12, 0, 0, 12, 0, 7];
const OSTI = [0, 0, 12, 0, 7, 0, 12, 0];

// =====================================================================
// THE MUSIC
// =====================================================================

// ---- ORBIS main theme (menu): D major, 66 bpm. Rising-fifth motto.
const MENU = {
  bpm: 66, beats: 4, lvl: 1.1,
  sec: {
    I: { bars: 4, ch: 'Dadd9:4 G/D:4 Dadd9:4 Asus4:2 A:2',
      mel: 'D6:1.5 A6:.5 A6:2 | B6:1 A6:.5 G6:.5 F#6:2 | D6:1.5 A6:.5 A6:2 | E6:2 C#6:2' },
    A: { bars: 8, ch: 'D:4 Bm:4 G:4 A:4 D:4 Em:4 Bm:2 Asus4:1 A:1 D:4',
      mel: 'D4:1.5 A4:.5 A4:2 | B4:1 A4:.5 G4:.5 F#4:2 | G4:1.5 B4:.5 D5:2 | C#5:1 B4:.5 C#5:.5 A4:2 | D4:1.5 A4:.5 A4:2 | B4:1 C#5:.5 D5:.5 E5:2 | F#5:1.5 E5:.5 D5:1 C#5:1 | D5:4',
      ctr: 'A3:2 F#3:2 | B3:2 D4:2 | B3:2 G3:2 | E3:2 A3:2 | A3:2 F#3:2 | G3:2 B3:2 | B3:1 A3:1 A3:1 E3:1 | F#3:4' },
    A2: { bars: 8, ch: 'D:4 Bm:4 G:4 A:4 G:4 Bm:2 Em:2 G:2 A:2 D:4',
      mel: 'D4:1.5 A4:.5 A4:2 | B4:1 A4:.5 G4:.5 F#4:2 | G4:1.5 B4:.5 D5:2 | C#5:1 B4:.5 C#5:.5 A4:2 | B4:1.5 D5:.5 G5:2 | F#5:1 E5:.5 D5:.5 E5:2 | D5:1 C#5:.5 B4:.5 C#5:1 E5:1 | D5:4',
      ctr: 'A3:2 F#3:2 | B3:2 D4:2 | B3:2 G3:2 | E3:2 A3:2 | B3:2 D4:2 | D4:2 B3:2 | B3:2 A3:2 | F#3:4' },
    B: { bars: 8, ch: 'Bm:4 G:4 D:4 A:4 Bm:4 G:4 Em:4 A7:4',
      mel: 'F#5:3 E5:.5 F#5:.5 | G5:2 D5:2 | F#5:1.5 E5:.5 D5:1 A4:1 | C#5:2 E5:2 | F#5:3 G5:.5 A5:.5 | B5:2 G5:1 D5:1 | E5:1.5 F#5:.5 G5:1 B5:1 | A5:2 G5:1 E5:1',
      ctr: 'D4:4 | B3:4 | A3:2 D4:2 | E4:4 | F#4:4 | D4:4 | G4:2 E4:2 | E4:2 C#4:2' },
  },
  form: [
    { s: 'I', dyn: [0.45, 0.6], L: [mel('celesta', 0.6), arp('harp', 0.42, 50, SWEEP), pad('choir', 0.3, 55, 3, { att: 1.2 }), bass('cello', 0.35, 38), roll('timpani', 0.45, 2)] },
    { s: 'A', dyn: [0.6, 0.72], L: [mel('horn', 0.85), pad('strings', 0.36, 52), arp('harp', 0.4, 50, SWEEP), bass('cello', 0.48, 38)],
      alt: [mel('strings', 0.72), mel('flute', 0.4, 12), pad('choir', 0.28, 55, 3), arp('harp', 0.42, 50, SWEEP), bass('cello', 0.48, 38), spark('celesta', 0.28, 79, 96, 1)] },
    { s: 'A2', dyn: [0.7, 0.85], L: [mel('horn', 0.85), mel('strings', 0.45), ctr('cello', 0.55), pad('choir', 0.3, 55, 3), arp('harp', 0.42, 50, SWEEP), bass('strings', 0.4, 38), perc('timpani', 0.5, 'x...............'), roll('timpani', 0.55, 2)] },
    { s: 'B', dyn: [0.65, 0.95], L: [mel('strings', 0.8), ctr('horn', 0.55), pad('choir', 0.36, 55, 3, { att: 1 }), arp('harp', 0.4, 50, WIDE), bass('cello', 0.5, 38), spark('celesta', 0.3, 79, 96, 2), roll('timpani', 0.6, 2)] },
    { s: 'A2', dyn: [0.9, 1], L: [mel('horn', 0.9), mel('strings', 0.55), mel('choir', 0.3, -12), ctr('cello', 0.6), arp('harp', 0.45, 50, SWEEP), bass('strings', 0.45, 38), perc('timpani', 0.6, 'x.......x.......'), spark('glock', 0.25, 79, 98, 1), roll('timpani', 0.5, 2)] },
  ],
};

// ---- HAVEN: Bb major, 76 bpm, noble horn call.
const HAVEN_SEC = {
  I: { bars: 4, ch: 'Bb:4 Eb/Bb:4 Bb:4 F:4', mel: 'F4:1 Bb4:1.5 C5:.5 D5:1 | Eb5:2 D5:2 | F4:1 Bb4:1.5 C5:.5 D5:1 | C5:4' },
  A: { bars: 8, ch: 'Bb:4 F/A:4 Gm:4 Eb:4 Bb/F:4 Eb:2 Cm:2 F:4 Bb:4',
    mel: 'F4:1 Bb4:1.5 C5:.5 D5:1 | C5:2 A4:1 F4:1 | G4:1.5 A4:.5 Bb4:1 D5:1 | Eb5:3 D5:.5 C5:.5 | D5:1.5 Bb4:.5 F4:2 | G4:1 Bb4:1 C5:1 Eb5:1 | C5:1.5 Bb4:.5 A4:1 C5:1 | Bb4:4',
    ctr: 'D3:2 F3:2 | C4:2 A3:2 | Bb3:2 D4:2 | Bb3:2 G3:2 | D4:2 F3:2 | Eb4:2 G3:2 | F3:2 A3:2 | D4:4' },
  A2: { bars: 8, ch: 'Bb:4 F/A:4 Gm:4 Eb:4 Bb/D:4 Eb:2 Cm7:2 F:3 F7:1 Bb:4',
    mel: 'F4:1 Bb4:1.5 C5:.5 D5:1 | C5:2 A4:1 F4:1 | G4:1.5 A4:.5 Bb4:1 D5:1 | Eb5:3 D5:.5 C5:.5 | F5:1.5 D5:.5 Bb4:2 | Eb5:1 D5:1 C5:1 Bb4:1 | A4:1 C5:1 F5:1.5 Eb5:.5 | D5:4',
    ctr: 'D3:2 F3:2 | C4:2 A3:2 | Bb3:2 D4:2 | Bb3:2 G3:2 | Bb3:2 D4:2 | G3:2 Eb4:2 | C4:2 A3:2 | Bb3:4' },
  B: { bars: 8, ch: 'Gm:4 Eb:4 Bb/D:4 F:4 Gm:4 Eb:4 Cm:4 Dsus4:2 D:2',
    mel: 'G5:2 F5:1 D5:1 | Eb5:3 Bb4:1 | D5:2 C5:1 Bb4:1 | C5:4 | G5:2 A5:1 Bb5:1 | G5:2 F5:1 Eb5:1 | Eb5:2 D5:1 C5:1 | G5:2 F#5:2',
    ctr: 'D4:4 | G4:4 | F4:4 | F4:2 C4:2 | D4:2 G4:2 | Eb4:2 Bb3:2 | C4:2 G4:2 | A4:4' },
};
const HAVEN = {
  bpm: 76, beats: 4, sec: HAVEN_SEC, lvl: 0.9,
  form: [
    { s: 'I', dyn: [0.55, 0.7], L: [mel('horn', 0.8), pad('strings', 0.34, 50), bass('cello', 0.42, 34), roll('timpani', 0.55, 3)] },
    { s: 'A', dyn: [0.62, 0.75], L: [mel('horn', 0.85), pad('strings', 0.38, 52), arp('harp', 0.4, 50, SWEEP), bass('cello', 0.5, 34)],
      alt: [mel('strings', 0.72), mel('flute', 0.36, 12), ctr('cello', 0.45), pad('choir', 0.24, 55, 3), arp('harp', 0.4, 50, SWEEP), bass('strings', 0.38, 34)] },
    { s: 'A2', dyn: [0.72, 0.88], L: [mel('brass', 0.72), mel('horn', 0.45), ctr('cello', 0.55), pad('strings', 0.36, 52), pad('choir', 0.26, 55, 3), arp('harp', 0.4, 50, SWEEP), bass('strings', 0.4, 34, 'half'), perc('timpani', 0.55, 'x.......x.......'), roll('timpani', 0.5, 2)] },
    { s: 'B', dyn: [0.62, 0.95], L: [mel('strings', 0.8), ctr('horn', 0.55), pad('choir', 0.38, 55, 3, { att: 1 }), arp('harp', 0.42, 50, WIDE), bass('cello', 0.5, 34), roll('timpani', 0.65, 3)] },
    { s: 'A2', dyn: [0.92, 1], L: [mel('brass', 0.78), mel('strings', 0.6), ctr('cello', 0.6), ctr('horn', 0.4), pad('choir', 0.34, 55, 3), arp('harp', 0.45, 50, SWEEP), bass('strings', 0.45, 34, 'half'), perc('timpani', 0.62, 'x...x...x...x.xx'), roll('timpani', 0.5, 2)] },
  ],
};
const HAVEN_TOWN = {
  bpm: 66, beats: 4, sec: HAVEN_SEC, lvl: 1.1,
  form: [
    { s: 'A', dyn: 0.55, L: [mel('flute', 0.6, 12), arp('harp', 0.42, 50, SWEEP), pad('strings', 0.3, 52), bass('cello', 0.38, 34)] },
    { s: 'B', dyn: [0.5, 0.65], L: [mel('oboe', 0.6), arp('harp', 0.4, 50, WIDE), pad('strings', 0.32, 52), bass('cello', 0.38, 34)] },
    { s: 'A2', dyn: [0.55, 0.6], L: [mel('strings', 0.6), ctr('horn', 0.35), arp('harp', 0.42, 50, SWEEP), bass('cello', 0.38, 34)],
      alt: [mel('horn', 0.6), ctr('cello', 0.4), arp('harp', 0.42, 50, SWEEP), pad('strings', 0.26, 52), bass('strings', 0.3, 34)] },
  ],
};

// ---- NECROPOLIS: D minor, 3/4, 80 bpm. A music-box waltz over a lament bass.
const NECRO_SEC = {
  I: { bars: 4, ch: 'Dm:3 Dm:3 Bb:3 A:3' },
  A: { bars: 8, ch: 'Dm:3 Dm/C:3 Bb:3 A:3 Dm:3 Gm/Bb:3 A7:3 Dm:3',
    mel: 'A5:1.5 G5:.5 F5:1 | D6:2 C6:1 | Bb5:1.5 A5:.5 F5:1 | C#5:2 E5:1 | F5:1.5 E5:.5 D5:1 | G5:1 Bb5:1 D6:1 | E6:1.5 D6:.5 C#6:1 | D6:3',
    ctr: 'F3:3 | A3:3 | Bb3:3 | A3:3 | F3:3 | G3:3 | G3:3 | F3:3' },
  A2: { bars: 8, ch: 'Dm:3 Dm/C:3 Bb:3 A:3 Dm/F:3 Gm:3 Bb:3 A:3',
    mel: 'A5:1.5 G5:.5 F5:1 | D6:2 C6:1 | Bb5:1.5 A5:.5 F5:1 | C#5:2 E5:1 | D5:1 F5:1 A5:1 | Bb5:2 G5:1 | F5:1.5 E5:.5 D5:1 | E5:3',
    ctr: 'F3:3 | A3:3 | Bb3:3 | A3:3 | A3:3 | G3:3 | F3:3 | E3:3' },
  B: { bars: 8, ch: 'F:3 C/E:3 Dm:3 Bb:3 Gm:3 Eb:3 A:3 A7:3',
    mel: 'C5:2 A4:1 | G4:2 E4:1 | F4:1 A4:1 D5:1 | F5:2 D5:1 | Bb4:1.5 C5:.5 D5:1 | Eb5:3 | E5:1.5 D5:.5 C#5:1 | A4:3',
    ctr: 'F5:3 | E5:3 | D5:3 | D5:3 | D5:3 | G5:3 | A5:3 | G5:3' },
};
const NECRO = {
  bpm: 80, beats: 3, sec: NECRO_SEC, lvl: 1.6,
  form: [
    { s: 'I', dyn: [0.5, 0.65], L: [pad('choir', 0.36, 50, 3, { att: 1.4 }), bass('strings', 0.42, 38), bell('bells', 0.5, 55, 2)] },
    { s: 'A', dyn: 0.62, L: [mel('celesta', 0.66), mel('glock', 0.18), ctr('cello', 0.45), pad('strings', 0.3, 50, 3), bass('strings', 0.4, 38), bell('bells', 0.38, 55, 8)],
      alt: [mel('celesta', 0.66), ctr('cello', 0.45), pad('choir', 0.3, 50, 3), bass('strings', 0.4, 38), arp('harp', 0.3, 50, ROLL6)] },
    { s: 'A2', dyn: [0.62, 0.72], L: [mel('celesta', 0.6), mel('choir', 0.32, -12), ctr('cello', 0.5), pad('strings', 0.3, 50, 3), bass('strings', 0.42, 38), bell('bells', 0.4, 55, 4)] },
    { s: 'B', dyn: [0.6, 0.95], L: [mel('strings', 0.62), ctr('celesta', 0.36), pad('choir', 0.4, 50, 3, { att: 1.2 }), bass('cello', 0.48, 38), bell('bells', 0.45, 55, 2), roll('timpani', 0.35, 3)] },
    { s: 'A', dyn: 0.7, L: [mel('celesta', 0.66), mel('glock', 0.2), ctr('cello', 0.5), pad('choir', 0.3, 50, 3), bass('strings', 0.42, 38), arp('harp', 0.3, 50, ROLL6)] },
    { s: 'A2', dyn: [0.75, 0.6], L: [mel('strings', 0.62), mel('celesta', 0.3), ctr('cello', 0.5), pad('choir', 0.34, 50, 3), bass('strings', 0.42, 38), bell('bells', 0.45, 55, 4)] },
  ],
};
const NECRO_TOWN = {
  bpm: 72, beats: 3, sec: NECRO_SEC, lvl: 2.0,
  form: [
    { s: 'A', dyn: 0.5, L: [mel('celesta', 0.6), pad('strings', 0.26, 50, 3), bass('strings', 0.34, 38)] },
    { s: 'B', dyn: 0.5, L: [mel('strings', 0.52), pad('choir', 0.3, 50, 3, { att: 1.4 }), bass('cello', 0.38, 38), bell('bells', 0.32, 55, 4)] },
    { s: 'A2', dyn: 0.5, L: [mel('celesta', 0.55), mel('glock', 0.15), ctr('cello', 0.38), pad('choir', 0.22, 50, 3), bass('strings', 0.34, 38)] },
  ],
};

// ---- SYLVAN: G lydian/major, lilting 6/8 (3 quarter beats), 84 bpm.
const SYLVAN_SEC = {
  I: { bars: 4, ch: 'G:3 A/G:3 G:3 A/G:3' },
  A: { bars: 8, ch: 'G:3 A/G:3 G:3 A/G:3 Em:3 C:3 D:3 D:3',
    mel: 'D5:1 G5:.5 B5:1 A5:.5 | C#6:1.5 B5:1 A5:.5 | B5:1 G5:.5 D5:1.5 | E5:1 F#5:.5 A5:1.5 | G5:1 F#5:.5 E5:1 B4:.5 | E5:1 G5:.5 C6:1.5 | B5:1 A5:.5 F#5:1 E5:.5 | A5:3',
    ctr: 'B3:3 | C#4:3 | B3:1.5 D4:1.5 | C#4:3 | B3:3 | C4:1.5 E4:1.5 | D4:1.5 F#3:1.5 | A3:3' },
  A2: { bars: 8, ch: 'G:3 A/G:3 G:3 A/G:3 Em:3 C:3 Am7:1.5 D:1.5 G:3',
    mel: 'D5:1 G5:.5 B5:1 A5:.5 | C#6:1.5 B5:1 A5:.5 | B5:1 G5:.5 D5:1.5 | E5:1 F#5:.5 A5:1.5 | G5:1 B5:.5 E6:1.5 | E6:1 D6:.5 C6:1 B5:.5 | A5:1 C6:.5 F#5:1 A5:.5 | G5:3',
    ctr: 'B3:3 | C#4:3 | B3:1.5 D4:1.5 | C#4:3 | B3:3 | C4:1.5 E4:1.5 | C4:1.5 C4:1.5 | B3:3' },
  B: { bars: 8, ch: 'C:3 D/C:3 Bm:3 Em:3 C:3 D/C:3 Am:3 D:3',
    mel: 'G5:2 E5:1 | F#5:2 A5:1 | B5:1.5 A5:1 F#5:.5 | G5:1 F#5:.5 E5:1.5 | C5:1 E5:.5 G5:1.5 | A5:1 F#5:.5 D5:1.5 | C5:1 E5:.5 A5:1.5 | A5:1.5 F#5:1 E5:.5',
    ctr: 'G6:3 | F#6:3 | D6:3 | B5:3 | G6:3 | F#6:3 | E6:3 | F#6:3' },
};
const SYLVAN = {
  bpm: 84, beats: 3, sec: SYLVAN_SEC, lvl: 1.2,
  form: [
    { s: 'I', dyn: [0.5, 0.62], L: [arp('harp', 0.45, 50, ROLL6), spark('celesta', 0.3, 79, 96, 2), pad('strings', 0.26, 55, 3, { att: 0.8 }), bass('cello', 0.36, 38)] },
    { s: 'A', dyn: 0.65, L: [mel('flute', 0.7), arp('harp', 0.42, 50, ROLL6), bass('pizz', 0.55, 38, 'dot'), pad('strings', 0.28, 55, 3), spark('celesta', 0.26, 79, 96, 1)],
      alt: [mel('oboe', 0.66), arp('harp', 0.42, 50, ROLL6), bass('pizz', 0.55, 38, 'dot'), pad('strings', 0.28, 55, 3), spark('glock', 0.22, 84, 100, 1)] },
    { s: 'A2', dyn: [0.65, 0.75], L: [mel('flute', 0.72), ctr('cello', 0.45), arp('harp', 0.42, 50, ROLL6), bass('pizz', 0.5, 38, 'dot'), pad('strings', 0.26, 55, 3), spark('celesta', 0.28, 79, 96, 2)] },
    { s: 'B', dyn: [0.62, 0.9], L: [mel('oboe', 0.66), ctr('flute', 0.3), pad('strings', 0.36, 55, 3, { att: 0.8 }), arp('harp', 0.42, 50, ROLL6), bass('cello', 0.45, 38), spark('celesta', 0.3, 79, 96, 2)] },
    { s: 'A', dyn: 0.75, L: [mel('flute', 0.7), mel('strings', 0.32, -12), ctr('cello', 0.42), arp('harp', 0.42, 50, ROLL6), bass('pizz', 0.55, 38, 'dot'), spark('glock', 0.2, 84, 100, 1)] },
    { s: 'A2', dyn: [0.78, 0.62], L: [mel('flute', 0.7), mel('celesta', 0.26), ctr('cello', 0.45), pad('choir', 0.24, 55, 3, { att: 1 }), arp('harp', 0.42, 50, ROLL6), bass('pizz', 0.5, 38, 'dot'), spark('celesta', 0.26, 79, 96, 2)] },
  ],
};
const SYLVAN_TOWN = {
  bpm: 76, beats: 3, sec: SYLVAN_SEC, lvl: 1.45,
  form: [
    { s: 'A', dyn: 0.52, L: [mel('flute', 0.62), arp('harp', 0.4, 50, ROLL6), bass('cello', 0.32, 38), spark('celesta', 0.22, 79, 96, 1)] },
    { s: 'B', dyn: 0.52, L: [mel('oboe', 0.6), arp('harp', 0.4, 50, ROLL6), pad('strings', 0.28, 55, 3), bass('cello', 0.32, 38)] },
    { s: 'A2', dyn: 0.52, L: [mel('harp', 0.6, 0), mel('celesta', 0.35), ctr('cello', 0.35), pad('strings', 0.22, 55, 3), spark('glock', 0.18, 84, 100, 1)] },
  ],
};

// ---- INFERNO: E phrygian / harmonic minor, 112 bpm, ostinato and brass.
const INFERNO_SEC = {
  I: { bars: 4, ch: 'Em:4 F:4 Em:4 F:4' },
  A: { bars: 8, ch: 'Em:4 F:4 Em:4 F:4 Em:4 C:4 B7:4 B:4',
    mel: 'E4:1 G4:1 B4:2 | C5:1.5 B4:.5 A4:2 | G4:1 B4:1 E5:2 | F5:1.5 E5:.5 C5:2 | E5:1 D5:1 B4:2 | E5:1 C5:1 G4:2 | F#4:1 A4:1 D#5:2 | B4:4' },
  A2: { bars: 8, ch: 'Em:4 F:4 Em:4 F:4 Em:4 C:4 B7:4 Em:4',
    mel: 'E4:1 G4:1 B4:2 | C5:1.5 B4:.5 A4:2 | G4:1 B4:1 E5:2 | F5:1.5 E5:.5 C5:2 | E5:1 D5:1 B4:2 | E5:1 C5:1 G4:2 | F#4:1 A4:1 D#5:1 F#5:1 | E5:4' },
  B: { bars: 8, ch: 'Am:4 Em:4 F:4 B:4 Am:4 C:4 F:4 B7:4',
    mel: 'A4:2 C5:1 B4:1 | B4:2 G4:2 | A4:1.5 G4:.5 F4:2 | F#4:2 D#4:2 | E4:1 A4:1 C5:2 | C5:1 E5:1 G5:2 | F5:1.5 E5:.5 C5:2 | D#5:2 B4:1 A4:1' },
};
const INFERNO = {
  bpm: 112, beats: 4, sec: INFERNO_SEC, lvl: 0.9,
  form: [
    { s: 'I', dyn: [0.55, 0.75], L: [ost('cello', 0.6, 40, OSTI), ost('strings', 0.34, 52, OSTI), perc('taiko', 0.7, 'x.......x...x...', { m: 36 }), perc('timpani', 0.4, 'x...............'), roll('timpani', 0.5, 2)] },
    { s: 'A', dyn: 0.75, L: [mel('horn', 0.82), ost('cello', 0.6, 40, OSTI), ost('strings', 0.34, 52, OSTI), perc('taiko', 0.62, 'x.......x...x...', { m: 36 }), perc('timpani', 0.45, 'x.......x.......'), pad('choir', 0.22, 52, 3)],
      alt: [mel('horn', 0.78), mel('strings', 0.4), ost('cello', 0.6, 40, OSTI), ost('pizz', 0.4, 52, OSTI), perc('taiko', 0.62, 'x.......x...x...', { m: 36 }), perc('timpani', 0.45, 'x.......x.......')] },
    { s: 'A2', dyn: [0.8, 0.92], L: [mel('brass', 0.75), mel('horn', 0.45, -12), pad('choir', 0.34, 52, 3), ost('cello', 0.62, 40, OSTI), ost('strings', 0.36, 52, OSTI), perc('taiko', 0.7, 'x..x..x.x.x.x...', { m: 36 }), perc('timpani', 0.5, 'x.......x.......'), roll('timpani', 0.6, 2)] },
    { s: 'B', dyn: [0.78, 0.9], L: [mel('strings', 0.75), mel('choir', 0.36), stab('brass', 0.5, 52, 'x..x..x.'), ost('cello', 0.6, 40, OSTI), perc('taiko', 0.66, 'x.......x.......', { m: 36 }), perc('timpani', 0.5, 'x..x..x.........')] },
    { s: 'B', dyn: [0.88, 1], L: [mel('strings', 0.78), mel('horn', 0.5, -12), stab('brass', 0.55, 52, 'x..x..x.'), pad('choir', 0.34, 52, 3), ost('cello', 0.62, 40, OSTI), perc('taiko', 0.72, 'x..x..x.x.x.x...', { m: 36 }), perc('timpani', 0.55, 'x..x..x.........'), roll('timpani', 0.6, 2)] },
    { s: 'A2', dyn: [1, 0.85], L: [mel('brass', 0.8), mel('strings', 0.5), pad('choir', 0.36, 52, 3), ost('cello', 0.62, 40, OSTI), ost('strings', 0.36, 52, OSTI), perc('taiko', 0.72, 'x..x..x.x.x.x...', { m: 36 }), perc('timpani', 0.55, 'x.......x.......')] },
  ],
};
const INFERNO_TOWN = {
  bpm: 92, beats: 4, sec: INFERNO_SEC, lvl: 1.1,
  form: [
    { s: 'A', dyn: 0.55, L: [mel('horn', 0.7), bass('cello', 0.5, 36, 'pulse'), pad('strings', 0.26, 52, 3), perc('timpani', 0.35, 'x...............')] },
    { s: 'B', dyn: 0.55, L: [mel('strings', 0.62), pad('choir', 0.28, 52, 3), bass('cello', 0.45, 36, 'half'), perc('taiko', 0.3, 'x...............', { m: 36 })] },
    { s: 'A2', dyn: 0.58, L: [mel('oboe', 0.5), mel('horn', 0.4, -12), bass('cello', 0.48, 36, 'pulse'), pad('strings', 0.26, 52, 3), perc('timpani', 0.35, 'x.......x.......')] },
  ],
};

// ---- DUNGEON: A dorian with whole-tone (augmented) colour, 60 bpm.
const DUNGEON_SEC = {
  I: { bars: 4, ch: 'Am:4 D/A:4 Am:4 D/A:4' },
  A: { bars: 8, ch: 'Am:4 D/A:4 Am:4 D/A:4 F:4 G:4 Em:4 E+:4',
    mel: 'E5:2 A5:1 B5:1 | F#5:3 E5:1 | C6:1.5 B5:.5 A5:2 | F#5:2 D5:2 | C5:1 F5:1 A5:2 | B5:1.5 A5:.5 G5:1 D5:1 | E5:1 G5:1 B5:2 | C6:2 G#5:2',
    ctr: 'C4:4 | D4:4 | E4:4 | F#4:4 | F4:4 | D4:4 | E4:4 | E4:2 G#4:2' },
  A2: { bars: 8, ch: 'Am:4 D/A:4 Am:4 D/A:4 F:4 G:4 E+:4 Am:4',
    mel: 'E5:2 A5:1 B5:1 | F#5:3 E5:1 | C6:1.5 B5:.5 A5:2 | F#5:2 D5:2 | A5:1 C6:1 E6:2 | D6:1.5 C6:.5 B5:2 | G#5:2 C6:1 B5:1 | A5:4',
    ctr: 'C4:4 | D4:4 | E4:4 | F#4:4 | F4:4 | D4:4 | E4:2 G#4:2 | E4:4' },
  B: { bars: 8, ch: 'Dm:4 G:4 Bbmaj7:4 C+:4 Dm:4 G:4 Fmaj7:4 E:4',
    mel: 'A4:3 F4:1 | B4:2 D5:2 | A4:2 F4:2 | G#4:2 E4:2 | F4:2 A4:2 | G4:1 B4:1 D5:2 | E5:2 C5:2 | B4:2 G#4:2' },
};
const DUNGEON = {
  bpm: 60, beats: 4, sec: DUNGEON_SEC, lvl: 1.75,
  form: [
    { s: 'I', dyn: [0.5, 0.62], L: [arp('harp', 0.42, 45, WIDE), pad('choir', 0.3, 52, 3, { att: 1.5 }), spark('glock', 0.24, 84, 100, 2), bass('cello', 0.36, 36)] },
    { s: 'A', dyn: 0.62, L: [mel('celesta', 0.68), arp('harp', 0.4, 45, WIDE), pad('choir', 0.28, 52, 3, { att: 1.2 }), bass('cello', 0.4, 36), spark('glock', 0.2, 84, 100, 1)],
      alt: [mel('harp', 0.62), mel('celesta', 0.3, 12), pad('strings', 0.26, 52, 3), arp('harp', 0.34, 45, WIDE), bass('cello', 0.4, 36), bell('bells', 0.32, 57, 4)] },
    { s: 'A2', dyn: [0.62, 0.75], L: [mel('celesta', 0.6), mel('flute', 0.36), ctr('strings', 0.36), arp('harp', 0.4, 45, WIDE), pad('choir', 0.28, 52, 3), bass('cello', 0.42, 36), bell('bells', 0.36, 57, 4)] },
    { s: 'B', dyn: [0.62, 0.85], L: [mel('choir', 0.62), arp('harp', 0.42, 45, WIDE), pad('strings', 0.3, 52, 3, { att: 1 }), bass('cello', 0.42, 36), spark('celesta', 0.3, 79, 96, 2), bell('bells', 0.36, 57, 2)] },
    { s: 'A2', dyn: [0.75, 0.6], L: [mel('celesta', 0.62), mel('strings', 0.4, -12), ctr('cello', 0.4), pad('choir', 0.3, 52, 3), arp('harp', 0.4, 45, WIDE), bass('strings', 0.36, 36), spark('glock', 0.22, 84, 100, 2)] },
  ],
};
const DUNGEON_TOWN = {
  bpm: 54, beats: 4, sec: DUNGEON_SEC, lvl: 2.2,
  form: [
    { s: 'A', dyn: 0.5, L: [mel('harp', 0.6), arp('harp', 0.3, 45, WIDE), pad('choir', 0.24, 52, 3, { att: 1.5 }), bass('cello', 0.32, 36)] },
    { s: 'B', dyn: 0.5, L: [mel('choir', 0.5), arp('harp', 0.36, 45, WIDE), bass('cello', 0.32, 36), spark('celesta', 0.22, 79, 96, 1)] },
    { s: 'A2', dyn: 0.5, L: [mel('celesta', 0.55), ctr('strings', 0.28), arp('harp', 0.34, 45, WIDE), spark('glock', 0.18, 84, 100, 1)] },
  ],
};

// ---- BATTLE: one theme (D minor, 132 bpm), coloured and transposed per faction.
const BATTLE_SEC = {
  I: { bars: 2, ch: 'Dm:4 Dm:4' },
  A: { bars: 8, ch: 'Dm:4 Bb:4 C:4 A:4 Dm:4 Bb:4 Gm:4 A:4',
    mel: 'D5:1.5 A4:.5 D5:1 E5:1 | F5:1.5 E5:.5 D5:2 | E5:1 C5:1 G4:1 C5:1 | A4:1 C#5:1 E5:2 | D5:1.5 A4:.5 D5:1 E5:1 | F5:1.5 G5:.5 F5:1 D5:1 | Bb4:1 D5:1 G5:1 F5:1 | E5:3 r:1',
    ctr: 'F4:4 | F4:4 | E4:4 | E4:4 | F4:4 | D4:4 | D4:4 | C#4:4' },
  B: { bars: 8, ch: 'Bb:4 C:4 Dm:4 Dm:4 Bb:4 C:4 A:4 A7:4',
    mel: 'F5:2 D5:2 | E5:2 G5:2 | A5:3 F5:1 | D5:4 | F5:2 Bb5:2 | G5:2 E5:2 | C#5:2 E5:2 | G5:2 E5:1 C#5:1',
    ctr: 'D4:4 | E4:4 | F4:4 | A4:2 F4:2 | D4:4 | C4:4 | C#4:4 | C#4:4' },
};
const BCOL = {
  haven: { tr: 0, l1: ['strings', 0], l2: ['horn', -12], c: 'brass', st: 'brass', o1: 'cello', o2: 'strings', dr: 'timpani', ex: [pad('choir', 0.26, 55, 3)] },
  necro: { tr: -2, l1: ['strings', 0], l2: ['choir', -12], c: 'horn', st: 'horn', o1: 'cello', o2: 'strings', dr: 'timpani', ex: [bell('bells', 0.4, 55, 2), spark('glock', 0.2, 84, 100, 1)] },
  sylvan: { tr: 2, l1: ['flute', 0], l2: ['strings', -12], c: 'horn', st: 'pizz', o1: 'cello', o2: 'pizz', dr: 'timpani', ex: [arp('harp', 0.36, 50, SWEEP)] },
  inferno: { tr: -3, l1: ['brass', 0], l2: ['horn', 0], c: 'strings', st: 'brass', o1: 'cello', o2: 'strings', dr: 'taiko', ex: [pad('choir', 0.3, 52, 3)] },
  dungeon: { tr: -1, l1: ['strings', 0], l2: ['celesta', 12], c: 'choir', st: 'harp', o1: 'cello', o2: 'harp', dr: 'timpani', ex: [spark('glock', 0.22, 84, 100, 2), pad('choir', 0.22, 52, 3)] },
};
const battleCache = {};
function battle(fac) {
  if (battleCache[fac]) return battleCache[fac];
  const c = BCOL[fac] || BCOL.haven;
  const drum = (v, p) => perc(c.dr, v, p, c.dr === 'taiko' ? { m: 36 } : {});
  const os = (v) => [ost(c.o1, 0.62 * v, 38, OSTB), ost(c.o2, 0.36 * v, 50, OSTB)];
  const lead = (a = 1) => [mel(c.l1[0], 0.82 * a, c.l1[1]), mel(c.l2[0], 0.46 * a, c.l2[1])];
  return battleCache[fac] = {
    bpm: 132, beats: 4, sec: BATTLE_SEC, tr: c.tr, lvl: 0.85,
    form: [
      { s: 'I', dyn: [0.7, 0.85], L: [...os(1), drum(0.7, 'x.......x...x.x.'), roll('timpani', 0.5, 2)] },
      { s: 'A', dyn: 0.82, L: [...lead(), ...os(1), drum(0.62, 'x.....x...x.....'), ...c.ex] },
      { s: 'B', dyn: [0.85, 0.95], L: [mel(c.l1[0], 0.82, c.l1[1]), ctr(c.c, 0.5), stab(c.st, 0.5, 52, 'x..x..x.'), ...os(1), drum(0.7, 'x..x..x.x...x.x.'), pad('choir', 0.3, 55, 3), roll('timpani', 0.6, 2)] },
      { s: 'A', dyn: 0.9, L: [...lead(), ctr(c.c, 0.5), ...os(1), drum(0.66, 'x.....x...x.x...'), ...c.ex] },
      { s: 'B', dyn: [0.92, 1], L: [...lead(), stab(c.st, 0.55, 52, 'x..x..x.'), ...os(1.05), drum(0.75, 'x..x..x.x.x.x.xx'), pad('choir', 0.34, 55, 3), roll('timpani', 0.65, 2)] },
    ],
  };
}

// ---- stingers (play once, then back to the map)
const VICTORY = {
  bpm: 100, beats: 4, once: true, lvl: 1.05,
  sec: { V: { bars: 4, ch: 'D:4 A:2 Bb:1 C:1 D:4 D:4', mel: 'A4:.5 D5:.5 F#5:1 A5:2 | G5:1 E5:1 F5:1 G5:1 | A5:4 | r:4' } },
  form: [{ s: 'V', dyn: 0.9, L: [mel('brass', 0.85), mel('strings', 0.6), mel('horn', 0.45, -12), pad('choir', 0.4, 55, 3, { att: 0.3 }), pad('horn', 0.36, 50, 3, { w: [8, 16] }), bass('cello', 0.55, 38), perc('timpani', 0.7, 'x.......x.......', { w: [0, 8] }), roll('timpani', 0.6, 1, { at: 7 }), arp('harp', 0.4, 50, GLISS, 0.125, { w: [8, 10] }), perc('timpani', 0.8, 'x...............', { w: [8, 12] })] }],
};
const DEFEAT = {
  bpm: 66, beats: 4, once: true, lvl: 1.2,
  sec: { D: { bars: 4, ch: 'Dm:4 Bb:2 Gm/Bb:2 A:4 Dm:4', mel: 'A4:2 F4:1 E4:1 | D4:2 G4:1 F4:1 | E4:2 C#4:2 | D4:4' } },
  form: [{ s: 'D', dyn: 0.7, L: [mel('horn', 0.7), pad('strings', 0.42, 48, 4, { att: 0.6 }), pad('choir', 0.3, 55, 3, { att: 1 }), bass('cello', 0.5, 36), bell('bells', 0.45, 55, 3), roll('timpani', 0.35, 2, { at: 8 })] }],
};

const THEMES = { haven: [HAVEN, HAVEN_TOWN], necro: [NECRO, NECRO_TOWN], sylvan: [SYLVAN, SYLVAN_TOWN], inferno: [INFERNO, INFERNO_TOWN], dungeon: [DUNGEON, DUNGEON_TOWN] };
function pieceFor(scene, fac) {
  if (!THEMES[fac]) fac = 'haven';
  switch (scene) {
    case 'menu': return MENU;
    case 'town': return THEMES[fac][1];
    case 'battle': return battle(fac);
    case 'victory': return VICTORY;
    case 'defeat': return DEFEAT;
    default: return THEMES[fac][0];
  }
}

// ------------------------------------------------------------ compile & render
const compiled = new WeakMap();
function compile(p) {
  if (compiled.has(p)) return compiled.get(p);
  const tr = p.tr || 0, sec = {};
  for (const [k, s] of Object.entries(p.sec)) {
    const ch = chords(s.ch, tr), beats = s.bars * p.beats;
    if (Math.abs(ch.len - beats) > 1e-6) throw new Error(`chords of ${k} last ${ch.len} beats, expected ${beats}`);
    const m = s.mel ? seq(s.mel, tr) : null, c = s.ctr ? seq(s.ctr, tr) : null;
    for (const [n, x] of [['mel', m], ['ctr', c]]) if (x && Math.abs(x.len - beats) > 1e-6) throw new Error(`${n} of ${k} lasts ${x.len} beats, expected ${beats}`);
    sec[k] = { beats, ch: ch.list, mel: m && m.notes, ctr: c && c.notes };
  }
  const inst = new Set();
  for (const e of p.form) for (const L of [...e.L, ...(e.alt || [])]) inst.add(L.i);
  const c = { sec, inst: [...inst], spb: 60 / p.bpm };
  c.dur = p.form.reduce((a, e) => a + sec[e.s].beats * c.spb, 0);
  compiled.set(p, c);
  return c;
}
function rng32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const chordAt = (list, b) => { for (const c of list) if (b < c.b + c.d - 1e-6) return c; return list[list.length - 1]; };

// all note events of one form entry, at absolute times from t0
function renderEntry(p, ei, pass, t0) {
  const C = compile(p), e = p.form[ei], S = C.sec[e.s], spb = C.spb, beats = S.beats, out = [];
  const R = rng32(ei * 7919 + pass * 104729 + 17);
  const [d0, d1] = Array.isArray(e.dyn) ? e.dyn : [e.dyn ?? 0.8, e.dyn ?? 0.8];
  const layers = pass % 2 && e.alt ? e.alt : e.L;
  for (const L of layers) {
    const push = (b, m, d, v, x) => {
      if (L.w && (b < L.w[0] || b >= L.w[1])) return;
      out.push({ t: t0 + b * spb, i: L.i, m, d: d * spb, v: v * (d0 + (d1 - d0) * b / beats), ...x });
    };
    const hum = () => (R() - 0.5) * 0.02 / spb;
    switch (L.k) {
      case 'mel': case 'ctr': {
        const ns = S[L.k]; if (!ns) break;
        let lo = 1e3, hi = -1e3; for (const n of ns) { lo = Math.min(lo, n.m); hi = Math.max(hi, n.m); }
        for (const n of ns) {
          const shape = 0.86 + 0.2 * (n.m - lo) / Math.max(1, hi - lo) + (n.d >= 2 ? 0.05 : 0);
          push(n.b + hum(), n.m + L.o, n.d + 0.06 / spb, L.v * shape * (0.96 + R() * 0.08), L.att ? { att: L.att } : undefined);
        }
        break;
      }
      case 'pad': {
        let prev = null;
        for (const c of S.ch) {
          const vs = voicing(c, prev, L.lo, L.n); prev = vs;
          for (const m of vs) push(c.b, m, c.d + 0.12 / spb, L.v * (0.9 + R() * 0.1), { att: L.att ?? INST[L.i].att * 2.5 });
        }
        break;
      }
      case 'bass': {
        let last = null;
        for (const c of S.ch) {
          let m = near(c.bass, L.lo);
          if (last !== null && Math.abs(m + 12 - last) < Math.abs(m - last) && m + 12 < L.lo + 14) m += 12;
          last = m;
          const step = { long: c.d, half: 2, pulse: 1, dot: 1.5 }[L.p] || c.d;
          for (let b = 0; b < c.d - 1e-6; b += step) push(c.b + b, m, Math.min(step, c.d - b), L.v * (b === 0 ? 1 : 0.8));
        }
        break;
      }
      case 'arp': {
        for (const c of S.ch) {
          const tones = [];
          for (let m = L.lo; m < L.lo + 30; m++) if (c.pcs.includes(m % 12)) tones.push(m);
          const n = Math.round(c.d / L.div);
          for (let j = 0; j < n; j++) {
            const b = c.b + j * L.div, m = tones[L.p[j % L.p.length] % tones.length];
            push(b, m, 2, L.v * (j % (L.p.length / 2) === 0 ? 1 : 0.78) * (0.92 + R() * 0.12));
          }
        }
        break;
      }
      case 'ost': {
        for (const c of S.ch) {
          const root = near(c.bass, L.lo), n = Math.round(c.d / L.div);
          for (let j = 0; j < n; j++) {
            const off = L.p[j % L.p.length]; if (off == null) continue;
            push(c.b + j * L.div, root + off, L.div * 0.85, L.v * (j % 4 === 0 ? 1 : j % 2 ? 0.7 : 0.82));
          }
        }
        break;
      }
      case 'perc': {
        const bar = p.beats;
        for (let b0 = 0; b0 < beats - 1e-6; b0 += bar) {
          for (let j = 0; j < L.p.length && j * L.div < bar - 1e-6; j++) {
            const ch = L.p[j]; if (ch === '.') continue;
            const b = b0 + j * L.div, m = L.m ?? near(chordAt(S.ch, b).root, L.lo);
            push(b, m, 2, L.v * (ch === 'x' ? 1 : 0.55));
          }
        }
        break;
      }
      case 'roll': {
        const at = L.at ?? beats - L.beats, c = chordAt(S.ch, at), m = near(c.root, L.lo), step = 0.075 / spb;
        for (let b = 0; b < L.beats - 1e-6; b += step) push(at + b, m, 1, L.v * (0.25 + 0.75 * (b / L.beats) ** 1.5));
        break;
      }
      case 'stab': {
        let prev = null;
        for (let b0 = 0; b0 < beats - 1e-6; b0 += p.beats) {
          for (let j = 0; j < L.p.length; j++) {
            if (L.p[j] !== 'x') continue;
            const b = b0 + j * L.div, vs = voicing(chordAt(S.ch, b), prev, L.lo, 3); prev = vs;
            for (const m of vs) push(b, m, 0.4, L.v * (j === 0 ? 1 : 0.82), { att: 0.01 });
          }
        }
        break;
      }
      case 'bell': {
        for (let bar = 0; bar * p.beats < beats; bar += L.every) {
          const b = bar * p.beats; push(b, near(chordAt(S.ch, b).root, L.lo), 4, L.v);
        }
        break;
      }
      case 'spark': {
        for (let b0 = 0; b0 < beats - 1e-6; b0 += p.beats) {
          const c = chordAt(S.ch, b0), tones = [];
          for (let m = L.lo; m <= L.hi; m++) if (c.pcs.includes(m % 12)) tones.push(m);
          const slots = p.beats * 2;
          for (let k = 0; k < L.n; k++) {
            if (R() < 0.25) continue;
            const b = b0 + Math.floor(R() * slots) * 0.5, m = tones[Math.floor(R() * tones.length)];
            push(b, m, 2, L.v * (0.7 + R() * 0.3));
            if (R() < 0.35) push(b + 0.25, tones[Math.min(tones.length - 1, tones.indexOf(m) + 1)], 2, L.v * 0.6);
          }
        }
        break;
      }
    }
  }
  out.sort((a, b) => a.t - b.t);
  return { ev: out, dur: beats * spb };
}

// hall impulse response: stereo, early reflections, darkening exponential tail
function hallIR(ac, sec = 2.8) {
  const SR = ac.sampleRate, len = Math.floor(SR * sec), buf = ac.createBuffer(2, len, SR), R = rng32(99);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c); let lp = 0;
    const pre = Math.floor(SR * 0.018);
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / SR, k = 0.08 + 0.85 * Math.min(1, t / sec) ** 0.6; // lowpass coefficient: brighter early, darker late
      lp += (1 - k) * ((R() * 2 - 1) - lp);
      d[i] = lp * Math.exp(-6.2 * t / (sec * 0.82)) * (t < 0.08 ? 0.6 + 4 * t : 1);
    }
    for (const [ms, g] of [[11, 0.5], [19, 0.36], [27, 0.3], [37, 0.22], [53, 0.16]]) { const i = Math.floor(SR * (ms + c * 3) / 1000); if (i < len) d[i] += g * (c ? -1 : 1); }
  }
  return buf;
}

// =====================================================================
// ENGINE
// =====================================================================
export function createScore(ac, out) {
  const LOOK = 1.4, XF = 2.6, MAXV = 72;
  let clock = () => ac.currentTime, sim = false;
  const mix = ac.createGain(); mix.gain.value = 1.6;
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 2.6; comp.attack.value = 0.03; comp.release.value = 0.3;
  const master = ac.createGain(); master.gain.value = 0.0001;
  mix.connect(comp).connect(master).connect(out);
  const rev = ac.createConvolver(); rev.buffer = hallIR(ac);
  const revRet = ac.createGain(); revRet.gain.value = 0.55;
  const revIn = ac.createGain(); revIn.gain.value = 1;
  revIn.connect(rev).connect(revRet).connect(mix);

  // ---- sample bank
  const bank = {}, loading = {};
  async function decode(ab) { return await new Promise((res, rej) => { const p = ac.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); }); }
  function load(name) {
    if (loading[name]) return loading[name];
    return (loading[name] = (async () => {
      const ab = await (await fetch(AUDIO + name + '.bin')).arrayBuffer();
      const hl = new DataView(ab).getUint32(0, true), h = JSON.parse(new TextDecoder().decode(new Uint8Array(ab, 4, hl)));
      const notes = await Promise.all(h.notes.map(async ([m, off, len]) => ({ m, buf: await decode(ab.slice(4 + hl + off, 4 + hl + off + len)) })));
      bank[name] = notes.sort((a, b) => a.m - b.m);
    })().catch((e) => { delete loading[name]; throw e; }));
  }
  const ready = (list) => list.every((n) => bank[n]);
  const ensure = (list) => Promise.all(list.map(load));

  // ---- decks: one playing piece each, crossfaded
  let decks = [], running = false, timer = null, scene = 'map', fac = 'haven', want = 0, back = null;
  function newDeck(piece, t) {
    const dry = ac.createGain(), wet = ac.createGain(), lvl = piece.lvl ?? 1;
    dry.connect(mix); wet.connect(revIn);
    const d = { piece, dry, wet, lvl, ch: {}, q: [], qi: 0, next: t, ei: 0, pass: 0, stopAt: Infinity, killAt: Infinity, voices: [], end: Infinity, fFrom: 0, fTo: 0, f0: 0, f1: 0 };
    return d;
  }
  function channel(d, name) {
    if (d.ch[name]) return d.ch[name];
    const I = INST[name], g = ac.createGain(), send = ac.createGain();
    g.gain.value = 1; send.gain.value = I.rev;
    let node = g;
    if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = I.pan; g.connect(p); node = p; }
    node.connect(d.dry); node.connect(send).connect(d.wet);
    return (d.ch[name] = g);
  }
  // deck gain ramps; the current value is tracked here (AudioParam.value is unreliable ahead of time)
  const gainAt = (d, now) => (now >= d.f1 ? d.fTo : now <= d.f0 ? d.fFrom : d.fFrom + (d.fTo - d.fFrom) * (now - d.f0) / (d.f1 - d.f0));
  function fade(d, now, to, sec) {
    const from = gainAt(d, now);
    for (const g of [d.dry.gain, d.wet.gain]) {
      g.cancelScheduledValues(now); g.setValueAtTime(from, now);
      g.linearRampToValueAtTime(Math.max(0, to), now + sec);
    }
    Object.assign(d, { fFrom: from, fTo: to, f0: now, f1: now + sec });
  }
  function retire(d, now, sec) {
    if (d.stopAt < Infinity) return;
    fade(d, now, 0, sec); d.stopAt = now + sec; d.killAt = now + sec + 4;
  }

  // play one note event through the sampler
  function play(d, ev, now) {
    const S = bank[ev.i], I = INST[ev.i]; if (!S) return;
    d.voices = d.voices.filter((x) => x > now);
    if (d.voices.length > MAXV && ev.v < 0.5) return;
    let s = S[0]; for (const x of S) if (Math.abs(x.m - ev.m) < Math.abs(s.m - ev.m)) s = x;
    const rate = 2 ** ((ev.m - s.m) / 12), len = s.buf.duration / rate;
    const v = Math.min(1.4, Math.max(0, ev.v)) ** 1.4 * I.g, t = Math.max(ev.t, now);
    const dest = channel(d, ev.i), rel = I.rel;
    const voice = (st, off, a, hold, endFade, stop) => {
      const src = ac.createBufferSource(), g = ac.createGain();
      src.buffer = s.buf; src.playbackRate.value = rate;
      g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(v, st + a);
      if (endFade) { g.gain.setValueAtTime(v, Math.max(st + a, hold)); g.gain.linearRampToValueAtTime(0, stop); }
      else { g.gain.setTargetAtTime(0, Math.max(st + a, hold), rel / 3); }
      src.connect(g).connect(dest); src.start(st, off); src.stop(stop);
      d.voices.push(stop);
    };
    if (!I.sus) {
      const ring = Math.min(len - 0.02, Math.max(ev.d, I.ring));
      if (ring >= len - 0.05) voice(t, 0, I.att, t + len - 0.3, true, t + len - 0.01);
      else voice(t, 0, I.att, t + ring, false, t + ring + rel * 1.6);
      return;
    }
    // sustained: chain crossfaded segments for notes longer than the sample
    const end = t + Math.max(0.08, ev.d), XS = 0.35, LOOPOFF = 0.75;
    let a = Math.min(ev.att ?? I.att, Math.max(0.01, (end - t) * 0.5));
    let st = t, off = 0;
    for (let k = 0; k < 12; k++) {
      const playable = (s.buf.duration - off) / rate - 0.04;
      if (st + playable >= end + rel * 1.4) { voice(st, off, a, end, false, end + rel * 1.4); return; }
      voice(st, off, a, st + playable - XS, true, st + playable);
      st = st + playable - XS; off = LOOPOFF; a = XS;
    }
  }

  function tick() {
    const now = clock();
    for (const d of decks) {
      const p = d.piece, C = compile(p);
      while (d.next < now + LOOK + 0.5 && d.next < d.stopAt && d.end === Infinity) {
        const r = renderEntry(p, d.ei, d.pass, d.next);
        d.q = d.q.slice(d.qi).concat(r.ev); d.qi = 0;
        d.next += r.dur; d.ei++;
        if (d.ei >= p.form.length) { if (p.once) d.end = d.next; else { d.ei = 0; d.pass++; } }
      }
      while (d.qi < d.q.length && d.q[d.qi].t < now + LOOK) {
        const ev = d.q[d.qi++];
        if (ev.t > d.stopAt || ev.t < now - 0.08) continue;
        play(d, ev, now);
      }
      if (p.once && d.end < Infinity && !d.backed && now > d.end - 0.6) { d.backed = true; if (back) back(); }
      void C;
    }
    decks = decks.filter((d) => {
      if (now < d.killAt) return true;
      if (!sim) { d.dry.disconnect(); d.wet.disconnect(); }
      return false;
    });
  }

  // begin the current scene: wait for its instruments, then crossfade in
  function cue() {
    const piece = pieceFor(scene, fac), token = ++want, C = compile(piece);
    const go = () => {
      if (token !== want || !running) return;
      const now = clock(), once = !!piece.once;
      for (const d of decks) retire(d, now, once ? 0.9 : XF);
      const d = newDeck(piece, now + (once ? 0.25 : 0.12));
      d.dry.gain.value = d.wet.gain.value = 0;
      fade(d, now, d.lvl, once ? 0.02 : decks.length ? XF * 0.6 : 1.5);
      decks.push(d); tick();
      prefetch();
    };
    if (ready(C.inst)) go(); else ensure(C.inst).then(go, () => {});
  }
  let prefetched = false;
  function prefetch() { // warm the rest of this faction's music in the background, one file at a time
    if (prefetched) return; prefetched = true;
    const names = new Set();
    for (const s of ['map', 'town', 'battle', 'victory', 'defeat']) for (const n of compile(pieceFor(s, fac)).inst) names.add(n);
    let chain = Promise.resolve();
    for (const n of names) chain = chain.then(() => load(n)).catch(() => {});
    chain.then(() => { prefetched = false; });
  }

  function setScene(sc, f) {
    if (!SCENES.includes(sc)) sc = 'map';
    if (f && THEMES[f]) { if (f !== fac) prefetched = false; fac = f; }
    const cur = decks.find((d) => d.stopAt === Infinity);
    if (sc === 'victory' || sc === 'defeat') {
      const resume = scene === 'victory' || scene === 'defeat' ? 'map' : scene === 'battle' ? 'map' : scene;
      scene = sc;
      back = () => { back = null; scene = resume; if (running) cue(); };
      if (running) cue(); else { scene = resume; back = null; }
      return;
    }
    back = null;
    const piece = pieceFor(sc, fac);
    scene = sc;
    if (cur && cur.piece === piece) return;
    if (running) cue();
  }

  const api = {
    start() {
      if (running) return;
      running = true;
      const now = clock();
      master.gain.cancelScheduledValues(now); master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now);
      master.gain.linearRampToValueAtTime(1, now + 2);
      if (!decks.some((d) => d.stopAt === Infinity)) cue();
      if (!timer && typeof setInterval === 'function') timer = setInterval(tick, 200);
    },
    stop() {
      if (!running) return;
      running = false; want++;
      const now = clock();
      master.gain.cancelScheduledValues(now); master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0.0001, now + 1);
      for (const d of decks) { d.stopAt = Math.min(d.stopAt, now + 1); d.killAt = Math.min(d.killAt, now + 1.2); }
    },
    setScene,
    // legacy: 1 = town, 2 = adventure map, 3 = battle
    setEra(e) { setScene(e === 1 ? 'town' : e === 3 ? 'battle' : 'map', fac); },
    get scene() { return scene; },
    get faction() { return fac; },
    get playing() { return running; },
    // load everything a scene needs (resolves when it can play)
    preload(sc = scene, f = fac) { return ensure(compile(pieceFor(sc, f)).inst); },
    // testing: drive the scheduler on a simulated clock (OfflineAudioContext)
    scheduleUntil(t) { const real = clock; for (let x = ac.currentTime; x <= t; x += 0.2) { clock = () => x; tick(); } clock = real; },
    _useClock(fn) { clock = fn; sim = true; },
    _tick: tick,
  };
  return api;
}

// for tests and the dev page
export const __test = { pieceFor, compile, renderEntry, seq, chords, voicing, INST, THEMES };
