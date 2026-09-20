import { AudioEngine } from './audio.js';
import { LEVELS, TOTAL_LEVELS, DIFFICULTIES, DEFAULT_DIFFICULTY } from './levels.js';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const W = 540;               // world width (fixed); height adapts to the screen
const H_MIN = 820, H_MAX = 1300;
const DESIGN_GROUND = 700;   // ground line used by level coordinates (levels.js)
const GRAVITY = 1400;        // px / s^2
const BALL_R = 14;
const MAX_POWER = 1150;      // max launch speed px/s
const SNOWMAN_W = 150, SNOWMAN_H = 195, SNOWMAN_X = 96;
const SAVE_KEY = 'snowman.progress';
const DIFF_KEY = 'snowman.difficulty';

/**
 * Set to true (or run `node tools/snowman-gemini-art.mjs --apply` from the repo root) to use the
 * Gemini-generated PNG illustrations in assets/sprites/gemini/. Any missing
 * PNG falls back to the built-in SVG sprite automatically.
 */
const USE_GEMINI_ART = false;

const SPRITES = {
  snowman: 'assets/sprites/snowman.svg',
  snowman_throw: 'assets/sprites/snowman_throw.svg',
  snowman_scarf: 'assets/sprites/snowman_scarf.svg',
  snowball: 'assets/sprites/snowball.svg',
  bullseye: 'assets/sprites/target_bullseye.svg',
  can: 'assets/sprites/target_can.svg',
  ice: 'assets/sprites/target_ice.svg',
  star: 'assets/sprites/target_star.svg',
  scarf: 'assets/sprites/scarf.svg',
  background: 'assets/sprites/background.svg',
};

const POINTS = { bullseye: 100, can: 80, ice: 150, star: 250 };

/* ------------------------------------------------------------------ */
/*  Persistence                                                        */
/* ------------------------------------------------------------------ */
function loadProgress() {
  try {
    const p = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
    return { unlocked: p.unlocked || 1, scarf: !!p.scarf, best: p.best || {} };
  } catch { return { unlocked: 1, scarf: false, best: {} }; }
}
function loadDifficulty() {
  try { const d = localStorage.getItem(DIFF_KEY); return DIFFICULTIES[d] ? d : DEFAULT_DIFFICULTY; } catch { return DEFAULT_DIFFICULTY; }
}
function saveProgress(p) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(p)); } catch { /* storage unavailable */ } }

/* ------------------------------------------------------------------ */
/*  Asset loading                                                      */
/* ------------------------------------------------------------------ */
function loadOne(src) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
}

async function loadImages(map) {
  const out = {};
  await Promise.all(Object.entries(map).map(async ([k, src]) => {
    let img = null;
    if (USE_GEMINI_ART) img = await loadOne(src.replace(/\.svg$/, '.png').replace('sprites/', 'sprites/gemini/'));
    if (!img) img = await loadOne(src);
    if (!img) console.warn('Missing sprite', src);
    out[k] = img;
  }));
  return out;
}

/* ------------------------------------------------------------------ */
/*  Game                                                               */
/* ------------------------------------------------------------------ */
export class Game {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ui = ui;
    this.audio = new AudioEngine();
    this.progress = loadProgress();
    this.difficulty = loadDifficulty();
    this.wind = 0;
    this.images = {};
    this.state = 'menu';       // menu | playing | levelwin | levelfail | victory
    this.levelIndex = 0;
    this.balls = [];
    this.targets = [];
    this.particles = [];
    this.flakes = [];
    this.aim = null;           // { sx, sy, cx, cy } while dragging
    this.throwAnim = 0;
    this.score = 0;
    this.levelScore = 0;
    this.time = 0;
    this.last = 0;
    this.scale = 1;
    this.offset = { x: 0, y: 0 };

    for (let i = 0; i < 60; i++) {
      this.flakes.push({ x: Math.random() * W, y: Math.random() * H_MIN, r: 1 + Math.random() * 3, v: 20 + Math.random() * 40, d: Math.random() * Math.PI * 2 });
    }

    this._bindInput();
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  async init() {
    this.images = await loadImages(SPRITES);
    this.ui.showMenu(this.progress);
    requestAnimationFrame((t) => this.loop(t));
  }

  /* ----------------------------------------------------------- sizing */
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vw = window.innerWidth, vh = window.innerHeight;
    // Fill the screen: fixed world width, world height follows the device aspect.
    this.H = Math.max(H_MIN, Math.min(H_MAX, Math.round(W * vh / vw)));
    this.groundY = this.H - 260;
    this.snowman = { x: SNOWMAN_X, y: this.groundY, w: SNOWMAN_W, h: SNOWMAN_H };
    this.hand = { x: SNOWMAN_X + 62, y: this.groundY - 130 };
    this.scale = Math.min(vw / W, vh / this.H);
    const cw = Math.floor(W * this.scale), ch = Math.floor(this.H * this.scale);
    // Re-anchor targets to the new ground line.
    if (this.targets) for (const t of this.targets) { t.baseY = this.groundY - t.groundOffset; if (!t.move || t.move.axis !== 'y') t.y = t.baseY; }
    for (const f of this.flakes || []) if (f.y > this.H) f.y = Math.random() * this.H;
    this.canvas.style.width = cw + 'px';
    this.canvas.style.height = ch + 'px';
    this.canvas.width = Math.floor(cw * dpr);
    this.canvas.height = Math.floor(ch * dpr);
    this.offset = { x: (vw - cw) / 2, y: (vh - ch) / 2 };
    this.ctx.setTransform(this.scale * dpr, 0, 0, this.scale * dpr, 0, 0);
  }

  toWorld(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: (clientX - rect.left) / this.scale, y: (clientY - rect.top) / this.scale };
  }

  /* ------------------------------------------------------------ input */
  _bindInput() {
    const c = this.canvas;
    const start = (e) => {
      if (this.state !== 'playing') return;
      const p = this._pt(e);
      const w = this.toWorld(p.x, p.y);
      if (this.ballsLeft <= 0) return;
      this.aim = { sx: w.x, sy: w.y, cx: w.x, cy: w.y };
      e.preventDefault();
    };
    const move = (e) => {
      if (!this.aim) return;
      const p = this._pt(e);
      const w = this.toWorld(p.x, p.y);
      this.aim.cx = w.x; this.aim.cy = w.y;
      e.preventDefault();
    };
    const end = (e) => {
      if (!this.aim) return;
      const v = this._launchVelocity(this.aim);
      const speed = Math.hypot(v.x, v.y);
      if (speed > 120) this.throwBall(v);
      this.aim = null;
      e.preventDefault();
    };
    c.addEventListener('touchstart', start, { passive: false });
    c.addEventListener('touchmove', move, { passive: false });
    c.addEventListener('touchend', end, { passive: false });
    c.addEventListener('touchcancel', end, { passive: false });
    c.addEventListener('mousedown', start);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
  }

  _pt(e) {
    if (e.touches && e.touches.length) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    if (e.changedTouches && e.changedTouches.length) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    return { x: e.clientX, y: e.clientY };
  }

  /** Slingshot: drag back, release to fire in the opposite direction. */
  _launchVelocity(aim) {
    const dx = aim.sx - aim.cx, dy = aim.sy - aim.cy;
    const len = Math.hypot(dx, dy);
    const power = Math.min(len / 220, 1) * MAX_POWER;
    if (len < 1) return { x: 0, y: 0 };
    return { x: dx / len * power, y: dy / len * power };
  }

  /* ------------------------------------------------------------ flow */
  startLevel(i) {
    this.levelIndex = i;
    const L = LEVELS[i];
    const D = this.diff;
    this.wind = L.wind * D.wind;
    this.targets = L.targets.map((t) => {
      const groundOffset = DESIGN_GROUND - t.y;
      const y = this.groundY - groundOffset;
      const move = t.move ? { ...t.move, speed: t.move.speed * D.speed } : undefined;
      return { ...t, move, r: Math.round(t.r * D.size), y, hp: t.hp || 1, hit: false, baseX: t.x, baseY: y, groundOffset, phase: Math.random() * Math.PI * 2, wobble: 0 };
    });
    this.balls = [];
    this.particles = [];
    this.ballsLeft = Math.max(3, L.balls + D.balls);
    this.levelScore = 0;
    this.state = 'playing';
    this.audio.unlock();
    this.audio.startMusic();
    this.ui.showHud(i + 1, TOTAL_LEVELS, L.name, this.ballsLeft, this.score, this.wind, D);
  }

  throwBall(v) {
    this.ballsLeft--;
    this.balls.push({ x: this.hand.x, y: this.hand.y, vx: v.x, vy: v.y, r: BALL_R, alive: true, age: 0 });
    this.throwAnim = 0.25;
    this.audio.sfxThrow();
    this.ui.updateBalls(this.ballsLeft);
  }

  _levelComplete() {
    this.state = 'levelwin';
    const n = this.levelIndex + 1;
    const bonus = Math.round(this.ballsLeft * 50 * this.diff.score);
    this.score += bonus;
    this.levelScore += bonus;
    this.progress.best[n] = Math.max(this.progress.best[n] || 0, this.levelScore);
    if (n >= TOTAL_LEVELS) {
      this.progress.scarf = true;
      this.progress.unlocked = TOTAL_LEVELS;
      saveProgress(this.progress);
      this.state = 'victory';
      this.audio.stopMusic();
      this.audio.sfxFanfare();
      this._burst(W / 2, this.H * 0.4, 90, ['#e63946', '#ffd166', '#fff', '#4fa3ff']);
      this.ui.showVictory(this.score);
    } else {
      this.progress.unlocked = Math.max(this.progress.unlocked, n + 1);
      saveProgress(this.progress);
      this.audio.sfxLevelWin();
      this.ui.showLevelWin(n, this.levelScore, bonus);
    }
  }

  _levelFailed() {
    this.state = 'levelfail';
    this.audio.sfxFail();
    this.ui.showLevelFail(this.levelIndex + 1);
  }

  restartAll() {
    this.score = 0;
    this.startLevel(0);
  }

  get diff() { return DIFFICULTIES[this.difficulty] || DIFFICULTIES[DEFAULT_DIFFICULTY]; }

  setDifficulty(key) {
    if (!DIFFICULTIES[key]) return;
    this.difficulty = key;
    try { localStorage.setItem(DIFF_KEY, key); } catch { /* storage unavailable */ }
  }

  /* ---------------------------------------------------------- update */
  update(dt) {
    this.time += dt;
    // snow flakes
    for (const f of this.flakes) {
      f.y += f.v * dt; f.x += Math.sin(this.time + f.d) * 12 * dt;
      if (f.y > this.H + 5) { f.y = -5; f.x = Math.random() * W; }
    }
    if (this.throwAnim > 0) this.throwAnim -= dt;

    // particles
    for (const p of this.particles) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 900 * dt; p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    if (this.state !== 'playing') return;
    const L = LEVELS[this.levelIndex];

    // targets movement
    for (const t of this.targets) {
      if (t.hit) continue;
      if (t.move) {
        const o = Math.sin(this.time * t.move.speed + t.phase) * t.move.range;
        if (t.move.axis === 'x') t.x = t.baseX + o; else t.y = t.baseY + o;
      }
      if (t.wobble > 0) t.wobble -= dt;
    }

    // snowballs
    for (const b of this.balls) {
      if (!b.alive) continue;
      b.age += dt;
      b.vx += this.wind * dt;
      b.vy += GRAVITY * dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
      // collision with targets
      for (const t of this.targets) {
        if (t.hit) continue;
        const d = Math.hypot(b.x - t.x, b.y - t.y);
        if (d < b.r + t.r) {
          t.hp--; t.wobble = 0.3;
          b.alive = false;
          this._burst(b.x, b.y, 14, ['#fff', '#dbeaff']);
          if (t.hp <= 0) {
            t.hit = true;
            const pts = Math.round((POINTS[t.type] || 100) * this.diff.score);
            this.score += pts; this.levelScore += pts;
            this._burst(t.x, t.y, 22, t.type === 'star' ? ['#ffd166', '#fff3c4'] : ['#ffd166', '#e63946', '#fff']);
            this.ui.updateScore(this.score);
            this.ui.floatText(t.x, t.y, '+' + pts, this.scale, this.offset);
          }
          this.audio.sfxHit();
          break;
        }
      }
      if (b.alive && (b.y > this.groundY + 10 || b.x > W + 40 || b.x < -40 || b.age > 6)) {
        b.alive = false;
        if (b.y > this.groundY - 30) { this._burst(b.x, this.groundY, 10, ['#fff']); this.audio.sfxMiss(); }
      }
    }
    this.balls = this.balls.filter((b) => b.alive || b.age < 6);

    // win / fail conditions
    const remaining = this.targets.filter((t) => !t.hit).length;
    if (remaining === 0) { this._levelComplete(); return; }
    const inFlight = this.balls.some((b) => b.alive);
    if (this.ballsLeft <= 0 && !inFlight) this._levelFailed();
  }

  _burst(x, y, n, colors) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 120 + Math.random() * 260;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, life: 0.5 + Math.random() * 0.5, r: 2 + Math.random() * 4, c: colors[i % colors.length] });
    }
  }

  /* ------------------------------------------------------------ draw */
  draw() {
    const ctx = this.ctx, im = this.images;
    const H = this.H, GROUND_Y = this.groundY;
    ctx.clearRect(0, 0, W, H);
    if (im.background) {
      // "cover": scale the 540x960 background to the world height, anchor to the ground.
      const bw = im.background.width || 540, bh = im.background.height || 960;
      const sc = Math.max(W / bw, (GROUND_Y + 20) / (bh * (700 / 960)));
      const dw = bw * sc, dh = bh * sc;
      ctx.drawImage(im.background, (W - dw) / 2, GROUND_Y + 20 - dh * (700 / 960), dw, dh);
    } else { ctx.fillStyle = '#bfe3ff'; ctx.fillRect(0, 0, W, H); }

    // ground snow
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(W / 2, GROUND_Y + 120, W * 0.8, 140, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(0, GROUND_Y + 120, W, H - GROUND_Y);

    // flakes
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const f of this.flakes) { ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill(); }

    // wind indicator
    const L = LEVELS[this.levelIndex];
    if (this.state === 'playing' && L && this.wind) this._drawWind(ctx, this.wind);

    // targets
    for (const t of this.targets) {
      if (t.hit) continue;
      const img = im[t.type];
      const s = t.r * 2.1;
      const wob = t.wobble > 0 ? Math.sin(t.wobble * 40) * 0.15 : 0;
      ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(wob);
      // stand / pole
      if (t.type !== 'star') {
        ctx.strokeStyle = '#7a4a1e'; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, t.r * 0.8); ctx.lineTo(0, GROUND_Y - t.y); ctx.stroke();
      }
      if (img) {
        const ratio = img.height / img.width;
        ctx.drawImage(img, -s / 2, -s * ratio / 2, s, s * ratio);
      } else { ctx.fillStyle = '#e63946'; ctx.beginPath(); ctx.arc(0, 0, t.r, 0, Math.PI * 2); ctx.fill(); }
      if (t.hp > 1) { // crack indicator for 2-hp targets
        ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.font = 'bold 18px system-ui'; ctx.textAlign = 'center';
        ctx.fillText('x' + t.hp, 0, t.r + 22);
      }
      ctx.restore();
    }

    // aim trajectory
    if (this.aim) this._drawTrajectory(ctx);

    // snowman
    const smImg = this.throwAnim > 0 ? im.snowman_throw : (this.progress.scarf ? im.snowman_scarf : im.snowman);
    const SM = this.snowman, HAND = this.hand;
    if (smImg) ctx.drawImage(smImg, SM.x - SM.w / 2, SM.y - SM.h, SM.w, SM.h);

    // held snowball
    if (this.state === 'playing' && this.ballsLeft > 0 && this.throwAnim <= 0 && im.snowball) {
      ctx.drawImage(im.snowball, HAND.x - BALL_R, HAND.y - BALL_R, BALL_R * 2, BALL_R * 2);
    }

    // snowballs in flight
    for (const b of this.balls) {
      if (!b.alive) continue;
      if (im.snowball) ctx.drawImage(im.snowball, b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
      else { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); }
    }

    // particles
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
      ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  _drawWind(ctx, wind) {
    const dir = Math.sign(wind), n = Math.min(4, Math.ceil(Math.abs(wind) / 60));
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const y = 150 + i * 22;
      const x0 = W / 2 - 40 + ((this.time * 60 * dir + i * 30) % 80) - 40;
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + 40 * dir, y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x0 + 40 * dir, y); ctx.lineTo(x0 + 30 * dir, y - 6); ctx.stroke();
    }
    ctx.restore();
  }

  _drawTrajectory(ctx) {
    const v = this._launchVelocity(this.aim);
    if (Math.hypot(v.x, v.y) < 120) return;
    const L = LEVELS[this.levelIndex];
    const HAND = this.hand, GROUND_Y = this.groundY, SNOWMAN = this.snowman;
    let x = HAND.x, y = HAND.y, vx = v.x, vy = v.y;
    const dt = 1 / 60;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.strokeStyle = 'rgba(29,42,68,0.35)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 70; i++) {
      vx += this.wind * dt; vy += GRAVITY * dt; x += vx * dt; y += vy * dt;
      if (i % 5 === 0 && i / 5 < this.diff.preview) {
        const r = 6 - i * 0.05;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      if (y > GROUND_Y || x > W) break;
    }
    // power meter on the snowman
    const p = Math.min(Math.hypot(this.aim.sx - this.aim.cx, this.aim.sy - this.aim.cy) / 220, 1);
    ctx.fillStyle = 'rgba(29,42,68,0.35)'; ctx.fillRect(SNOWMAN.x - 50, SNOWMAN.y + 16, 100, 10);
    ctx.fillStyle = p > 0.85 ? '#e63946' : '#4fa3ff'; ctx.fillRect(SNOWMAN.x - 50, SNOWMAN.y + 16, 100 * p, 10);
  }

  /* ------------------------------------------------------------ loop */
  loop(t) {
    const dt = Math.min(0.033, (t - this.last) / 1000 || 0.016);
    this.last = t;
    this.update(dt);
    this.draw();
    requestAnimationFrame((tt) => this.loop(tt));
  }
}
