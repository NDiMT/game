import { TOTAL_LEVELS, LEVELS } from './levels.js';

/** DOM overlay controller (menus, HUD, dialogs). */
export class UI {
  constructor(root) {
    this.root = root;
    this.game = null;
    this.$ = (sel) => root.querySelector(sel);
    this.screens = {
      menu: this.$('#screen-menu'),
      levels: this.$('#screen-levels'),
      hud: this.$('#hud'),
      levelwin: this.$('#screen-levelwin'),
      levelfail: this.$('#screen-levelfail'),
      victory: this.$('#screen-victory'),
      help: this.$('#screen-help'),
    };
    this._bind();
  }

  attach(game) {
    this.game = game;
    this._syncMute();
  }

  _bind() {
    this.$('#btn-play').addEventListener('click', () => {
      const p = this.game.progress;
      this.game.score = 0;
      this.game.startLevel(Math.min(p.unlocked, TOTAL_LEVELS) - 1);
    });
    this.$('#btn-levels').addEventListener('click', () => this.showLevels());
    this.$('#btn-help').addEventListener('click', () => this.show('help'));
    this.$('#btn-help-close').addEventListener('click', () => this.showMenu(this.game.progress));
    this.$('#btn-levels-back').addEventListener('click', () => this.showMenu(this.game.progress));
    this.$('#btn-next').addEventListener('click', () => this.game.startLevel(this.game.levelIndex + 1));
    this.$('#btn-retry').addEventListener('click', () => this.game.startLevel(this.game.levelIndex));
    this.$('#btn-fail-menu').addEventListener('click', () => this.showMenu(this.game.progress));
    this.$('#btn-victory-menu').addEventListener('click', () => this.showMenu(this.game.progress));
    this.$('#btn-victory-again').addEventListener('click', () => this.game.restartAll());
    this.$('#btn-hud-menu').addEventListener('click', () => {
      this.game.state = 'menu';
      this.game.audio.stopMusic();
      this.showMenu(this.game.progress);
    });
    for (const el of this.root.querySelectorAll('.btn-mute')) {
      el.addEventListener('click', () => {
        this.game.audio.unlock();
        this.game.audio.toggleMute();
        this._syncMute();
      });
    }
    // Unlock audio on first touch anywhere (mobile autoplay policy).
    const unlock = () => { this.game && this.game.audio.unlock(); };
    window.addEventListener('touchstart', unlock, { once: true, passive: true });
    window.addEventListener('mousedown', unlock, { once: true });
  }

  _syncMute() {
    const m = this.game.audio.muted;
    for (const el of this.root.querySelectorAll('.btn-mute')) {
      el.textContent = m ? '🔇' : '🔊';
      el.setAttribute('aria-label', m ? 'Ενεργοποίηση ήχου' : 'Σίγαση');
    }
  }

  show(name) {
    for (const [k, el] of Object.entries(this.screens)) el.classList.toggle('hidden', k !== name);
  }

  showMenu(progress) {
    this.show('menu');
    this.$('#menu-progress').textContent = progress.scarf
      ? 'Ολοκλήρωσες και τις 10 πίστες! 🧣'
      : `Ξεκλειδωμένες πίστες: ${progress.unlocked} / ${TOTAL_LEVELS}`;
    this.$('#menu-scarf').classList.toggle('hidden', !progress.scarf);
    this.$('#menu-logo').src = progress.scarf ? 'assets/sprites/snowman_scarf.svg' : 'assets/sprites/snowman.svg';
    this.$('#btn-play').textContent = progress.unlocked > 1 && !progress.scarf ? `▶ Συνέχεια (Πίστα ${progress.unlocked})` : '▶ Παίξε';
  }

  showLevels() {
    this.show('levels');
    const grid = this.$('#levels-grid');
    grid.innerHTML = '';
    const p = this.game.progress;
    LEVELS.forEach((L, i) => {
      const n = i + 1;
      const b = document.createElement('button');
      const locked = n > p.unlocked;
      b.className = 'level-btn' + (locked ? ' locked' : '');
      b.disabled = locked;
      const best = p.best[n];
      b.innerHTML = `<span class="lvl-num">${locked ? '🔒' : n}</span><span class="lvl-name">${L.name}</span>${best ? `<span class="lvl-best">★ ${best}</span>` : ''}`;
      b.addEventListener('click', () => { this.game.score = 0; this.game.startLevel(i); });
      grid.appendChild(b);
    });
  }

  showHud(level, total, name, balls, score, wind) {
    this.show('hud');
    this.$('#hud-level').textContent = `Πίστα ${level}/${total}`;
    this.$('#hud-name').textContent = name;
    this.$('#hud-score').textContent = score;
    this.$('#hud-wind').textContent = wind ? (wind > 0 ? '💨 →' : '← 💨') : '';
    this.updateBalls(balls);
    // progress dots
    const dots = this.$('#hud-dots');
    dots.innerHTML = '';
    for (let i = 1; i <= total; i++) {
      const d = document.createElement('span');
      d.className = 'dot' + (i < level ? ' done' : i === level ? ' current' : '');
      dots.appendChild(d);
    }
  }

  updateBalls(n) {
    const el = this.$('#hud-balls');
    el.innerHTML = '';
    for (let i = 0; i < n; i++) {
      const s = document.createElement('img');
      s.src = 'assets/sprites/snowball.svg'; s.alt = '';
      el.appendChild(s);
    }
    if (n === 0) el.textContent = '—';
  }

  updateScore(s) { this.$('#hud-score').textContent = s; }

  floatText(wx, wy, text, scale, offset) {
    const el = document.createElement('div');
    el.className = 'float-text';
    el.textContent = text;
    el.style.left = (offset.x + wx * scale) + 'px';
    el.style.top = (offset.y + wy * scale) + 'px';
    this.root.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  showLevelWin(level, levelScore, bonus) {
    this.show('levelwin');
    this.$('#win-title').textContent = `Πίστα ${level} ολοκληρώθηκε! 🎯`;
    this.$('#win-score').textContent = `Πόντοι πίστας: ${levelScore}` + (bonus ? ` (μπόνους μπάλες +${bonus})` : '');
    this.$('#win-next').textContent = level + 1 === TOTAL_LEVELS
      ? 'Επόμενη: ο μεγάλος τελικός! Μία πίστα πριν το κόκκινο κασκόλ 🧣'
      : `Ακόμη ${TOTAL_LEVELS - level} πίστες μέχρι το κόκκινο κασκόλ 🧣`;
  }

  showLevelFail(level) {
    this.show('levelfail');
    this.$('#fail-title').textContent = `Τέλος οι μπάλες χιονιού! ❄️`;
    this.$('#fail-sub').textContent = `Πίστα ${level}: δοκίμασε ξανά, μπορείς να το κάνεις!`;
  }

  showVictory(score) {
    this.show('victory');
    this.$('#victory-score').textContent = `Συνολικοί πόντοι: ${score}`;
    const scarf = this.$('#victory-scarf');
    scarf.classList.remove('pop');
    void scarf.offsetWidth; // restart animation
    scarf.classList.add('pop');
  }
}
