import { Game } from './game.js';
import { UI } from './ui.js';

const canvas = document.getElementById('game');
const ui = new UI(document.getElementById('ui'));
const game = new Game(canvas, ui);
ui.attach(game);
game.init();
window.__snowmanGame = game; // handy for debugging / automated tests

// Register the service worker for offline play (only over http/https).
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
