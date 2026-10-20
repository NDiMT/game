// Sound: every effect is synthesized once (OfflineAudioContext) into a small bank of AudioBuffers at load,
// then played through a fixed pool of 16 voices (buffer source + reused gain node). Cheap per hit, no files.
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const SR = 44100;

function synth(c, out) {
  let nb = null;
  const noiseBuf = () => {
    if (nb) return nb;
    nb = c.createBuffer(1, SR, SR);
    const d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return nb;
  };
  const N = (t, dur, type, freq, q, gain, att = 0.002, freqEnd = 0) => {
    const s = c.createBufferSource(); s.buffer = noiseBuf();
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(out);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  };
  const T = (t, freq, dur, gain, type = 'sine', att = 0.002, freqEnd = 0) => {
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02);
  };
  return { N, T };
}

// name -> [duration, variants, (N, T, k) => void]
const DEFS = {
  glass: [0.75, 4, (N, T) => {
    N(0, 0.45, 'highpass', rnd(2200, 3200), 0.7, 0.55); N(0, 0.1, 'bandpass', rnd(1100, 1700), 1.2, 0.45);
    T(0, rnd(260, 340), 0.07, 0.18, 'triangle', 0.001, 110);
    for (let i = 0; i < 14; i++) T(0.01 + Math.random() * Math.random() * 0.45, rnd(2300, 7200), rnd(0.05, 0.26), rnd(0.04, 0.12), Math.random() < 0.5 ? 'sine' : 'triangle');
  }],
  bottle: [0.5, 3, (N, T) => {
    N(0, 0.25, 'highpass', rnd(2800, 3600), 0.7, 0.45); N(0, 0.06, 'bandpass', 1800, 1.4, 0.4);
    for (let i = 0; i < 8; i++) T(0.005 + Math.random() * Math.random() * 0.3, rnd(3000, 7500), rnd(0.04, 0.18), rnd(0.04, 0.1), 'sine');
  }],
  tink: [0.25, 4, (N, T) => { const f = rnd(2600, 5200); T(0, f, 0.18, 0.12); T(0, f * 1.52, 0.1, 0.07); }],
  brick: [0.3, 4, (N, T) => { N(0, 0.2, 'lowpass', rnd(450, 900), 0.8, 0.7); T(0, rnd(80, 125), 0.14, 0.5, 'sine', 0.002, 45); }],
  crumble: [0.9, 3, (N, T) => {
    N(0, 0.16, 'lowpass', rnd(600, 900), 0.8, 0.8); T(0, rnd(70, 100), 0.16, 0.6, 'sine', 0.002, 38);
    N(0.01, 0.7, 'lowpass', 1800, 0.5, 0.32, 0.01, 300);
    for (let i = 0; i < 7; i++) N(Math.random() * 0.4, 0.03, 'bandpass', rnd(1500, 4000), 3, 0.24);
  }],
  metal0: [0.45, 3, (N, T) => metalS(N, T, 880, 0.32)],
  metal1: [1.0, 3, (N, T) => metalS(N, T, 360, 0.9)],
  metal2: [1.5, 3, (N, T) => metalS(N, T, 165, 1.4)],
  crunch: [0.35, 3, (N, T) => {
    N(0, 0.18, 'bandpass', 2400, 1.4, 0.5);
    for (let i = 0; i < 6; i++) N(Math.random() * 0.14, 0.025, 'bandpass', rnd(2000, 5000), 4, 0.3);
    T(0, rnd(700, 1000), 0.2, 0.07, 'sine', 0.001);
  }],
  wood: [0.25, 4, (N, T) => { N(0, 0.12, 'bandpass', rnd(600, 1100), 1.5, 0.6); T(0, rnd(170, 260), 0.09, 0.32, 'triangle', 0.002, 110); }],
  splinter: [0.5, 3, (N, T) => {
    N(0, 0.1, 'bandpass', 800, 1.2, 0.7); T(0, rnd(150, 210), 0.12, 0.4, 'triangle', 0.002, 80);
    N(0, 0.28, 'highpass', 2000, 0.7, 0.3);
    for (let i = 0; i < 7; i++) N(Math.random() * 0.25, 0.02, 'bandpass', rnd(2500, 4500), 4, 0.3);
  }],
  thud: [0.3, 3, (N, T) => { N(0, 0.15, 'lowpass', 340, 0.7, 0.7); T(0, rnd(68, 80), 0.2, 0.65, 'sine', 0.002, 36); }],
  thudH: [0.35, 2, (N, T) => { N(0, 0.18, 'lowpass', 220, 0.7, 0.8); T(0, rnd(48, 56), 0.25, 0.75, 'sine', 0.002, 30); }],
  whoosh: [0.35, 3, (N) => N(0, 0.3, 'bandpass', rnd(340, 420), 1.4, 0.25, 0.06, rnd(1500, 1900))],
  boom: [1.6, 2, (N, T) => {
    N(0, 1.5, 'lowpass', 1100, 0.7, 1.0, 0.004, 90); T(0, 95, 0.8, 1.0, 'sine', 0.003, 26);
    N(0, 0.35, 'highpass', 1500, 0.5, 0.45);
    for (let i = 0; i < 10; i++) N(0.05 + Math.random() * 0.6, 0.03, 'bandpass', rnd(800, 3000), 3, 0.25);
  }],
  fanfare: [0.8, 1, (N, T) => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => { T(i * 0.09, f, 0.35, 0.13, 'triangle', 0.005); T(i * 0.09, f * 2, 0.2, 0.03, 'sine', 0.005); });
  }],
  earn: [0.45, 1, (N, T) => { T(0, 880, 0.18, 0.12, 'triangle', 0.004); T(0.08, 1320, 0.3, 0.12, 'triangle', 0.004); T(0.08, 2640, 0.2, 0.03); }],
  click: [0.1, 1, (N, T) => T(0, 620, 0.07, 0.1, 'triangle', 0.002, 900)],
  empty: [0.2, 1, (N, T) => T(0, 220, 0.14, 0.12, 'square', 0.002, 150)],
  land: [0.3, 2, (N, T) => { N(0, 0.25, 'lowpass', 260, 0.7, 0.5); T(0, 60, 0.25, 0.5, 'sine', 0.003, 35); }],
};
function metalS(N, T, base0, dur) {
  const base = base0 * rnd(0.85, 1.18), R = [1, 2.76, 5.4, 8.93], A = [1, 0.55, 0.35, 0.18];
  for (let i = 0; i < 4; i++) T(0, base * R[i] * rnd(0.98, 1.02), dur / (1 + i * 0.6), 0.2 * A[i], 'sine', 0.001);
  T(0, base * 0.5, dur * 0.4, 0.12, 'triangle', 0.001);
  N(0, 0.04, 'highpass', 2800, 0.7, 0.4);
}

export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.last = Object.create(null);
    this.bank = Object.create(null);
    this.ready = false;
    this.win = 0; this.cnt = 0;
  }
  // render the bank offline (no user gesture needed); spread over idle time so loading stays smooth
  async build() {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC) return;
    for (const name in DEFS) {
      const [dur, nv, fn] = DEFS[name];
      this.bank[name] = [];
      for (let v = 0; v < nv; v++) {
        try {
          const c = new OAC(1, Math.ceil(SR * dur), SR);
          const { N, T } = synth(c, c.destination);
          fn(N, T);
          this.bank[name].push(await c.startRendering());
        } catch (e) { /* ignore a failed variant */ }
      }
    }
    this.ready = true;
  }
  unlock() {
    if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    let c;
    try { c = new AC({ latencyHint: 'interactive' }); } catch (e) { return; }
    this.ctx = c;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 6; comp.attack.value = 0.002; comp.release.value = 0.25;
    this.out = c.createGain();
    this.out.gain.value = this.muted ? 0 : 0.85;
    this.out.connect(comp); comp.connect(c.destination);
    this.voices = [];
    for (let i = 0; i < 16; i++) { const g = c.createGain(); g.connect(this.out); this.voices.push({ g, src: null }); }
    this.vi = 0;
    try { const s = c.createBufferSource(); s.buffer = c.createBuffer(1, 1, 22050); s.connect(c.destination); s.start(0); } catch (e) { /* ignore */ }
    if (c.state !== 'running') c.resume().catch(() => {});
  }
  setMuted(m) {
    this.muted = m;
    if (this.out) this.out.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.02);
  }
  play(name, gain, rate = 1, key = name, gap = 0.035) {
    const c = this.ctx;
    if (!c || this.muted || !this.ready || c.state !== 'running' || !(gain > 0.005)) return;
    const t = c.currentTime;
    if (t - (this.last[key] || -1) < gap) return;
    if (t - this.win > 0.08) { this.win = t; this.cnt = 0; }
    if (++this.cnt > 8) return;
    this.last[key] = t;
    const list = this.bank[name];
    if (!list || !list.length) return;
    const v = this.voices[this.vi++ % this.voices.length];
    if (v.src) { try { v.src.stop(); } catch (e) { /* already ended */ } }
    const s = c.createBufferSource();
    s.buffer = list[(Math.random() * list.length) | 0];
    s.playbackRate.value = clamp(rate, 0.5, 2);
    v.g.gain.setValueAtTime(Math.min(1.2, gain), t);
    s.connect(v.g);
    s.start(t);
    v.src = s;
  }
  // gameplay-facing API (velocity-scaled volume, random pitch per hit)
  glassBreak(v) { this.play('glass', clamp(v / 14, 0.3, 1), rnd(0.9, 1.12)); }
  bottle(v) { this.play('bottle', clamp(v / 10, 0.35, 1), rnd(0.85, 1.2)); }
  glassTink(v) { this.play('tink', clamp(v / 8, 0.15, 0.8), rnd(0.85, 1.2)); }
  brick(v) { this.play('brick', clamp(v / 12, 0.1, 1), rnd(0.85, 1.15)); }
  crumble(v) { this.play('crumble', clamp(v / 16, 0.4, 1), rnd(0.88, 1.12)); }
  metal(v, size = 1) { this.play('metal' + size, clamp(v / 12, 0.12, 1), rnd(0.88, 1.14), 'm' + size, 0.04); }
  crunch(v) { this.play('crunch', clamp(v / 10, 0.4, 1), rnd(0.9, 1.15)); }
  wood(v) { this.play('wood', clamp(v / 12, 0.1, 1), rnd(0.85, 1.2)); }
  splinter(v) { this.play('splinter', clamp(v / 16, 0.45, 1), rnd(0.9, 1.1)); }
  thud(v, heavy = false) { this.play(heavy ? 'thudH' : 'thud', clamp(v / 14, 0.1, 1), rnd(0.9, 1.1)); }
  whoosh(s) { this.play('whoosh', clamp(s / 25, 0.3, 1), rnd(0.9, 1.15)); }
  boom() { this.play('boom', 1, rnd(0.9, 1.05), 'boom', 0.1); }
  fanfare() { this.play('fanfare', 0.9, 1, 'ff', 0.5); }
  earn() { this.play('earn', 0.8, 1, 'earn', 0.15); }
  click() { this.play('click', 0.8, 1); }
  empty() { this.play('empty', 0.6, 1); }
  land() { this.play('land', 0.7, rnd(0.9, 1.1), 'land', 0.12); }
}
