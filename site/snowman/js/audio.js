/**
 * Procedural audio for Snowman Snowball Toss.
 * Happy chiptune-style loop in C major (WebAudio, no external files),
 * plus short sound effects. Everything is generated at runtime so the
 * game has zero audio assets to download.
 */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.muted = localStorage.getItem('snowman.muted') === '1';
    this.playing = false;
    this._timer = null;
    this._step = 0;
    this._nextTime = 0;
    this.bpm = 132;
  }

  /** Must be called from a user gesture (mobile autoplay policy). */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.35;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.6;
    this.sfxGain.connect(this.master);
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('snowman.muted', this.muted ? '1' : '0');
    if (this.master) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 1, this.ctx.currentTime, 0.05);
    }
    return this.muted;
  }

  // ---------------------------------------------------------------- music
  // Note helpers. Frequencies for a C-major happy tune.
  static NOTE = {
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0,
    C3: 130.81, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0,
  };

  /** 32-step (2 bars of 16ths) melody. null = rest. Cheerful skipping tune. */
  static MELODY = [
    'C5', null, 'E5', null, 'G5', null, 'E5', null, 'F5', null, 'E5', 'D5', 'C5', null, null, null,
    'D5', null, 'F5', null, 'A5', null, 'F5', null, 'G5', null, 'F5', 'E5', 'D5', null, 'C5', null,
    'E5', null, 'G5', null, 'C5', null, 'E5', null, 'D5', null, 'F5', null, 'A4', null, 'D5', null,
    'G5', 'F5', 'E5', 'D5', 'C5', null, 'E5', null, 'G4', null, 'B4', null, 'C5', null, null, null,
  ];
  /** Bass: one note per beat (every 4 steps). */
  static BASS = ['C3', 'G3', 'C3', 'G3', 'F3', 'C3', 'F3', 'C3', 'A3', 'E3', 'A3', 'E3', 'G3', 'G3', 'C3', 'C3'];
  /** Chords per beat used for a soft pad. */
  static CHORDS = [
    ['C4', 'E4', 'G4'], ['C4', 'E4', 'G4'], ['C4', 'E4', 'G4'], ['C4', 'E4', 'G4'],
    ['F4', 'A4', 'C5'], ['F4', 'A4', 'C5'], ['F4', 'A4', 'C5'], ['F4', 'A4', 'C5'],
    ['A4', 'C5', 'E5'], ['A4', 'C5', 'E5'], ['A4', 'C5', 'E5'], ['A4', 'C5', 'E5'],
    ['G4', 'B4', 'D5'], ['G4', 'B4', 'D5'], ['C4', 'E4', 'G4'], ['C4', 'E4', 'G4'],
  ];

  startMusic() {
    if (!this.ctx || this.playing) return;
    this.playing = true;
    this._step = 0;
    this._nextTime = this.ctx.currentTime + 0.05;
    this._schedule();
  }

  stopMusic() {
    this.playing = false;
    if (this._timer) clearTimeout(this._timer);
    this._timer = null;
  }

  _schedule() {
    if (!this.playing) return;
    const stepDur = 60 / this.bpm / 4; // 16th note
    // Schedule ~120 ms ahead for smooth playback on mobile.
    while (this._nextTime < this.ctx.currentTime + 0.12) {
      this._playStep(this._step, this._nextTime, stepDur);
      this._step = (this._step + 1) % AudioEngine.MELODY.length;
      this._nextTime += stepDur;
    }
    this._timer = setTimeout(() => this._schedule(), 40);
  }

  _playStep(step, t, dur) {
    const N = AudioEngine.NOTE;
    const mel = AudioEngine.MELODY[step];
    if (mel) this._tone(N[mel], t, dur * 1.6, 'square', 0.16, this.musicGain, 0.008, 0.08);
    if (step % 4 === 0) {
      const beat = (step / 4) % 16;
      this._tone(N[AudioEngine.BASS[beat]], t, dur * 3.2, 'triangle', 0.28, this.musicGain, 0.01, 0.12);
      // soft pad chord on beats 1 and 3
      if (beat % 2 === 0) {
        for (const n of AudioEngine.CHORDS[beat]) {
          this._tone(N[n], t, dur * 7, 'sine', 0.045, this.musicGain, 0.05, 0.25);
        }
      }
      this._kick(t);
    }
    if (step % 8 === 4) this._hat(t, 0.06);
    if (step % 4 === 2) this._hat(t, 0.03);
    // sleigh-bell sparkle every bar
    if (step % 16 === 14) this._tone(N.G5 * 2, t, dur, 'sine', 0.05, this.musicGain, 0.002, 0.15);
  }

  // ------------------------------------------------------------ synthesis
  _tone(freq, t, dur, type, vol, dest, attack = 0.005, release = 0.05) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.setValueAtTime(vol, t + Math.max(attack, dur - release));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  _kick(t) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(g).connect(this.musicGain);
    o.start(t);
    o.stop(t + 0.16);
  }

  _noise(t, dur, vol, dest, hp = 4000) {
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = hp;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t);
  }

  _hat(t, vol) { this._noise(t, 0.05, vol, this.musicGain, 6000); }

  // --------------------------------------------------------------- SFX
  sfxThrow() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._noise(t, 0.18, 0.25, this.sfxGain, 1200);
    this._tone(300, t, 0.15, 'sine', 0.15, this.sfxGain);
  }

  sfxHit() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._noise(t, 0.12, 0.35, this.sfxGain, 800);
    const N = AudioEngine.NOTE;
    this._tone(N.C5, t, 0.1, 'square', 0.15, this.sfxGain);
    this._tone(N.E5, t + 0.08, 0.1, 'square', 0.15, this.sfxGain);
    this._tone(N.G5, t + 0.16, 0.16, 'square', 0.15, this.sfxGain);
  }

  sfxMiss() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._noise(t, 0.2, 0.15, this.sfxGain, 300);
  }

  sfxLevelWin() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const N = AudioEngine.NOTE;
    ['C5', 'E5', 'G5', 'C5', 'E5', 'G5', 'A5'].forEach((n, i) => {
      this._tone(N[n] * (i >= 3 ? 2 : 1), t + i * 0.09, 0.2, 'square', 0.18, this.sfxGain);
    });
  }

  sfxFail() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const N = AudioEngine.NOTE;
    ['E4', 'D4', 'C4'].forEach((n, i) => this._tone(N[n], t + i * 0.14, 0.25, 'triangle', 0.2, this.sfxGain));
  }

  sfxFanfare() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const N = AudioEngine.NOTE;
    const seq = ['C5', 'C5', 'C5', 'E5', 'G5', 'G5', 'A5', 'C5', 'E5', 'G5', 'C5'];
    seq.forEach((n, i) => {
      const f = N[n] * (i >= 7 ? 2 : 1);
      this._tone(f, t + i * 0.13, 0.28, 'square', 0.2, this.sfxGain);
      this._tone(f / 2, t + i * 0.13, 0.28, 'triangle', 0.2, this.sfxGain);
    });
    for (let i = 0; i < 6; i++) this._noise(t + 1.5 + i * 0.1, 0.15, 0.2, this.sfxGain, 3000);
  }
}
