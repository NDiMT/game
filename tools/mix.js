/* Μέτρηση του ήχου σε αληθινό Chromium — γιατί «ακούγεται καλά» δεν είναι μέτρηση.
   Σπλαϊσάρουμε ένα tap ΠΡΙΝ τον πραγματικό destination και βάζουμε δύο πράγματα πάνω του:
     · AudioWorklet «meter» → κάθε δείγμα, άρα ακριβής κορυφή και RMS
     · AnalyserNode         → φάσμα ανά 100 ms, άρα σύγκριση των μερών της φόρμας
   ΚΡΙΣΙΜΟ: και τα δύο ΠΡΕΠΕΙ να καταλήγουν στον αληθινό destination, αλλιώς το γράφημα
   δεν τα «τραβά» καθόλου και μετράς σιωπή.

   node tools/mix.js [check]
     all     (προεπιλογή) groove → amp → clip → form
     groove  τι προγραμματίστηκε, πού και πόσο συχνά
     amp     κορυφή/RMS στις δύο στάθμες × τρεις θέσεις αλυσίδας
     clip    μουσική στο μέγιστο + βόμβες, και οι ήχοι μόνοι τους
     form    φάσμα ανά μέρος σε έναν πλήρη κύκλο 120 s
     layers  κάθε στρώμα μόνο του (για να μπαίνουν τα gains με μέτρηση, όχι με το μάτι)
     rm      ότι το prefers-reduced-motion ΔΕΝ σβήνει τον ήχο */
const { chromium } = require("playwright");
const path = require("path");
const WHICH = process.argv[2] || "all";

/* Ο μετρητής ζει σε AudioWorklet, δηλαδή στο ΝΗΜΑ ΤΟΥ ΗΧΟΥ. Πρώτα το είχα σε
   ScriptProcessor και έβγαζε 0,78 · 0,44 · 0,13 για το ΙΔΙΟ σήμα: ο ScriptProcessor
   τρέχει στο κύριο νήμα, λιμοκτονεί όταν αυτό είναι απασχολημένο, και μετράς ψέματα. */
const METER = `
class Meter extends AudioWorkletProcessor {
  constructor() {
    super();
    this.z(); this.t0 = currentTime; this.k = 0; this.bp = 0;
    this.port.onmessage = (e) => {
      if (e.data === "reset") { this.z(); this.t0 = currentTime; }
      else this.port.postMessage({ peak: this.peak, mpeak: this.mpeak, peakT: this.peakT, sq: this.sq, n: this.n, t0: this.t0, hist: this.hist, snap: this.snap });
    };
  }
  z() { this.peak = 0; this.peakT = 0; this.mpeak = 0; this.sq = 0; this.n = 0; this.hist = []; this.snap = null; this.prev = new Float32Array(128); this.w = [0, 0, 0]; }
  process(inputs) {
    const inp = inputs[0];
    if (!inp || !inp.length) { this.n += 128; this.k += 1; }
    else {
      let hit = -1;
      for (let ch = 0; ch < inp.length; ch++) {
        const d = inp[ch];
        for (let i = 0; i < d.length; i++) {
          const v = d[i] < 0 ? -d[i] : d[i];
          if (v > this.bp) this.bp = v;
          if (v > this.peak) { this.peak = v; this.peakT = currentTime + i / sampleRate; hit = i; }
          /* Κορυφή ΜΕΤΑ από median-3: πετά τα μεμονωμένα δείγματα-ακίδες (η μηχανή του
             φυλλομετρητή βγάζει τέτοια) και αφήνει άθικτο κάθε αληθινό transient, που
             κρατά εκατοντάδες δείγματα. Και οι δύο αριθμοί αναφέρονται. */
          if (ch === 0) {
            const w = this.w; w[0] = w[1]; w[1] = w[2]; w[2] = v;
            const m = w[0] > w[1] ? (w[1] > w[2] ? w[1] : (w[0] > w[2] ? w[2] : w[0])) : (w[0] > w[2] ? w[0] : (w[1] > w[2] ? w[2] : w[1]));
            if (m > this.mpeak) this.mpeak = m;
          }
          this.sq += d[i] * d[i]; this.n++;
        }
      }
      /* Η κυματομορφή γύρω από την κορυφή: βήμα (κλικ), αργό φούσκωμα, ή ριπή θορύβου;
         Χωρίς αυτό μαντεύεις — και μάντεψα λάθος τρεις φορές. */
      if (hit >= 0) { const a = new Float32Array(256); a.set(this.prev, 0); a.set(inp[0], 128); this.snap = { i: hit, d: Array.from(a).map((x) => Math.round(x * 1e4) / 1e4) }; }
      this.prev.set(inp[0]);
      this.k += 1;
    }
    /* κορυφή ανά 32 render quanta ≈ 93 ms — για να φαίνεται ΠΟΤΕ χτυπά */
    if (this.k >= 32) { this.hist.push([Math.round((currentTime - this.t0) * 1000) / 1000, Math.round(this.bp * 1e4) / 1e4]); this.bp = 0; this.k = 0; }
    return true;
  }
}
registerProcessor("meter", Meter);
`;

const TAP = function (src) {
  const AC0 = window.AudioContext;
  function Patched() {
    const c = new AC0();
    const real = c.destination;
    const tap = c.createGain();
    const an = c.createAnalyser();
    an.fftSize = 4096; an.smoothingTimeConstant = 0;
    tap.connect(an); an.connect(real);            /* ← ο analyser ΠΡΕΠΕΙ να φτάνει στον real */
    const zero = c.createGain(); zero.gain.value = 0; zero.connect(real);
    let node = null;
    /* Σε σελίδα file:// το blob: για module του worklet απορρίπτεται· το data: περνά. */
    const url = "data:text/javascript;base64," + btoa(unescape(encodeURIComponent(src)));
    const ready = c.audioWorklet.addModule(url).then(function () {
      node = new AudioWorkletNode(c, "meter");
      tap.connect(node); node.connect(zero);     /* ← και ο μετρητής, αλλιώς δεν τον τραβά */
    });
    Object.defineProperty(c, "destination", { get: function () { return tap; }, configurable: true });
    const ask = () => new Promise(function (res) {
      if (!node) { res(null); return; }
      node.port.onmessage = (e) => res(e.data);
      node.port.postMessage("stats");
    });
    const spec = [];
    let specT = 0;
    window.__probe = {
      ctx: c, an: an, spec: spec, ready: ready,
      reset: function () { if (node) node.port.postMessage("reset"); spec.length = 0; },
      stop: function () {},
      stats: async function () {
        const d = await ask();
        if (!d) return { peak: 0, rms: 0, n: 0, at: 0, loud: [] };
        return { peak: d.peak, mpeak: d.mpeak, at: +(d.peakT - d.t0).toFixed(3), t0: d.t0, rms: d.n ? Math.sqrt(d.sq / d.n) : 0, n: d.n,
          snap: d.snap, loud: d.hist.slice().sort((a, b) => b[1] - a[1]).slice(0, 8) };
      },
      grab: function () {
        const b = new Float32Array(an.frequencyBinCount);
        an.getFloatFrequencyData(b);
        spec.push([c.currentTime, Array.from(b)]);
      },
      startSpec: function (ms) { clearInterval(specT); specT = setInterval(window.__probe.grab, ms); },
      stopSpec: function () { clearInterval(specT); },
    };
    return c;
  }
  window.AudioContext = Patched; window.webkitAudioContext = Patched;
};

const boot = async (page) => {
  await page.addInitScript(TAP, METER);
  await page.goto("file://" + path.join(__dirname, "../site/raise/index.html"));
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    window.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    localStorage.setItem("raise.music", "1");
  });
  await page.waitForTimeout(300);
};
/* Ανάβει τη μουσική στη ζητούμενη στάθμη (1 = on, 2 = loud) χωρίς να πειράξει το ui. */
const arm = (page, lvl, chain, cap) => page.evaluate(async ([lvl, chain, cap]) => {
  await window.__probe.ready;
  while (FX.musicLevel() !== lvl) FX.toggleMusic();
  FX.music.start();
  FX.music.chain(chain, cap);
  return { state: FX.audioState(), lvl: FX.musicLevel() };
}, [lvl, chain, cap]);

const fmt = (x, n) => (x == null || isNaN(x) ? "—" : x.toFixed(n == null ? 4 : n));

/* ---------------------------------------------------------------- ΣΤΑΘΜΗ */
async function amp(page) {
  console.log("\n=== 2. ΣΤΑΘΜΗ (μόνο μουσική, μετά τον compressor, στον destination) ===");
  console.log("στάθμη  chain        κορυφή   med3      RMS   δείγματα");
  const rows = [];
  for (const lvl of [1, 2]) {
    for (const [name, pos, cap] of [["×1", 1, 6], ["×3 (μέση)", 3, 6], ["×6 (μέγιστο)", 6, 6]]) {
      await arm(page, lvl, pos, cap);
      /* 7 s για να ανεβεί το inten (tau ≈ 0,8 s) και να ανοίξουν τα στρώματα ανά μπάρα,
         μετά πηδάμε στο A΄ — το πιο γεμάτο μέρος — και μετράμε ΟΛΕΣ τις 16 μπάρες του,
         ώστε να πιαστεί και το riser της τελευταίας. */
      await page.waitForTimeout(7000);
      await page.evaluate(() => FX.music.at(36 * 16));
      await page.waitForTimeout(600);
      await page.evaluate(() => window.__probe.reset());
      await page.waitForTimeout(37500);
      const s = await page.evaluate(() => window.__probe.stats());
      rows.push([lvl, name, s]);
      console.log("  " + ["-", "on", "loud"][lvl].padEnd(6) + "  " + name.padEnd(12) +
        fmt(s.peak).padStart(7) + " " + fmt(s.mpeak).padStart(7) + "  " + fmt(s.rms).padStart(7) + "  " + s.n);
    }
  }
  /* Το όριο κρίνεται στην med3 κορυφή: οι μεμονωμένες ακίδες της μηχανής δεν είναι
     μουσική. Η ωμή κορυφή τυπώνεται πάντα δίπλα, να φαίνεται πόσο μακριά είναι. */
  const lim = { 1: 0.12, 2: 0.18 };
  rows.forEach(([lvl, name, s]) => {
    const ok = s.mpeak <= lim[lvl];
    console.log("  " + (ok ? "✓" : "✗") + " " + ["-", "on", "loud"][lvl] + " " + name +
      " med3 " + fmt(s.mpeak) + " vs όριο " + lim[lvl] + " (ωμή " + fmt(s.peak) + ")");
  });
  return rows.every(([lvl, , s]) => s.mpeak <= lim[lvl]);
}

/* ------------------------------------------------------------- ΨΑΛΙΔΙΣΜΑ */
async function clip(page) {
  console.log("\n=== 5. ΨΑΛΙΔΙΣΜΑ (μουσική loud + μέγιστη αλυσίδα + βόμβα/climb) ===");
  await arm(page, 2, 6, 6);
  await page.waitForTimeout(7000);
  await page.evaluate(() => FX.music.at(36 * 16));
  await page.waitForTimeout(600);
  await page.evaluate(() => window.__probe.reset());
  /* Δώδεκα βόμβες σε τυχαίες στιγμές μέσα στο μέτρο, ώστε να πιαστεί και η χειρότερη
     σύμπτωση με το kick, και έξι climb ×12 ανάμεσα. */
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(700 + Math.floor(Math.random() * 500));
    await page.evaluate((i) => { FX.sfx.bomb(); if (i % 2) FX.sfx.climb(12); }, i);
  }
  await page.waitForTimeout(1500);
  const s = await page.evaluate(() => window.__probe.stats());
  console.log("  κορυφή " + fmt(s.peak) + " · med3 " + fmt(s.mpeak) + " · RMS " + fmt(s.rms) + " · δείγματα " + s.n);
  console.log("  " + (s.peak < 1 ? "✓" : "✗") + " κάτω από 1,0 (ψαλίδισμα)");
  /* Και οι ήχοι μόνοι τους, για αναφορά. */
  const solo = {};
  for (const k of ["climb", "bomb", "clear", "boss", "bust", "unlock", "tick"]) {
    await page.evaluate(() => { FX.music.stop(0.05); });
    await page.waitForTimeout(600);
    await page.evaluate(() => window.__probe.reset());
    await page.waitForTimeout(120);
    await page.evaluate((k) => { k === "climb" ? FX.sfx.climb(8) : FX.sfx[k](); }, k);
    await page.waitForTimeout(1400);
    solo[k] = (await page.evaluate(() => window.__probe.stats())).peak;
  }
  console.log("  ήχοι μόνοι: " + Object.entries(solo).map(([k, v]) => k + " " + fmt(v, 3)).join(" · "));
  return s.peak < 1;
}

/* ----------------------------------------------------------------- ΦΟΡΜΑ */
/* Παίζουμε ΟΛΟΚΛΗΡΟ τον κύκλο μια φορά και μαζεύουμε φάσμα ανά 100 ms. Η άθροιση γίνεται
   ΜΕΣΑ στη σελίδα (1.230 δείγματα × 2.048 bins δεν έχει νόημα να ταξιδέψουν από το CDP).
   Κάθε δείγμα χρεώνεται στο μέρος της μπάρας που ηχούσε — και οι μπάρες είναι γραμμένες
   με απόλυτο χρόνο ήχου στο __MLOG, όχι μαντεμένες από ρολόι.

   ΤΟ ΚΡΙΣΙΜΟ ΕΙΝΑΙ ΤΟ ΚΑΤΩΦΛΙ. «Μια λούπα δίνει ~0 dB» είναι σωστό στη θεωρία και άχρηστο
   στην πράξη: κανένα ζευγάρι δεν δίνει ακριβώς 0, γιατί οι νότες πέφτουν σε άλλες στιγμές.
   Άρα μετράμε ΚΑΙ έναν μάρτυρα: κάθε μέρος κοπμμένο στη μέση, πρώτο μισό vs δεύτερο.
   Αυτό ΕΙΝΑΙ επανάληψη μέσα στο ίδιο υλικό — ό,τι νούμερο βγάλει, είναι ο θόρυβος της
   μέτρησης. Τα μέρη περνούν μόνο αν είναι σαφώς πιο μακριά μεταξύ τους από αυτό. */
async function form(page) {
  console.log("\n=== 3. ΦΟΡΜΑ (φάσμα ανά μέρος σε έναν πλήρη κύκλο 120 s) ===");
  await arm(page, 1, 6, 6);
  await page.waitForTimeout(8000);
  await page.evaluate(() => {
    const SECT = [[0, 4], [4, 16], [20, 16], [36, 16]];
    /* οκτώ κουβάδες: μέρος × μισό — τα μισά δίνουν τον μάρτυρα της λούπας */
    const F = { per: [0, 1, 2, 3].map(() => [{ sum: null, n: 0 }, { sum: null, n: 0 }]), miss: 0, samples: 0 };
    window.__FORM = F;
    window.__MLOG = [];
    FX.music.at(0);
    const an = window.__probe.an, c = window.__probe.ctx, buf = new Float32Array(an.frequencyBinCount);
    F.bins = an.frequencyBinCount; F.sr = c.sampleRate;
    F.timer = setInterval(function () {
      an.getFloatFrequencyData(buf);
      /* Το mlog("bar", at, sec) γράφει τον αριθμό του μέρους στο τρίτο πεδίο· μετράμε
         και πόσες μπάρες έχουν ηχήσει, για να ξέρουμε σε ποιο μισό είμαστε. */
      const t = c.currentTime, L = window.__MLOG;
      let sec = -1, nbar = 0;
      for (let i = 0; i < L.length; i++) if (L[i][0] === "bar") {
        if (L[i][1] > t) break;
        sec = L[i][2]; nbar++;
      }
      F.samples++;
      if (sec < 0) { F.miss++; return; }
      const inSec = nbar - 1 - SECT[sec][0];
      const p = F.per[sec][inSec < SECT[sec][1] / 2 ? 0 : 1];
      if (!p.sum) p.sum = new Float64Array(buf.length);
      for (let k = 0; k < buf.length; k++) p.sum[k] += Math.max(-110, buf[k]);
      p.n++;
    }, 100);
  });
  await page.waitForTimeout(123000);
  const out = await page.evaluate(() => {
    const F = window.__FORM;
    clearInterval(F.timer);
    const bars = window.__MLOG.filter((e) => e[0] === "bar").length;
    window.__MLOG = null;
    return { avg: F.per.map((h) => h.map((p) => (p.n ? Array.from(p.sum).map((x) => x / p.n) : null))),
      n: F.per.map((h) => h.map((p) => p.n)), miss: F.miss, samples: F.samples, bars: bars, bins: F.bins, sr: F.sr };
  });
  const SN = ["intro", "A", "B", "A'"];
  console.log("  δείγματα φάσματος " + out.samples + " (χωρίς αντιστοίχιση " + out.miss +
    ") · μπάρες που ήχησαν " + out.bars + " · ανά μέρος/μισό " + out.n.map((h) => h.join("+")).join(" · "));
  const hz = out.sr / 2 / out.bins, top = Math.min(out.bins, Math.floor(8000 / hz));
  /* μέση απόλυτη διαφορά dB ανά bin, 0–8 kHz */
  const diff = (a, b) => { if (!a || !b) return NaN; let d = 0; for (let k = 1; k < top; k++) d += Math.abs(a[k] - b[k]); return d / (top - 1); };
  /* μέσος όρος των δύο μισών ενός μέρους = το προφίλ του μέρους */
  const whole = out.avg.map((h) => (h[0] && h[1] ? h[0].map((x, k) => (x + h[1][k]) / 2) : (h[0] || h[1])));

  console.log("\n  ΜΑΡΤΥΡΑΣ ΛΟΥΠΑΣ — το ίδιο υλικό, πρώτο μισό vs δεύτερο:");
  let base = 0, bn = 0;
  SN.forEach((n, i) => {
    const d = diff(out.avg[i][0], out.avg[i][1]);
    if (!isNaN(d) && i > 0) { base += d; bn++; }
    console.log("    " + (n + " Α' μισό vs Β' μισό").padEnd(24) + fmt(d, 2).padStart(6) + " dB");
  });
  base /= bn;
  console.log("    κατώφλι λούπας (μ.ό. A/B/A΄) " + fmt(base, 2) + " dB");

  console.log("\n  ΜΕΤΑΞΥ ΜΕΡΩΝ:");
  let minDiff = 1e9;
  for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
    const d = diff(whole[a], whole[b]);
    if (a > 0 && b > 0) minDiff = Math.min(minDiff, d);
    console.log("    " + (SN[a] + " vs " + SN[b]).padEnd(14) + fmt(d, 2).padStart(6) + " dB   ×" + fmt(d / base, 2) + " τον μάρτυρα");
  }
  const bands = [[40, 120, "sub"], [120, 400, "arp/μπάσο"], [400, 1200, "pad"], [1200, 3500, "lead"], [3500, 12000, "hats/χώρος"]];
  console.log("\n  μέσο dB ανά ζώνη (δείχνει ΤΙ αλλάζει, όχι μόνο ότι αλλάζει):");
  console.log("    μέρος   " + bands.map((b) => b[2].padStart(12)).join(""));
  SN.forEach((n, i) => {
    if (!whole[i]) return;
    console.log("    " + n.padEnd(8) + bands.map((b) => {
      const k0 = Math.max(1, Math.round(b[0] / hz)), k1 = Math.min(out.bins - 1, Math.round(b[1] / hz));
      let s = 0; for (let k = k0; k <= k1; k++) s += whole[i][k];
      return fmt(s / (k1 - k0 + 1), 1).padStart(12);
    }).join(""));
  });
  const ok = minDiff >= base * 1.6;
  console.log("\n  " + (ok ? "✓" : "✗") + " μικρότερη διαφορά A/B/A΄ " + fmt(minDiff, 2) +
    " dB = ×" + fmt(minDiff / base, 2) + " τον μάρτυρα της λούπας (θέλουμε ≥ ×1,6)");
  return ok;
}

/* ------------------------------------------- REDUCE-MOTION (παλιό σφάλμα) */
/* Το prefers-reduced-motion ΔΕΝ σβήνει τον ήχο. Ήταν αληθινό σφάλμα κάποτε· εδώ
   ανοίγουμε σελίδα με reducedMotion: "reduce" και απαιτούμε να ΒΓΑΙΝΕΙ σήμα. */
async function rmotion(browser) {
  console.log("\n=== 0. REDUCE-MOTION: η κίνηση σβήνει, ο ήχος ΟΧΙ ===");
  const cx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await cx.newPage();
  await boot(page);
  const rm = await page.evaluate(() => FX.RM);
  await arm(page, 1, 6, 6);
  await page.waitForTimeout(6000);
  await page.evaluate(() => window.__probe.reset());
  await page.waitForTimeout(5000);
  const s = await page.evaluate(() => window.__probe.stats());
  const st = await page.evaluate(() => FX.audioState());
  await cx.close();
  const ok = rm === true && st === "music playing" && s.rms > 0.001;
  console.log("  FX.RM " + rm + " · audioState \"" + st + "\" · RMS " + fmt(s.rms) + " · κορυφή " + fmt(s.peak));
  console.log("  " + (ok ? "✓" : "✗") + " με reduce-motion η μουσική παίζει κανονικά");
  return ok;
}

/* ---------------------------------------------------------------- ΓΡΟΘΙΑ */
async function groove(page) {
  console.log("\n=== 4. ΓΡΟΘΙΑ (τι προγραμματίστηκε, πού και πόσο συχνά) ===");
  await arm(page, 1, 6, 6);
  await page.waitForTimeout(8000);
  const out = await page.evaluate(async () => {
    window.__MLOG = [];
    FX.music.at(4 * 16);                       /* αρχή του μέρους A */
    await new Promise((r) => setTimeout(r, 6 * 2.3077 * 1000 + 400));
    const L = window.__MLOG; window.__MLOG = null;
    return L;
  });
  const STEP = 60 / 104 / 4, BARDUR = STEP * 16;
  const barEv = out.filter((e) => e[0] === "bar");
  if (barEv.length < 3) { console.log("  ✗ δεν γράφτηκαν μπάρες"); return false; }
  const t0 = barEv[0][1];
  const kinds = {};
  out.forEach((e) => { (kinds[e[0]] = kinds[e[0]] || []).push(e[1]); });
  console.log("  γεγονότα σε " + (barEv.length) + " μπάρες: " +
    Object.entries(kinds).map(([k, v]) => k + " " + v.length).join(" · "));
  const nb = barEv.length - 1;   /* πλήρεις μπάρες */
  const perBar = (k) => (kinds[k] ? kinds[k].filter((t) => t >= t0 - STEP * 0.5 && t < t0 + nb * BARDUR - STEP * 0.5).length / nb : 0);
  console.log("\n  ανά μπάρα: arp " + fmt(perBar("arp"), 2) + " · pad " + fmt(perBar("pad"), 2) +
    " · kick " + fmt(perBar("kick"), 2) + " · clap " + fmt(perBar("clap"), 2) +
    " · hat " + fmt(perBar("hat"), 2) + " · sub " + fmt(perBar("sub"), 2));
  /* Πέφτει το arp σε ΚΑΘΕ δέκατο-έκτο; */
  const arp = (kinds.arp || []).filter((t) => t >= t0).sort((a, b) => a - b);
  let maxJit = 0, gaps = [];
  for (let i = 1; i < arp.length; i++) { gaps.push(arp[i] - arp[i - 1]); }
  gaps.forEach((g) => { maxJit = Math.max(maxJit, Math.abs(g - STEP)); });
  console.log("  βήμα arp: ονομαστικό " + (STEP * 1000).toFixed(2) + " ms · μέσο " +
    (gaps.reduce((a, b) => a + b, 0) / gaps.length * 1000).toFixed(2) + " ms · μέγιστη απόκλιση " +
    (maxJit * 1000).toFixed(3) + " ms");
  /* Πού πέφτει το kick μέσα στο μέτρο; */
  const pos = (k) => (kinds[k] || []).filter((t) => t >= t0).map((t) => {
    return Math.round(((t - t0) % BARDUR) / STEP) % 16;
  });
  const uniq = (a) => Array.from(new Set(a)).sort((x, y) => x - y);
  console.log("  θέσεις (σε δεκαέκτατα μέσα στο μέτρο):");
  ["kick", "clap", "hat", "ohat", "sub", "pad", "lead"].forEach((k) => {
    if (!kinds[k]) return;
    console.log("    " + k.padEnd(5) + " " + uniq(pos(k)).join(", "));
  });
  const kickOk = JSON.stringify(uniq(pos("kick"))) === "[0,8]";
  /* Το clap στο 14 είναι το ghost snare της κάθε 4ης μπάρας — σχεδιασμένο, όχι ατύχημα. */
  const clapOk = uniq(pos("clap")).every((x) => x === 4 || x === 12 || x === 14) &&
    uniq(pos("clap")).indexOf(4) >= 0 && uniq(pos("clap")).indexOf(12) >= 0;
  const arpOk = Math.abs(perBar("arp") - 16) < 0.35 && maxJit < 0.0005;
  console.log("\n  " + (arpOk ? "✓" : "✗") + " arp = 16 χτυπήματα/μπάρα σε ίσα δεκαέκτατα");
  console.log("  " + (kickOk ? "✓" : "✗") + " kick στο 1 και στο 3 (βήματα 0, 8)");
  console.log("  " + (clapOk ? "✓" : "✗") + " clap στο 2 και στο 4 (βήματα 4, 12 · το 14 είναι το ghost snare)");
  return arpOk && kickOk && clapOk;
}

(async () => {
  const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const page = await b.newPage();
  page.on("pageerror", (e) => console.log("[σφάλμα σελίδας]", e.message));
  await boot(page);
  const first = await page.evaluate(() => ({ state: FX.audioState(), sr: window.__probe.ctx.sampleRate, rm: FX.RM }));
  console.log("=== 1. ΑΡΜΟΝΙΑ: node tools/music.js (ξεχωριστά, χωρίς φυλλομετρητή) ===");
  console.log("audio: " + first.state + " · " + first.sr + " Hz · prefers-reduced-motion: " + first.rm);
  const res = {};
  if (WHICH === "layers") { await layers(b); await b.close(); process.exit(0); }
  if (WHICH === "all" || WHICH === "rm") res.rm = await rmotion(b);
  if (WHICH === "all" || WHICH === "groove") res.groove = await groove(page);
  if (WHICH === "all" || WHICH === "amp") res.amp = await amp(page);
  if (WHICH === "all" || WHICH === "clip") res.clip = await clip(page);
  if (WHICH === "all" || WHICH === "form") res.form = await form(page);
  console.log("\n=== ΣΥΝΟΛΟ ===");
  Object.entries(res).forEach(([k, v]) => console.log("  " + (v ? "✓" : "✗") + " " + k));
  await b.close();
  process.exit(Object.values(res).every(Boolean) ? 0 : 1);
})();
