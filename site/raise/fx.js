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
      P.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - pow * 0.35, r: 1 + Math.random() * 2.4, l: 1, d: 0.012 + Math.random() * 0.016, h: hue || "#f2d68c" });
    }
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function tick() {
    cx.clearRect(0, 0, innerWidth, innerHeight);
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.055; p.vx *= 0.99; p.l -= p.d;
      if (p.l <= 0) { P.splice(i, 1); continue; }
      cx.globalAlpha = Math.max(0, p.l); cx.fillStyle = p.h;
      cx.beginPath(); cx.arc(p.x, p.y, p.r * p.l, 0, 6.284); cx.fill();
    }
    cx.globalAlpha = 1;
    raf = P.length ? requestAnimationFrame(tick) : 0;
    if (!raf) cx.clearRect(0, 0, innerWidth, innerHeight);
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
    raise: () => { tone({ f: 440, t: 0.12, type: "triangle", g: 0.12 }); tone({ f: 660, t: 0.2, type: "triangle", g: 0.12, delay: 0.1 }); tone({ f: 880, t: 0.3, type: "sine", g: 0.08, delay: 0.2 }); },
  };
  function toggleMute() { muted = !muted; try { localStorage.setItem("raise.mute", muted ? "1" : "0"); } catch (e) {} return muted; }

  root.FX = { spark, burstAt, floatIn, countUp, pulse, fly, buzz, sfx, toggleMute, isMuted: () => muted, RM };
})(window);
