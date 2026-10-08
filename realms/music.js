// =====================================================================
// The AEONS soundtrack: real little songs, generated live. Each age has
// its own band and style, and every song has a form (A A B A) with a
// melody that repeats so you can hum it, chords, a bass line and a groove.
// Plucked instruments (harp, lyre, lute, guitar, piano) use Karplus-Strong
// string synthesis, so they ring like real strings.
// =====================================================================

const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
const MAJ = [0, 2, 4, 5, 7, 9, 11], MIN = [0, 2, 3, 5, 7, 8, 10], DOR = [0, 2, 3, 5, 7, 9, 10], PENT = [0, 2, 4, 7, 9], MPENT = [0, 3, 5, 7, 10];
// chord progressions as scale degrees (0 = I). A and B sections.
const STYLES = [
  { name: 'stone', bpm: 62, key: 50, scale: MPENT, A: [0, 0, 3, 0], B: [3, 3, 0, 4], lead: 'flute', comp: 'kalimba', bass: 'drone', drums: 'tribal', pad: 'drone', swing: 0 },
  { name: 'bronze', bpm: 66, key: 52, scale: DOR, A: [0, 6, 0, 4], B: [3, 3, 0, 4], lead: 'flute', comp: 'lyre', bass: 'pluck', drums: 'hand', pad: 'drone', swing: 0.1 },
  { name: 'classical', bpm: 64, key: 53, scale: MAJ, A: [0, 5, 3, 4], B: [5, 3, 0, 4], lead: 'flute', comp: 'harp', bass: 'pluck', drums: null, pad: 'strings', swing: 0 },
  { name: 'medieval', bpm: 70, key: 50, scale: DOR, A: [0, 6, 0, 4], B: [2, 6, 3, 4], lead: 'recorder', comp: 'lute', bass: 'drone', drums: 'tabor', pad: 'drone', swing: 0.15 },
  { name: 'industrial', bpm: 68, key: 48, scale: MAJ, A: [0, 5, 3, 4], B: [3, 4, 2, 5], lead: 'piano', comp: 'piano', bass: 'piano', drums: null, pad: 'strings', swing: 0.12 },
  { name: 'modern', bpm: 74, key: 53, scale: MAJ, A: [0, 4, 5, 3], B: [5, 3, 0, 4], lead: 'bell', comp: 'epiano', bass: 'synth', drums: 'soft', pad: 'warm', swing: 0.08 },
  { name: 'space', bpm: 58, key: 50, scale: MIN, A: [0, 5, 2, 6], B: [3, 5, 0, 4], lead: 'glass', comp: 'arp', bass: 'synth', drums: null, pad: 'space', swing: 0 },
];
// rhythm templates for a two-bar melodic phrase, in 8th notes (1 = note, 2 = held)
// sparse and singing: long notes with room to breathe
const RHYTHMS = [
  [1, 2, 2, 2, 1, 2, 1, 2, 1, 2, 2, 2, 2, 2, 0, 0],
  [1, 2, 1, 2, 1, 2, 2, 2, 1, 2, 2, 2, 0, 0, 0, 0],
  [0, 0, 1, 2, 1, 2, 1, 2, 1, 2, 2, 2, 2, 2, 2, 0],
  [1, 2, 2, 1, 1, 2, 2, 2, 1, 2, 1, 2, 1, 2, 2, 2],
];

function impulse(ac, seconds, decay) {
  const len = Math.floor(ac.sampleRate * seconds), buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
  return buf;
}

export function createScore(ac, out) {
  const rnd = Math.random, SR = ac.sampleRate;
  const bus = ac.createGain(); bus.gain.value = 0.0001;
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
  bus.connect(comp).connect(out);
  const rev = ac.createConvolver(); rev.buffer = impulse(ac, 5.5, 2.2);
  const revGain = ac.createGain(); revGain.gain.value = 0.5; rev.connect(revGain).connect(bus);
  const delay = ac.createDelay(1.5); delay.delayTime.value = 0.48; const fb = ac.createGain(); fb.gain.value = 0.42; const dGain = ac.createGain(); dGain.gain.value = 0.28;
  const dlp = ac.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2400; fb.connect(dlp);
  delay.connect(fb); dlp.connect(delay); delay.connect(dGain).connect(bus); const dRev = ac.createGain(); dRev.gain.value = 0.5; dGain.connect(dRev).connect(rev);
  // every voice goes to the dry bus and sends to the reverb (and optionally the delay)
  function out3(node, wet = 0.4, echo = 0) {
    node.connect(bus);
    const s = ac.createGain(); s.gain.value = wet; node.connect(s).connect(rev);
    if (echo) { const e = ac.createGain(); e.gain.value = echo; node.connect(e).connect(delay); }
  }
  const noise = ac.createBuffer(1, SR, SR);
  { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1; }

  // ---- Karplus-Strong plucked strings, cached per note and timbre
  const ksCache = new Map();
  function ks(m, bright = 0.5, sustain = 0.996, dur = 2.4) {
    const key = `${m}|${bright}|${sustain}`;
    if (ksCache.has(key)) return ksCache.get(key);
    const f = mtof(m), N = Math.max(2, Math.round(SR / f)), len = Math.floor(SR * dur);
    const buf = ac.createBuffer(1, len, SR), d = buf.getChannelData(0), ring = new Float32Array(N);
    // a burst of filtered noise excites the string; brighter = less filtered
    let prev = 0;
    for (let i = 0; i < N; i++) { const x = rnd() * 2 - 1; prev = prev + (x - prev) * (0.25 + bright * 0.7); ring[i] = prev; }
    let idx = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const cur = ring[idx], nxt = ring[(idx + 1) % N];
      const v = sustain * (cur * 0.5 + nxt * 0.5);
      ring[idx] = v; d[i] = cur; idx = (idx + 1) % N; last = v;
    }
    // soften the attack click
    for (let i = 0; i < 64 && i < len; i++) d[i] *= i / 64;
    ksCache.set(key, buf);
    return buf;
  }
  function pluck(m, t, vel, { bright = 0.5, sustain = 0.996, tone = 4000, wet = 0.35, echo = 0, dur = 2 } = {}) {
    const src = ac.createBufferSource(); src.buffer = ks(m, bright, sustain);
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = tone;
    const g = ac.createGain(); g.gain.setValueAtTime(vel, t); g.gain.setTargetAtTime(0.0001, t + dur, 0.15);
    src.connect(lp).connect(g); out3(g, wet, echo);
    src.start(t); src.stop(t + dur + 0.8);
  }
  function osc(type, f, t, end, dest, detune = 0) { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = detune; o.connect(dest); o.start(t); o.stop(end); return o; }
  function env(g, t, peak, a, hold, rel) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setValueAtTime(peak, t + a + hold); g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel); }

  // ---- instruments
  const I = {
    harp: (m, t, v) => pluck(m, t, v * 0.42, { bright: 0.45, sustain: 0.998, tone: 3800, wet: 0.75, echo: 0.3, dur: 2.8 }),
    lyre: (m, t, v) => pluck(m, t, v * 0.42, { bright: 0.35, sustain: 0.997, tone: 3000, wet: 0.7, echo: 0.3, dur: 2.4 }),
    lute: (m, t, v) => pluck(m, t, v * 0.42, { bright: 0.3, sustain: 0.996, tone: 2500, wet: 0.65, echo: 0.25, dur: 2 }),
    guitar: (m, t, v) => pluck(m, t, v * 0.5, { bright: 0.45, sustain: 0.996, tone: 3800, wet: 0.3, dur: 1.6 }),
    piano(m, t, v, dur = 1.4) {
      pluck(m, t, v * 0.3, { bright: 0.75, sustain: 0.998, tone: 6000, wet: 0.35, dur });
      const g = ac.createGain(); env(g, t, v * 0.05, 0.005, 0.05, dur * 0.8); out3(g, 0.3);
      osc('sine', mtof(m), t, t + dur + 0.5, g);
    },
    kalimba(m, t, v) {
      const g = ac.createGain(); env(g, t, v * 0.1, 0.003, 0.02, 1.4); out3(g, 0.8, 0.35);
      osc('sine', mtof(m), t, t + 1, g); const g2 = ac.createGain(); env(g2, t, v * 0.04, 0.002, 0, 0.12); g2.connect(g); osc('sine', mtof(m) * 5.4, t, t + 0.2, g2);
    },
    epiano(m, t, v, dur = 0.9) {
      const g = ac.createGain(); env(g, t, v * 0.065, 0.02, dur * 0.4, dur * 1.4); out3(g, 0.7, 0.3);
      const mod = ac.createOscillator(), mg = ac.createGain(); mod.frequency.value = mtof(m) * 2; mg.gain.setValueAtTime(mtof(m) * 1.2, t); mg.gain.exponentialRampToValueAtTime(mtof(m) * 0.1, t + 0.4);
      const car = ac.createOscillator(); car.frequency.value = mtof(m); mod.connect(mg).connect(car.frequency); car.connect(g);
      mod.start(t); car.start(t); mod.stop(t + dur * 1.5); car.stop(t + dur * 1.5);
    },
    arp(m, t, v) {
      const g = ac.createGain(); env(g, t, v * 0.035, 0.01, 0.03, 0.6); out3(g, 0.7, 0.6);
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(3500, t); lp.frequency.exponentialRampToValueAtTime(700, t + 0.3); lp.connect(g);
      osc('sawtooth', mtof(m), t, t + 0.45, lp, -6); osc('square', mtof(m), t, t + 0.45, lp, 6);
    },
    flute(m, t, v, dur) {
      const g = ac.createGain(); env(g, t, v * 0.075, 0.18, Math.max(0, dur - 0.2), 0.6); out3(g, 0.85, 0.35);
      const o = osc('sine', mtof(m), t, t + dur + 0.3, g), vib = ac.createOscillator(), vd = ac.createGain();
      vib.frequency.value = 5.2; vd.gain.setValueAtTime(0, t); vd.gain.linearRampToValueAtTime(mtof(m) * 0.008, t + 0.3); vib.connect(vd).connect(o.frequency); vib.start(t); vib.stop(t + dur + 0.3);
      osc('triangle', mtof(m) * 2, t, t + dur + 0.3, (() => { const h = ac.createGain(); h.gain.value = 0.12; h.connect(g); return h; })());
      const n = ac.createBufferSource(); n.buffer = noise; const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = mtof(m) * 2; bp.Q.value = 3; const ng = ac.createGain(); ng.gain.value = 0.25;
      n.connect(bp).connect(ng).connect(g); n.start(t, rnd()); n.stop(t + dur);
    },
    recorder(m, t, v, dur) { I.flute(m + 12, t, v * 0.8, dur); },
    bell(m, t, v, dur) {
      const g = ac.createGain(); env(g, t, v * 0.06, 0.003, 0.05, 2 + dur * 0.5); out3(g, 0.8, 0.45);
      osc('sine', mtof(m), t, t + 2, g); const h = ac.createGain(); h.gain.value = 0.35; h.connect(g); osc('sine', mtof(m) * 2.76, t, t + 0.8, h);
      const h2 = ac.createGain(); h2.gain.value = 0.15; h2.connect(g); osc('sine', mtof(m) * 5.4, t, t + 0.4, h2);
    },
    glass(m, t, v, dur) {
      const g = ac.createGain(); env(g, t, v * 0.055, 0.25, dur * 0.6, 2); out3(g, 0.9, 0.5);
      osc('triangle', mtof(m), t, t + dur + 1.2, g, -4); osc('sine', mtof(m) * 2, t, t + dur + 1.2, g, 5);
    },
  };
  function pad(kind, notes, t, dur, v = 1) {
    for (const m of notes) {
      const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.03 * v, t + dur * 0.5); g.gain.linearRampToValueAtTime(0.0001, t + dur * 1.3);
      const top = kind === 'space' ? 1800 : kind === 'warm' ? 1400 : kind === 'strings' ? 1900 : 1000;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2; lp.frequency.setValueAtTime(top * 0.35, t); lp.frequency.linearRampToValueAtTime(top, t + dur * 0.6); lp.frequency.linearRampToValueAtTime(top * 0.4, t + dur * 1.3);
      lp.connect(g); out3(g, 0.9, 0.2);
      const f = mtof(m), end = t + dur * 1.35;
      if (kind === 'drone') { osc('sawtooth', f, t, end, lp, -4); osc('sine', f / 2, t, end, g); }
      else if (kind === 'strings') { osc('sawtooth', f, t, end, lp, -8); osc('sawtooth', f, t, end, lp, 9); }
      else if (kind === 'space') { osc('sawtooth', f, t, end, lp, -12); osc('sawtooth', f, t, end, lp, 12); osc('sine', f * 2, t, end, g, 3); }
      else { osc('triangle', f, t, end, lp, -6); osc('sawtooth', f, t, end, lp, 6); }
    }
  }
  function bassNote(kind, m, t, dur, v = 1) {
    if (kind === 'pluck') { pluck(m, t, 0.55 * v, { bright: 0.25, sustain: 0.995, tone: 900, wet: 0.15, dur: Math.min(dur, 1.2) }); return; }
    if (kind === 'piano') { I.piano(m, t, 0.7 * v, dur); return; }
    const g = ac.createGain(); env(g, t, 0.16 * v, 0.01, dur * 0.6, 0.2); out3(g, 0.1);
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(kind === 'synth' ? 700 : 400, t); lp.frequency.exponentialRampToValueAtTime(220, t + dur); lp.connect(g);
    osc(kind === 'synth' ? 'sawtooth' : 'triangle', mtof(m), t, t + dur + 0.3, lp); osc('sine', mtof(m), t, t + dur + 0.3, g);
  }
  // ---- drums
  function kick(t, v = 1) { const g = ac.createGain(); env(g, t, 0.3 * v, 0.002, 0.02, 0.3); g.connect(bus); const o = ac.createOscillator(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.15); o.connect(g); o.start(t); o.stop(t + 0.4); }
  function noiseHit(t, f, type, q, v, dec, wet = 0.15) { const s = ac.createBufferSource(); s.buffer = noise; const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = ac.createGain(); env(g, t, v, 0.001, 0, dec); s.connect(fl).connect(g); out3(g, wet); s.start(t, rnd() * 0.5); s.stop(t + dec + 0.1); }
  const snare = (t, v = 1) => { noiseHit(t, 1800, 'bandpass', 0.8, 0.22 * v, 0.16, 0.25); const g = ac.createGain(); env(g, t, 0.12 * v, 0.001, 0, 0.08); g.connect(bus); osc('triangle', 190, t, t + 0.1, g); };
  const hat = (t, v = 1) => noiseHit(t, 8000, 'highpass', 0.7, 0.06 * v, 0.04, 0.05);
  const shaker = (t, v = 1) => noiseHit(t, 6000, 'bandpass', 1.2, 0.05 * v, 0.07, 0.1);
  const frame = (t, v = 1, f = 120) => { const g = ac.createGain(); env(g, t, 0.2 * v, 0.002, 0, 0.35); out3(g, 0.3); const o = ac.createOscillator(); o.frequency.setValueAtTime(f * 1.6, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.08); o.connect(g); o.start(t); o.stop(t + 0.45); noiseHit(t, 700, 'bandpass', 1, 0.08 * v, 0.06); };
  const brush = (t, v = 1) => noiseHit(t, 3000, 'bandpass', 0.5, 0.08 * v, 0.2, 0.2);
  function drumBar(kind, t, beat, sec) {
    const e = beat / 2;
    for (let b = 0; b < 4; b++) {
      const at = t + b * beat;
      if (kind === 'tribal') { if (b === 0 || b === 2) frame(at, 1, 90); if (b === 3) frame(at + e, 0.6, 140); shaker(at + e, 0.7); }
      else if (kind === 'hand') { if (b % 2 === 0) frame(at, 0.9, 110); frame(at + e, 0.4, 200); if (b === 3) frame(at + e * 1.5, 0.35, 220); }
      else if (kind === 'tabor') { frame(at, b === 0 ? 1 : 0.55, 160); if (b === 1 || b === 3) frame(at + e, 0.35, 230); }
      else if (kind === 'brush') { if (b % 2 === 0) kick(at, 0.45); else brush(at, 1); hat(at + e, 0.6); }
      else if (kind === 'groove') { if (b === 0 || (b === 2 && sec !== 'B')) kick(at, 1); if (b === 2 && sec === 'B') kick(at + e, 0.7); if (b % 2 === 1) snare(at, 1); hat(at, 0.7); hat(at + e, 0.45); }
      else if (kind === 'soft') { if (b === 0) kick(at, 0.6); if (b === 2) snare(at, 0.4); hat(at + e, 0.5); }
    }
  }

  // ---- air: filtered wind that breathes under the music
  function air(t, len) {
    const s = ac.createBufferSource(); s.buffer = noise; s.loop = true;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = era === 6 ? 6 : 1.2;
    const f0 = [500, 600, 800, 650, 420, 900, 1500][era];
    bp.frequency.setValueAtTime(f0 * (0.7 + rnd() * 0.3), t); bp.frequency.linearRampToValueAtTime(f0 * (1.2 + rnd() * 0.6), t + len * 0.6); bp.frequency.linearRampToValueAtTime(f0 * 0.8, t + len * 1.4);
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(era === 4 ? 0.035 : 0.022, t + len * 0.5); g.gain.linearRampToValueAtTime(0.0001, t + len * 1.5);
    s.connect(bp).connect(g); out3(g, 0.9);
    s.start(t, rnd()); s.stop(t + len * 1.6);
    // a far-away shimmer now and then
    if (rnd() < 0.35) { const m = deg(STYLES[era], 14 + ((rnd() * 5) | 0)); const sg = ac.createGain(); env(sg, t + len * 0.3, 0.012, 1.2, 0.5, 3); out3(sg, 1, 0.6); osc('sine', mtof(m), t + len * 0.3, t + len * 0.3 + 5, sg); }
  }

  // ---- the composer
  let era = 0, timer = null, nextBar = 0, bar = 0, level = 0.8, song = null;
  const deg = (st, d, oct = 0) => { const sc = st.scale, n = sc.length; return st.key + sc[((d % n) + n) % n] + 12 * (Math.floor(d / n) + oct); };
  const triad = (st, root) => [deg(st, root), deg(st, root + 2), deg(st, root + 4)];
  function makeSong() {
    const st = STYLES[era];
    // a melody for each section: a two-bar phrase, answered by a variation
    const mel = (prog) => {
      const r = RHYTHMS[(rnd() * RHYTHMS.length) | 0], notes = [];
      let d = 7 + ((rnd() * 3) | 0);
      for (let i = 0; i < 16; i++) {
        if (r[i] !== 1) { notes.push(r[i] === 2 ? 'hold' : null); continue; }
        const chordRoot = prog[Math.floor(i / 8) % prog.length];
        if (i % 4 === 0) { const tones = [chordRoot, chordRoot + 2, chordRoot + 4].map((x) => x + 7); d = tones.reduce((a, b) => (Math.abs(b - d) < Math.abs(a - d) ? b : a)); }
        else d += [-1, -1, 1, 1, 2, -2, 0][(rnd() * 7) | 0];
        d = Math.max(4, Math.min(12, d));
        notes.push(d);
      }
      return notes;
    };
    song = { st, A: mel(st.A), A2: null, B: mel(st.B), form: ['I', 'A', 'I', 'B', 'A', 'I'], bars: 0 };
    // the answer phrase: same rhythm and start, different ending
    song.A2 = song.A.map((x, i) => (i >= 12 && typeof x === 'number' ? x - [0, 1, 2, 0][i % 4] : x));
  }
  function playBar(t) {
    if (!song || song.st !== STYLES[era]) { makeSong(); bar = 0; }
    const st = song.st, beat = 60 / st.bpm, len = beat * 4;
    const secIdx = Math.floor(bar / 4) % song.form.length, sec = song.form[secIdx], inSec = bar % 4;
    const prog = sec === 'B' ? st.B : st.A, root = prog[inSec];
    const chord = triad(st, root);
    const sw = (i) => (i % 2 ? st.swing * beat : 0);
    // pads breathe over two bars, the wind under everything
    if (st.pad && inSec % 2 === 0) pad(st.pad, chord.map((m) => m - 12), t, len * 2, sec === 'I' ? 0.8 : 1);
    if (inSec % 2 === 0) air(t, len * 2);
    if (sec !== 'I' || inSec >= 2) {
      const b = deg(st, root, -2);
      if (st.bass === 'drone') bassNote('drone', b, t, len * 0.95, 0.7);
      else for (const [i, k] of [[0, 0], [2, 4], [3, 7]].slice(0, st.bpm > 95 ? 3 : 2)) bassNote(st.bass, k === 7 ? b + 12 : k === 4 ? deg(st, root + 4, -2) : b, t + i * beat + sw(i * 2), beat * (i === 0 ? 1.8 : 0.9));
    }
    // accompaniment: broken chords or comping
    const comp = I[st.comp];
    const pattern = st.comp === 'epiano' ? [[0, 0], [2.5, 1]] : st.comp === 'arp' ? [0, 0.75, 1.5, 2.25, 3].map((x, i) => [x, i]) : [[0, 0], [1, 1], [2, 2], [3, 3]];
    for (const [p, i] of pattern) {
      const at = t + p * beat + (Math.round(p * 2) % 2 ? st.swing * beat : 0);
      if (st.comp === 'epiano' || st.comp === 'piano' && i === 0) { for (const m of chord) comp(m, at, 0.5, beat * 1.8); continue; }
      const notes = [chord[0], chord[1], chord[2], chord[0] + 12];
      comp(notes[i % 4] + (st.comp === 'arp' ? 12 : 0), at, 0.42 + (i === 0 ? 0.15 : 0));
    }
    // the melody, in the A and B sections
    if (sec !== 'I') {
      const phrase = sec === 'B' ? song.B : (inSec >= 2 ? song.A2 : song.A);
      const half = inSec % 2;
      for (let i = 0; i < 8; i++) {
        const n = phrase[half * 8 + i];
        if (typeof n !== 'number') continue;
        let held = 1; while (half * 8 + i + held < 16 && phrase[half * 8 + i + held] === 'hold' && held < 6) held++;
        const at = t + i * (beat / 2) + sw(i);
        const m = deg(st, n, st.lead === 'piano' ? 0 : st.lead === 'bell' || st.lead === 'glass' ? 0 : 0);
        I[st.lead](m, at, sec === 'B' ? 0.85 : 0.75, held * beat / 2);
      }
    }
    if (st.drums && sec === 'B') drumBar(st.drums, t, beat, sec);
    bar++;
    // after a full song, write a new one in the same style
    if (bar >= song.form.length * 4) { bar = 0; makeSong(); }
    return len;
  }
  return {
    start() {
      if (timer) return;
      nextBar = ac.currentTime + 0.2;
      bus.gain.cancelScheduledValues(ac.currentTime);
      bus.gain.setValueAtTime(Math.max(bus.gain.value, 0.0001), ac.currentTime);
      bus.gain.linearRampToValueAtTime(level, ac.currentTime + 3);
      const run = () => { while (nextBar < ac.currentTime + 1.2) nextBar += playBar(nextBar); };
      run();
      timer = setInterval(run, 250);
    },
    stop() {
      if (!timer) return;
      clearInterval(timer); timer = null;
      bus.gain.cancelScheduledValues(ac.currentTime);
      bus.gain.setValueAtTime(bus.gain.value, ac.currentTime);
      bus.gain.linearRampToValueAtTime(0.0001, ac.currentTime + 1);
    },
    scheduleUntil(t) { while (nextBar < t) nextBar += playBar(nextBar); },
    // a new age starts a new song in its own style
    setEra(e) { const n = Math.max(0, Math.min(STYLES.length - 1, e)); if (n !== era) { era = n; song = null; } },
    get playing() { return !!timer; },
  };
}
