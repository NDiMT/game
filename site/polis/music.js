// =====================================================================
// A small generative jazz combo for POLIS, played live with Web Audio:
// walking bass, electric-piano comping on a ii–V–I tune, brushed swing
// drums and a vibraphone that improvises over the changes. Nothing is
// pre-recorded, so it never plays exactly the same twice.
// =====================================================================

const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
const CHORD = {
  M7: [0, 4, 7, 11, 14], D7: [0, 4, 7, 10, 14], m7: [0, 3, 7, 10, 14], h7: [0, 3, 6, 10, 13], D9: [0, 4, 7, 10, 13],
};
const SCALE = { M7: [0, 2, 4, 7, 9, 11], D7: [0, 2, 4, 7, 9, 10], m7: [0, 2, 3, 5, 7, 10], h7: [0, 1, 3, 5, 6, 10], D9: [0, 1, 4, 7, 8, 10] };
// A 16-bar tune in F: I–VI–ii–V turnarounds, a trip to the IV and back.
const TUNE = [
  [53, 'M7'], [50, 'D7'], [55, 'm7'], [48, 'D7'], [57, 'm7'], [50, 'D9'], [55, 'm7'], [48, 'D7'],
  [58, 'M7'], [51, 'D7'], [57, 'm7'], [50, 'D9'], [55, 'm7'], [48, 'D7'], [53, 'M7'], [48, 'D9'],
];

function impulse(ac, seconds) {
  const len = Math.floor(ac.sampleRate * seconds), buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  return buf;
}

export function createJazz(ac, out) {
  const rnd = Math.random;
  const bus = ac.createGain();
  bus.gain.value = 0.0001;
  bus.connect(out);
  const dry = ac.createGain(); dry.connect(bus);
  const rev = ac.createConvolver(); rev.buffer = impulse(ac, 2.4);
  const wet = ac.createGain(); wet.gain.value = 0.28;
  rev.connect(wet).connect(bus);
  const warm = ac.createBiquadFilter(); warm.type = 'lowpass'; warm.frequency.value = 3200;
  warm.connect(dry); warm.connect(rev);
  const noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1; }

  const env = (g, t, peak, attack, decay, floor = 0.0001) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(Math.max(floor, 0.0001), t + attack + decay);
  };
  // ---- instruments
  function epiano(m, t, dur, vel) {
    const f = mtof(m), g = ac.createGain(), bell = ac.createGain();
    const o1 = ac.createOscillator(), o2 = ac.createOscillator(), o3 = ac.createOscillator();
    o1.type = 'sine'; o1.frequency.value = f;
    o2.type = 'triangle'; o2.frequency.value = f * 1.003;
    o3.type = 'sine'; o3.frequency.value = f * 4.01;
    env(g, t, vel, 0.008, dur + 0.5);
    env(bell, t, vel * 0.25, 0.002, 0.18);
    o1.connect(g); o2.connect(g); o3.connect(bell);
    g.connect(warm); bell.connect(warm);
    for (const o of [o1, o2, o3]) { o.start(t); o.stop(t + dur + 0.7); }
  }
  function bass(m, t, dur, vel) {
    const f = mtof(m), g = ac.createGain(), lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(320, t + 0.25);
    const o1 = ac.createOscillator(), o2 = ac.createOscillator();
    o1.type = 'triangle'; o1.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f;
    env(g, t, vel, 0.012, dur + 0.05);
    o1.connect(lp); o2.connect(lp); lp.connect(g).connect(dry);
    for (const o of [o1, o2]) { o.start(t); o.stop(t + dur + 0.2); }
  }
  function vibes(m, t, dur, vel) {
    const f = mtof(m), g = ac.createGain(), trem = ac.createGain(), lfo = ac.createOscillator(), depth = ac.createGain();
    const o1 = ac.createOscillator(), o2 = ac.createOscillator();
    o1.type = 'sine'; o1.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f * 3.98;
    const o2g = ac.createGain(); o2g.gain.value = 0.12;
    lfo.frequency.value = 5.2; depth.gain.value = 0.25; trem.gain.value = 0.75;
    lfo.connect(depth).connect(trem.gain);
    env(g, t, vel, 0.004, dur + 0.9);
    o1.connect(g); o2.connect(o2g).connect(g); g.connect(trem).connect(warm);
    for (const o of [o1, o2, lfo]) { o.start(t); o.stop(t + dur + 1.1); }
  }
  function hit(t, f, type, q, vel, decay, attack = 0.002) {
    const s = ac.createBufferSource(); s.buffer = noise;
    const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = ac.createGain();
    env(g, t, vel, attack, decay);
    s.connect(fl).connect(g).connect(dry);
    s.start(t, rnd() * 0.5); s.stop(t + attack + decay + 0.05);
  }
  const ride = (t, v) => { hit(t, 7400, 'bandpass', 0.7, 0.05 * v, 0.42); hit(t, 11000, 'highpass', 0.5, 0.02 * v, 0.12); };
  const hat = (t) => hit(t, 8000, 'highpass', 0.6, 0.03, 0.045);
  const brush = (t, v) => hit(t, 2600, 'bandpass', 0.6, 0.05 * v, 0.2, 0.03);
  function kick(t, v) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
    env(g, t, 0.22 * v, 0.004, 0.22);
    o.connect(g).connect(dry); o.start(t); o.stop(t + 0.3);
  }

  // ---- the band
  const BPM = 100, BEAT = 60 / BPM, BAR = BEAT * 4;
  const at = (barT, eighth) => barT + Math.floor(eighth / 2) * BEAT + (eighth % 2 ? BEAT * (2 / 3) : 0); // swing eighths
  const inRange = (m, lo, hi) => { while (m < lo) m += 12; while (m > hi) m -= 12; return m; };
  let lastMel = 72, lastBass = 41;
  function playBar(t, n) {
    const [root, q] = TUNE[n % TUNE.length], [next] = TUNE[(n + 1) % TUNE.length];
    const tones = CHORD[q], chorus = Math.floor(n / TUNE.length);
    // walking bass: root, chord tones, then a chromatic approach to the next root
    const b = inRange(root, 34, 45), nb = inRange(next, 34, 45);
    const line = [b, b + (rnd() < 0.5 ? tones[1] : tones[2]), b + (rnd() < 0.5 ? tones[2] : tones[3] - 12 + 12), nb + (rnd() < 0.5 ? 1 : -1)];
    line.forEach((m, i) => bass(inRange(m, 31, 50), t + i * BEAT, BEAT * 0.9, i === 0 ? 0.5 : 0.4));
    lastBass = line[3];
    // rootless piano voicings (3rd, 7th, 9th and sometimes the 5th) on syncopated hits
    const voicing = [tones[1], tones[3], tones[4], ...(rnd() < 0.4 ? [tones[2]] : [])].map((iv) => inRange(root + iv, 56, 70)).sort((a, z) => a - z);
    const patterns = [[3, 6], [1, 4], [0, 5], [2, 7], [3, 7], [1, 6], [0, 3, 6]];
    for (const e of patterns[(rnd() * patterns.length) | 0]) {
      const len = e % 2 ? BEAT * 0.5 : BEAT * 0.9;
      voicing.forEach((m, i) => epiano(m, at(t, e) + i * 0.006, len, 0.075 + rnd() * 0.02));
    }
    // brushed swing: ride "ding ding-da ding ding-da", hats and brushes on 2 and 4
    for (let beat = 0; beat < 4; beat++) {
      ride(t + beat * BEAT, beat % 2 ? 0.8 : 1);
      if (beat % 2) { ride(t + beat * BEAT + BEAT * (2 / 3), 0.55); hat(t + beat * BEAT); brush(t + beat * BEAT, 1); }
      if (beat === 0 || (beat === 2 && rnd() < 0.5)) kick(t + beat * BEAT, 0.8);
      if (rnd() < 0.18) brush(t + beat * BEAT + BEAT * (2 / 3), 0.5);
    }
    // the vibraphone solos on alternate choruses, phrase by phrase
    const soloing = chorus % 2 === 1 ? n % 4 !== 3 : n % 8 >= 4 && n % 8 !== 7;
    if (soloing) {
      const scale = SCALE[q];
      const pool = [];
      for (let m = 64; m <= 82; m++) if (scale.includes(((m - root) % 12 + 12) % 12)) pool.push(m);
      for (let e = 0; e < 8; e++) {
        if (rnd() > 0.55) continue;
        // prefer small steps, land on chord tones on the beat
        let cand = pool.filter((m) => Math.abs(m - lastMel) <= 4 && m !== lastMel);
        if (e % 2 === 0) { const ct = cand.filter((m) => tones.includes(((m - root) % 12 + 12) % 12)); if (ct.length) cand = ct; }
        if (!cand.length) cand = pool;
        lastMel = cand[(rnd() * cand.length) | 0];
        const long = e === 7 || rnd() < 0.2;
        vibes(lastMel, at(t, e), long ? BEAT : BEAT * 0.45, 0.08 + rnd() * 0.03);
      }
    }
  }

  let timer = null, nextBar = 0, bar = 0, level = 0.4;
  return {
    start() {
      if (timer) return;
      nextBar = ac.currentTime + 0.15;
      bus.gain.cancelScheduledValues(ac.currentTime);
      bus.gain.setValueAtTime(Math.max(bus.gain.value, 0.0001), ac.currentTime);
      bus.gain.linearRampToValueAtTime(level, ac.currentTime + 2);
      const tick = () => { while (nextBar < ac.currentTime + 0.8) { playBar(nextBar, bar++); nextBar += BAR; } };
      tick();
      timer = setInterval(tick, 200);
    },
    stop() {
      if (!timer) return;
      clearInterval(timer); timer = null;
      bus.gain.cancelScheduledValues(ac.currentTime);
      bus.gain.setValueAtTime(bus.gain.value, ac.currentTime);
      bus.gain.linearRampToValueAtTime(0.0001, ac.currentTime + 0.6);
    },
    get playing() { return !!timer; },
    setLevel(v) { level = v; if (timer) bus.gain.setTargetAtTime(v, ac.currentTime, 0.3); },
  };
}
