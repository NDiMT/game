// All sounds are synthesized with WebAudio (oscillators + filtered noise). No audio files.
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.last = Object.create(null);
    this.win = 0;
    this.cnt = 0;
  }
  unlock() {
    if (this.ctx) {
      if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    let c;
    try { c = new AC({ latencyHint: 'interactive' }); } catch (e) { return; }
    this.ctx = c;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 6;
    comp.attack.value = 0.002; comp.release.value = 0.25;
    this.out = c.createGain();
    this.out.gain.value = this.muted ? 0 : 0.85;
    this.out.connect(comp);
    comp.connect(c.destination);
    const len = c.sampleRate | 0;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.nb = buf;
    try { const s = c.createBufferSource(); s.buffer = c.createBuffer(1, 1, 22050); s.connect(c.destination); s.start(0); } catch (e) { /* ignore */ }
    if (c.state !== 'running') c.resume().catch(() => {});
  }
  setMuted(m) {
    this.muted = m;
    if (this.out) this.out.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.02);
  }
  // voice limiter: per-key minimum gap + global cap per 80 ms window
  ok(key, gap = 0.03) {
    const c = this.ctx;
    if (!c || this.muted || c.state !== 'running') return false;
    const t = c.currentTime;
    if (key && t - (this.last[key] || -1) < gap) return false;
    if (t - this.win > 0.08) { this.win = t; this.cnt = 0; }
    if (++this.cnt > 10) return false;
    if (key) this.last[key] = t;
    return true;
  }
  bad(...a) {
    for (const x of a) if (!Number.isFinite(x)) { if (!window.__sfxBad) window.__sfxBad = new Error('sfx').stack; return true; }
    return false;
  }
  noise(t, dur, type, freq, q, gain, att = 0.002, freqEnd = 0) {
    if (this.bad(t, dur, freq, q, gain, att, freqEnd)) return;
    const c = this.ctx, s = c.createBufferSource();
    s.buffer = this.nb;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.out);
    s.start(t, Math.random() * 0.6);
    s.stop(t + dur + 0.05);
  }
  tone(t, freq, dur, gain, type = 'sine', att = 0.002, freqEnd = 0) {
    if (this.bad(t, freq, dur, gain, att, freqEnd)) return;
    const c = this.ctx, o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  get now() { return this.ctx.currentTime + 0.005; }

  glassBreak(v) {
    if (!this.ok('gb', 0.04)) return;
    const t = this.now, k = clamp(v / 14, 0.25, 1);
    this.noise(t, 0.3 + 0.2 * k, 'highpass', rnd(2200, 3200), 0.7, 0.55 * k);
    this.noise(t, 0.1, 'bandpass', rnd(1100, 1700), 1.2, 0.45 * k);
    this.tone(t, rnd(260, 340), 0.07, 0.18 * k, 'triangle', 0.001, 110);
    const n = 5 + Math.round(9 * k);
    for (let i = 0; i < n; i++) {
      const f = rnd(2300, 7200);
      this.tone(t + Math.random() * Math.random() * 0.45 * k + 0.01, f, rnd(0.05, 0.28), rnd(0.03, 0.09) * (0.5 + k), Math.random() < 0.5 ? 'sine' : 'triangle');
    }
  }
  glassTink(v) {
    if (!this.ok('gt', 0.05)) return;
    const t = this.now, k = clamp(v / 8, 0.15, 1), f = rnd(2600, 5200);
    this.tone(t, f, 0.18, 0.08 * k);
    this.tone(t, f * 1.52, 0.1, 0.05 * k);
  }
  brick(v) {
    if (!this.ok('br', 0.03)) return;
    const t = this.now, k = clamp(v / 12, 0.1, 1);
    this.noise(t, 0.08 + 0.12 * k, 'lowpass', rnd(450, 900), 0.8, 0.65 * k);
    this.tone(t, rnd(80, 125), 0.12, 0.45 * k, 'sine', 0.002, 45);
  }
  crumble(v) {
    if (!this.ok('cr', 0.04)) return;
    const t = this.now, k = clamp(v / 16, 0.35, 1);
    this.noise(t, 0.16, 'lowpass', rnd(600, 900), 0.8, 0.8 * k);
    this.tone(t, rnd(70, 100), 0.16, 0.6 * k, 'sine', 0.002, 38);
    this.noise(t + 0.01, 0.5 + 0.3 * k, 'lowpass', 1800, 0.5, 0.32 * k, 0.01, 300);
    for (let i = 0; i < 6; i++) this.noise(t + Math.random() * 0.35, 0.03, 'bandpass', rnd(1500, 4000), 3, 0.22 * k);
  }
  // size: 0 = can, 1 = sheet/pipe, 2 = barrel/fridge
  metal(v, size = 1) {
    if (!this.ok('m' + size, 0.04)) return;
    const t = this.now, k = clamp(v / 12, 0.12, 1);
    const base = [880, 360, 165][size] * rnd(0.82, 1.2);
    const dur = [0.32, 0.9, 1.4][size] * (0.55 + 0.45 * k);
    const R = [1, 2.76, 5.4, 8.93], A = [1, 0.55, 0.35, 0.18];
    for (let i = 0; i < 4; i++) this.tone(t, base * R[i] * rnd(0.98, 1.02), dur / (1 + i * 0.6), 0.2 * A[i] * k, 'sine', 0.001);
    this.tone(t, base * 0.5, dur * 0.4, 0.12 * k, 'triangle', 0.001);
    this.noise(t, 0.04, 'highpass', 2800, 0.7, 0.4 * k);
  }
  crunch(v) {
    if (!this.ok('cn', 0.05)) return;
    const t = this.now, k = clamp(v / 10, 0.4, 1);
    this.noise(t, 0.18, 'bandpass', 2400, 1.4, 0.5 * k);
    for (let i = 0; i < 5; i++) this.noise(t + Math.random() * 0.12, 0.025, 'bandpass', rnd(2000, 5000), 4, 0.3 * k);
    this.tone(t, rnd(700, 1000), 0.2, 0.07 * k, 'sine', 0.001);
  }
  wood(v) {
    if (!this.ok('wd', 0.03)) return;
    const t = this.now, k = clamp(v / 12, 0.1, 1);
    this.noise(t, 0.07 + 0.05 * k, 'bandpass', rnd(600, 1100), 1.5, 0.6 * k);
    this.tone(t, rnd(170, 260), 0.09, 0.32 * k, 'triangle', 0.002, 110);
  }
  splinter(v) {
    if (!this.ok('sp', 0.04)) return;
    const t = this.now, k = clamp(v / 16, 0.4, 1);
    this.noise(t, 0.1, 'bandpass', 800, 1.2, 0.7 * k);
    this.tone(t, rnd(150, 210), 0.12, 0.4 * k, 'triangle', 0.002, 80);
    this.noise(t, 0.28, 'highpass', 2000, 0.7, 0.3 * k);
    for (let i = 0; i < 6; i++) this.noise(t + Math.random() * 0.22, 0.02, 'bandpass', rnd(2500, 4500), 4, 0.3 * k);
  }
  thud(v, heavy = false) {
    if (!this.ok(heavy ? 'th2' : 'th', 0.04)) return;
    const t = this.now, k = clamp(v / 14, 0.1, 1);
    this.noise(t, 0.15, 'lowpass', heavy ? 220 : 340, 0.7, 0.7 * k);
    this.tone(t, heavy ? 52 : 74, 0.2, 0.65 * k, 'sine', 0.002, 36);
  }
  whoosh(s) {
    if (!this.ok('wh', 0.05)) return;
    const t = this.now, k = clamp(s / 25, 0.3, 1);
    this.noise(t, 0.3, 'bandpass', 380, 1.4, 0.22 * k, 0.06, 1700);
  }
  boom() {
    if (!this.ok(null)) return;
    const t = this.now;
    this.noise(t, 1.5, 'lowpass', 1100, 0.7, 1.0, 0.004, 90);
    this.tone(t, 95, 0.8, 1.0, 'sine', 0.003, 26);
    this.noise(t, 0.35, 'highpass', 1500, 0.5, 0.45);
    for (let i = 0; i < 10; i++) this.noise(t + 0.05 + Math.random() * 0.6, 0.03, 'bandpass', rnd(800, 3000), 3, 0.25);
  }
  fanfare() {
    if (!this.ok('ff', 0.5)) return;
    const t = this.now;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      this.tone(t + i * 0.09, f, 0.35, 0.13, 'triangle', 0.005);
      this.tone(t + i * 0.09, f * 2, 0.2, 0.03, 'sine', 0.005);
    });
  }
  click() {
    if (!this.ok('ck', 0.03)) return;
    const t = this.now;
    this.tone(t, 620, 0.07, 0.1, 'triangle', 0.002, 900);
  }
  land() {
    if (!this.ok('ld', 0.12)) return;
    const t = this.now;
    this.noise(t, 0.25, 'lowpass', 260, 0.7, 0.5);
    this.tone(t, 60, 0.25, 0.5, 'sine', 0.003, 35);
  }
}
