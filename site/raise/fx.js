/* Εφέ: σωματίδια, ήχος (Web Audio synth, χωρίς αρχεία), FLIP, δόνηση, count-up. */
(function (root) {
  "use strict";
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- particles ---- */
  const cv = document.getElementById("fx"), cx = cv.getContext("2d");
  let P = [], raf = 0;
  /* Το backing store σε φυσικά pixel, το ΚΟΥΤΙ σε λογικά — και τα δύο ρητά, γιατί το
     `cv.width` είναι το εγγενές μέγεθος και χωρίς CSS μέγεθος νικά το `inset:0`. */
  function fit() {
    const d = Math.min(devicePixelRatio || 1, 2);
    cv.width = innerWidth * d; cv.height = innerHeight * d;
    cv.style.width = innerWidth + "px"; cv.style.height = innerHeight + "px";
    cx.setTransform(d, 0, 0, d, 0, 0);
  }
  addEventListener("resize", fit); fit();
  function spark(x, y, n, pow, hue) {
    if (RM) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = (0.4 + Math.random()) * pow;
      P.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - pow * 0.35, r: 1 + Math.random() * 2.4, l: 1, d: 0.012 + Math.random() * 0.016, h: Array.isArray(hue) ? hue[i % hue.length] : (hue || "#f2d68c") });
    }
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function tick() {
    cx.clearRect(0, 0, innerWidth, innerHeight);
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.x += p.vx; p.y += p.vy; p.vy += (p.g == null ? 0.055 : p.g); p.vx *= 0.99; p.l -= p.d;
      if (p.l <= 0) { P.splice(i, 1); continue; }
      cx.globalAlpha = Math.max(0, p.l); cx.fillStyle = p.h;
      cx.beginPath(); cx.arc(p.x, p.y, p.r * p.l, 0, 6.284); cx.fill();
    }
    cx.globalAlpha = 1;
    raf = P.length ? requestAnimationFrame(tick) : 0;
    if (!raf) cx.clearRect(0, 0, innerWidth, innerHeight);
  }
  let emberT = 0;
  /* Αργές χρυσές σπίθες που ανεβαίνουν — μόνο όσο είναι ανοιχτή η αρχική οθόνη. */
  function embers(on) {
    clearInterval(emberT); emberT = 0;
    if (!on || RM) return;
    emberT = setInterval(() => {
      if (P.length > 90) return;
      P.push({ x: Math.random() * innerWidth, y: innerHeight + 6, vx: (Math.random() - 0.5) * 0.25, vy: -(0.35 + Math.random() * 0.55), r: 0.8 + Math.random() * 1.6, l: 1, d: 0.0035 + Math.random() * 0.004, h: Math.random() < 0.8 ? "#f2d68c" : "#ffffff", g: 0 });
      if (!raf) raf = requestAnimationFrame(tick);
    }, 140);
  }
  function flash() { const f = document.getElementById("flash"); if (!f || RM) return; pulse(f, "on"); }
  /* Βόμβα: τριπλή έκρηξη σε πορτοκαλί / κόκκινο / λευκό, από το κέντρο του στοιχείου. */
  function boom(el) {
    if (RM) return;
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    spark(x, y, 70, 7.5, "#ffb15a"); spark(x, y, 40, 5.5, "#ff6a3d"); spark(x, y, 30, 9, "#ffffff");
    setTimeout(() => spark(x, y, 40, 6, "#f2d68c"), 120);
  }
  function burstAt(el, n, pow, hue) { const r = el.getBoundingClientRect(); spark(r.left + r.width / 2, r.top + r.height / 2, n, pow, hue); }

  /* ---- floats, count-up, pulse, shake ---- */
  /* Στο reduced motion το «+N» μένει — απλώς δεν πετάει. Η πληροφορία δεν είναι διακόσμηση. */
  function floatIn(el, txt) { const e = document.createElement("div"); e.className = "float" + (RM ? " still" : ""); e.textContent = txt; el.appendChild(e); setTimeout(() => e.remove(), RM ? 900 : 1100); }
  /* Η διάρκεια μεγαλώνει λογαριθμικά με το μέγεθος: ένα μεγάλο χέρι *ακούγεται* μεγάλο.
     Το `delay` αφήνει τα φύλλα να προσγειωθούν πρώτα — αναμονή, μετά ανταμοιβή. */
  function countUp(el, from, to, delay) {
    if (RM || from === to) { el.textContent = to; return; }
    const t0 = performance.now() + (delay || 0), diff = Math.abs(to - from);
    const dur = Math.min(1500, 260 + Math.log2(1 + diff) * 95);
    let tick = 0;
    (function step(t) {
      if (t < t0) { requestAnimationFrame(step); return; }
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(from + (to - from) * e);
      if (p < 1) { if (t - tick > 55) { tick = t; sfx.tick(); } requestAnimationFrame(step); }
    })(performance.now());
  }
  function pulse(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

  /* FLIP: τα φύλλα πετούν από το χέρι στο τραπέζι. from = rects πριν, els = στοιχεία μετά. */
  function fly(from, els) {
    if (RM) return;
    els.forEach((el, i) => {
      const f = from[i]; if (!f) return;
      const t = el.getBoundingClientRect();
      const dx = f.left - t.left, dy = f.top - t.top, sx = f.width / t.width;
      el.classList.add("fly");
      el.style.transition = "none";
      el.style.transform = `translate(${dx}px,${dy}px) scale(${sx})`;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        el.style.transition = "transform .42s cubic-bezier(.2,.85,.2,1)";
        el.style.transform = "";
      }));
    });
  }

  /* Φαντάσματα φύλλων που πετούν σε έναν στόχο (π.χ. στη στοίβα των discards). */
  function ghostTo(rects, targetEl) {
    if (RM || !targetEl) return;
    const t = targetEl.getBoundingClientRect(), tx = t.left + t.width / 2, ty = t.top + t.height / 2;
    rects.forEach((r, i) => {
      if (!r) return;
      const g = document.createElement("div"); g.className = "flycard";
      g.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;transition-delay:${i * 30}ms`;
      document.body.appendChild(g);
      requestAnimationFrame(() => requestAnimationFrame(() => { g.style.transform = `translate(${tx - r.left - r.width / 2}px,${ty - r.top - r.height / 2}px) scale(.25) rotate(20deg)`; g.style.opacity = "0"; }));
      setTimeout(() => g.remove(), 700 + i * 30);
    });
  }
  const buzz = (ms) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

  /* ================= ήχος =================
     Ένα master bus με compressor, ένα στερεοφωνικό send για χώρο, και μουσική που
     ΠΑΡΑΓΕΤΑΙ — κανένα αρχείο, κανένα byte. Τα στρώματα μπαίνουν με την αλυσίδα:
     όσο ψηλότερα ανεβαίνεις, τόσο περισσότερο κομμάτι ακούς. Αυτό είναι το άγκιστρο. */
  const AC = root.AudioContext || root.webkitAudioContext;
  let ac = null, muted = false, musicOff = false;
  try { muted = localStorage.getItem("raise.mute") === "1"; } catch (e) {}
  /* Σβηστή από προεπιλογή. Ένα κομμάτι που παίζει σε λούπα όσο σκέφτεσαι ένα χέρι γίνεται
     ενοχλητικό πολύ πριν γίνει εθιστικό — ας το ανάψει όποιος το θέλει. */
  /* 0 = σβηστή (προεπιλογή) · 1 = κανονικά · 2 = δυνατά. Ο λόγος για τρίτη στάθμη είναι
     πρακτικός: σε ηχείο κινητού μια μπάντα 4× κάτω από τους ήχους ακούγεται σαν τίποτα. */
  let musicLvl = 0;
  try { musicLvl = Math.max(0, Math.min(2, +(localStorage.getItem("raise.music") || 0) | 0)); } catch (e) { musicLvl = 0; }
  musicOff = musicLvl === 0;
  const BUS = [0, 0.75, 1.3];
  let master = null, send = null, duckG = null;

  function ctx() {
    if (!AC) return null;
    if (!ac) { ac = new AC(); build(); }
    if (ac.state === "suspended") ac.resume();
    return ac;
  }
  function build() {
    const c = ac;
    master = c.createGain(); master.gain.value = 0.9;
    duckG = c.createGain(); duckG.gain.value = 1;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 24; comp.ratio.value = 4;
    comp.attack.value = 0.004; comp.release.value = 0.22;
    /* Χώρος χωρίς impulse response: δύο καθυστερήσεις με ανάδραση και κομμένα ψηλά. */
    send = c.createGain(); send.gain.value = 1;
    const sp = c.createGain(); sp.gain.value = 0.34;
    [[0.113, 0.34, -0.6], [0.171, 0.28, 0.6]].forEach(function (d) {
      const dl = c.createDelay(1), fb = c.createGain(), lp = c.createBiquadFilter(), pan = c.createStereoPanner ? c.createStereoPanner() : null;
      dl.delayTime.value = d[0]; fb.gain.value = d[1];
      lp.type = "lowpass"; lp.frequency.value = 2600;
      send.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl);
      if (pan) { pan.pan.value = d[2]; lp.connect(pan).connect(sp); } else lp.connect(sp);
    });
    /* Ο duck είναι ΜΟΝΟ για τη μουσική: όταν καθόταν στον master, η βόμβα χαμήλωνε και τον
       ίδιο τον ήχο της βόμβας. Τώρα η μουσική περνά από τον duckG, οι ήχοι πάνε κατευθείαν. */
    sp.connect(master);
    master.connect(comp); duckG.connect(master); comp.connect(c.destination);
  }
  addEventListener("pointerdown", () => { ctx(); }, { once: true, passive: true });

  /* Μια φωνή: ταλαντωτής → φάκελος → master (+ ένα μέρος στον χώρο). */
  function voice(o) {
    const c = ctx(); if (!c) return null;
    const f = o.f || 440, t = o.t || 0.1, d = o.delay || 0, g = o.g || 0.12, now = c.currentTime + d;
    const osc = c.createOscillator(), amp = c.createGain();
    osc.type = o.type || "sine";
    osc.frequency.setValueAtTime(f, now);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f * o.slide), now + t);
    if (o.detune) osc.detune.setValueAtTime(o.detune, now);
    const atk = o.atk == null ? 0.008 : o.atk;
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, g), now + atk);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + t);
    let out = amp;
    if (o.cut) { const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(o.cut, now); amp.connect(lp); out = lp; }
    osc.connect(amp);
    out.connect(o.bus || master);
    if (o.space) { const sg = c.createGain(); sg.gain.value = o.space; out.connect(sg).connect(send); }
    osc.start(now); osc.stop(now + t + 0.06);
    return osc;
  }
  function tone(o) { if (muted) return; voice(o); }
  /* Θόρυβος για κρουστά — ένα buffer, ξαναχρησιμοποιείται. */
  let nb = null;
  function noise(o) {
    const c = ctx(); if (!c) return;
    if (!nb) { nb = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate); const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const now = c.currentTime + (o.delay || 0), src = c.createBufferSource(), amp = c.createGain(), bp = c.createBiquadFilter();
    src.buffer = nb; src.loop = true;
    bp.type = o.type || "highpass"; bp.frequency.value = o.f || 6000; bp.Q.value = o.q || 1;
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.g || 0.05), now + 0.003);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + (o.t || 0.06));
    src.connect(bp).connect(amp).connect(o.bus || master);
    if (o.space) { const sg = c.createGain(); sg.gain.value = o.space; amp.connect(sg).connect(send); }
    src.start(now); src.stop(now + (o.t || 0.06) + 0.05);
  }
  /* Το μεγάλο χτύπημα «σκύβει» τη μουσική για μια στιγμή, να ακουστεί καθαρά. */
  function duck(amount, ms) {
    const c = ac; if (!c || !duckG) return;
    const now = c.currentTime;
    duckG.gain.cancelScheduledValues(now);
    duckG.gain.setValueAtTime(duckG.gain.value, now);
    duckG.gain.linearRampToValueAtTime(amount, now + 0.02);
    duckG.gain.linearRampToValueAtTime(1, now + (ms || 400) / 1000);
  }

  /* ---------------- μουσική ----------------
     Ένα κομμάτι 16 μπάρων σε λα ελάσσονα, γραμμένο νότα-νότα. Τέσσερις φράσεις:
       P1  Am F C G   — το θέμα
       P2  Am F C G   — το ίδιο, με ψηλότερο τέλος
       P3  Dm G C F   — η ανύψωση, η μελωδία κάθεται μια οκτάβα πιο πάνω
       P4  Am F E  Am — η πτώση: το E φέρνει το σολ δίεση, το θέμα λύνεται στο λα
     Κάθε νότα της μελωδίας είναι φθόγγος της συγχορδίας ή της κλίμακας — ελεγμένο από το
     tools/music.js, μαζί με το ότι καμία δεν πέφτει ημιτόνιο από φωνή του pad. */
  const BPM = 84, STEP = 60 / BPM / 4, SPB = 16, BARS = 16, CYCLE = SPB * BARS;
  /* ρίζα ανά μπάρα (ημιτόνια από το λα) και αν είναι ελάσσων */
  const CHORD = [
    [0, 1], [8, 0], [3, 0], [10, 0],
    [0, 1], [8, 0], [3, 0], [10, 0],
    [5, 1], [10, 0], [3, 0], [8, 0],
    [0, 1], [8, 0], [7, 0], [0, 1],
  ];
  /* [βήμα μέσα στη φράση (0-63), ημιτόνια από το λα, μήκος σε δέκατα-έκτα] */
  const M1 = [[0, 7, 6], [8, 10, 4], [12, 12, 4], [16, 12, 8], [26, 10, 6], [32, 7, 10], [44, 5, 4], [48, 10, 8], [58, 2, 6]];
  const M2 = [[0, 7, 6], [8, 10, 4], [12, 12, 4], [16, 12, 8], [26, 10, 6], [32, 7, 10], [44, 5, 4], [48, 10, 8], [58, 12, 6]];
  const M3 = [[0, 12, 6], [8, 14, 4], [12, 15, 4], [16, 14, 8], [26, 12, 6], [32, 10, 10], [44, 7, 4], [48, 8, 8], [58, 5, 6]];
  const M4 = [[0, 7, 6], [8, 10, 4], [12, 12, 4], [16, 12, 8], [26, 8, 6], [32, 7, 8], [42, 11, 6], [48, 12, 16]];
  const PHRASE = [M1, M2, M3, M4];
  const hz = (semi) => 55 * Math.pow(2, semi / 12);
  const swing = (st) => (st % 2 === 1 ? STEP * 0.07 : 0);
  let mOn = false, mTimer = null, mStep = 0, mNext = 0, inten = 0, want = 0, keyOff = 0, musicG = null;

  function musicBus() {
    const c = ctx(); if (!c) return null;
    if (!musicG) { musicG = c.createGain(); musicG.gain.value = 0; musicG.connect(duckG); }
    return musicG;
  }
  /* Καμπανάκι: θεμελιώδης, ξεκούρδιστη οκτάβα, μαλακή δωδεκάτη. Ένας σκέτος ημιτονοειδής
     ακούγεται σαν τεστ ακοής· τρεις μαζί ακούγονται σαν όργανο. */
  function bell(f, t, g, bus, d, space) {
    voice({ f: f, t: t, g: g, type: "sine", bus: bus, delay: d, atk: 0.008, space: space });
    voice({ f: f * 2.006, t: t * 0.6, g: g * 0.34, type: "sine", bus: bus, delay: d, atk: 0.005, space: space });
    voice({ f: f * 3.01, t: t * 0.26, g: g * 0.12, type: "triangle", bus: bus, delay: d, atk: 0.004 });
  }
  /* Φωνές του pad για μια συγχορδία: ρίζα, τρίτη (μικρή ή μεγάλη), πέμπτη, ενάτη. */
  function padVoices(root, minor) { return [root, root + (minor ? 3 : 4), root + 7, root + 14]; }

  function schedule(t, i) {
    const bar = Math.floor(i / SPB) % BARS, st = i % SPB, bus = musicG;
    const ch = CHORD[bar], root = (ch[0] + keyOff) % 12, minor = !!ch[1];
    const mel = PHRASE[Math.floor(bar / 4)], local = (i % CYCLE) - Math.floor(bar / 4) * 64;
    const q = inten, tt = t + swing(st);
    const breath = 0.5 + 0.5 * Math.sin((i / CYCLE) * Math.PI * 4);
    const cut = 520 + q * 2400 + breath * 600;

    /* ---- pad: κρατά τη μπάρα ---- */
    if (st === 0) padVoices(root + 36, minor).forEach(function (semi, n) {
      voice({ f: hz(semi), t: STEP * SPB * 1.15, g: 0.026 + q * 0.008, type: "sawtooth", cut: cut * 0.55,
        bus: bus, delay: t, atk: 0.55, detune: (n - 1.5) * 4, space: 0.7 });
    });
    /* ---- μπάσο: ρίζα, ρίζα, πέμπτη, οκτάβα — παλμός, όχι drone ---- */
    if (st === 0) voice({ f: hz(root + 12), t: 0.62, g: 0.075 + q * 0.02, type: "sine", cut: 340, bus: bus, delay: t, atk: 0.04 });
    if (q > 0.15 && st === 6) voice({ f: hz(root + 12), t: 0.24, g: 0.032, type: "sine", cut: 340, bus: bus, delay: tt, atk: 0.02 });
    if (q > 0.15 && st === 10) voice({ f: hz(root + 19), t: 0.26, g: 0.03, type: "sine", cut: 380, bus: bus, delay: t, atk: 0.02 });
    if (q > 0.45 && st === 14) voice({ f: hz(root + 24), t: 0.2, g: 0.024, type: "triangle", cut: 500, bus: bus, delay: tt, atk: 0.02 });
    /* ---- η μελωδία ---- */
    for (let m = 0; m < mel.length; m++) if (mel[m][0] === local) {
      const len = mel[m][2] * STEP;
      bell(hz(mel[m][1] + keyOff + 48), len * 0.92 + 0.14, 0.042 + q * 0.014, bus, tt, 0.72);
      if (q > 0.75) bell(hz(mel[m][1] + keyOff + 60), len * 0.4, 0.007, bus, tt + STEP * 0.5, 0.9);
    }
    /* ---- κρουστά: μπαίνουν ψηλά, και μένουν αραιά ---- */
    if (q > 0.55 && (st === 4 || st === 12)) noise({ f: 9000, g: 0.0085 + q * 0.005, t: 0.03, bus: bus, delay: tt, space: 0.4 });
    if (q > 0.7 && (st === 0 || st === 10)) voice({ f: 104, t: 0.16, g: 0.05, type: "sine", slide: 0.44, bus: bus, delay: t });
    if (q > 0.88 && st === 8) noise({ f: 2000, q: 0.8, type: "bandpass", g: 0.026, t: 0.085, bus: bus, delay: tt, space: 0.6 });
  }
  function pump() {
    const c = ac; if (!c || !mOn) return;
    inten += (want - inten) * 0.035;
    while (mNext < c.currentTime + 0.14) {
      schedule(Math.max(0, mNext - c.currentTime), mStep);
      mStep = (mStep + 1) % CYCLE;
      mNext += STEP;
    }
  }
  const music = {
    start: function () {
      if (mOn || muted || musicOff) return;
      const c = ctx(); if (!c) return;
      musicBus(); mOn = true; mStep = 0; mNext = c.currentTime + 0.08;
      musicG.gain.cancelScheduledValues(c.currentTime);
      musicG.gain.setValueAtTime(0.0001, c.currentTime);
      musicG.gain.linearRampToValueAtTime(BUS[musicLvl] || 0.75, c.currentTime + 2.6);
      mTimer = setInterval(pump, 25);
    },
    stop: function (fade) {
      if (!mOn) return;
      const c = ac; mOn = false;
      if (musicG && c) { musicG.gain.cancelScheduledValues(c.currentTime); musicG.gain.setValueAtTime(musicG.gain.value, c.currentTime); musicG.gain.linearRampToValueAtTime(0.0001, c.currentTime + (fade == null ? 1.1 : fade)); }
      clearInterval(mTimer); mTimer = null;
    },
    /* Δάπεδο 0,3: στο chain ×1 έβγαινε ένταση 0, δηλαδή σκέτο pad — σε ηχείο κινητού
       ακουγόταν σαν τίποτα. Τώρα ακούγεται κομμάτι από την αρχή και χτίζεται από εκεί. */
    chain: function (pos, cap) { const x = (pos - 1) / Math.max(3, (cap || 6) - 1); want = 0.3 + 0.7 * Math.max(0, Math.min(1, x)); },
    level: function (x) { want = Math.max(0.22, Math.min(1, x)); },
    key: function (n) { keyOff = ((n % 12) + 12) % 12; },
    playing: function () { return mOn; },
    /* Άγκιστρο ελέγχου: το tools/music.js διαβάζει τους πίνακες και ελέγχει την αρμονία. */
    tables: function () { return { CHORD: CHORD, PHRASE: PHRASE, BPM: BPM, BARS: BARS, SPB: SPB }; },
  };

  const sfx = {
    tick: () => tone({ f: 1700, t: 0.035, type: "square", g: 0.035 }),
    /* ο τόνος ανεβαίνει με κάθε σκαλί της αλυσίδας — ο ήχος είναι η σκάλα */
    climb: (pos) => {
      if (muted) return;
      const p = Math.min(pos, 12), f = 330 * Math.pow(2, (Math.min(p, 10) - 1) / 6), n = Math.min(5, 1 + Math.floor(p / 2)), gap = Math.max(0.035, 0.09 - p * 0.005);
      for (let i = 0; i < n; i++) voice({ f: f * Math.pow(2, i / 12 * (i % 2 ? 4 : 3)), t: 0.14, type: "triangle", g: 0.13 - i * 0.015, delay: i * gap, space: 0.3 + i * 0.06 });
      voice({ f: f * 1.5, t: 0.26, type: "sine", g: 0.06, delay: n * gap, space: 0.6 });
      if (p >= 6) voice({ f: f * 4, t: 0.35, type: "sine", g: 0.035, delay: n * gap + 0.04, slide: 1.25, space: 0.9 });
      duck(0.72, 260);
    },
    boss: () => { if (muted) return; duck(0.5, 900); voice({ f: 110, t: 0.55, type: "sawtooth", g: 0.11, slide: 0.55, space: 0.5 }); voice({ f: 55, t: 0.7, type: "square", g: 0.08, delay: 0.08, slide: 0.7 }); voice({ f: 880, t: 0.12, type: "sine", g: 0.05, delay: 0.3, space: 0.8 }); },
    pass: () => { if (muted) return; voice({ f: 220, t: 0.28, type: "sawtooth", g: 0.07, slide: 0.5, space: 0.35 }); },
    ace: () => { if (muted) return; voice({ f: 660, t: 0.12, type: "sine", g: 0.1, space: 0.4 }); voice({ f: 440, t: 0.3, type: "sine", g: 0.1, delay: 0.09, slide: 0.75, space: 0.5 }); },
    clear: () => { if (muted) return; duck(0.55, 900); [523, 659, 784, 1046].forEach((f, i) => voice({ f, t: 0.38, type: "triangle", g: 0.11, delay: i * 0.09, space: 0.7 })); },
    bust: () => { if (muted) return; duck(0.35, 1400); voice({ f: 196, t: 0.5, type: "sawtooth", g: 0.08, slide: 0.7, space: 0.5 }); voice({ f: 147, t: 0.6, type: "sawtooth", g: 0.08, delay: 0.16, slide: 0.7, space: 0.6 }); },
    buy: () => { if (muted) return; voice({ f: 880, t: 0.13, type: "sine", g: 0.1, slide: 1.5, space: 0.5 }); },
    open: () => tone({ f: 520, t: 0.08, type: "sine", g: 0.05, slide: 1.2 }),
    discard: () => { if (muted) return; noise({ f: 3200, g: 0.05, t: 0.07 }); voice({ f: 700, t: 0.07, type: "square", g: 0.03, slide: 0.6 }); },
    draw: () => { if (muted) return; noise({ f: 5200, g: 0.028, t: 0.045 }); },
    unlock: () => { if (muted) return; [660, 880, 1320].forEach((f, i) => voice({ f, t: 0.3, type: "triangle", g: 0.1, delay: i * 0.08, space: 0.7 })); },
    bomb: () => {
      if (muted) return;
      duck(0.28, 1100);
      voice({ f: 90, t: 0.55, type: "sawtooth", g: 0.22, slide: 0.35 });
      voice({ f: 60, t: 0.7, type: "square", g: 0.14, delay: 0.04, slide: 0.5 });
      noise({ f: 900, q: 0.6, type: "bandpass", g: 0.16, t: 0.45, space: 0.9 });
      voice({ f: 1400, t: 0.12, type: "square", g: 0.05, slide: 0.2 });
      [880, 1320, 1760].forEach((f, i) => voice({ f, t: 0.25, type: "triangle", g: 0.08, delay: 0.25 + i * 0.07, space: 0.8 }));
    },
  };
  function toggleMute() {
    muted = !muted;
    try { localStorage.setItem("raise.mute", muted ? "1" : "0"); } catch (e) {}
    if (muted) music.stop(0.2); else if (!musicOff) music.start();
    return muted;
  }
  /* Κυκλικά: off → on → loud → off. Και κάθε φορά παίζει τρεις νότες του θέματος, ώστε το
     πάτημα να ΑΠΑΝΤΑ — αλλιώς «Music · on» και σιωπή είναι αδιάκριτο από χαλασμένο. */
  function toggleMusic() {
    musicLvl = (musicLvl + 1) % 3;
    musicOff = musicLvl === 0;
    try { localStorage.setItem("raise.music", String(musicLvl)); } catch (e) {}
    if (musicOff) music.stop(0.5);
    else {
      const c = ctx();
      if (mOn && musicG && c) { musicG.gain.cancelScheduledValues(c.currentTime); musicG.gain.setValueAtTime(musicG.gain.value, c.currentTime); musicG.gain.linearRampToValueAtTime(BUS[musicLvl], c.currentTime + 0.5); }
      else if (!muted) music.start();
      /* τρεις νότες του θέματος: μι — λα — μι, στη στάθμη που μόλις διάλεξες */
      const g = 0.05 * BUS[musicLvl];
      bell(hz(7 + 48), 0.34, g, master, 0, 0.6);
      bell(hz(12 + 48), 0.34, g, master, 0.16, 0.6);
      bell(hz(7 + 60), 0.5, g * 0.7, master, 0.32, 0.8);
    }
    return musicLvl;
  }
  /* Τι κάνει ΠΡΑΓΜΑΤΙΚΑ ο ήχος, για το μενού: όταν ο παίκτης λέει «δεν ακούω», αυτό απαντά. */
  function audioState() {
    if (!AC) return "no web audio";
    if (!ac) return "not started";
    if (ac.state !== "running") return ac.state;
    return muted ? "effects muted" : mOn ? "music playing" : musicOff ? "music off" : "music idle";
  }

  root.FX = { spark, burstAt, boom, floatIn, countUp, pulse, fly, ghostTo, buzz, sfx, music, duck, toggleMute, toggleMusic, isMuted: () => muted, musicOn: () => !musicOff, musicLevel: () => musicLvl, audioState, embers, flash, RM };
})(window);
