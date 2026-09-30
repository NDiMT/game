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
  /* Προεπιλογή ΑΝΑΜΜΕΝΗ στο 1. Είχε γίνει 0 όταν η παλιά μουσική κρίθηκε ενοχλητική· τώρα
     είναι άλλο κομμάτι, και ο παίκτης που το ζήτησε δεν πρέπει να ψάχνει στο μενού για να το
     ακούσει. Ό,τι έχει διαλέξει ρητά ο παίκτης (0/1/2) το σέβεται όπως πάντα. */
  let musicLvl = 1;
  try { const v = localStorage.getItem("raise.music"); musicLvl = v == null ? 1 : Math.max(0, Math.min(2, +v | 0)); } catch (e) { musicLvl = 1; }
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

  /* ---------------- μουσική: synthwave ----------------
     104 BPM, λα ελάσσων, 52 μπάρες = 2:00 ακριβώς. Τίποτα δεν είναι δειγματοληπτημένο:
     όλα βγαίνουν από ταλαντωτές που ΤΡΕΧΟΥΝ ΣΥΝΕΧΩΣ και τα οποία «πυλώνουμε» (gate) —
     έτσι το arp είναι ένα synth με envelope, όχι χίλιοι κόμβοι ανά μπάρα.

     Η φόρμα:
       intro  4 μπάρες   Am Am F G          — pad + arp σε 8α, το φίλτρο κλειστό
       A     16 μπάρες   Am F C G / Am F C E ×2
       B     16 μπάρες   Dm G C F / Dm G Am ×2   — η ανύψωση, μελωδία μια οκτάβα πάνω
       A'    16 μπάρες   Am F C G / Am F E Am ×2 — η επιστροφή, λύνει στο λα·
                              στο δεύτερο μισό το arp ανεβαίνει μια οκτάβα

     Τα στρώματα (με τη σειρά που ανοίγουν καθώς ανεβαίνει η αλυσίδα):
       arp   δεκαέκτατα, δύο σάγια 14 cents μακριά + ένα τετράγωνο, lowpass με resonance
             — ΠΑΝΤΑ, σε κάθε στάθμη· αυτό είναι που κάνει το κομμάτι synthwave
       pad   gated σε όγδοα, τέσσερις φωνές, sidechain κάτω από το kick — ΠΑΝΤΑ
       sub   τρίγωνο στη ρίζα, στο 1 και στο 3 — ΠΑΝΤΑ
       kick  1 και 3            q>0.28
       hats  όγδοα              q>0.36   (δεκαέκτατα: στο A΄ από q>0.5, στο B από 0.72)
       clap  2 και 4, με χώρο   q>0.42
       lead  τρία σάγια detuned + tape delay σε παρεστιγμένο όγδοο   q>0.50
       oct   η μελωδία διπλή μια οκτάβα πάνω   q>0.68
       fill  open hat + ghost snare   q>0.80
       riser pitch bend στην τελευταία μπάρα κάθε μέρους   q>0.86 */
  const BPM = 104, STEP = 60 / BPM / 4, SPB = 16;
  /* ρίζα ανά μπάρα (ημιτόνια από το λα) και αν είναι ελάσσων */
  /* Δεύτερο κομμάτι, άλλη πρόοδος: Am–G–F–G αντί για Am–F–C–G. Πιο «outrun», και το B
     ανοίγει σε Dm–F–C–G πριν γυρίσει. */
  const INTRO = [[0, 1], [0, 1], [10, 0], [8, 0]];
  const VA = [[0, 1], [10, 0], [8, 0], [10, 0], [0, 1], [10, 0], [3, 0], [7, 0]];
  const VB = [[5, 1], [8, 0], [3, 0], [10, 0], [5, 1], [8, 0], [7, 0], [0, 1]];
  const VC = [[0, 1], [10, 0], [8, 0], [3, 0], [0, 1], [5, 1], [10, 0], [0, 1]];
  const CHORD = [].concat(INTRO, VA, VA, VB, VB, VC, VC);
  const BARS = CHORD.length, CYCLE = BARS * SPB;
  /* [πρώτη μπάρα, μήκος σε μπάρες] — τα ονόματα είναι intro, A, B, A' */
  const SECT = [[0, 4], [4, 16], [20, 16], [36, 16]];

  /* Το arp διαβάζει δείκτες μέσα σε μια «σκάλα» της συγχορδίας· -1 = παύση.
     Η σκάλα: ρίζα, πέμπτη, οκτάβα, δεκάτη, δωδεκάτη, δύο οκτάβες. */
  const ARPV = (minor) => [0, 7, 12, minor ? 15 : 16, 19, 24];
  const ARP_I = [0, -1, 2, -1, 1, -1, 2, -1, 0, -1, 2, -1, 3, -1, 2, -1];
  const ARP_A = [0, 1, 2, 1, 0, 1, 2, 3, 0, 1, 2, 1, 4, 3, 2, 1];
  const ARP_B = [0, 2, 3, 2, 1, 2, 3, 4, 0, 2, 3, 2, 5, 4, 3, 2];
  const ARP_C = [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 5, 4, 3, 2];
  const ARP = [ARP_I, ARP_A, ARP_B, ARP_C];

  /* Μελωδία: [βήμα μέσα στο μέρος, ημιτόνια από το λα, μήκος σε δεκαέκτατα].
     Παίζεται μια οκτάβα πάνω από το pad (βάση +36 ⇒ το 0 είναι λα 440).
     Κάθε νότα είναι φθόγγος της συγχορδίας ή της κλίμακας της μπάρας της, και καμία
     δεν πέφτει ημιτόνιο από φωνή του pad — το tools/music.js το ελέγχει νότα-νότα. */
  const M_I = [];
  const M_A = [
      [0, 7, 10], [12, 12, 6], [16, 22, 8], [24, 17, 6], [30, 14, 4], [34, 12, 8], [42, 15, 10], [48,
      26, 14], [62, 22, 4], [64, 7, 10], [76, 12, 6], [80, 22, 8], [88, 17, 6], [94, 14, 4], [98, 7,
      8], [106, 10, 10], [116, 23, 12], [128, 12, 8], [136, 7, 6], [142, 3, 4], [144, 17, 10], [156,
      22, 6], [160, 24, 14], [174, 20, 4], [178, 14, 8], [186, 17, 10], [192, 7, 10], [204, 12, 6],
      [208, 22, 8], [216, 17, 6], [222, 14, 4], [224, 10, 6], [230, 15, 6], [236, 19, 8], [244, 23,
      12],
    ];
  const M_B = [
      [0, 17, 12], [12, 20, 8], [16, 24, 10], [26, 20, 8], [32, 10, 6], [38, 15, 6], [44, 19, 8], [52,
      26, 12], [64, 17, 12], [76, 20, 8], [80, 24, 10], [90, 20, 8], [96, 19, 8], [104, 23, 10], [112,
      15, 16], [128, 20, 10], [138, 17, 8], [144, 15, 6], [150, 20, 6], [156, 24, 8], [160, 15, 12],
      [172, 19, 8], [180, 26, 12], [192, 12, 6], [198, 17, 6], [204, 20, 8], [208, 24, 10], [218, 20,
      8], [224, 19, 8], [232, 23, 10], [240, 15, 16],
    ];
  const M_C = [
      [0, 27, 16], [16, 34, 8], [24, 38, 10], [32, 27, 8], [40, 24, 4], [44, 27, 6], [48, 31, 8], [56,
      27, 4], [60, 22, 10], [64, 27, 16], [80, 29, 8], [88, 32, 10], [96, 38, 14], [110, 34, 4], [112,
      27, 16], [128, 24, 8], [136, 27, 10], [144, 29, 8], [152, 26, 4], [156, 29, 6], [160, 36, 16],
      [176, 31, 8], [184, 27, 4], [188, 22, 10], [192, 19, 8], [200, 15, 4], [204, 19, 6], [208, 29,
      8], [216, 32, 10], [226, 26, 8], [234, 29, 10], [240, 19, 8], [248, 24, 16],
    ];
  const PHRASE = [M_I, M_A, M_B, M_C];

  const hz = (semi) => 55 * Math.pow(2, semi / 12);
  /* Φωνές του pad: ρίζα, πέμπτη, οκτάβα, δεκάτη — χωρίς ενάτη, ώστε η μελωδία να έχει αέρα. */
  function padVoices(root, minor) { return [root, root + 7, root + 12, root + (minor ? 15 : 16)]; }

  let mOn = false, mTimer = null, mStep = 0, mNext = 0, inten = 0, want = 0, keyOff = 0, musicG = null;
  /* ΔΕΚΑ ΣΤΡΩΣΕΙΣ, ΜΙΑ ΑΝΑ ΣΚΑΛΙ. Η ενορχήστρωση ΕΙΝΑΙ ο μετρητής της αλυσίδας: κάθε σκαλί
     προσθέτει ακριβώς ένα όργανο, και στο δέκατο παίζουν και τα δέκα. Η στάθμη κλειδώνει στην
     αρχή κάθε μπάρας (`barLvl`), αλλιώς τα όργανα θα άναβαν και θα έσβηναν μέσα στο μέτρο. */
  const L = { bed: 1, arp: 2, kick: 3, hats: 4, clap: 5, lead: 6, oct: 7, six: 8, ghost: 9, riser: 10 };
  let wantLvl = 1, barLvl = 1;
  let MG = null, barQ = 0.3, leadEnd = -99;
  /* Άγκιστρο μέτρησης: αν κάποιος ορίσει window.__MLOG = [], κάθε γεγονός γράφεται εκεί
     (είδος, απόλυτος χρόνος, Hz). Ένα `if` ανά νότα — αυτό είναι όλο το κόστος. */
  function mlog(k, at, f) { const L = root.__MLOG; if (L) L.push([k, +at.toFixed(5), f | 0]); }

  /* ΕΝΑ νούμερο για τη στάθμη της μπάντας απέναντι στους ήχους. Οι ισορροπίες ΜΕΣΑ στο
     κομμάτι μπαίνουν με τα gains των στρωμάτων (μετρημένα ένα-ένα με `tools/mix.js
     layers`)· αυτό εδώ μετακινεί το σύνολο.

     Το όριο μπαίνει στην ΚΟΡΥΦΗ, αλλά αυτό που ακούγεται είναι η μέση ισχύς — άρα κάθε dB
     που τρώει ένα transient είναι dB που χάνει η μουσική. Δοκίμασα να βάλω έναν
     DynamicsCompressor εδώ ως limiter: **ανέβασε** την κορυφή από 0,186 σε 0,393 (ίδιο
     TRIM, μετρημένο). Ο compressor του Chromium έχει εσωτερικό makeup gain, οπότε σε
     σήμα γύρω στα -20 dBFS δίνει ενίσχυση, όχι περιορισμό. Βγήκε.
     Η καθαρή λύση ήταν στο μίξερ, όχι στο master: το kick κρατούσε το 76% της κορυφής
     και μόνο το 27% της ισχύος. Στρώθηκε το transient του (πιο μαλακό attack, πιο
     σιγανό κλικ) και ανέβηκε το TRIM — ίδια κορυφή, περισσότερη μουσική: ο crest factor
     έπεσε από 9,9 σε 6,8, άρα το TRIM ανέβηκε για την ίδια κορυφή.
     Δεσμευτικό είναι το «loud»: BUS 1,3 / 0,75 = ×1,73, και το όριο εκεί είναι 0,18 —
     άρα το «on» πρέπει να κάθεται γύρω στο 0,10, όχι στο 0,12. */
  const TRIM = 0.78;
  function musicBus() {
    const c = ctx(); if (!c) return null;
    if (!musicG) {
      musicG = c.createGain(); musicG.gain.value = 0;
      const trim = c.createGain(); trim.gain.value = TRIM;
      musicG.connect(trim).connect(duckG);
    }
    return musicG;
  }
  /* Το γράφημα φτιάχνεται ΜΙΑ φορά. Οι ταλαντωτές δεν σταματούν ποτέ· σιωπούν με κλειστές
     πύλες. Ένα synthwave κομμάτι είναι ένα πάτημα που δεν σταματά — άρα ούτε το γράφημα. */
  function buildGraph() {
    const c = ctx(); if (!c) return null;
    if (MG) return MG;
    musicBus();
    const g = {}, osc = (type, f, det, dest) => {
      const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det || 0;
      o.connect(dest); o.start(); return o;
    };
    /* χώρος ΜΟΝΟ για τη μουσική, μέσα στο bus — ώστε η στάθμη και ο duck να τον πιάνουν */
    g.rev = c.createGain(); g.rev.gain.value = 1;
    const rout = c.createGain(); rout.gain.value = 0.42; rout.connect(musicG);
    [[0.127, 0.35, -0.72], [0.191, 0.30, 0.72]].forEach(function (d) {
      const dl = c.createDelay(1), fb = c.createGain(), lp = c.createBiquadFilter();
      dl.delayTime.value = d[0]; fb.gain.value = d[1];
      lp.type = "lowpass"; lp.frequency.value = 2400;
      g.rev.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl);
      if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = d[2]; lp.connect(p).connect(rout); }
      else lp.connect(rout);
    });
    /* sidechain: pad, arp και sub «σκύβουν» κάτω από κάθε kick */
    g.side = c.createGain(); g.side.gain.value = 1; g.side.connect(musicG);

    /* arp — το χαρακτηριστικό του συνόλου: δεκαέκτατα που δεν σταματούν ποτέ */
    g.arpAmp = c.createGain(); g.arpAmp.gain.value = 0.055; g.arpAmp.connect(g.side);
    g.arpGate = c.createGain(); g.arpGate.gain.value = 0.0001; g.arpGate.connect(g.arpAmp);
    g.arpCut = c.createBiquadFilter(); g.arpCut.type = "lowpass"; g.arpCut.frequency.value = 700; g.arpCut.Q.value = 2;
    g.arpCut.connect(g.arpGate);
    const sq = c.createGain(); sq.gain.value = 0.4; sq.connect(g.arpCut);
    g.arp = [osc("sawtooth", 110, -7, g.arpCut), osc("sawtooth", 110, 7, g.arpCut), osc("square", 110, 2, sq)];

    /* sub — ένα τρίγωνο στη ρίζα, στο 1 και στο 3 */
    g.subAmp = c.createGain(); g.subAmp.gain.value = 0.039; g.subAmp.connect(g.side);
    g.subGate = c.createGain(); g.subGate.gain.value = 0.0001; g.subGate.connect(g.subAmp);
    g.sub = osc("triangle", 110, 0, g.subGate);

    /* pad — τέσσερα σάγια, πύλη σε όγδοα (παλμός, όχι drone) */
    g.padAmp = c.createGain(); g.padAmp.gain.value = 0.020; g.padAmp.connect(g.side);
    const pspc = c.createGain(); pspc.gain.value = 0.55; g.padAmp.connect(pspc).connect(g.rev);
    g.padGate = c.createGain(); g.padGate.gain.value = 0.0001; g.padGate.connect(g.padAmp);
    g.padCut = c.createBiquadFilter(); g.padCut.type = "lowpass"; g.padCut.frequency.value = 1400; g.padCut.Q.value = 0.8;
    g.padCut.connect(g.padGate);
    g.pad = [0, 1, 2, 3].map((n) => osc("sawtooth", 440, (n - 1.5) * 8, g.padCut));

    /* tape delay: παρεστιγμένο όγδοο (τρία δεκαέκτατα) με ανάδραση και λίγο wow */
    g.tapeIn = c.createGain(); g.tapeIn.gain.value = 0.0;
    g.tape = c.createDelay(1); g.tape.delayTime.value = STEP * 3;
    const tlp = c.createBiquadFilter(); tlp.type = "lowpass"; tlp.frequency.value = 2000;
    const thp = c.createBiquadFilter(); thp.type = "highpass"; thp.frequency.value = 320;
    g.tapeFb = c.createGain(); g.tapeFb.gain.value = 0.44;
    const tout = c.createGain(); tout.gain.value = 0.6;
    g.tapeIn.connect(g.tape); g.tape.connect(tlp).connect(thp);
    thp.connect(g.tapeFb).connect(g.tape); thp.connect(tout).connect(musicG);
    const wowG = c.createGain(); wowG.gain.value = 0.0014;
    osc("sine", 0.29, 0, wowG); wowG.connect(g.tape.delayTime);

    /* lead — τρία σάγια λίγα cents μακριά, portamento, φαρδύ */
    g.leadAmp = c.createGain(); g.leadAmp.gain.value = 0.0; g.leadAmp.connect(musicG);
    g.leadAmp.connect(g.tapeIn);
    const lspc = c.createGain(); lspc.gain.value = 0.5; g.leadAmp.connect(lspc).connect(g.rev);
    g.leadGate = c.createGain(); g.leadGate.gain.value = 0.0001; g.leadGate.connect(g.leadAmp);
    g.leadCut = c.createBiquadFilter(); g.leadCut.type = "lowpass"; g.leadCut.frequency.value = 2600; g.leadCut.Q.value = 1.4;
    g.leadCut.connect(g.leadGate);
    g.lead = [osc("sawtooth", 440, -9, g.leadCut), osc("sawtooth", 440, 0, g.leadCut), osc("sawtooth", 440, 11, g.leadCut)];
    /* η οκτάβα πάνω, ξεχωριστή πύλη ώστε να μπαίνει με την αλυσίδα */
    g.octAmp = c.createGain(); g.octAmp.gain.value = 0.0; g.octAmp.connect(musicG);
    g.octAmp.connect(g.tapeIn);
    g.octGate = c.createGain(); g.octGate.gain.value = 0.0001; g.octGate.connect(g.octAmp);
    g.oct = [osc("sawtooth", 880, -6, g.octGate), osc("sawtooth", 880, 8, g.octGate)];

    /* 10η στρώση: shimmer. Δύο ψηλά saw που ΔΕΝ έχουν πύλη — κρατούν συνέχεια και ανοίγουν
       μόνο στη στάθμη 10, μέσα από χαμηλοπερατό ώστε να λάμπουν χωρίς να τσιρίζουν. */
    g.shimAmp = c.createGain(); g.shimAmp.gain.value = 0; g.shimAmp.connect(g.side);
    g.shimCut = c.createBiquadFilter(); g.shimCut.type = "lowpass"; g.shimCut.frequency.value = 3200; g.shimCut.Q.value = 0.7;
    g.shimCut.connect(g.shimAmp);
    g.shim = [osc("sawtooth", 880, -9, g.shimCut), osc("sawtooth", 1320, 11, g.shimCut)];

    /* κρουστά — ΚΑΙ αυτά μόνιμα. Είχα ένα createBufferSource ανά χτύπημα (30 κόμβοι
       ανά μπάρα) και ο μετρητής έπιανε μεμονωμένα δείγματα στο -0,28 μέσα σε απόλυτη
       σιωπή: κλικ από το γκρέμισμα των κόμβων. Τώρα ένα looping buffer θορύβου και
       τρεις πύλες πάνω του — μηδέν νέοι κόμβοι ανά μπάρα, και μηδέν κλικ. */
    g.drum = c.createGain(); g.drum.gain.value = 1; g.drum.connect(musicG);
    g.drumSpc = c.createGain(); g.drumSpc.gain.value = 0.35; g.drumSpc.connect(g.rev);
    if (!nb) { nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate); const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    g.nz = c.createBufferSource(); g.nz.buffer = nb; g.nz.loop = true;
    const chain = function (filt, amp, spc) {
      const gt = c.createGain(), am = c.createGain();
      gt.gain.value = 0.0001; am.gain.value = amp;
      filt.connect(gt).connect(am).connect(g.drum);
      if (spc) { const sg = c.createGain(); sg.gain.value = spc; am.connect(sg).connect(g.drumSpc); }
      g.nz.connect(filt);
      return { gate: gt.gain, filt: filt, amp: am };
    };
    const bq = function (type, f, q) { const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
    g.hat = chain(bq("highpass", 9500, 0.7), 1, 0.18);
    g.clap = chain(bq("bandpass", 1700, 0.8), 1, 1);
    g.clapLo = chain(bq("bandpass", 220, 1.4), 0.45, 0);
    g.clk = chain(bq("highpass", 1700, 0.7), 1, 0);
    g.nz.start();
    /* kick: ένα μόνιμο ημιτονοειδές με φάκελο τόνου σε κάθε χτύπημα */
    g.kickAmp = c.createGain(); g.kickAmp.gain.value = 1; g.kickAmp.connect(g.drum);
    g.kickGate = c.createGain(); g.kickGate.gain.value = 0.0001; g.kickGate.connect(g.kickAmp);
    g.kickOsc = osc("sine", 60, 0, g.kickGate);
    g.cut = {};                    /* οι τελευταίοι στόχοι των φίλτρων, για συνεχή ράμπα */
    MG = g; return g;
  }

  /* Τα κρουστά: πύλες πάνω σε φωνές που ήδη τρέχουν. Κανένας νέος κόμβος. */
  function kick(at, g) {
    const p = MG.kickOsc.frequency, a = MG.kickGate.gain;
    p.cancelScheduledValues(at); p.setValueAtTime(132, at);
    p.exponentialRampToValueAtTime(44, at + 0.09);
    a.cancelScheduledValues(at); a.setValueAtTime(0.0001, at);
    a.exponentialRampToValueAtTime(g, at + 0.010);
    a.exponentialRampToValueAtTime(0.0001, at + 0.26);
    blip(MG.clk, at, g * 0.09, 0.003, 0.020);
    mlog("kick", at, 132);
  }
  /* Ένα χτύπημα θορύβου: attack, μετά εκθετική πτώση. Δύο ράμπες, τίποτα άλλο. */
  function blip(v, at, g, atk, t) {
    const a = v.gate;
    a.cancelScheduledValues(at); a.setValueAtTime(0.0001, at);
    a.exponentialRampToValueAtTime(Math.max(0.0002, g), at + atk);
    a.exponentialRampToValueAtTime(0.0001, at + t);
  }
  /* Το clap: τρία κοντά ριπάκια με 9 ms διαφορά, μια ουρά με χώρο, και ένα σώμα στα 220. */
  function clap(at, g) {
    const a = MG.clap.gate;
    a.cancelScheduledValues(at);
    for (let i = 0; i < 3; i++) {
      a.setValueAtTime(0.0001, at + i * 0.009);
      a.exponentialRampToValueAtTime(g * (i === 2 ? 1 : 0.55), at + i * 0.009 + 0.002);
      if (i < 2) a.exponentialRampToValueAtTime(0.0001, at + i * 0.009 + 0.007);
    }
    a.exponentialRampToValueAtTime(0.0001, at + 0.17);
    blip(MG.clapLo, at, g, 0.003, 0.11);
    mlog("clap", at, 1700);
  }
  function hat(at, g, open) {
    MG.hat.filt.frequency.setValueAtTime(open ? 7000 : 9500, at);
    blip(MG.hat, at, g, 0.002, open ? 0.20 : 0.038);
    mlog(open ? "ohat" : "hat", at, open ? 7000 : 9500);
  }
  /* Riser: ένα σάι που ανεβαίνει μια οκτάβα σε μια μπάρα, μαζί με θόρυβο που ανοίγει. */
  function riser(at, bars) {
    const c = ac, T = bars * SPB * STEP, o = c.createOscillator(), a = c.createGain(), lp = c.createBiquadFilter();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(hz(keyOff + 24), at);
    o.frequency.exponentialRampToValueAtTime(hz(keyOff + 36), at + T);
    lp.type = "lowpass"; lp.frequency.setValueAtTime(600, at); lp.frequency.linearRampToValueAtTime(4200, at + T);
    a.gain.setValueAtTime(0.0001, at);
    a.gain.linearRampToValueAtTime(0.022, at + T * 0.85);
    a.gain.exponentialRampToValueAtTime(0.0002, at + T);
    o.connect(lp).connect(a).connect(MG.drum);
    const sg = c.createGain(); sg.gain.value = 0.7; a.connect(sg).connect(MG.drumSpc);
    o.start(at); o.stop(at + T + 0.05);
    const n = c.createBufferSource(), na = c.createGain(), hp = c.createBiquadFilter();
    n.buffer = nb; n.loop = true;
    hp.type = "bandpass"; hp.Q.value = 1.2;
    hp.frequency.setValueAtTime(700, at); hp.frequency.exponentialRampToValueAtTime(8000, at + T);
    na.gain.setValueAtTime(0.0001, at); na.gain.linearRampToValueAtTime(0.02, at + T * 0.9);
    na.gain.exponentialRampToValueAtTime(0.0002, at + T);
    n.connect(hp).connect(na).connect(MG.drum); n.start(at); n.stop(at + T + 0.05);
    mlog("riser", at, 0);
  }

  const sectOf = (bar) => { for (let s = SECT.length - 1; s >= 0; s--) if (bar >= SECT[s][0]) return s; return 0; };
  /* Πύλη: attack → decay σε ένα sustain → release. Ένα gain, καμία νέα φωνή.
     ΠΡΟΣΟΧΗ στο `rel`: πρέπει να ΤΕΛΕΙΩΝΕΙ πριν το επόμενο άνοιγμα της ίδιας πύλης.
     Αλλιώς το cancelScheduledValues του επόμενου βήματος σβήνει το release που τρέχει,
     η τιμή κολλάει στην κορυφή, και το arp γίνεται τετράγωνο κύμα με ένα κλικ σε κάθε
     βήμα — μετρημένο: κορυφή 0,56 αντί για 0,10. */
  function gate(p, at, peak, atk, hold, rel, sus) {
    const pk = Math.max(0.0002, peak), sv = Math.max(0.0002, pk * (sus == null ? 1 : sus));
    p.cancelScheduledValues(at);
    p.setValueAtTime(0.0001, at);
    p.exponentialRampToValueAtTime(pk, at + atk);
    if (hold > atk) p.exponentialRampToValueAtTime(sv, at + hold);
    p.exponentialRampToValueAtTime(0.0001, at + rel);
  }

  function mstep(at, i) {
    const g = MG; if (!g) return;
    const bar = Math.floor(i / SPB), st = i % SPB, sec = sectOf(bar);
    const ch = CHORD[bar], rootN = (ch[0] + keyOff) % 12, minor = !!ch[1];
    const local = bar - SECT[sec][0], lstep = local * SPB + st, last = local === SECT[sec][1] - 1;
    if (st === 0) { barQ = inten; barLvl = wantLvl; if (local === 0) leadEnd = -99; }
    const q = barQ, vo = ARPV(minor), pat = ARP[sec], mel = PHRASE[sec];

    /* ---- η καμπύλη του φίλτρου: ανοίγει μέσα σε κάθε μέρος ΚΑΙ με την αλυσίδα ---- */
    if (st === 0) {
      const thru = SECT[sec][1] > 1 ? local / (SECT[sec][1] - 1) : 0;
      const base = [0.10, 0.42, 0.72, 0.58][sec];
      const open = base + 0.28 * thru;
      const bt = STEP * SPB;
      /* Το σάρωμα: κάθε μπάρα ράμπα προς τον νέο στόχο. Αγκυρώνουμε στον ΠΡΟΗΓΟΥΜΕΝΟ
         στόχο, όχι στο `.value` — το `.value` διαβάζεται 0,3 s πριν φτάσει η στιγμή και
         θα πετούσε το φίλτρο πίσω σε κάθε μέτρο. */
      const tgt = { arpCut: 340 + 2400 * open * (0.45 + 0.55 * q), padCut: 900 + 2600 * open, leadCut: 1500 + 3400 * open };
      ["arpCut", "padCut", "leadCut"].forEach(function (k) {
        const p = g[k].frequency;
        p.cancelScheduledValues(at);
        p.setValueAtTime(g.cut[k] == null ? p.value : g.cut[k], at);
        p.linearRampToValueAtTime(tgt[k], at + bt);
        g.cut[k] = tgt[k];
      });
      /* τα στρώματα του lead ανοίγουν με την αλυσίδα, ομαλά */
      g.leadAmp.gain.setTargetAtTime(barLvl >= L.lead ? 0.0140 : 0, at, 0.35);
      g.octAmp.gain.setTargetAtTime(barLvl >= L.oct ? 0.0075 : 0, at, 0.35);
      g.tapeIn.gain.setTargetAtTime(barLvl >= L.lead ? 0.55 : 0, at, 0.4);
      g.arpAmp.gain.setTargetAtTime(barLvl >= L.arp ? 0.030 + 0.014 * q : 0, at, 0.3);
      /* 10η στρώση: shimmer — δύο ψηλά saw που κρατούν, μόνο στο τέρμα της αλυσίδας. */
      g.shimAmp.gain.setTargetAtTime(barLvl >= L.riser ? 0.0042 : 0, at, 0.6);
      if (barLvl >= L.riser) { const sv = padVoices(rootN + 36, minor); g.shim[0].frequency.setValueAtTime(hz(sv[0]), at); g.shim[1].frequency.setValueAtTime(hz(sv[2]), at); }
      g.padAmp.gain.setTargetAtTime(0.0078 + 0.0032 * q, at, 0.3);
      /* pad: οι φωνές αλλάζουν ΜΙΑ φορά ανά μπάρα */
      padVoices(rootN + 24, minor).forEach((s, n) => g.pad[n].frequency.setValueAtTime(hz(s), at));
      mlog("bar", at, sec);
    }

    /* ---- arp: δεκαέκτατα ---- */
    const ai = pat[st];
    if (ai >= 0) {
      /* Στο A΄ ΟΛΟΚΛΗΡΟ το arp ανεβαίνει μια οκτάβα — η κλασική κίνηση «σήκωσε το arp».
         Μαζί με τα δεκαέκτατα hats πιο κάτω, είναι αυτό που κάνει το A΄ επιστροφή και όχι
         επανάληψη. Το tools/mix.js form μετρά πόσο: η ζώνη arp/μπάσο πέφτει από -84,0 dB
         στο A σε -91,1 στο A΄, δηλαδή το μέρος αλλάζει ΜΗΤΡΩΟ, όχι μόνο μελωδία. */
      const lift = sec === 3 ? 12 : 0;
      const f = hz(rootN + 12 + lift + vo[ai]);
      for (let n = 0; n < g.arp.length; n++) g.arp[n].frequency.setValueAtTime(f, at);
      const accent = st % 4 === 0 ? 1 : st % 2 === 0 ? 0.82 : 0.68;
      const rest = pat[(st + 1) % SPB] < 0;
      gate(g.arpGate.gain, at, accent, 0.004, STEP * 0.42, rest ? STEP * 0.80 : STEP * 0.94, 0.30);
      mlog("arp", at, f);
    }
    /* ---- sub: ρίζα στο 1 και στο 3 ----
       Δοκίμασα και δύο σπρωξιές στα offbeat 6 και 11 μόνο στο A΄, για να ξεχωρίζει το
       μέρος. Μετρημένα: η διαφορά A vs A΄ ΧΕΙΡΟΤΕΡΕΨΕ (×1,12 → ×1,06 τον μάρτυρα της
       λούπας) — γέμισε πίσω το κάτω μισό που είχε αδειάσει η οκτάβα του arp — και
       κόστισε 0,5 dB headroom σε όλο το κομμάτι. Βγήκε. */
    if (barLvl >= L.bed && (st === 0 || st === 8)) {
      g.sub.frequency.setValueAtTime(hz(rootN + 12), at);
      gate(g.subGate.gain, at, 1, 0.018, STEP * 2.0, STEP * 7.4, 0.85);
      mlog("sub", at, hz(rootN + 12));
    }
    /* ---- pad: πύλη σε όγδοα ---- */
    if (st % 2 === 0) {
      gate(g.padGate.gain, at, st % 8 === 0 ? 1 : 0.8, 0.014, 0.09, STEP * 1.70, 0.92);
      mlog("pad", at, 0);
    }

    /* ---- kick + sidechain ---- */
    if (barLvl >= L.kick && (st === 0 || st === 8)) {
      kick(at, 0.070 + 0.012 * q);
      const s = g.side.gain;
      s.cancelScheduledValues(at);
      s.setValueAtTime(1, at);
      s.linearRampToValueAtTime(0.60, at + 0.022);
      s.linearRampToValueAtTime(1, at + 0.20);
    }
    /* ---- clap στο 2 και στο 4 ---- */
    if (barLvl >= L.clap && (st === 4 || st === 12)) clap(at, 0.038 + 0.010 * q);
    if (barLvl >= L.ghost && st === 14 && bar % 4 === 3) clap(at, 0.018);
    /* ---- hats: η πυκνότητα ανήκει στο ΜΕΡΟΣ, όχι μόνο στην αλυσίδα ----
       intro/A όγδοα, B όγδοα με τόνο στο δεύτερο μισό, A΄ γεμάτα δεκαέκτατα.
       Είναι το δεύτερο μισό της απάντησης στο «το A΄ δεν είναι λούπα του A». */
    if (barLvl >= L.hats) {
      /* Τα δεκαέκτατα hats μπαίνουν στη στάθμη 8 — και νωρίτερα στο A΄, που είναι το μέρος
         που «σηκώνεται» από μόνο του. */
      const six = barLvl >= L.six || (sec === 3 && barLvl >= L.oct);
      if (st % 2 === 0) hat(at, 0.019 + 0.006 * q, false);
      else if (six) hat(at, sec === 3 ? 0.012 : 0.009, false);
      if (barLvl >= L.ghost && st === 6 && bar % 2 === 1) hat(at, 0.017, true);
    }
    /* ---- riser: η τελευταία μπάρα κάθε μέρους ---- */
    if (barLvl >= L.riser && last && st === 0) riser(at, 1);

    /* ---- η μελωδία: πύλη + portamento σε ένα synth που ήδη τρέχει ---- */
    for (let m = 0; m < mel.length; m++) if (mel[m][0] === lstep) {
      const f = hz(mel[m][1] + keyOff + 36), len = mel[m][2] * STEP;
      const gap = lstep - leadEnd, glide = gap >= 0 && gap <= 2 ? 0.055 : 0;
      for (let n = 0; n < g.lead.length; n++) {
        const p = g.lead[n].frequency;
        if (glide) p.setTargetAtTime(f, at, glide); else p.setValueAtTime(f, at);
      }
      for (let n = 0; n < g.oct.length; n++) {
        const p = g.oct[n].frequency;
        if (glide) p.setTargetAtTime(f * 2, at, glide); else p.setValueAtTime(f * 2, at);
      }
      gate(g.leadGate.gain, at, 1, glide ? 0.05 : 0.02, len * 0.30, len * 0.96, 0.88);
      gate(g.octGate.gain, at, 1, glide ? 0.06 : 0.03, len * 0.24, len * 0.88, 0.80);
      leadEnd = lstep + mel[m][2];
      mlog("lead", at, f);
    }
  }
  function pump() {
    const c = ac; if (!c || !mOn) return;
    inten += (want - inten) * 0.05;
    while (mNext < c.currentTime + 0.3) {
      if (mNext > c.currentTime) mstep(mNext, mStep);
      mStep = (mStep + 1) % CYCLE;
      mNext += STEP;
    }
  }
  const music = {
    start: function () {
      if (mOn || muted || musicOff) return;
      const c = ctx(); if (!c) return;
      buildGraph(); mOn = true; mStep = 0; leadEnd = -99; barQ = want;
      mNext = c.currentTime + 0.12;
      musicG.gain.cancelScheduledValues(c.currentTime);
      musicG.gain.setValueAtTime(0.0001, c.currentTime);
      musicG.gain.linearRampToValueAtTime(BUS[musicLvl] || 0.75, c.currentTime + 2.2);
      mTimer = setInterval(pump, 40);
    },
    stop: function (fade) {
      if (!mOn) return;
      const c = ac; mOn = false;
      if (musicG && c) { musicG.gain.cancelScheduledValues(c.currentTime); musicG.gain.setValueAtTime(musicG.gain.value, c.currentTime); musicG.gain.linearRampToValueAtTime(0.0001, c.currentTime + (fade == null ? 1.1 : fade)); }
      clearInterval(mTimer); mTimer = null;
    },
    /* Δάπεδο 0,3: στο chain ×1 το κομμάτι είναι arp + pad + sub + kick. Από εκεί και πάνω
       ανοίγουν clap, hats, lead, οκτάβα, riser — η αλυσίδα ΕΙΝΑΙ το mixer. */
    /* Στο Survival η αλυσίδα δεν έχει οροφή, οπότε στάθμη = το σκαλί (ώς 10). Στο κανονικό run
       κόβεται στο ×6, οπότε τα έξι σκαλιά ΑΠΛΩΝΟΝΤΑΙ στις δέκα στρώσεις — αλλιώς ο παίκτης του
       Classic δεν θα άκουγε ποτέ τα μισά όργανα. */
    chain: function (pos, cap) {
      const c = cap || 6;
      const lv = c >= 10 ? pos : 1 + 9 * (pos - 1) / Math.max(1, c - 1);
      wantLvl = Math.max(1, Math.min(10, Math.round(lv)));
      want = 0.25 + 0.75 * (wantLvl - 1) / 9;
    },
    level: function (x) { want = Math.max(0.22, Math.min(1, x)); wantLvl = Math.max(1, Math.min(10, Math.round(1 + 9 * want))); },
    key: function (n) { keyOff = ((n % 12) + 12) % 12; },
    playing: function () { return mOn; },
    /* Άγκιστρα ελέγχου: το tools/music.js διαβάζει τους πίνακες, το tools/mix.js μετρά. */
    tables: function () { return { CHORD: CHORD, PHRASE: PHRASE, ARP: ARP, SECT: SECT, BPM: BPM, BARS: BARS, SPB: SPB }; },
    at: function (n) { const c = ac; if (!c || !mOn) return; mStep = ((n % CYCLE) + CYCLE) % CYCLE; mNext = c.currentTime + 0.12; },
    nodes: function () { return MG; },
    where: function () { return { step: mStep, bar: Math.floor(mStep / SPB), cycle: CYCLE, inten: inten }; },
  };
  /* Το καμπανάκι έμεινε για ένα πράγμα: τις τρεις νότες που απαντούν στο πάτημα του μενού. */
  function bell(f, t, g, bus, d, space) {
    voice({ f: f, t: t, g: g, type: "sawtooth", bus: bus, delay: d, atk: 0.01, space: space, cut: f * 4 });
    voice({ f: f * 1.006, t: t, g: g * 0.6, type: "sawtooth", bus: bus, delay: d, atk: 0.013, space: space, cut: f * 3 });
    voice({ f: f * 0.5, t: t * 0.8, g: g * 0.35, type: "square", bus: bus, delay: d, atk: 0.006, cut: 700 });
  }

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
      bell(hz(7 + 36), 0.30, g, master, 0, 0.5);
      bell(hz(12 + 36), 0.30, g, master, 0.14, 0.5);
      bell(hz(7 + 48), 0.46, g * 0.7, master, 0.28, 0.7);
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
