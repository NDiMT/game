// =====================================================================
// A generative cinematic score for AEONS in the spirit of a space-epic
// soundtrack: a church organ playing a slow minor ostinato over long
// pedal notes, a ticking clock (one tick every 1.25 s), and crescendos
// that swell and fall back. Each age adds stops and layers, so the music
// grows from a quiet flute stop in the Stone Age to the full organ with
// shimmering strings in the Space Age.
// =====================================================================

const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
// A minor. Chords as [root, third, fifth] MIDI notes (low octave).
const PROGS = [
  [[45, 48, 52], [41, 45, 48], [48, 52, 55], [43, 47, 50]], // Am F C G
  [[45, 48, 52], [41, 45, 48], [38, 41, 45], [40, 44, 47]], // Am F Dm E
  [[45, 48, 52], [43, 47, 50], [41, 45, 48], [41, 45, 48]], // Am G F F
];
// the ostinato: indices into [root, third, fifth, octave, 10th, 12th], as 16ths
const MOTIFS = [
  [0, 2, 3, 2, 0, 2, 3, 2, 0, 2, 4, 2, 0, 2, 3, 2],
  [0, 3, 2, 3, 0, 3, 2, 3, 1, 3, 2, 3, 1, 3, 5, 3],
  [3, 2, 0, 2, 3, 2, 0, 2, 4, 2, 0, 2, 3, 2, 1, 2],
];
// per age: how many layers the swell can reach, organ brightness, and colour
const AGES = [
  { max: 2, bright: 0.25, strings: false, shimmer: false },
  { max: 3, bright: 0.3, strings: false, shimmer: false },
  { max: 3, bright: 0.4, strings: true, shimmer: false },
  { max: 4, bright: 0.55, strings: true, shimmer: false },
  { max: 4, bright: 0.65, strings: true, shimmer: false },
  { max: 5, bright: 0.8, strings: true, shimmer: true },
  { max: 5, bright: 1, strings: true, shimmer: true },
];

function impulse(ac, seconds) {
  const len = Math.floor(ac.sampleRate * seconds), buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    // a cathedral: dense early reflections, then a long smooth tail
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2) * (i < ac.sampleRate * 0.02 ? 0.4 : 1);
  }
  return buf;
}
// organ stops as harmonic series: flute (soft), principal, and full organ with mixtures
function organWave(ac, bright) {
  const n = 16, re = new Float32Array(n), im = new Float32Array(n);
  const stops = { 1: 1, 2: 0.55 * bright + 0.25, 3: 0.3 * bright, 4: 0.35 * bright + 0.1, 6: 0.2 * bright, 8: 0.22 * bright, 10: 0.08 * bright, 12: 0.1 * bright, 16: 0.06 * bright };
  for (const [h, a] of Object.entries(stops)) if (+h < n) im[+h] = a;
  return ac.createPeriodicWave(re, im);
}

export function createScore(ac, out) {
  const rnd = Math.random;
  const bus = ac.createGain(); bus.gain.value = 0.0001; bus.connect(out);
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -18; comp.ratio.value = 3; comp.attack.value = 0.05; comp.release.value = 0.4;
  comp.connect(bus);
  // the swell: a master filter and gain that open as the music builds
  const swellF = ac.createBiquadFilter(); swellF.type = 'lowpass'; swellF.frequency.value = 1200; swellF.Q.value = 0.4;
  const swellG = ac.createGain(); swellG.gain.value = 0.6;
  swellF.connect(swellG);
  const dry = ac.createGain(); dry.gain.value = 0.95; swellG.connect(dry).connect(comp);
  const rev = ac.createConvolver(); rev.buffer = impulse(ac, 6);
  const wet = ac.createGain(); wet.gain.value = 1.15;
  swellG.connect(rev); rev.connect(wet).connect(comp);
  const tickBus = ac.createGain(); tickBus.gain.value = 0.5; tickBus.connect(comp);
  const noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1; }
  let waves = AGES.map((a) => organWave(ac, a.bright));
  const flute = organWave(ac, 0);

  function organ(m, t, dur, vel, wave, attack = 0.06, release = 0.5) {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vel, t + attack);
    g.gain.setValueAtTime(vel, t + Math.max(attack, dur));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + release);
    g.connect(swellF);
    // two slightly detuned ranks make the pipes breathe
    for (const det of [-3, 3]) {
      const o = ac.createOscillator();
      o.setPeriodicWave(wave); o.frequency.value = mtof(m); o.detune.value = det;
      o.connect(g); o.start(t); o.stop(t + dur + release + 0.05);
    }
  }
  function strings(notes, t, dur, vel) {
    for (const m of notes) {
      const g = ac.createGain(), lp = ac.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 2200;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + dur * 0.45); g.gain.linearRampToValueAtTime(0.0001, t + dur * 1.1);
      lp.connect(g).connect(swellF);
      for (const det of [-9, 0, 8]) { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + dur * 1.15); }
    }
  }
  function shimmer(m, t) {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.018, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    g.connect(swellF);
    for (const r of [1, 2.005]) { const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = mtof(m) * r; o.connect(g); o.start(t); o.stop(t + 2.3); }
  }
  // the clock
  function tick(t, accent) {
    const s = ac.createBufferSource(); s.buffer = noise;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = accent ? 3400 : 4200; bp.Q.value = 6;
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(accent ? 0.16 : 0.11, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    s.connect(bp).connect(g).connect(tickBus); s.start(t, rnd() * 0.5); s.stop(t + 0.07);
  }
  // a deep timpani-like boom at the peak of a swell
  function boom(t) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(40, t + 1.5);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.35, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.5);
    o.connect(g).connect(comp); o.start(t); o.stop(t + 2.6);
  }

  // ---- the composer: phrases of 8 bars that build layer by layer, then breathe out
  const BEAT = 1.25, BAR = BEAT * 4, SIX = BEAT / 4;
  let era = 0, timer = null, nextBar = 0, bar = 0, level = 1, prog = 0, motif = 0;
  function playBar(t) {
    const age = AGES[era];
    const phraseBar = bar % 8;
    if (phraseBar === 0) { prog = (rnd() * PROGS.length) | 0; motif = (rnd() * MOTIFS.length) | 0; }
    // intensity rises through the phrase: 0 = clock and ostinato only ... 5 = everything
    const peak = Math.min(age.max, 1 + Math.floor(phraseBar / 1.6));
    const layer = phraseBar === 7 ? Math.max(1, peak - 2) : peak;
    const chord = PROGS[prog][phraseBar % 4];
    const [r, th, fi] = chord;
    const ostiNotes = [r + 12, th + 12, fi + 12, r + 24, th + 24, fi + 24];
    // the swell opens the filter and raises the gain over each bar
    const openTo = 900 + layer * 900 * (0.5 + age.bright * 0.5);
    swellF.frequency.cancelScheduledValues(t);
    swellF.frequency.setValueAtTime(swellF.frequency.value, t);
    swellF.frequency.linearRampToValueAtTime(openTo, t + BAR);
    swellG.gain.setValueAtTime(swellG.gain.value, t);
    swellG.gain.linearRampToValueAtTime(0.45 + layer * 0.11, t + BAR);
    // the clock never stops
    for (let b = 0; b < 4; b++) tick(t + b * BEAT, b === 0);
    // ostinato: 16ths on a soft stop, louder and brighter with each layer
    const wave = layer <= 1 ? flute : waves[era];
    const pattern = MOTIFS[motif];
    for (let i = 0; i < 16; i++) organ(ostiNotes[pattern[i]] + (layer >= 4 && i % 8 === 0 ? 12 : 0), t + i * SIX, SIX * 0.8, 0.028 + layer * 0.006, wave, 0.015, 0.18);
    // pedal note
    if (layer >= 2) organ(r - 12, t, BAR * 0.95, 0.07, waves[era], 0.5, 1.5);
    // held chord in the manuals
    if (layer >= 3) organ(th, t, BAR * 0.95, 0.03, waves[era], 0.9, 1.5), organ(fi, t, BAR * 0.95, 0.03, waves[era], 0.9, 1.5), organ(r + 12, t, BAR * 0.95, 0.025, waves[era], 0.9, 1.5);
    if (layer >= 3 && age.strings) strings([r + 24, th + 24, fi + 12], t, BAR, 0.012 + layer * 0.002);
    // the climb: a long melody note in the high octave
    if (layer >= 4) organ([r, th, fi][(rnd() * 3) | 0] + 36, t + BEAT * 2 * ((rnd() * 2) | 0), BEAT * 2, 0.022, waves[era], 0.4, 1.8);
    if (layer >= 5 && phraseBar === 6) boom(t);
    if (age.shimmer && layer >= 3) for (let i = 0; i < 4; i++) if (rnd() < 0.6) shimmer(ostiNotes[(rnd() * 6) | 0] + 24, t + i * BEAT + BEAT / 2);
    bar++;
    return BAR;
  }
  return {
    start() {
      if (timer) return;
      nextBar = ac.currentTime + 0.2;
      bus.gain.cancelScheduledValues(ac.currentTime);
      bus.gain.setValueAtTime(Math.max(bus.gain.value, 0.0001), ac.currentTime);
      bus.gain.linearRampToValueAtTime(level, ac.currentTime + 4);
      const run = () => { while (nextBar < ac.currentTime + 1.5) nextBar += playBar(nextBar); };
      run();
      timer = setInterval(run, 300);
    },
    stop() {
      if (!timer) return;
      clearInterval(timer); timer = null;
      bus.gain.cancelScheduledValues(ac.currentTime);
      bus.gain.setValueAtTime(bus.gain.value, ac.currentTime);
      bus.gain.linearRampToValueAtTime(0.0001, ac.currentTime + 1);
    },
    // a new age starts a fresh phrase so the change is heard
    setEra(e) { const n = Math.max(0, Math.min(AGES.length - 1, e)); if (n !== era) bar = 0; era = n; },
    // schedule ahead up to a given time (used for offline rendering in tests)
    scheduleUntil(t) { while (nextBar < t) nextBar += playBar(nextBar); },
    get playing() { return !!timer; },
  };
}
