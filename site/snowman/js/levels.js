/**
 * Level definitions. Coordinates are in "world units" on a 540 x 960
 * portrait canvas (scaled to the device). Targets are placed in the right
 * two thirds of the screen; the snowman stands bottom-left.
 *
 *  type:   bullseye | can | ice | star
 *  hp:     hits needed (ice takes 2)
 *  move:   optional { axis: 'x'|'y', range, speed }  (moving targets)
 *  balls:  snowballs available in the level
 *  wind:   horizontal acceleration (px/s^2) applied to snowballs
 */
export const LEVELS = [
  { name: 'Πρώτες βολές', balls: 6, wind: 0, targets: [
    { type: 'bullseye', x: 400, y: 560, r: 44 },
    { type: 'bullseye', x: 300, y: 420, r: 44 },
  ]},
  { name: 'Κονσέρβες', balls: 6, wind: 0, targets: [
    { type: 'can', x: 360, y: 620, r: 34 },
    { type: 'can', x: 440, y: 620, r: 34 },
    { type: 'can', x: 400, y: 540, r: 34 },
  ]},
  { name: 'Ψηλά στον ουρανό', balls: 7, wind: 0, targets: [
    { type: 'bullseye', x: 430, y: 300, r: 40 },
    { type: 'bullseye', x: 330, y: 240, r: 40 },
    { type: 'can', x: 460, y: 620, r: 34 },
  ]},
  { name: 'Παγάκια', balls: 8, wind: 0, targets: [
    { type: 'ice', x: 380, y: 600, r: 40, hp: 2 },
    { type: 'ice', x: 460, y: 460, r: 40, hp: 2 },
    { type: 'star', x: 300, y: 300, r: 30 },
  ]},
  { name: 'Κινούμενοι στόχοι', balls: 8, wind: 0, targets: [
    { type: 'bullseye', x: 400, y: 500, r: 40, move: { axis: 'x', range: 90, speed: 1.2 } },
    { type: 'bullseye', x: 380, y: 320, r: 40, move: { axis: 'x', range: 120, speed: 1.6 } },
    { type: 'can', x: 470, y: 620, r: 34 },
  ]},
  { name: 'Αεράκι', balls: 8, wind: -140, targets: [
    { type: 'bullseye', x: 430, y: 560, r: 40 },
    { type: 'can', x: 330, y: 620, r: 34 },
    { type: 'star', x: 450, y: 320, r: 30 },
    { type: 'can', x: 400, y: 450, r: 34 },
  ]},
  { name: 'Πάνω κάτω', balls: 9, wind: 0, targets: [
    { type: 'ice', x: 420, y: 480, r: 40, hp: 2, move: { axis: 'y', range: 120, speed: 1.4 } },
    { type: 'bullseye', x: 320, y: 360, r: 36, move: { axis: 'y', range: 80, speed: 2.0 } },
    { type: 'can', x: 480, y: 620, r: 34 },
    { type: 'can', x: 260, y: 620, r: 34 },
  ]},
  { name: 'Χιονοθύελλα', balls: 9, wind: 170, targets: [
    { type: 'bullseye', x: 320, y: 520, r: 36, move: { axis: 'x', range: 60, speed: 2.2 } },
    { type: 'ice', x: 440, y: 400, r: 40, hp: 2 },
    { type: 'star', x: 380, y: 260, r: 28, move: { axis: 'x', range: 100, speed: 1.8 } },
    { type: 'can', x: 470, y: 620, r: 34 },
  ]},
  { name: 'Ακροβατικά', balls: 10, wind: -90, targets: [
    { type: 'ice', x: 380, y: 340, r: 36, hp: 2, move: { axis: 'x', range: 90, speed: 2.4 } },
    { type: 'bullseye', x: 470, y: 560, r: 34, move: { axis: 'y', range: 90, speed: 2.6 } },
    { type: 'can', x: 300, y: 620, r: 30 },
    { type: 'can', x: 360, y: 620, r: 30 },
    { type: 'star', x: 280, y: 240, r: 26 },
  ]},
  { name: 'Ο μεγάλος τελικός', balls: 11, wind: 120, targets: [
    { type: 'ice', x: 400, y: 300, r: 36, hp: 2, move: { axis: 'x', range: 80, speed: 2.8 } },
    { type: 'ice', x: 440, y: 480, r: 36, hp: 2, move: { axis: 'y', range: 70, speed: 2.2 } },
    { type: 'bullseye', x: 300, y: 500, r: 32, move: { axis: 'x', range: 50, speed: 3.0 } },
    { type: 'star', x: 250, y: 300, r: 26, move: { axis: 'y', range: 60, speed: 3.2 } },
    { type: 'can', x: 300, y: 630, r: 30 },
    { type: 'can', x: 420, y: 630, r: 30 },
  ]},
];

export const TOTAL_LEVELS = LEVELS.length; // 10

/**
 * Difficulty presets. Applied on top of every level at start.
 *  balls:    added/removed snowballs (never below 3)
 *  size:     target radius multiplier
 *  speed:    moving-target speed multiplier
 *  wind:     wind multiplier
 *  preview:  how many trajectory dots are shown while aiming (0 = none)
 *  score:    score multiplier
 */
export const DIFFICULTIES = {
  easy:   { label: 'Εύκολο',   icon: '🙂', balls: +2, size: 1.2,  speed: 0.75, wind: 0.5, preview: 14, score: 0.75 },
  normal: { label: 'Κανονικό', icon: '😀', balls:  0, size: 1.0,  speed: 1.0,  wind: 1.0, preview: 14, score: 1 },
  hard:   { label: 'Δύσκολο',  icon: '😈', balls: -2, size: 0.85, speed: 1.35, wind: 1.4, preview: 4,  score: 1.5 },
};
export const DEFAULT_DIFFICULTY = 'normal';
