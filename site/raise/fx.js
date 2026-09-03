/* Εφέ: σωματίδια, ήχος (Web Audio synth, χωρίς αρχεία), FLIP, δόνηση, count-up. */
(function (root) {
  "use strict";
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- particles ---- */
  const cv = document.getElementById("fx"), cx = cv.getContext("2d");
  let P = [], raf = 0;
  function fit() { const d = Math.min(devicePixelRatio || 1, 2); cv.width = innerWidth * d; cv.height = innerHeight * d; cx.setTransform(d, 0, 0, d, 0, 0); }
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
  function floatIn(el, txt) { if (RM) return; const e = document.createElement("div"); e.className = "float"; e.textContent = txt; el.appendChild(e); setTimeout(() => e.remove(), 1100); }
  function countUp(el, from, to) {
    if (RM || from === to) { el.textContent = to; return; }
    const t0 = performance.now(), dur = Math.min(750, 240 + Math.abs(to - from) * 1.4);
    (function step(t) { const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3); el.textContent = Math.round(from + (to - from) * e); if (p < 1) requestAnimationFrame(step); })(t0);
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

  /* ---- synth ---- */
  const AC = root.AudioContext || root.webkitAudioContext;
  let ac = null, muted = false;
  try { muted = localStorage.getItem("raise.mute") === "1"; } catch (e) {}
  function ctx() { if (!AC) return null; if (!ac) ac = new AC(); if (ac.state === "suspended") ac.resume(); return ac; }
  addEventListener("pointerdown", () => { ctx(); }, { once: true, passive: true });
  function tone(o) {
    if (muted) return; const c = ctx(); if (!c) return;
    const f = o.f || 440, t = o.t || 0.1, d = o.delay || 0, g = o.g || 0.12, now = c.currentTime + d;
    const osc = c.createOscillator(), amp = c.createGain();
    osc.type = o.type || "sine";
    osc.frequency.setValueAtTime(f, now);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f * o.slide), now + t);
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(g, now + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + t);
    osc.connect(amp).connect(c.destination);
    osc.start(now); osc.stop(now + t + 0.03);
  }
  const sfx = {
    tick: () => tone({ f: 1700, t: 0.035, type: "square", g: 0.035 }),
    /* ο τόνος ανεβαίνει με κάθε σκαλί της αλυσίδας — ο ήχος είναι η σκάλα */
    climb: (pos) => { const f = 330 * Math.pow(2, (Math.min(pos, 10) - 1) / 6); tone({ f, t: 0.16, type: "triangle", g: 0.14 }); tone({ f: f * 1.5, t: 0.24, type: "sine", g: 0.06, delay: 0.05 }); },
    pass: () => tone({ f: 220, t: 0.28, type: "sawtooth", g: 0.07, slide: 0.5 }),
    ace: () => { tone({ f: 660, t: 0.12, type: "sine", g: 0.1 }); tone({ f: 440, t: 0.3, type: "sine", g: 0.1, delay: 0.09, slide: 0.75 }); },
    shatter: () => { tone({ f: 2600, t: 0.16, type: "square", g: 0.05, slide: 0.35 }); tone({ f: 1900, t: 0.2, type: "square", g: 0.04, delay: 0.03, slide: 0.3 }); },
    clear: () => [523, 659, 784, 1046].forEach((f, i) => tone({ f, t: 0.38, type: "triangle", g: 0.11, delay: i * 0.09 })),
    bust: () => { tone({ f: 196, t: 0.5, type: "sawtooth", g: 0.08, slide: 0.7 }); tone({ f: 147, t: 0.6, type: "sawtooth", g: 0.08, delay: 0.16, slide: 0.7 }); },
    buy: () => tone({ f: 880, t: 0.13, type: "sine", g: 0.1, slide: 1.5 }),
    open: () => tone({ f: 520, t: 0.08, type: "sine", g: 0.05, slide: 1.2 }),
    discard: () => { tone({ f: 900, t: 0.06, type: "square", g: 0.04, slide: 0.6 }); tone({ f: 600, t: 0.08, type: "square", g: 0.03, delay: 0.05, slide: 0.6 }); },
    draw: () => tone({ f: 1200, t: 0.04, type: "sine", g: 0.03, slide: 1.3 }),
    unlock: () => [660, 880, 1320].forEach((f, i) => tone({ f, t: 0.3, type: "triangle", g: 0.1, delay: i * 0.08 })),
    bomb: () => { tone({ f: 90, t: 0.55, type: "sawtooth", g: 0.22, slide: 0.35 }); tone({ f: 60, t: 0.7, type: "square", g: 0.14, delay: 0.04, slide: 0.5 }); tone({ f: 1400, t: 0.12, type: "square", g: 0.05, slide: 0.2 }); [880, 1320, 1760].forEach((f, i) => tone({ f, t: 0.25, type: "triangle", g: 0.08, delay: 0.25 + i * 0.07 })); },
    raise: () => { tone({ f: 440, t: 0.12, type: "triangle", g: 0.12 }); tone({ f: 660, t: 0.2, type: "triangle", g: 0.12, delay: 0.1 }); tone({ f: 880, t: 0.3, type: "sine", g: 0.08, delay: 0.2 }); },
  };
  function toggleMute() { muted = !muted; try { localStorage.setItem("raise.mute", muted ? "1" : "0"); } catch (e) {} return muted; }

  root.FX = { spark, burstAt, boom, floatIn, countUp, pulse, fly, ghostTo, buzz, sfx, toggleMute, isMuted: () => muted, embers, flash, RM };
})(window);
