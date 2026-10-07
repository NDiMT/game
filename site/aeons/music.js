// =====================================================================
// A generative score for AEONS that evolves with your civilisation:
// drums and a bone flute in the Stone Age, lyre and harp in antiquity,
// organ and lute in the Middle Ages, piano in the industrial era, an
// electric piano groove in the modern age and shimmering synths in space.
// =====================================================================

const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
const PENTA = [0, 3, 5, 7, 10], DORIAN = [0, 2, 3, 5, 7, 9, 10], MAJOR = [0, 2, 4, 5, 7, 9, 11], LYDIAN = [0, 2, 4, 6, 7, 9, 11];
// per era: tempo, key, scale, chord roots (scale degrees), and which instruments play
const ERAS = [
  { bpm: 76, key: 50, scale: PENTA, prog: [0, 0, 3, 0], pad: 'drone', lead: 'flute', drum: 'tribal', arp: null },
  { bpm: 80, key: 52, scale: DORIAN, prog: [0, 3, 0, 4], pad: 'drone', lead: 'flute', drum: 'hand', arp: 'lyre' },
  { bpm: 84, key: 50, scale: DORIAN, prog: [0, 5, 3, 4], pad: 'strings', lead: null, drum: null, arp: 'harp' },
  { bpm: 88, key: 50, scale: DORIAN, prog: [0, 6, 5, 4], pad: 'organ', lead: 'flute', drum: 'tabor', arp: 'lute' },
  { bpm: 92, key: 48, scale: MAJOR, prog: [0, 5, 3, 4], pad: 'strings', lead: null, drum: null, arp: 'piano' },
  { bpm: 98, key: 53, scale: MAJOR, prog: [1, 4, 0, 5], pad: 'epiano', lead: 'bell', drum: 'beat', arp: null },
  { bpm: 104, key: 50, scale: LYDIAN, prog: [0, 1, 5, 4], pad: 'synth', lead: 'bell', drum: 'pulse', arp: 'synth' },
];
function impulse(ac, seconds) {
  const len = Math.floor(ac.sampleRate * seconds), buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4); }
  return buf;
}

export function createScore(ac, out) {
  const rnd = Math.random;
  const bus = ac.createGain(); bus.gain.value = 0.0001; bus.connect(out);
  const dry = ac.createGain(); dry.connect(bus);
  const rev = ac.createConvolver(); rev.buffer = impulse(ac, 3.2);
  const wet = ac.createGain(); wet.gain.value = 0.38; rev.connect(wet).connect(bus);
  const send = ac.createGain(); send.connect(dry); send.connect(rev);
  const noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1; }
  const env = (g, t, peak, a, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
  const osc = (type, f, t, stop, dest, detune = 0) => { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = detune; o.connect(dest); o.start(t); o.stop(stop); return o; };
  function filtered(type, freq, dest) { const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.connect(dest); return f; }

  // ---- voices
  function pad(kind, notes, t, dur) {
    for (const m of notes) {
      const g = ac.createGain(), f = mtof(m);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.03, t + dur * 0.3); g.gain.linearRampToValueAtTime(0.0001, t + dur * 1.05);
      g.connect(send);
      if (kind === 'drone') { osc('sine', f, t, t + dur * 1.1, g); osc('triangle', f * 0.5, t, t + dur * 1.1, g); }
      else if (kind === 'strings') { const lp = filtered('lowpass', 1400, g); osc('sawtooth', f, t, t + dur * 1.1, lp, -6); osc('sawtooth', f, t, t + dur * 1.1, lp, 7); }
      else if (kind === 'organ') { const lp = filtered('lowpass', 1800, g); osc('square', f, t, t + dur * 1.1, lp); osc('sine', f * 2, t, t + dur * 1.1, g); }
      else if (kind === 'epiano') { const gg = ac.createGain(); env(gg, t, 0.06, 0.01, dur * 0.9); gg.connect(send); osc('sine', f, t, t + dur, gg); osc('sine', f * 4.01, t, t + 0.3, gg); g.gain.value = 0; }
      else { const lp = filtered('lowpass', 900 + 600 * Math.sin(t * 0.3), g); osc('sawtooth', f, t, t + dur * 1.1, lp, -10); osc('sawtooth', f, t, t + dur * 1.1, lp, 10); osc('sine', f / 2, t, t + dur * 1.1, g); }
    }
  }
  function pluck(kind, m, t, vel = 1) {
    const f = mtof(m), g = ac.createGain();
    g.connect(send);
    if (kind === 'lyre' || kind === 'harp' || kind === 'lute') { env(g, t, 0.07 * vel, 0.003, kind === 'harp' ? 1.4 : 0.7); const lp = filtered('lowpass', kind === 'lute' ? 1800 : 3200, g); osc('triangle', f, t, t + 1.6, lp); osc('sine', f * 2, t, t + 0.6, lp); }
    else if (kind === 'piano') { env(g, t, 0.08 * vel, 0.004, 1.2); osc('triangle', f, t, t + 1.4, g); osc('sine', f * 2.002, t, t + 0.5, g); }
    else if (kind === 'bell') { env(g, t, 0.05 * vel, 0.002, 1.6); osc('sine', f, t, t + 1.8, g); osc('sine', f * 3.01, t, t + 0.6, g); }
    else { env(g, t, 0.04 * vel, 0.004, 0.35); const lp = filtered('lowpass', 2400, g); osc('square', f, t, t + 0.45, lp); }
  }
  function flute(m, t, dur) {
    const g = ac.createGain(), vib = ac.createOscillator(), vd = ac.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + 0.08); g.gain.setValueAtTime(0.05, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.2);
    g.connect(send);
    const o = osc('sine', mtof(m), t, t + dur + 0.3, g);
    vib.frequency.value = 5; vd.gain.value = 4; vib.connect(vd).connect(o.frequency); vib.start(t); vib.stop(t + dur + 0.3);
    const s = ac.createBufferSource(); s.buffer = noise; const bp = filtered('bandpass', mtof(m) * 2, g); const ng = ac.createGain(); ng.gain.value = 0.15; s.connect(ng).connect(bp); s.start(t); s.stop(t + dur);
  }
  function drum(kind, t, vel = 1) {
    if (kind === 'low') { const g = ac.createGain(); env(g, t, 0.25 * vel, 0.004, 0.35); g.connect(dry); const o = ac.createOscillator(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.3); o.connect(g); o.start(t); o.stop(t + 0.45); return; }
    const f = { hand: 900, tabor: 1400, hat: 8000, snap: 2200 }[kind] || 1000;
    const s = ac.createBufferSource(); s.buffer = noise;
    const fl = ac.createBiquadFilter(); fl.type = kind === 'hat' ? 'highpass' : 'bandpass'; fl.frequency.value = f; fl.Q.value = 0.8;
    const g = ac.createGain(); env(g, t, (kind === 'hat' ? 0.03 : 0.08) * vel, 0.002, kind === 'hat' ? 0.05 : 0.15);
    s.connect(fl).connect(g).connect(dry); s.start(t, rnd() * 0.5); s.stop(t + 0.3);
  }

  // ---- the composer
  let era = 0, timer = null, nextBar = 0, bar = 0, level = 0.5, lastLead = 0;
  const deg = (cfg, d, oct = 0) => { const sc = cfg.scale, n = sc.length; return cfg.key + sc[((d % n) + n) % n] + 12 * (Math.floor(d / n) + oct); };
  function playBar(t) {
    const cfg = ERAS[era], beat = 60 / cfg.bpm, len = beat * 4;
    const root = cfg.prog[bar % cfg.prog.length];
    const chord = [deg(cfg, root, -1), deg(cfg, root + 2, -1), deg(cfg, root + 4, -1), ...(cfg.scale.length > 5 && era >= 4 ? [deg(cfg, root + 6, -1)] : [])];
    pad(cfg.pad, cfg.pad === 'drone' ? [chord[0], chord[0] + 7] : chord, t, len);
    if (cfg.arp) {
      const steps = cfg.arp === 'synth' ? 8 : 6;
      for (let i = 0; i < steps; i++) if (cfg.arp === 'synth' || rnd() < 0.8) pluck(cfg.arp, deg(cfg, root + [0, 2, 4, 7, 4, 2, 0, 4][i % 8], 0), t + (i * len) / steps, 0.7 + rnd() * 0.3);
    }
    if (cfg.lead && bar % 4 !== 3 && rnd() < 0.75) {
      // a short phrase that moves by steps from where the last one ended
      let d = lastLead || root + 7;
      const n = 3 + ((rnd() * 4) | 0);
      for (let i = 0; i < n; i++) {
        d += [-2, -1, -1, 1, 1, 2, 0][(rnd() * 7) | 0];
        d = Math.max(root + 3, Math.min(root + 12, d));
        const at = t + (i * len) / n;
        if (cfg.lead === 'flute') flute(deg(cfg, d, 0), at, len / n * 1.1); else pluck('bell', deg(cfg, d, 1), at, 0.8);
      }
      lastLead = d;
    }
    if (cfg.drum) {
      for (let b = 0; b < 4; b++) {
        const at = t + b * beat;
        if (cfg.drum === 'tribal') { if (b === 0 || b === 2 || rnd() < 0.3) drum('low', at, b === 0 ? 1 : 0.6); if (rnd() < 0.4) drum('hand', at + beat / 2, 0.5); }
        else if (cfg.drum === 'hand') { if (b % 2 === 0) drum('low', at, 0.6); drum('hand', at + beat / 2, 0.6); }
        else if (cfg.drum === 'tabor') { drum('tabor', at, b === 0 ? 1 : 0.5); }
        else if (cfg.drum === 'beat') { if (b % 2 === 0) drum('low', at, 0.7); else drum('snap', at, 0.5); drum('hat', at + beat / 2, 0.6); }
        else { drum('low', at, 0.5); drum('hat', at + beat / 2, 0.5); }
      }
    }
    bar++;
    return len;
  }
  return {
    start() {
      if (timer) return;
      nextBar = ac.currentTime + 0.2;
      bus.gain.cancelScheduledValues(ac.currentTime);
      bus.gain.setValueAtTime(Math.max(bus.gain.value, 0.0001), ac.currentTime);
      bus.gain.linearRampToValueAtTime(level, ac.currentTime + 3);
      const tick = () => { while (nextBar < ac.currentTime + 1) nextBar += playBar(nextBar); };
      tick();
      timer = setInterval(tick, 250);
    },
    stop() {
      if (!timer) return;
      clearInterval(timer); timer = null;
      bus.gain.cancelScheduledValues(ac.currentTime);
      bus.gain.setValueAtTime(bus.gain.value, ac.currentTime);
      bus.gain.linearRampToValueAtTime(0.0001, ac.currentTime + 0.8);
    },
    setEra(e) { era = Math.max(0, Math.min(ERAS.length - 1, e)); lastLead = 0; },
    get playing() { return !!timer; },
  };
}
