// sfx.js: the ORBIS: Five Crowns sound-effect palette.
//
//   import { createSfx, SFX_NAMES } from './sfx.js';
//   const sfx = createSfx(audioContext, destinationNode);   // samples start loading at once
//   sfx.play('coin');                                        // fire and forget
//   sfx.play('hit', { kind: 'heavy', pan: -0.3, vol: 0.8, pitch: 1.1 });
//   await sfx.ready;                                         // optional: resolves when samples are decoded
//
// Options for play(name, opts):
//   pan    -1 … 1   stereo position (e.g. from the unit's screen x)
//   vol    0 … 1+   extra gain on top of the built-in level (default 1)
//   pitch  ratio    1 = normal, 2 = one octave up
//   kind   string   sub-variant, see the list below
//
// Sounds (legacy names from the old main.js synth all still work):
//   UI        click · tab · select · open · close · confirm · deny
//   loot      coin (=gold) · wood · ore · gems · pickup {kind: gold|wood|ore|gems} · chest · artifact · mana
//   map       step {kind: walk|hoof|fly} · flag (mine captured) · capture (town captured) · town (enter town)
//             day · week · alarm (enemy approaching) · magic (=portal, learn: generic magic / shrine)
//   town      build · recruit · upgrade · hire (hero joins)
//   hero      levelup · fanfare (short reward flourish)
//   battle    battle (war horn + drums) · hit {kind: melee|heavy|slash|blunt|arrow} · heavy · defend
//             shoot {kind: arrow|tower|holy|death|boulder|magic|fireball}
//             cast {kind: spell id}  (caster starts)   spell {kind: arrow|bolt|fireball|bless|cure|haste|slow|stoneskin} (spell lands)
//             die {kind: undead} · die_undead · gate {kind: broken} · luck · morale
//   endings   victory · defeat
//
// Design: one shared bus → soft limiter → out, one shared convolution reverb (send per sound),
// stereo panning, every envelope starts and ends at zero (no clicks). Synthesis (FM bells, filtered
// noise, granular sparkle) is layered with a few short orchestral one-shots from the MIT-licensed
// FluidR3_GM soundfont (audio/sfx/*.mp3, ≈440 KB). Until those are decoded (or if they fail)
// every sampled layer falls back to a synthesized stand-in, so play() always works.
// Levels are calibrated so the loudest effects peak near -6 dBFS at `out`; click and step stay quiet.

export const SFX_NAMES = [
  'click', 'tab', 'select', 'open', 'close', 'confirm', 'deny',
  'coin', 'gold', 'wood', 'ore', 'gems', 'pickup', 'chest', 'artifact', 'mana',
  'step', 'flag', 'capture', 'town', 'day', 'week', 'alarm', 'magic', 'portal', 'learn',
  'build', 'recruit', 'upgrade', 'hire', 'levelup', 'fanfare',
  'battle', 'hit', 'heavy', 'defend', 'shoot', 'cast', 'spell', 'die', 'die_undead', 'gate', 'luck', 'morale',
  'victory', 'defeat',
];

// sampled instruments: short key → [soundfont file stem, notes we ship]
const INST = {
  cel: ['celesta', ['C5', 'G5', 'C6']],
  harp: ['orchestral_harp', ['C4', 'G4', 'C5', 'G5']],
  horn: ['french_horn', ['C3', 'G3']],
  brass: ['brass_section', ['C3', 'G3', 'C4']],
  timp: ['timpani', ['C2', 'G2']],
  taiko: ['taiko_drum', ['C2']],
  choir: ['choir_aahs', ['C4', 'G4']],
  bells: ['tubular_bells', ['C4', 'G4']],
  rcym: ['reverse_cymbal', ['C4']],
  glock: ['glockenspiel', ['G5', 'C6']],
};
const NOTE_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const noteMidi = (n) => 12 * (+n.slice(-1) + 1) + NOTE_PC[n[0]] + (n[1] === 'b' ? -1 : 0);
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
const PENT = [0, 2, 4, 7, 9];

// per sound: [level, reverb send, random pitch spread]
const MIX = {
  click: [0.55, 0.06, 0.08], tab: [0.5, 0.06, 0.08], select: [0.75, 0.22, 0], open: [0.8, 0.3, 0], close: [0.65, 0.25, 0], confirm: [0.7, 0.3, 0], deny: [0.85, 0.08, 0.04],
  coin: [0.75, 0.22, 0.06], pickup: [0.75, 0.22, 0.06], wood: [0.9, 0.16, 0.08], ore: [0.75, 0.18, 0.06], gems: [0.8, 0.35, 0.03], chest: [0.8, 0.3, 0], artifact: [0.8, 0.38, 0], mana: [0.8, 0.4, 0.03],
  step: [0.32, 0.04, 0.12], flag: [0.85, 0.28, 0], capture: [0.85, 0.32, 0], town: [0.85, 0.4, 0], day: [0.85, 0.42, 0], week: [0.85, 0.42, 0], alarm: [0.9, 0.35, 0], magic: [0.85, 0.5, 0.02],
  build: [0.85, 0.26, 0.03], recruit: [0.85, 0.24, 0], upgrade: [0.85, 0.34, 0], hire: [0.85, 0.32, 0], levelup: [0.85, 0.42, 0], fanfare: [0.85, 0.36, 0],
  battle: [0.9, 0.32, 0], hit: [0.85, 0.12, 0.1], heavy: [0.9, 0.18, 0.06], defend: [0.8, 0.18, 0.05], shoot: [0.75, 0.14, 0.08], cast: [0.75, 0.42, 0.03], spell: [0.9, 0.32, 0.03],
  die: [0.8, 0.24, 0.1], die_undead: [0.8, 0.45, 0.08], gate: [0.9, 0.28, 0.05], luck: [0.75, 0.38, 0], morale: [0.75, 0.32, 0],
  victory: [0.85, 0.38, 0], defeat: [0.85, 0.45, 0],
};
// calibrated output levels (dev/sfx.html "Analyze"); key 'name' or 'name:kind'
const LEVEL = {
  click: 4.793, tab: 4.256, select: 1.408, open: 0.803, close: 1.008, confirm: 0.713, deny: 0.889, coin: 3.101, wood: 1.591, ore: 1.734, gems: 2.401, chest: 1.035, artifact: 1.182, mana: 2.731, step: 1.496, 'step:fly': 0.518, flag: 2.295, capture: 1.656, town: 1.062, day: 1.439, week: 1.194, alarm: 1.358, magic: 1.746, build: 1.254, recruit: 1.618, upgrade: 1.223, hire: 1.856, levelup: 1.242, fanfare: 1.644, battle: 1.258, hit: 2.331, 'hit:arrow': 7.183, heavy: 3.324, defend: 1.308, 'shoot:arrow': 6.419, 'shoot:tower': 5.402, 'shoot:holy': 1.687, 'shoot:death': 2.84, 'shoot:boulder': 3.92, 'shoot:magic': 7.261, 'shoot:fireball': 2.491, die: 2.344, die_undead: 2.012, gate: 3.487, 'gate:broken': 3.043, luck: 2.156, morale: 1.627, 'cast:arrow': 6.553, 'spell:arrow': 7.073, 'cast:bolt': 5.909, 'spell:bolt': 3.096, 'cast:fireball': 2.335, 'spell:fireball': 2.335, 'cast:bless': 1.722, 'spell:bless': 1.577, 'cast:cure': 1.777, 'spell:cure': 1.444, 'cast:haste': 1.778, 'spell:haste': 1.907, 'cast:slow': 1.794, 'spell:slow': 3.887, 'cast:stoneskin': 1.801, 'spell:stoneskin': 1.498, victory: 1.33, defeat: 2.339,
};
const BUFS = new Map(); // decoded sample cache, shared by every context with the same sample rate
const ALIAS = { gold: 'coin', portal: 'magic', learn: 'magic' };

export function createSfx(ac, out, { base = new URL('./audio/sfx/', import.meta.url).href } = {}) {
  const SR = ac.sampleRate, R = Math.random;
  const pick = (a) => a[(R() * a.length) | 0];

  // ---- master chain: bus → gentle limiter → trim → out; reverb return feeds the bus
  const bus = ac.createGain(); bus.gain.value = 1;
  const lim = ac.createDynamicsCompressor();
  lim.threshold.value = -9; lim.knee.value = 4; lim.ratio.value = 14; lim.attack.value = 0.002; lim.release.value = 0.18;
  const trim = ac.createGain(); trim.gain.value = 0.62;
  bus.connect(lim).connect(trim).connect(out);
  const rev = ac.createConvolver(); rev.normalize = true; rev.buffer = impulse(1.9);
  const revOut = ac.createGain(); revOut.gain.value = 0.9; rev.connect(revOut).connect(bus);

  function impulse(sec) {
    const len = Math.floor(SR * sec), buf = ac.createBuffer(2, len, SR), pre = Math.floor(SR * 0.012);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c); let lp = 0;
      for (let i = pre; i < len; i++) {
        const k = (i - pre) / (len - pre), a = 0.55 - 0.45 * k; // darker as it decays
        lp += a * ((R() * 2 - 1) - lp);
        d[i] = lp * Math.pow(1 - k, 2.6) * (i < pre + SR * 0.004 ? (i - pre) / (SR * 0.004) : 1);
      }
    }
    return buf;
  }
  const noiseBuf = ac.createBuffer(1, SR * 2, SR);
  { const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = R() * 2 - 1; }

  // ---- samples: fetched + decoded in the background; each note remembers where its sound starts
  const lib = {};
  const decode = (ab) => new Promise((res, rej) => { const p = ac.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); });
  const ready = Promise.all(Object.entries(INST).flatMap(([k, [stem, notes]]) => notes.map(async (n) => {
    try {
      const url = `${base}${stem}-${n}.mp3`, key = `${url}@${SR}`;
      if (!BUFS.has(key)) BUFS.set(key, fetch(url).then((r) => r.arrayBuffer()).then(decode));
      const buf = await BUFS.get(key);
      const d = buf.getChannelData(0), bs = buf.sampleRate; let on = 0, pk = 0, pi = 0, end = d.length - 1;
      while (on < d.length && Math.abs(d[on]) < 0.003) on++;
      for (let i = on; i < d.length; i++) if (Math.abs(d[i]) > pk) { pk = Math.abs(d[i]); pi = i; }
      while (end > on && Math.abs(d[end]) < pk * 0.006) end--; // drop the silent tail (saves CPU)
      (lib[k] ||= []).push({ m: noteMidi(n), buf, norm: 0.45 / (pk || 1), off: Math.max(0, on / bs - 0.002), peakAt: (pi - on) / bs, len: (end - on) / bs + 0.05 });
    } catch { /* keep the synth fallback */ }
  }))).then(() => Object.keys(lib).length);

  // ---- building blocks. d = destination node, t = start time
  function env(p, t, a, hold, rel, peak) {
    p.setValueAtTime(0, t);
    p.linearRampToValueAtTime(peak, t + a);
    if (hold > 0) p.setValueAtTime(peak, t + a + hold);
    p.exponentialRampToValueAtTime(Math.max(1e-5, peak * 0.001), t + a + hold + rel);
    p.linearRampToValueAtTime(0, t + a + hold + rel + 0.01);
    return t + a + hold + rel + 0.02;
  }
  function panTo(d, x) {
    if (!x || !ac.createStereoPanner) return d;
    const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, x)); p.connect(d); return p;
  }
  function filt(type, f, q = 0.7) { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
  // oscillator voice: optional glide (f1), vibrato (cents), lowpass
  function osc(d, t, f, { type = 'sine', vol = 0.2, a = 0.004, hold = 0, rel = 0.3, f1, glide, vib = 0, vibRate = 5.5, det = 0, lp, q, pan } = {}) {
    const o = ac.createOscillator(), g = ac.createGain();
    f *= shift; if (f1) f1 *= shift;
    o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = det;
    const end = env(g.gain, t, a, hold, rel, vol);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + (glide ?? a + hold + rel));
    if (vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = vibRate; lg.gain.value = vib; l.connect(lg).connect(o.detune); l.start(t); l.stop(end); }
    let n = o; if (lp) { const fl = filt('lowpass', lp, q); o.connect(fl); n = fl; }
    n.connect(g).connect(panTo(d, pan)); o.start(t); o.stop(end);
    return end;
  }
  // FM bell / metal: inharmonic ratio + decaying index gives crystal, glass, coin, anvil
  function bell(d, t, f, { ratio = 3.5, idx = 2, vol = 0.12, a = 0.002, rel = 1, pan } = {}) {
    const c = ac.createOscillator(), m = ac.createOscillator(), mg = ac.createGain(), g = ac.createGain();
    f *= shift;
    c.frequency.value = f; m.frequency.value = f * ratio;
    mg.gain.setValueAtTime(f * idx, t); mg.gain.exponentialRampToValueAtTime(f * idx * 0.04 + 0.01, t + rel * 0.7);
    const end = env(g.gain, t, a, 0, rel, vol);
    m.connect(mg).connect(c.frequency); c.connect(g).connect(panTo(d, pan));
    c.start(t); m.start(t); c.stop(end); m.stop(end);
    return end;
  }
  // filtered noise with an optional frequency sweep and flutter (banner / grinding)
  function noise(d, t, { type = 'bandpass', f = 1000, f1, q = 1, vol = 0.2, a = 0.003, hold = 0, rel = 0.2, glide, flutter = 0, flutterDepth = 0.8, pan } = {}) {
    f *= shift; if (f1) f1 *= shift;
    const s = ac.createBufferSource(), fl = filt(type, f, q), g = ac.createGain();
    s.buffer = noiseBuf; s.loop = true;
    if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + (glide ?? a + hold + rel));
    const end = env(g.gain, t, a, hold, rel, vol);
    let n = s.connect(fl);
    if (flutter) {
      const am = ac.createGain(), l = ac.createOscillator(), lg = ac.createGain();
      am.gain.value = 1 - flutterDepth / 2; l.frequency.value = flutter; lg.gain.value = flutterDepth / 2;
      l.connect(lg).connect(am.gain); n = n.connect(am); l.start(t); l.stop(end);
    }
    n.connect(g).connect(panTo(d, pan));
    s.start(t, R() * 1.5); s.stop(end);
    return end;
  }
  const thump = (d, t, f, f1, { vol = 0.4, rel = 0.12, glide = 0.07, pan } = {}) => osc(d, t, f, { f1, glide, vol, rel, a: 0.002, pan });
  // granular sparkle: many tiny bell grains, scattered in time and stereo
  function sparkle(d, t, dur, { n = 10, lo = 84, hi = 100, vol = 0.035, up = false, rel = 0.25 } = {}) {
    for (let i = 0; i < n; i++) {
      const k = up ? i / Math.max(1, n - 1) : R();
      let m = up ? lo + (hi - lo) * k : lo + R() * (hi - lo);
      m = Math.floor(m / 12) * 12 + PENT.reduce((b, p) => (Math.abs(p - (m % 12)) < Math.abs(b - (m % 12)) ? p : b), 0);
      bell(d, t + k * dur + (up ? R() * 0.02 : 0), mtof(m), { ratio: 2.005, idx: 0.35, vol: vol * (0.55 + 0.45 * R()) * (up ? 1 : 1 - 0.5 * k), rel: rel * (0.6 + 0.8 * R()), pan: R() * 1.6 - 0.8 });
    }
  }
  // crackle: random short noise ticks (fire, splinters, bones, thunder)
  function crackle(d, t, dur, { n = 8, lo = 1500, hi = 4500, vol = 0.15, q = 3 } = {}) {
    for (let i = 0; i < n; i++) noise(d, t + R() * dur, { f: lo + R() * (hi - lo), q, vol: vol * (0.4 + 0.6 * R()), a: 0.001, rel: 0.012 + R() * 0.02, pan: R() * 1.2 - 0.6 });
  }
  // sampled note, or a synthesized stand-in until the samples are decoded
  let shift = 1; // current pitch ratio (set per play)
  function smp(d, t, inst, m, { vol = 0.4, hold, rel = 0.25, bend = 0, bendT = 0.1, pan } = {}) {
    m += 12 * Math.log2(shift);
    const set = lib[inst];
    if (!set || !set.length) return synthInst(d, t, inst, m, { vol, hold, rel, pan });
    const z = set.reduce((b, s) => (Math.abs(s.m - m) < Math.abs(b.m - m) ? s : b));
    const rate = 2 ** ((m - z.m) / 12), src = ac.createBufferSource(), g = ac.createGain();
    src.buffer = z.buf;
    src.playbackRate.setValueAtTime(rate * 2 ** (bend / 12), t);
    if (bend) src.playbackRate.linearRampToValueAtTime(rate, t + bendT);
    const natural = z.len / rate;
    const h = Math.max(0, Math.min(hold ?? natural - rel, natural - rel - 0.01));
    const end = env(g.gain, t, 0.004, h, rel, vol * z.norm);
    src.connect(g).connect(panTo(d, pan)); src.start(t, z.off); src.stop(end);
    return end;
  }
  function synthInst(d, t, inst, m, { vol, hold, rel, pan }) {
    const f = mtof(m) / shift, h = hold ?? 0; // helpers re-apply shift
    switch (inst) {
      case 'cel': return bell(d, t, f, { ratio: 4, idx: 0.9, vol: vol * 0.4, rel: 1.1, pan });
      case 'glock': bell(d, t, f * 2.76, { ratio: 1, idx: 0, vol: vol * 0.08, rel: 0.3, pan }); return bell(d, t, f, { ratio: 3.5, idx: 0.5, vol: vol * 0.22, rel: 1.3, pan });
      case 'bells': return bell(d, t, f, { ratio: 1.4, idx: 2.5, vol: vol * 0.35, rel: 2.6, pan });
      case 'harp': osc(d, t, f * 2, { vol: vol * 0.08, rel: 0.5, pan }); return osc(d, t, f, { type: 'triangle', vol: vol * 0.35, a: 0.003, rel: 1.2, lp: f * 6, pan });
      case 'horn': case 'brass': {
        const a = inst === 'horn' ? 0.06 : 0.025;
        osc(d, t, f, { type: 'sawtooth', vol: vol * 0.16, a, hold: h || 0.3, rel: rel || 0.3, lp: f * (inst === 'horn' ? 3 : 5), det: -6, pan });
        return osc(d, t, f, { type: 'sawtooth', vol: vol * 0.16, a, hold: h || 0.3, rel: rel || 0.3, lp: f * (inst === 'horn' ? 3 : 5), det: 6, vib: 6, pan });
      }
      case 'choir': for (const dt of [-9, 0, 9]) osc(d, t, f, { type: 'sawtooth', vol: vol * 0.07, a: 0.25, hold: h || 0.6, rel: rel || 0.6, lp: 1600, det: dt, vib: 12, vibRate: 5, pan }); return t + 1.5;
      case 'timp': noise(d, t, { type: 'lowpass', f: 400, vol: vol * 0.3, rel: 0.25 }); return thump(d, t, f * 1.03, f, { vol: vol * 0.7, rel: 1.1, glide: 0.2, pan });
      case 'taiko': noise(d, t, { type: 'lowpass', f: 600, vol: vol * 0.4, rel: 0.15 }); return thump(d, t, 140, 62, { vol: vol * 0.55, rel: 0.45, glide: 0.12, pan });
      case 'rcym': return noise(d, t, { type: 'highpass', f: 5000, vol: vol * 0.35, a: h || 1.2, rel: 0.05, pan });
    }
    return t;
  }
  const arp = (d, t, inst, notes, gap, o = {}) => notes.forEach((m, i) => smp(d, t + i * gap, inst, m, typeof o === 'function' ? o(i) : o));
  const rcymPeak = () => (lib.rcym && lib.rcym[0] ? lib.rcym[0].peakAt : 1.2);

  // ---- the palette: each recipe gets (d, t, kind, opts)
  const S = {
    click(d, t) {
      bell(d, t, 2350, { ratio: 2.01, idx: 0.5, vol: 0.09, rel: 0.07 });
      osc(d, t, 560, { type: 'triangle', vol: 0.09, a: 0.001, rel: 0.035 });
      noise(d, t, { f: 4200, q: 2, vol: 0.06, a: 0.001, rel: 0.018 });
    },
    tab(d, t) { shift *= 1.12; S.click(d, t); },
    select(d, t) { smp(d, t, 'harp', pick([72, 76, 79]), { vol: 0.35 }); bell(d, t, 2800, { ratio: 2.01, idx: 0.4, vol: 0.03, rel: 0.12 }); },
    open(d, t) {
      arp(d, t, 'harp', [60, 64, 67, 72, 76, 79, 84], 0.032, (i) => ({ vol: 0.22 + i * 0.025, pan: -0.4 + i * 0.13 }));
      sparkle(d, t + 0.18, 0.3, { n: 5, lo: 88, hi: 100, vol: 0.025 });
    },
    close(d, t) {
      arp(d, t, 'harp', [79, 76, 72, 67, 64], 0.028, (i) => ({ vol: 0.26 - i * 0.025, pan: 0.4 - i * 0.18 }));
      noise(d, t, { f: 2600, f1: 700, q: 1.2, vol: 0.05, a: 0.03, rel: 0.15 });
    },
    confirm(d, t) {
      smp(d, t, 'cel', 79, { vol: 0.35 }); smp(d, t + 0.085, 'cel', 84, { vol: 0.4 });
      smp(d, t, 'harp', 72, { vol: 0.2 });
      sparkle(d, t + 0.1, 0.25, { n: 4, lo: 91, hi: 103, vol: 0.02 });
    },
    deny(d, t) {
      thump(d, t, 150, 92, { vol: 0.45, rel: 0.16 });
      osc(d, t, 196, { f1: 180, type: 'triangle', vol: 0.11, a: 0.003, rel: 0.13, lp: 900 });
      thump(d, t + 0.09, 118, 78, { vol: 0.38, rel: 0.16 });
      noise(d, t, { type: 'lowpass', f: 500, vol: 0.12, a: 0.002, rel: 0.06 });
    },
    coin(d, t) {
      [0, 0.05 + R() * 0.025, 0.105 + R() * 0.035].forEach((dt, i) => {
        const f = 2500 + R() * 1000, p = R() * 1.0 - 0.5;
        bell(d, t + dt, f, { ratio: 1.414, idx: 1.1, vol: 0.09 - i * 0.012, rel: 0.2, pan: p });
        bell(d, t + dt, f * 1.62, { ratio: 2.1, idx: 0.6, vol: 0.04, rel: 0.12, pan: p });
        noise(d, t + dt, { type: 'highpass', f: 6500, vol: 0.06, a: 0.001, rel: 0.025, pan: p });
      });
      smp(d, t + 0.02, 'glock', pick([84, 88, 91]), { vol: 0.22 });
      sparkle(d, t + 0.08, 0.35, { n: 6, lo: 91, hi: 103, vol: 0.022 });
    },
    wood(d, t) {
      [0, 0.075].forEach((dt, i) => {
        const f = (330 + R() * 40) * (i ? 0.88 : 1);
        osc(d, t + dt, f, { f1: f * 0.85, vol: 0.28, a: 0.001, rel: 0.08 });
        noise(d, t + dt, { f: 950, q: 3, vol: 0.18, a: 0.001, rel: 0.045 });
      });
      smp(d, t + 0.13, 'harp', 67, { vol: 0.25 });
      sparkle(d, t + 0.14, 0.2, { n: 3, lo: 86, hi: 96, vol: 0.02 });
    },
    ore(d, t) {
      bell(d, t, 620, { ratio: 2.76, idx: 2.6, vol: 0.12, rel: 0.4 });
      bell(d, t + 0.065, 930, { ratio: 2.76, idx: 2, vol: 0.08, rel: 0.32, pan: 0.3 });
      thump(d, t, 140, 70, { vol: 0.35, rel: 0.13 });
      noise(d, t, { f: 2500, q: 2, vol: 0.1, a: 0.001, rel: 0.06 });
      smp(d, t + 0.12, 'cel', 72, { vol: 0.22 });
    },
    gems(d, t) {
      bell(d, t, 3136, { ratio: 4, idx: 0.8, vol: 0.07, rel: 0.6 });
      smp(d, t + 0.02, 'glock', 79, { vol: 0.22 }); smp(d, t + 0.1, 'glock', 84, { vol: 0.26 });
      sparkle(d, t + 0.05, 0.4, { n: 9, lo: 84, hi: 105, vol: 0.03, up: true });
    },
    pickup(d, t, k) { (['wood', 'ore', 'gems'].includes(k) ? S[k] : S.coin)(d, t); },
    chest(d, t) {
      osc(d, t, 40, { f1: 64, glide: 0.33, type: 'sawtooth', vol: 0.2, a: 0.03, hold: 0.24, rel: 0.08, vib: 120, vibRate: 9, lp: 1300, q: 3 });
      noise(d, t, { f: 1100, q: 5, vol: 0.05, a: 0.04, hold: 0.2, rel: 0.08, flutter: 30 });
      thump(d, t + 0.37, 110, 58, { vol: 0.42, rel: 0.16 });
      noise(d, t + 0.37, { type: 'lowpass', f: 700, vol: 0.18, a: 0.002, rel: 0.1 });
      arp(d, t + 0.42, 'cel', [72, 76, 79, 84, 88], 0.06, (i) => ({ vol: 0.3, pan: -0.3 + i * 0.15 }));
      smp(d, t + 0.42, 'choir', 67, { vol: 0.12, hold: 0.4, rel: 0.5 });
      sparkle(d, t + 0.45, 0.9, { n: 14, lo: 84, hi: 103, vol: 0.03 });
    },
    artifact(d, t) {
      smp(d, t, 'choir', 60, { vol: 0.14, hold: 0.5, rel: 0.6 }); smp(d, t, 'choir', 67, { vol: 0.12, hold: 0.5, rel: 0.6 });
      arp(d, t, 'cel', [72, 79, 84, 91], 0.07, { vol: 0.32 });
      smp(d, t + 0.3, 'glock', 84, { vol: 0.25 });
      sparkle(d, t + 0.1, 0.8, { n: 12, lo: 86, hi: 105, vol: 0.03 });
    },
    mana(d, t) {
      for (let i = 0; i < 8; i++) { const f = 380 + i * 90 + R() * 80; osc(d, t + i * 0.06 + R() * 0.02, f, { f1: f * 2.2, glide: 0.06, vol: 0.06, a: 0.004, rel: 0.07, pan: R() * 1.2 - 0.6 }); }
      smp(d, t + 0.45, 'glock', 84, { vol: 0.25 });
      sparkle(d, t + 0.3, 0.7, { n: 10, lo: 86, hi: 103, vol: 0.03 });
    },
    step(d, t, k) {
      if (k === 'fly') { for (const dt of [0, 0.17]) noise(d, t + dt, { type: 'lowpass', f: 450, f1: 900, q: 1.5, vol: 0.3, a: 0.06, rel: 0.11 }); return; }
      if (k === 'hoof' || (k !== 'walk' && R() < 0.5)) {
        for (const [dt, v] of [[0, 1], [0.07 + R() * 0.02, 0.6]]) {
          noise(d, t + dt, { f: 1100, q: 3, vol: 0.2 * v, a: 0.001, rel: 0.03 });
          osc(d, t + dt, 420, { f1: 290, glide: 0.03, vol: 0.14 * v, a: 0.001, rel: 0.035 });
        }
      } else {
        noise(d, t, { type: 'lowpass', f: 700, vol: 0.28, a: 0.003, rel: 0.06 });
        thump(d, t, 110, 68, { vol: 0.24, rel: 0.05 });
        noise(d, t + 0.02, { f: 2400, q: 1.5, vol: 0.04, a: 0.004, rel: 0.05 }); // grit
      }
    },
    flag(d, t) {
      noise(d, t, { f: 380, f1: 1800, glide: 0.3, q: 1.4, vol: 0.28, a: 0.16, rel: 0.2, flutter: 14, flutterDepth: 0.7 });
      smp(d, t + 0.22, 'brass', 60, { vol: 0.32, hold: 0.22, rel: 0.35 }); smp(d, t + 0.22, 'brass', 55, { vol: 0.28, hold: 0.22, rel: 0.35 });
      smp(d, t + 0.22, 'timp', 36, { vol: 0.45, rel: 0.6 });
      sparkle(d, t + 0.3, 0.4, { n: 5, lo: 88, hi: 100, vol: 0.022 });
    },
    capture(d, t) {
      noise(d, t, { f: 320, f1: 1600, glide: 0.3, q: 1.3, vol: 0.3, a: 0.16, rel: 0.2, flutter: 13, flutterDepth: 0.7 });
      for (const m of [48, 55, 60]) smp(d, t + 0.2, 'brass', m, { vol: 0.22, hold: 0.16, rel: 0.12 });
      for (const m of [48, 55, 60, 64]) smp(d, t + 0.5, 'brass', m, { vol: 0.2, hold: 0.6, rel: 0.6 });
      smp(d, t + 0.5, 'horn', 48, { vol: 0.25, hold: 0.6, rel: 0.6 });
      smp(d, t + 0.2, 'timp', 36, { vol: 0.4, rel: 0.3 }); smp(d, t + 0.5, 'timp', 36, { vol: 0.5, rel: 0.8 });
      smp(d, t + 0.52, 'bells', 72, { vol: 0.2 });
      sparkle(d, t + 0.55, 1, { n: 14, lo: 86, hi: 103, vol: 0.028 });
    },
    town(d, t) {
      osc(d, t, 30, { f1: 46, glide: 0.45, type: 'sawtooth', vol: 0.18, a: 0.05, hold: 0.32, rel: 0.1, vib: 140, vibRate: 7, lp: 900, q: 3 });
      thump(d, t + 0.5, 80, 44, { vol: 0.5, rel: 0.3 });
      noise(d, t + 0.5, { type: 'lowpass', f: 600, vol: 0.22, a: 0.003, rel: 0.25 });
      smp(d, t + 0.6, 'bells', 60, { vol: 0.28 }); smp(d, t + 0.95, 'bells', 67, { vol: 0.22, pan: 0.3 });
      arp(d, t + 0.62, 'harp', [67, 72, 76, 79], 0.07, { vol: 0.16 });
    },
    day(d, t) {
      smp(d, t, 'bells', 67, { vol: 0.25 });
      arp(d, t + 0.12, 'harp', [60, 64, 67, 72, 76], 0.09, (i) => ({ vol: 0.24, pan: -0.3 + i * 0.15 }));
      sparkle(d, t + 0.4, 0.6, { n: 6, lo: 88, hi: 100, vol: 0.02 });
    },
    week(d, t) {
      smp(d, t, 'timp', 36, { vol: 0.3, rel: 0.6 });
      smp(d, t, 'horn', 48, { vol: 0.26, hold: 0.8, rel: 0.6 }); smp(d, t + 0.05, 'horn', 55, { vol: 0.22, hold: 0.75, rel: 0.6 });
      smp(d, t, 'bells', 60, { vol: 0.25 }); smp(d, t + 0.4, 'bells', 67, { vol: 0.22, pan: 0.3 });
      arp(d, t + 0.1, 'harp', [48, 52, 55, 60, 64, 67, 72, 76, 79, 84], 0.035, (i) => ({ vol: 0.16 + i * 0.012, pan: -0.5 + i * 0.1 }));
      smp(d, t + 0.2, 'choir', 60, { vol: 0.12, hold: 0.8, rel: 0.8 });
      sparkle(d, t + 0.5, 1.4, { n: 16, lo: 86, hi: 105, vol: 0.025 });
    },
    alarm(d, t) {
      for (const dt of [0, 0.5]) { smp(d, t + dt, 'bells', 55, { vol: 0.35, rel: 0.6 }); smp(d, t + dt, 'taiko', 36, { vol: 0.45 }); }
      smp(d, t + 0.02, 'horn', 48, { vol: 0.28, hold: 0.25, rel: 0.3, bend: -1.5 });
      smp(d, t + 0.52, 'horn', 49, { vol: 0.28, hold: 0.35, rel: 0.4, bend: -1.5 });
      osc(d, t, 73.4, { type: 'sawtooth', vol: 0.04, a: 0.2, hold: 0.6, rel: 0.5, lp: 400 });
    },
    magic(d, t) {
      osc(d, t, 440, { f1: 880, glide: 1, vol: 0.05, a: 0.3, hold: 0.2, rel: 0.6, vib: 30, vibRate: 7 });
      osc(d, t, 660, { f1: 1320, glide: 1, vol: 0.035, a: 0.35, hold: 0.15, rel: 0.6, vib: 25, vibRate: 6, pan: 0.4 });
      smp(d, t, 'rcym', 60, { vol: 0.12, hold: Math.min(0.55, rcymPeak()), rel: 0.15 });
      sparkle(d, t + 0.1, 1.1, { n: 14, lo: 84, hi: 105, vol: 0.03 });
      smp(d, t + 0.5, 'cel', 84, { vol: 0.25 }); smp(d, t + 0.62, 'cel', 79, { vol: 0.2, pan: 0.3 });
      smp(d, t + 0.3, 'choir', 67, { vol: 0.08, hold: 0.3, rel: 0.6 });
    },
    build(d, t) {
      for (let i = 0; i < 3; i++) {
        const tt = t + i * 0.17 + R() * 0.02, f = 1250 * (0.94 + R() * 0.12);
        thump(d, tt, 220, 140, { vol: 0.32, rel: 0.06 });
        bell(d, tt, f, { ratio: 2.41, idx: 2.5, vol: 0.08, rel: 0.2 });
        noise(d, tt, { f: 3000, q: 1.5, vol: 0.12, a: 0.001, rel: 0.03 });
      }
      osc(d, t + 0.52, 523, { f1: 1568, glide: 0.45, vol: 0.06, a: 0.2, hold: 0.1, rel: 0.3, vib: 20 });
      arp(d, t + 0.62, 'cel', [72, 79, 84], 0.08, { vol: 0.3 });
      sparkle(d, t + 0.62, 0.6, { n: 10, lo: 86, hi: 103, vol: 0.03, up: true });
    },
    recruit(d, t) {
      for (const dt of [0, 0.12]) { noise(d, t + dt, { f: 1800, q: 0.8, vol: 0.16, a: 0.001, rel: 0.07 }); thump(d, t + dt, 200, 140, { vol: 0.18, rel: 0.05 }); }
      smp(d, t + 0.25, 'taiko', 36, { vol: 0.42 });
      smp(d, t + 0.3, 'glock', 79, { vol: 0.22 }); smp(d, t + 0.4, 'glock', 84, { vol: 0.25 });
      smp(d, t + 0.3, 'harp', 67, { vol: 0.18 });
    },
    upgrade(d, t) {
      smp(d, t, 'brass', 55, { vol: 0.25, hold: 0.1, rel: 0.12 }); smp(d, t + 0.14, 'brass', 60, { vol: 0.28, hold: 0.35, rel: 0.4 });
      arp(d, t + 0.14, 'cel', [72, 76, 79, 84, 88], 0.05, { vol: 0.26 });
      osc(d, t + 0.1, 600, { f1: 1800, glide: 0.4, vol: 0.04, a: 0.15, rel: 0.3 });
      sparkle(d, t + 0.2, 0.7, { n: 12, lo: 86, hi: 105, vol: 0.03, up: true });
    },
    hire(d, t) {
      smp(d, t, 'horn', 55, { vol: 0.3, hold: 0.15, rel: 0.15, bend: -1 }); smp(d, t + 0.22, 'horn', 60, { vol: 0.32, hold: 0.45, rel: 0.5 });
      arp(d, t + 0.22, 'harp', [60, 64, 67, 72, 76], 0.05, { vol: 0.2 });
      sparkle(d, t + 0.3, 0.5, { n: 6, lo: 88, hi: 100, vol: 0.022 });
    },
    fanfare(d, t) {
      smp(d, t, 'brass', 55, { vol: 0.24, hold: 0.06, rel: 0.1 });
      smp(d, t + 0.12, 'brass', 60, { vol: 0.26, hold: 0.45, rel: 0.4 }); smp(d, t + 0.12, 'horn', 48, { vol: 0.22, hold: 0.45, rel: 0.45 });
      smp(d, t + 0.12, 'timp', 36, { vol: 0.35, rel: 0.6 });
      arp(d, t + 0.14, 'cel', [79, 84, 88, 91], 0.06, { vol: 0.25 });
      sparkle(d, t + 0.2, 0.6, { n: 8, lo: 88, hi: 103, vol: 0.025 });
    },
    levelup(d, t) {
      noise(d, t, { f: 600, f1: 4000, glide: 0.6, q: 1.2, vol: 0.08, a: 0.5, rel: 0.25 });
      smp(d, t + 0.05, 'choir', 60, { vol: 0.24, hold: 0.9, rel: 0.7 }); smp(d, t + 0.05, 'choir', 67, { vol: 0.2, hold: 0.9, rel: 0.7 });
      arp(d, t + 0.05, 'cel', [72, 76, 79, 84, 88, 91], 0.075, (i) => ({ vol: 0.3, pan: -0.4 + i * 0.16 }));
      smp(d, t + 0.5, 'glock', 84, { vol: 0.25 });
      smp(d, t, 'timp', 36, { vol: 0.25, rel: 0.6 });
      sparkle(d, t + 0.3, 1.3, { n: 18, lo: 88, hi: 108, vol: 0.028 });
    },
    battle(d, t) {
      smp(d, t, 'horn', 48, { vol: 0.42, hold: 0.7, rel: 0.4, bend: -2, bendT: 0.12 });
      smp(d, t, 'brass', 48, { vol: 0.2, hold: 0.65, rel: 0.4, bend: -2, bendT: 0.12 });
      for (const [dt, v] of [[0, 0.4], [0.33, 0.35], [0.5, 0.5]]) smp(d, t + dt, 'taiko', 36, { vol: v });
      smp(d, t + 0.82, 'timp', 36, { vol: 0.45, rel: 0.8 }); smp(d, t + 0.82, 'timp', 43, { vol: 0.25, rel: 0.6 });
      noise(d, t + 0.82, { type: 'highpass', f: 5000, vol: 0.08, a: 0.002, rel: 0.9 });
    },
    hit(d, t, k) {
      if (k === 'heavy') return S.heavy(d, t);
      if (k === 'arrow') { thump(d, t, 230, 120, { vol: 0.28, rel: 0.06 }); noise(d, t, { f: 1500, q: 1.5, vol: 0.15, a: 0.001, rel: 0.04 }); return; }
      const v = k === 'slash' ? 2 : k === 'blunt' ? 1 : (R() * 3) | 0;
      if (v === 0) { // sword clash
        const f = 1600 * (0.9 + R() * 0.25);
        bell(d, t, f, { ratio: 1.414, idx: 3, vol: 0.12, rel: 0.28 });
        bell(d, t, f * 1.34, { ratio: 2.76, idx: 2, vol: 0.06, rel: 0.2, pan: 0.2 });
        noise(d, t, { type: 'highpass', f: 3500, vol: 0.22, a: 0.001, rel: 0.07 });
        thump(d, t, 130, 65, { vol: 0.38, rel: 0.1 });
      } else if (v === 1) { // blunt / shield
        thump(d, t, 160, 70, { vol: 0.6, rel: 0.12 });
        noise(d, t, { f: 900, q: 1, vol: 0.45, a: 0.001, rel: 0.09 });
        bell(d, t, 700, { ratio: 2.41, idx: 1.5, vol: 0.11, rel: 0.22 });
      } else { // slash
        noise(d, t, { f: 2600, f1: 1100, q: 1.2, vol: 0.24, a: 0.02, rel: 0.07 });
        thump(d, t + 0.03, 140, 70, { vol: 0.42, rel: 0.09 });
        noise(d, t + 0.03, { type: 'lowpass', f: 1800, vol: 0.22, a: 0.001, rel: 0.06 });
      }
    },
    heavy(d, t) {
      thump(d, t, 90, 38, { vol: 0.62, rel: 0.32, glide: 0.12 });
      noise(d, t, { type: 'lowpass', f: 1100, f1: 300, vol: 0.38, a: 0.002, rel: 0.3 });
      smp(d, t, 'timp', 36, { vol: 0.35, rel: 0.4 });
      bell(d, t, 520, { ratio: 2.76, idx: 3, vol: 0.08, rel: 0.4 });
      crackle(d, t + 0.03, 0.25, { n: 5, lo: 1200, hi: 3000, vol: 0.1 });
    },
    defend(d, t) {
      noise(d, t, { f: 900, f1: 1800, q: 1.2, vol: 0.14, a: 0.06, rel: 0.06 });
      bell(d, t + 0.08, 900, { ratio: 1.414, idx: 2, vol: 0.1, rel: 0.45 });
      thump(d, t + 0.08, 180, 115, { vol: 0.35, rel: 0.1 });
    },
    shoot(d, t, k) {
      switch (k) {
        case 'tower': shift *= 0.75; thump(d, t, 120, 80, { vol: 0.32, rel: 0.1 }); // ballista thunk, then the twang
        // falls through
        default: // bow
          osc(d, t, 220, { f1: 196, glide: 0.15, type: 'triangle', vol: 0.18, a: 0.002, rel: 0.18 });
          osc(d, t, 110, { type: 'sawtooth', vol: 0.08, a: 0.002, rel: 0.12, lp: 1200 });
          noise(d, t, { f: 3000, f1: 1400, q: 1.5, vol: 0.14, a: 0.004, rel: 0.15 });
          noise(d, t + 0.03, { type: 'highpass', f: 6000, vol: 0.04, a: 0.03, rel: 0.25 });
          return;
        case 'holy':
          osc(d, t, 880, { f1: 1760, glide: 0.2, vol: 0.08, a: 0.01, rel: 0.3 });
          smp(d, t, 'cel', 79, { vol: 0.25 });
          noise(d, t, { type: 'highpass', f: 4000, vol: 0.05, a: 0.05, rel: 0.2 });
          sparkle(d, t + 0.02, 0.3, { n: 6, lo: 88, hi: 103, vol: 0.025 });
          return;
        case 'death':
          osc(d, t, 220, { f1: 110, type: 'sawtooth', vol: 0.1, a: 0.05, rel: 0.4, lp: 800, vib: 30 });
          osc(d, t, 233, { f1: 116, type: 'sawtooth', vol: 0.08, a: 0.05, rel: 0.4, lp: 700 });
          noise(d, t, { f: 520, f1: 250, q: 2, vol: 0.16, a: 0.1, rel: 0.3 });
          return;
        case 'boulder':
          noise(d, t, { type: 'lowpass', f: 420, f1: 150, vol: 0.4, a: 0.05, rel: 0.35 });
          thump(d, t, 90, 55, { vol: 0.32, rel: 0.15 });
          return;
        case 'magic':
          osc(d, t, 1400, { f1: 350, glide: 0.25, type: 'square', vol: 0.045, a: 0.003, rel: 0.25, lp: 3000 });
          osc(d, t, 2800, { f1: 700, glide: 0.25, vol: 0.05, a: 0.003, rel: 0.25 });
          sparkle(d, t, 0.25, { n: 5, lo: 88, hi: 100, vol: 0.025 });
          return;
        case 'fireball':
          noise(d, t, { f: 300, f1: 1200, glide: 0.4, q: 0.8, vol: 0.32, a: 0.15, rel: 0.25 });
          crackle(d, t + 0.05, 0.35, { n: 6, vol: 0.08 });
          return;
      }
    },
    cast(d, t, k) {
      if (k === 'fireball') return S.shoot(d, t, 'fireball');
      if (k === 'arrow') return S.shoot(d, t, 'magic');
      if (k === 'bolt') { // charging static
        noise(d, t, { f: 1500, f1: 5000, glide: 0.35, q: 3, vol: 0.12, a: 0.3, rel: 0.05, flutter: 40 });
        crackle(d, t, 0.35, { n: 8, lo: 3000, hi: 7000, vol: 0.08 });
        return;
      }
      noise(d, t, { f: 800, f1: 3000, glide: 0.35, q: 1.5, vol: 0.12, a: 0.3, rel: 0.12 });
      osc(d, t, 440, { f1: 880, glide: 0.35, vol: 0.05, a: 0.3, rel: 0.15, vib: 15 });
      if (k === 'bless' || k === 'cure') smp(d, t, 'choir', 67, { vol: 0.12, hold: 0.25, rel: 0.25 });
      sparkle(d, t, 0.35, { n: 5, lo: 86, hi: 100, vol: 0.025, up: true });
    },
    spell(d, t, k) {
      switch (k) {
        case 'arrow':
          osc(d, t, 1800, { f1: 600, glide: 0.12, type: 'sawtooth', vol: 0.05, a: 0.002, rel: 0.15, lp: 4000 });
          bell(d, t, 2093, { ratio: 3, idx: 2, vol: 0.09, rel: 0.35 });
          noise(d, t, { type: 'highpass', f: 4000, vol: 0.1, a: 0.001, rel: 0.08 });
          thump(d, t, 180, 90, { vol: 0.3, rel: 0.08 });
          sparkle(d, t + 0.02, 0.25, { n: 5, lo: 88, hi: 100, vol: 0.025 });
          return;
        case 'bolt':
          noise(d, t, { type: 'highpass', f: 2500, vol: 0.5, a: 0.001, rel: 0.12 });
          osc(d, t, 4000, { f1: 200, glide: 0.08, type: 'sawtooth', vol: 0.05, a: 0.001, rel: 0.1 });
          crackle(d, t, 0.28, { n: 10, lo: 2000, hi: 6500, vol: 0.28 });
          noise(d, t + 0.02, { type: 'lowpass', f: 200, f1: 90, glide: 1.2, vol: 0.65, a: 0.03, hold: 0.15, rel: 1.4 });
          thump(d, t, 70, 35, { vol: 0.5, rel: 0.4, glide: 0.15 });
          return;
        case 'fireball':
          thump(d, t, 85, 30, { vol: 0.7, rel: 0.55, glide: 0.25 });
          noise(d, t, { type: 'lowpass', f: 900, f1: 200, glide: 0.8, vol: 0.5, a: 0.004, hold: 0.05, rel: 0.9 });
          crackle(d, t + 0.05, 0.7, { n: 12, lo: 1500, hi: 4000, vol: 0.13 });
          smp(d, t, 'timp', 36, { vol: 0.35, rel: 0.6 });
          return;
        case 'bless':
          smp(d, t, 'choir', 67, { vol: 0.2, hold: 0.6, rel: 0.8 }); smp(d, t, 'choir', 72, { vol: 0.16, hold: 0.6, rel: 0.8 });
          arp(d, t + 0.05, 'cel', [84, 88, 91, 96], 0.09, (i) => ({ vol: 0.24, pan: -0.3 + i * 0.2 }));
          osc(d, t, 2093, { vol: 0.025, a: 0.3, rel: 0.6, vib: 8 });
          sparkle(d, t, 1.2, { n: 16, lo: 91, hi: 108, vol: 0.026 });
          return;
        case 'cure':
          arp(d, t, 'harp', [60, 64, 67, 72, 76, 79], 0.06, (i) => ({ vol: 0.24, pan: -0.3 + i * 0.12 }));
          smp(d, t, 'choir', 60, { vol: 0.17, hold: 0.4, rel: 0.6 });
          bell(d, t + 0.05, 1047, { ratio: 2, idx: 0.5, vol: 0.05, rel: 1.2 });
          sparkle(d, t + 0.1, 0.8, { n: 10, lo: 84, hi: 103, vol: 0.026, up: true });
          return;
        case 'haste': {
          noise(d, t, { f: 500, f1: 5000, glide: 0.35, q: 2, vol: 0.22, a: 0.25, rel: 0.1 });
          osc(d, t, 300, { f1: 1800, glide: 0.35, vol: 0.05, a: 0.05, rel: 0.3 });
          let tt = t; for (let i = 0; i < 8; i++) { bell(d, tt, 3000, { ratio: 1.41, idx: 0.8, vol: 0.05, rel: 0.03 }); tt += 0.09 - i * 0.008; }
          smp(d, t + 0.38, 'cel', 84, { vol: 0.25 });
          return;
        }
        case 'slow': {
          noise(d, t, { f: 4000, f1: 400, glide: 0.6, q: 2, vol: 0.18, a: 0.05, rel: 0.55 });
          osc(d, t, 900, { f1: 150, glide: 0.8, type: 'triangle', vol: 0.07, a: 0.02, rel: 0.8, vib: 40 });
          osc(d, t, 906, { f1: 152, glide: 0.8, type: 'triangle', vol: 0.05, a: 0.02, rel: 0.8, pan: 0.4 });
          let tt = t; for (let i = 0; i < 6; i++) { bell(d, tt, 2400, { ratio: 1.41, idx: 0.8, vol: 0.05, rel: 0.04 }); tt += 0.05 + i * 0.03; }
          smp(d, t + 0.55, 'bells', 55, { vol: 0.16, rel: 0.6 });
          return;
        }
        case 'stoneskin':
          noise(d, t, { type: 'lowpass', f: 700, vol: 0.4, a: 0.08, hold: 0.4, rel: 0.3, flutter: 23, flutterDepth: 0.9 });
          noise(d, t, { f: 250, q: 2, vol: 0.32, a: 0.08, hold: 0.4, rel: 0.3, flutter: 17 });
          for (const dt of [0, 0.2, 0.45]) thump(d, t + dt, 80 + R() * 40, 50, { vol: 0.35, rel: 0.12 });
          bell(d, t + 0.55, 400, { ratio: 2.76, idx: 2, vol: 0.1, rel: 0.6 });
          smp(d, t + 0.55, 'timp', 43, { vol: 0.2, rel: 0.4 });
          return;
        default: return S.magic(d, t);
      }
    },
    die(d, t, k) {
      if (k === 'undead') return S.die_undead(d, t);
      thump(d, t, 120, 55, { vol: 0.42, rel: 0.2 });
      noise(d, t, { type: 'lowpass', f: 600, vol: 0.18, a: 0.02, rel: 0.35 });
      osc(d, t, 260, { f1: 90, glide: 0.7, type: 'sawtooth', vol: 0.06, a: 0.03, rel: 0.7, lp: 700 });
      smp(d, t + 0.25, 'harp', pick([55, 57, 52]), { vol: 0.14, rel: 0.6 });
      sparkle(d, t + 0.3, 0.5, { n: 4, lo: 79, hi: 91, vol: 0.015 });
    },
    die_undead(d, t) {
      crackle(d, t, 0.35, { n: 9, lo: 2500, hi: 4500, vol: 0.22, q: 4 });
      for (let i = 0; i < 4; i++) osc(d, t + R() * 0.3, 900 + R() * 600, { type: 'triangle', vol: 0.06, a: 0.001, rel: 0.025 });
      osc(d, t + 0.05, 900, { f1: 280, glide: 0.9, vol: 0.06, a: 0.1, rel: 0.8, vib: 50, vibRate: 6 });
      noise(d, t, { f: 1200, f1: 300, glide: 0.8, q: 2, vol: 0.1, a: 0.2, rel: 0.6 });
      thump(d, t, 140, 70, { vol: 0.28, rel: 0.12 });
    },
    gate(d, t, k) {
      thump(d, t, 70, 40, { vol: 0.62, rel: 0.35, glide: 0.15 });
      noise(d, t, { type: 'lowpass', f: 900, f1: 300, vol: 0.45, a: 0.003, rel: 0.4 });
      crackle(d, t, 0.3, { n: 10, lo: 1500, hi: 3500, vol: 0.18 });
      if (k === 'broken') { smp(d, t, 'timp', 36, { vol: 0.4, rel: 0.8 }); noise(d, t + 0.1, { type: 'lowpass', f: 300, vol: 0.4, a: 0.05, rel: 1 }); crackle(d, t + 0.3, 0.6, { n: 8, lo: 800, hi: 2500, vol: 0.12 }); }
    },
    luck(d, t) {
      arp(d, t, 'glock', [79, 84, 88, 91], 0.05, { vol: 0.22 });
      sparkle(d, t + 0.1, 0.5, { n: 8, lo: 91, hi: 105, vol: 0.025 });
    },
    morale(d, t) {
      smp(d, t, 'horn', 55, { vol: 0.28, hold: 0.12, rel: 0.2 }); smp(d, t + 0.15, 'horn', 60, { vol: 0.3, hold: 0.25, rel: 0.35 });
      smp(d, t + 0.15, 'cel', 84, { vol: 0.2 });
    },
    victory(d, t) {
      const hit = 0.5, rp = rcymPeak();
      smp(d, Math.max(t, t + hit - rp), 'rcym', 60, { vol: 0.2, hold: Math.min(rp, hit) - 0.01, rel: 0.04 });
      smp(d, t, 'brass', 55, { vol: 0.24, hold: 0.08, rel: 0.08 }); smp(d, t, 'timp', 36, { vol: 0.3, rel: 0.2 });
      smp(d, t + 0.16, 'brass', 60, { vol: 0.24, hold: 0.1, rel: 0.1 }); smp(d, t + 0.16, 'timp', 43, { vol: 0.3, rel: 0.2 });
      for (const m of [48, 55, 60, 64]) smp(d, t + hit, 'brass', m, { vol: 0.17, hold: 0.9, rel: 0.8 });
      smp(d, t + hit, 'horn', 48, { vol: 0.2, hold: 0.9, rel: 0.8 }); smp(d, t + hit, 'horn', 55, { vol: 0.16, hold: 0.9, rel: 0.8 });
      for (let i = 0; i < 6; i++) smp(d, t + hit + i * 0.05, 'timp', 36, { vol: 0.12 + i * 0.03, rel: 0.25 });
      smp(d, t + hit + 0.3, 'timp', 36, { vol: 0.4, rel: 0.9 });
      smp(d, t + hit, 'bells', 72, { vol: 0.2 });
      arp(d, t + hit + 0.05, 'cel', [84, 88, 91, 96], 0.06, { vol: 0.22 });
      sparkle(d, t + hit, 1.5, { n: 20, lo: 86, hi: 108, vol: 0.026 });
    },
    defeat(d, t) {
      smp(d, t, 'horn', 55, { vol: 0.3, hold: 0.35, rel: 0.2 });
      smp(d, t + 0.5, 'horn', 51, { vol: 0.3, hold: 0.35, rel: 0.2 });
      smp(d, t + 1, 'horn', 48, { vol: 0.32, hold: 0.9, rel: 1 });
      smp(d, t + 1, 'choir', 60, { vol: 0.13, hold: 0.7, rel: 1 }); smp(d, t + 1, 'choir', 63, { vol: 0.11, hold: 0.7, rel: 1 });
      smp(d, t + 1, 'timp', 36, { vol: 0.3, rel: 0.8 });
      osc(d, t, 65.4, { type: 'sawtooth', vol: 0.05, a: 0.5, hold: 1, rel: 1, lp: 300 });
    },
  };

  // ---- voices: per-sound gain → pan → bus (+ reverb send); light throttling for rapid repeats
  const last = {}, live = typeof ac.startRendering !== 'function'; let busyUntil = [];
  function play(name, o = {}) {
    name = ALIAS[name] || name;
    let kind = o.kind;
    if (name === 'pickup') name = ['wood', 'ore', 'gems'].includes(kind) ? kind : 'coin';
    if (name === 'hit' && kind === 'heavy') name = 'heavy';
    if (name === 'die' && kind === 'undead') name = 'die_undead';
    const fn = S[name]; if (!fn) return;
    const now = ac.currentTime, mix = MIX[name] || [0.8, 0.25, 0], lvl = LEVEL[`${name}:${kind}`] ?? LEVEL[name] ?? mix[0];
    if (last[name] && now - last[name] < 0.035) return; // same sound twice in one frame
    busyUntil = busyUntil.filter((x) => x > now);
    if (busyUntil.length > 18 && (name === 'step' || name === 'click' || name === 'coin')) return;
    last[name] = now; busyUntil.push(now + 1);
    const t = now + 0.006;
    const g = ac.createGain(); g.gain.value = lvl * (o.vol ?? 1);
    const p = panTo(bus, o.pan);
    g.connect(p);
    if (mix[1] > 0) { const s = ac.createGain(); s.gain.value = mix[1]; g.connect(s).connect(rev); }
    shift = (o.pitch || 1) * (mix[2] ? 1 + (R() * 2 - 1) * mix[2] : 1); // read by every helper
    fn(g, t, kind, o);
    shift = 1;
    // free the voice once every layer has rung out (sources stop themselves; this cuts the graph link)
    if (!live) return;
    setTimeout(() => { try { g.disconnect(); } catch { /* already gone */ } }, 6500);
  }
  return { play, ready, names: SFX_NAMES, get loaded() { return Object.keys(lib).length; } };
}
