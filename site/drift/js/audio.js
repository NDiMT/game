// WebAudio synthesis only: engine, tyre screech, boost, ball thump, post clang, net swish, crowd, whistle, UI.
export function createAudio() {
  let ctx = null, master = null, muted = false, noiseBuf = null;
  let eng = null, screech = null, crowd = null;
  const A = { ready: false };

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    // 2 s of white noise, shared
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); let b = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b = 0.97 * b + 0.03 * w; d[i] = w * 0.6 + b * 2.2; }
    // engine: two detuned oscillators through a lowpass
    eng = { o1: ctx.createOscillator(), o2: ctx.createOscillator(), f: ctx.createBiquadFilter(), g: ctx.createGain() };
    eng.o1.type = 'sawtooth'; eng.o2.type = 'square'; eng.o2.detune.value = -1200 + 7;
    eng.f.type = 'lowpass'; eng.f.frequency.value = 600; eng.f.Q.value = 3;
    eng.g.gain.value = 0;
    eng.o1.connect(eng.f); eng.o2.connect(eng.f); eng.f.connect(eng.g); eng.g.connect(master);
    eng.o1.start(); eng.o2.start();
    // tyre screech: band-passed noise
    screech = { s: loopNoise(), f: ctx.createBiquadFilter(), f2: ctx.createBiquadFilter(), g: ctx.createGain() };
    screech.f.type = 'bandpass'; screech.f.frequency.value = 1900; screech.f.Q.value = 6;
    screech.f2.type = 'peaking'; screech.f2.frequency.value = 3200; screech.f2.gain.value = 8;
    screech.g.gain.value = 0;
    screech.s.connect(screech.f); screech.f.connect(screech.f2); screech.f2.connect(screech.g); screech.g.connect(master);
    // crowd bed
    crowd = { s: loopNoise(), f: ctx.createBiquadFilter(), f2: ctx.createBiquadFilter(), g: ctx.createGain(), target: 0.05 };
    crowd.f.type = 'bandpass'; crowd.f.frequency.value = 700; crowd.f.Q.value = 0.6;
    crowd.f2.type = 'lowpass'; crowd.f2.frequency.value = 2400;
    crowd.g.gain.value = 0.0;
    crowd.s.connect(crowd.f); crowd.f.connect(crowd.f2); crowd.f2.connect(crowd.g); crowd.g.connect(master);
    A.ready = true;
  }
  function loopNoise() { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.loopStart = Math.random(); s.start(0, Math.random() * 1.5); return s; }
  function burst(dur, type, f0, f1, q, gain, when = 0) {
    const t = ctx.currentTime + when;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur); f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.02, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  function tone(type, f0, f1, dur, gain, when = 0, attack = 0.005) {
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
    return o;
  }

  A.unlock = init;
  A.setMuted = (m) => { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.05); };
  A.isMuted = () => muted;

  // continuous: called every frame
  A.drive = (speed, throttle, slip, boost, active) => {
    if (!ctx) return;
    const t = ctx.currentTime;
    const s = Math.min(1, speed / 30), th = throttle || 0;
    const f = 55 + s * 150 + boost * 35 + th * 18;
    eng.o1.frequency.setTargetAtTime(f, t, 0.05); eng.o2.frequency.setTargetAtTime(f * 1.01, t, 0.05);
    eng.f.frequency.setTargetAtTime(330 + s * 1300 + th * 520 + boost * 900, t, 0.06);
    eng.g.gain.setTargetAtTime(active ? 0.03 + s * 0.045 + th * 0.03 + boost * 0.03 : 0, t, 0.08);
    const sk = active ? Math.min(1, Math.max(0, (Math.abs(slip) - 0.12) * 2.4)) * Math.min(1, speed / 10) : 0;
    screech.g.gain.setTargetAtTime(sk * 0.07, t, 0.04);
    screech.f.frequency.setTargetAtTime(1500 + sk * 900 + Math.sin(t * 37) * 120, t, 0.03);
    crowd.g.gain.setTargetAtTime(crowd.target, t, 0.6);
  };
  A.crowd = (level) => { if (crowd) crowd.target = level; };
  A.silence = () => { if (!ctx) return; const t = ctx.currentTime; eng.g.gain.setTargetAtTime(0, t, 0.05); screech.g.gain.setTargetAtTime(0, t, 0.05); };

  // one-shots
  A.boost = (lv) => {
    if (!ctx) return;
    burst(0.7 + lv * 0.15, 'bandpass', 600, 4200, 1.2, 0.35 + lv * 0.08);
    tone('sawtooth', 120, 420 + lv * 120, 0.45, 0.08);
    tone('sine', 900 + lv * 200, 1800 + lv * 300, 0.18, 0.06);
  };
  A.level = (lv) => { if (!ctx) return; const f = [0, 660, 880, 1175][lv] || 1175; tone('triangle', f, f, 0.12, 0.09); tone('sine', f * 2, f * 2, 0.1, 0.04, 0.03); };
  A.thump = (pow) => {
    if (!ctx) return;
    const g = Math.min(1, pow / 30);
    tone('sine', 140, 45, 0.28, 0.5 * g + 0.15);
    burst(0.08, 'lowpass', 2500, 300, 0.8, 0.4 * g + 0.1);
  };
  A.bounce = (v) => { if (!ctx) return; const g = Math.min(1, v / 14); tone('sine', 110, 50, 0.18, 0.25 * g); };
  A.post = (v) => {
    if (!ctx) return; const g = Math.min(1, v / 20) * 0.22 + 0.05;
    for (const [f, d] of [[523, 1.1], [1307, 0.7], [2209, 0.45], [3001, 0.3]]) tone('sine', f, f * 0.995, d, g);
  };
  A.net = (v) => { if (!ctx) return; const g = Math.min(1, v / 20); burst(0.55, 'highpass', 2500, 1200, 0.5, 0.25 * g + 0.08); burst(0.3, 'bandpass', 500, 200, 1, 0.15 * g); };
  A.save = () => { if (!ctx) return; tone('sine', 160, 60, 0.2, 0.35); burst(0.12, 'lowpass', 1500, 200, 1, 0.3); };
  A.whistle = (long) => {
    if (!ctx) return;
    const n = long ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const w = i * 0.32, dur = long && i === 2 ? 0.7 : 0.22;
      const o = tone('sine', 2850, 2800, dur, 0.13, w, 0.01);
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 38; lg.gain.value = 70;
      lfo.connect(lg); lg.connect(o.frequency); lfo.start(ctx.currentTime + w); lfo.stop(ctx.currentTime + w + dur + 0.05);
      burst(dur, 'bandpass', 2800, 2800, 4, 0.04, w);
    }
  };
  A.roar = (big) => {
    if (!ctx) return;
    burst(big ? 3.2 : 1.6, 'bandpass', 600, 900, 0.5, big ? 0.6 : 0.3);
    burst(big ? 2.8 : 1.2, 'bandpass', 1400, 1100, 0.7, big ? 0.35 : 0.15, 0.05);
  };
  A.groan = () => { if (!ctx) return; burst(1.3, 'bandpass', 500, 260, 3, 0.35); burst(1.1, 'bandpass', 900, 420, 4, 0.12, 0.05); };
  A.firework = () => { if (!ctx) return; burst(0.5, 'lowpass', 3000, 200, 0.7, 0.3); tone('sine', 90, 40, 0.4, 0.2); };
  A.click = () => { if (!ctx) return; tone('triangle', 900, 1300, 0.05, 0.07); };
  A.jump = () => { if (!ctx) return; tone('sine', 220, 520, 0.14, 0.12); };
  A.land = (v) => { if (!ctx) return; tone('sine', 90, 40, 0.12, Math.min(0.3, v * 0.03)); };
  A.wall = (v) => { if (!ctx) return; burst(0.12, 'lowpass', 900, 200, 1, Math.min(0.35, v * 0.03)); };
  A.tick = () => { if (!ctx) return; tone('square', 1200, 1200, 0.04, 0.05); };
  A.unlockFx = () => { if (!ctx) return; [784, 988, 1175, 1568].forEach((f, i) => tone('triangle', f, f, 0.18, 0.1, i * 0.09)); };
  return A;
}
