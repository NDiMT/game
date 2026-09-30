// First-person weapon view models and the status-bar face.
//
// Weapons and gloved hands are small 3D models (boxes, cylinders, spheres)
// pre-rendered once with the software renderer in raster.js, then
// posterized and outlined. The face is sculpted as a height field (brow,
// eye sockets, nose, cheekbones, lips, chin), lit per pixel and quantized
// to an 8-tone skin ramp.

import { mulberry32 } from './art.js';
import { Scene, M, mat, render, toPixelCanvas } from './raster.js';

export const WEAPON_W = 240, WEAPON_H = 180;
export const FACE_W = 40, FACE_H = 46;
const CY = -0.12;
const FOCAL = 0.98; // horizon above the weapon strip: we look down onto the gun

// ---------------------------------------------------------------- helpers
// Cylinder from point a to point b (radius r0 -> r1), with optional joint balls.
function limb(s, a, b, r0, r1, mtl, { joints = true } = {}) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(d[0], d[1], d[2]);
  const rx = -Math.asin(d[1] / len), ry = Math.atan2(d[0], d[2]);
  s.group(mat(a, [rx, ry, 0]), () => s.cyl(0, 0, 0, len, r0, r1, mtl, { seg: 10, caps: false }));
  if (joints) { s.ball(a, r0 * 1.04, mtl, 8); s.ball(b, r1 * 1.04, mtl, 8); }
}

// Gloved hand gripping a handle whose axis is local +y, centered at the origin.
// The back of the hand sits on +x, fingers wrap around the front (+z) to -x,
// and the thumb rests on -x. The forearm leaves toward `elbow` (hand-local).
function hand(s, { elbow = [0.06, -0.16, -0.2], grip = 0.017, fingers = 4 } = {}) {
  const glove = M.cloth, armor = M.plate;
  const r = grip;
  // fingers
  for (let i = 0; i < fingers; i++) {
    const y = 0.028 - i * 0.02;
    const pts = [
      [r + 0.012, y, -0.006],
      [r + 0.01, y - 0.002, r + 0.012],
      [0, y - 0.004, r + 0.014],
      [-r - 0.006, y - 0.006, r * 0.6],
    ];
    const rad = i === fingers - 1 ? 0.0078 : 0.0088;
    for (let k = 0; k < 3; k++) limb(s, pts[k], pts[k + 1], rad, rad * 0.94, glove);
    // armored knuckle cap
    s.group(mat(pts[0], [0, 0.35, 0]), () => s.box([0.004, 0, 0], [0.012, 0.016, 0.018], armor, { bevel: 0.002 }));
    s.group(mat(pts[1], [0, 0.7, 0]), () => s.box([0.004, 0, 0], [0.008, 0.013, 0.012], armor, { bevel: 0.002 }));
  }
  // back of the hand
  s.group(mat([r + 0.018, -0.002, -0.022], [0, 0.25, 0]), () => {
    s.box([0, 0, 0], [0.026, 0.09, 0.06], glove, { bevel: 0.006 });
    s.box([0.012, 0.004, 0.002], [0.006, 0.07, 0.044], armor, { bevel: 0.003 });
    s.box([0.016, 0.004, 0.002], [0.003, 0.05, 0.012], M.hazard);
  });
  // thumb along the far side
  limb(s, [0.004, 0.03, -0.03], [-r - 0.006, 0.04, -0.008], 0.0105, 0.0095, glove);
  limb(s, [-r - 0.006, 0.04, -0.008], [-r - 0.004, 0.046, 0.022], 0.0095, 0.0085, glove);
  s.group(mat([-r - 0.008, 0.043, 0.006], [0, -0.3, 0]), () => s.box([-0.003, 0.003, 0], [0.008, 0.01, 0.02], armor, { bevel: 0.002 }));
  // wrist cuff and forearm
  const wrist = [r + 0.012, -0.05, -0.03];
  limb(s, [r + 0.014, -0.02, -0.028], wrist, 0.026, 0.024, glove, { joints: false });
  limb(s, wrist, [wrist[0] + (elbow[0] - wrist[0]) * 0.18, wrist[1] + (elbow[1] - wrist[1]) * 0.18, wrist[2] + (elbow[2] - wrist[2]) * 0.18], 0.029, 0.03, armor, { joints: false });
  limb(s, wrist, elbow, 0.026, 0.034, M.cloth, { joints: false });
}

function flash(g, x, y, r, color = [255, 190, 60]) {
  const cs = ([a, b, c], k = 1) => `rgba(${a},${b},${c},${k})`;
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + 0.3;
    const len = r * (1 + (i % 3) * 0.4);
    g.beginPath();
    g.moveTo(x + Math.cos(a - 0.14) * r * 0.3, y + Math.sin(a - 0.14) * r * 0.22);
    g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len * 0.62);
    g.lineTo(x + Math.cos(a + 0.14) * r * 0.3, y + Math.sin(a + 0.14) * r * 0.22);
    g.fillStyle = cs(color, 0.65);
    g.fill();
  }
  const rg = g.createRadialGradient(x, y, 0, x, y, r);
  rg.addColorStop(0, 'rgba(255,255,255,1)');
  rg.addColorStop(0.3, 'rgba(255,244,190,1)');
  rg.addColorStop(0.65, cs(color, 0.85));
  rg.addColorStop(1, cs(color, 0));
  g.fillStyle = rg;
  g.beginPath(); g.ellipse(x, y, r, r * 0.72, 0, 0, Math.PI * 2); g.fill();
  g.restore();
}

// ---------------------------------------------------------------- weapons
const MODELS = {
  pistol(s) {
    s.group(mat([0.022, -0.19, 0.3], [0, -0.05, 0]), () => {
      s.box([0, 0.028, 0.06], [0.029, 0.028, 0.19], M.gunmetal, { bevel: 0.004 });
      for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) s.box([sx * 0.0148, 0.028, -0.024 + i * 0.0065], [0.0012, 0.02, 0.0028], M.black);
      s.box([0.006, 0.0425, 0.07], [0.011, 0.0015, 0.03], M.black);
      s.box([0, 0.046, -0.027], [0.024, 0.008, 0.008], M.polymer, { bevel: 0.001 });
      for (const sx of [-1, 1]) s.box([sx * 0.0075, 0.047, -0.0315], [0.003, 0.003, 0.001], M.tritium);
      s.box([0, 0.0455, 0.146], [0.005, 0.007, 0.006], M.polymer);
      s.box([0, 0.047, 0.1425], [0.0025, 0.0025, 0.001], M.tritium);
      s.cyl(0, 0.024, 0.15, 0.159, 0.0066, 0.0066, M.steel, { capMtl: M.black });
      s.box([0, 0.005, 0.045], [0.027, 0.018, 0.15], M.polymer, { bevel: 0.002 });
      s.box([0, -0.012, 0.036], [0.018, 0.004, 0.05], M.polymer);
      s.box([0, -0.003, 0.06], [0.018, 0.018, 0.004], M.polymer);
      s.box([0, -0.004, 0.028], [0.004, 0.014, 0.006], M.steel);
      s.mark('muzzle', [0, 0.024, 0.165]);
      s.group(mat([0, -0.004, -0.014], [0.3, 0, 0]), () => {
        s.box([0, -0.052, 0], [0.03, 0.1, 0.045], M.polymer, { bevel: 0.004 });
        s.group(mat([0, -0.03, 0]), () => hand(s, { elbow: [0.07, -0.2, -0.16] }));
      });
    });
  },

  shotgun(s) {
    s.group(mat([0.022, -0.205, 0.31], [0, -0.04, 0]), () => {
      s.box([0, 0.02, -0.02], [0.046, 0.056, 0.2], M.blued, { bevel: 0.005 });
      s.box([0.0235, 0.03, 0.0], [0.002, 0.018, 0.05], M.black);
      s.box([0.021, 0.03, 0.0], [0.004, 0.012, 0.032], M.red);
      s.box([0.021, 0.03, -0.018], [0.004, 0.012, 0.004], M.brass);
      s.cyl(0, 0.037, 0.08, 0.47, 0.0115, 0.0105, M.blued, { capMtl: M.black });
      s.cyl(0, 0.012, 0.08, 0.42, 0.0098, 0.0098, M.blued);
      s.cyl(0, 0.012, 0.2, 0.37, 0.021, 0.02, M.wood);
      for (let i = 0; i < 7; i++) s.cyl(0, 0.012, 0.215 + i * 0.021, 0.219 + i * 0.021, 0.0214, 0.0214, M.leather, { caps: false });
      s.ball([0, 0.05, 0.455], 0.003, M.steel, 6);
      s.mark('muzzle', [0, 0.037, 0.48]);
      s.group(mat([0, -0.006, -0.1], [0.42, 0, 0]), () => {
        s.box([0, -0.055, 0], [0.034, 0.11, 0.05], M.wood, { bevel: 0.005 });
        s.group(mat([0, -0.03, 0]), () => hand(s, { elbow: [0.07, -0.2, -0.12] }));
      });
      // left hand under the pump: grip axis along +z, mirrored
    });
  },

  chaingun(s) {
    s.group(mat([0.0, -0.2, 0.33], [0, 0, 0]), () => {
      const cy = 0.035;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.26;
        s.cyl(Math.cos(a) * 0.021, cy + Math.sin(a) * 0.021, 0.05, 0.55, 0.0074, 0.0074, M.steel, { capMtl: M.black, seg: 12 });
      }
      s.cyl(0, cy, 0.05, 0.54, 0.008, 0.008, M.gunmetal, { seg: 10 });
      s.cyl(0, cy, -0.03, 0.08, 0.031, 0.031, M.gunmetal, { capMtl: M.plate });
      s.cyl(0, cy, -0.036, -0.03, 0.014, 0.014, M.steel);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; s.ball([Math.cos(a) * 0.023, cy + Math.sin(a) * 0.023, -0.031], 0.003, M.steel, 6); }
      for (const z of [0.28, 0.46]) s.cyl(0, cy, z, z + 0.018, 0.033, 0.033, M.gunmetal);
      s.box([0, -0.02, -0.09], [0.1, 0.06, 0.17], M.olive, { bevel: 0.008 });
      for (let i = 0; i < 5; i++) s.box([-0.03 + i * 0.015, 0.0105, -0.08], [0.006, 0.002, 0.08], M.black);
      s.box([0, -0.004, -0.02], [0.102, 0.004, 0.02], M.hazard);
      for (let i = 0; i < 6; i++) s.group(mat([0.06 + i * 0.012, -0.02 - i * 0.012, -0.06], [0, 0, 0.5]), () => s.box([0, 0, 0], [0.008, 0.014, 0.03], M.brass, { bevel: 0.002 }));
      s.mark('muzzle', [0, cy, 0.56]);
      for (const side of [-1, 1]) {
        s.box([side * 0.068, -0.045, -0.07], [0.022, 0.075, 0.026], M.polymer, { bevel: 0.003 });
        s.group(mat([side * 0.068, -0.045, -0.07], [0, 0, 0], [side, 1, 1]), () => hand(s, { grip: 0.013, elbow: [0.1, -0.2, -0.15] }));
      }
    });
  },

  plasma(s) {
    s.group(mat([0.0, -0.2, 0.32], [0, 0, 0]), () => {
      s.box([0, 0, 0.04], [0.075, 0.05, 0.3], M.sciblue, { bevel: 0.009 });
      s.box([0, 0.031, 0.06], [0.032, 0.018, 0.28], M.sciblue, { bevel: 0.005 });
      s.box([0, 0.0405, 0.06], [0.01, 0.002, 0.26], M.glowBlue);
      for (let i = 0; i < 4; i++) s.box([0, 0.0395, -0.06 + i * 0.07], [0.02, 0.004, 0.006], M.steel);
      for (const z of [-0.02, 0.06, 0.14]) {
        s.cyl(0, 0, z, z + 0.014, 0.043, 0.043, M.steel);
        s.cyl(0, 0, z + 0.014, z + 0.018, 0.044, 0.044, M.glowBlue);
      }
      for (let i = 0; i < 5; i++) for (const sx of [-1, 1]) s.box([sx * 0.0385, -0.008, -0.08 + i * 0.022], [0.002, 0.02, 0.01], M.black);
      s.cyl(0, 0, 0.19, 0.27, 0.03, 0.022, M.steel, { capMtl: M.glowWhite });
      s.cyl(0, 0, 0.27, 0.272, 0.024, 0.024, M.glowBlue);
      s.box([-0.02, -0.02, -0.12], [0.012, 0.006, 0.012], M.glowGreen);
      s.mark('muzzle', [0, 0, 0.28]);
      for (const side of [-1, 1]) {
        s.box([side * 0.05, -0.05, -0.06], [0.02, 0.07, 0.026], M.polymer, { bevel: 0.003 });
        s.group(mat([side * 0.05, -0.05, -0.06], [0, 0, 0], [side, 1, 1]), () => hand(s, { grip: 0.013, elbow: [0.1, -0.2, -0.15] }));
      }
    });
  },

  rocket(s) {
    s.group(mat([0.03, -0.225, 0.38], [0, -0.03, 0]), () => {
      s.cyl(0, 0.025, -0.06, 0.45, 0.056, 0.056, M.olive, { caps: false, seg: 28 });
      s.cyl(0, 0.025, -0.075, -0.06, 0.05, 0.05, M.gunmetal, { seg: 28, capMtl: M.plate });
      s.cyl(0, 0.025, -0.085, -0.075, 0.018, 0.018, M.steel, { seg: 16 });
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; s.ball([Math.cos(a) * 0.04, 0.025 + Math.sin(a) * 0.04, -0.076], 0.0035, M.steel, 6); }
      s.box([0, 0.025, -0.078], [0.07, 0.006, 0.004], M.hazard);
      s.cyl(0, 0.025, 0.25, 0.45, 0.05, 0.05, M.black, { caps: false, seg: 20 });
      s.cyl(0, 0.025, 0.36, 0.43, 0.032, 0.0, M.red, { caps: false, seg: 16 });
      s.cyl(0, 0.025, 0.43, 0.45, 0.06, 0.06, M.gunmetal, { caps: false, seg: 28 });
      for (const z of [0.06, 0.3]) s.cyl(0, 0.025, z, z + 0.03, 0.058, 0.058, M.hazard, { caps: false, seg: 28 });
      for (const z of [0.073, 0.313]) s.cyl(0, 0.025, z, z + 0.004, 0.059, 0.059, M.black, { caps: false, seg: 28 });
      s.box([-0.052, 0.09, 0.1], [0.022, 0.026, 0.09], M.polymer, { bevel: 0.003 });
      s.box([-0.052, 0.09, 0.056], [0.01, 0.008, 0.002], M.glowRed);
      s.box([0, -0.04, 0.02], [0.03, 0.03, 0.08], M.polymer, { bevel: 0.003 });
      s.mark('muzzle', [0, 0.025, 0.46]);
      s.group(mat([0, -0.07, -0.0], [0.3, 0, 0]), () => {
        s.box([0, -0.03, 0], [0.03, 0.08, 0.045], M.polymer, { bevel: 0.004 });
        s.group(mat([0, -0.02, 0]), () => hand(s, { elbow: [0.07, -0.2, -0.14] }));
      });
      s.group(mat([-0.05, -0.03, 0.22], [0, 0, 0.6], [-1, 1, 1]), () => hand(s, { grip: 0.016, elbow: [0.1, -0.2, -0.2] }));
    });
  },
};

export function buildWeapons(ids) {
  const out = {};
  for (const id of ids) {
    const s = new Scene();
    s.marks = {};
    s.mark = function (name, p) {
      const m = this.m;
      this.marks[name] = [0, 1, 2].map((i) => m.r[i][0] * p[0] + m.r[i][1] * p[1] + m.r[i][2] * p[2] + m.t[i]);
    };
    MODELS[id](s);
    const img = render(s, WEAPON_W, WEAPON_H, { focal: FOCAL, cx: 0.5, cy: CY });
    const idle = toPixelCanvas(img, { levels: 14 });
    // Firing frame: same model plus a muzzle flash at the projected muzzle.
    const fireC = document.createElement('canvas');
    fireC.width = WEAPON_W; fireC.height = WEAPON_H;
    const g = fireC.getContext('2d');
    const mz = s.marks.muzzle;
    const f = FOCAL * WEAPON_W;
    const mx = WEAPON_W * 0.5 + (f * mz[0]) / mz[2], my = WEAPON_H * CY - (f * mz[1]) / mz[2];
    g.drawImage(idle, 0, 0);
    const color = id === 'plasma' ? [90, 170, 255] : [255, 180, 50];
    flash(g, mx, my, id === 'pistol' ? 25 : id === 'chaingun' ? 28 : 35, color);
    g.drawImage(idle, 0, 0); // gun stays in front of the flash
    flash(g, mx, my - 2, id === 'pistol' ? 14 : 19, color);
    out[id] = [idle, fireC];
  }
  return out;
}

// ---------------------------------------------------------------- face
const SKIN = [[46, 24, 18], [78, 44, 30], [110, 66, 44], [142, 90, 60], [172, 116, 80], [200, 142, 102], [224, 168, 126], [244, 196, 158]];
const HAIR = [[22, 14, 8], [44, 28, 16], [68, 46, 26], [96, 68, 40]];
const ARMOR = [[20, 38, 18], [36, 64, 30], [56, 96, 46], [84, 134, 66], [120, 172, 94]];

const gauss = (x, y, cx, cy, sx, sy, amp) => amp * Math.exp(-(((x - cx) ** 2) / (2 * sx * sx) + ((y - cy) ** 2) / (2 * sy * sy)));

function halfWidth(y) {
  if (y < 3) return 0;
  if (y < 18) return 12.8 * Math.sqrt(Math.max(0, 1 - ((18 - y) / 15.5) ** 2));
  if (y < 27) return 12.8 - (y - 18) * 0.06;
  if (y <= 38.5) { const t = (y - 27) / 11.5; return 12.3 - Math.pow(t, 1.7) * 7.4; }
  return 0;
}

function heightAt(x, y, grin) {
  const w = halfWidth(y);
  if (w <= 0) return -1;
  const dx = (x - 20) / w;
  if (Math.abs(dx) > 1) return -1;
  let h = Math.sqrt(1 - dx * dx) * 9;
  if (y < 12) h -= ((12 - y) / 9) ** 2 * 3;
  h += gauss(x, y, 20, 16, 9, 1.4, 1.5);
  h += gauss(x, y, 14.5, 20.2, 2.8, 1.8, -2.1) + gauss(x, y, 25.5, 20.2, 2.8, 1.8, -2.1);
  h += gauss(x, y, 20, 22.5, 1.2, 4.2, 2.3) + gauss(x, y, 20, 27, 2.1, 1.5, 1.4);
  h += gauss(x, y, 17.6, 28, 1.1, 0.9, 0.6) + gauss(x, y, 22.4, 28, 1.1, 0.9, 0.6);
  h += gauss(x, y, 20, 29.6, 2.4, 0.7, -0.5);
  h += gauss(x, y, 12.2, 24.5, 2.8, 1.8, 1.0) + gauss(x, y, 27.8, 24.5, 2.8, 1.8, 1.0);
  h += gauss(x, y, 12.8, 29.5, 2.2, 2.4, -0.7) + gauss(x, y, 27.2, 29.5, 2.2, 2.4, -0.7);
  h += gauss(x, y, 20, 31.4, 4.2, 0.8, 0.5) + gauss(x, y, 20, 33.6, 3.6, 0.9, 0.75);
  h += gauss(x, y, 20, 32.5, 4.6, 0.35, grin ? -0.2 : -0.6);
  h += gauss(x, y, 20, 36.6, 3.8, 1.8, 1.2);
  h += gauss(x, y, 9.5, 33, 1.8, 3, 0.5) + gauss(x, y, 30.5, 33, 1.8, 3, 0.5);
  return h;
}

// look: -1 left, 0 center, 1 right, 2 ouch. level: 0 healthy .. 3 near death.
function face(level, look, grin) {
  const c = document.createElement('canvas');
  c.width = FACE_W; c.height = FACE_H;
  const g = c.getContext('2d');
  const img = g.createImageData(FACE_W, FACE_H);
  const d = img.data;
  const rng = mulberry32(level * 13 + (look + 1) * 3 + (grin ? 50 : 0));
  const tone = new Int8Array(FACE_W * FACE_H).fill(-1);
  const put = (x, y, col) => {
    if (x < 0 || y < 0 || x >= FACE_W || y >= FACE_H) return;
    const i = (y * FACE_W + x) * 4;
    d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
  };
  const setTone = (x, y, k) => {
    if (x < 0 || y < 0 || x >= FACE_W || y >= FACE_H) return;
    k = Math.max(0, Math.min(7, k));
    tone[y * FACE_W + x] = k;
    put(x, y, SKIN[k]);
  };
  const shift = (x, y, dk) => { const t = tone[y * FACE_W + x]; if (t >= 0) setTone(x, y, t + dk); };
  const L = [-0.5, -0.62, 0.6];
  const lightAt = (x, y) => {
    const h = heightAt(x + 0.5, y + 0.5, grin);
    const hx = heightAt(x + 1.5, y + 0.5, grin), hx0 = heightAt(x - 0.5, y + 0.5, grin);
    const hy = heightAt(x + 0.5, y + 1.5, grin), hy0 = heightAt(x + 0.5, y - 0.5, grin);
    const gx = ((hx < 0 ? h - 3 : hx) - (hx0 < 0 ? h - 3 : hx0)) / 2;
    const gy = ((hy < 0 ? h - 3 : hy) - (hy0 < 0 ? h - 3 : hy0)) / 2;
    const n = [-gx, -gy, 1.4];
    const l = Math.hypot(n[0], n[1], n[2]);
    n[0] /= l; n[1] /= l; n[2] /= l;
    const dif = Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
    const rim = Math.pow(1 - n[2], 2) * Math.max(0, n[0]) * 0.9;
    return 0.16 + dif * 0.92 + rim * 0.35;
  };

  // Neck (behind the head)
  for (let y = 33; y < FACE_H; y++)
    for (let x = 12; x < 28; x++) {
      const k = Math.round((0.35 + (1 - Math.abs(x - 17) / 10) * 0.3 - (y < 39 ? 0.18 : 0)) * 7);
      setTone(x, y, k);
    }
  // Ears
  for (const [ex, dir] of [[7, -1], [33, 1]])
    for (let y = 19; y < 28; y++)
      for (let k = 0; k < 3; k++) {
        const x = ex + dir * k;
        if (k === 2 && (y < 21 || y > 25)) continue;
        setTone(x, y, dir < 0 ? 4 - k : 3 - k);
      }
  // Head
  for (let y = 0; y < FACE_H; y++)
    for (let x = 0; x < FACE_W; x++) {
      if (heightAt(x + 0.5, y + 0.5, grin) < 0) continue;
      const v = lightAt(x, y) + (rng() - 0.5) * 0.05;
      setTone(x, y, Math.round(v * 7.2));
    }

  // Hair: short crop, lit from the upper left
  for (let y = 0; y < 16; y++)
    for (let x = 5; x < 36; x++) {
      if (tone[y * FACE_W + x] < 0) continue;
      const hairline = 7.5 + Math.abs(x - 20) * 0.16 - (Math.abs(x - 20) < 4 ? 0.8 : 0);
      const side = (x < 9 || x > 31) && y < 17;
      if (y > hairline && !side) continue;
      const lit = lightAt(x, y);
      const k = Math.max(0, Math.min(3, Math.round(lit * 2.6 + (rng() - 0.5) * 1.2)));
      put(x, y, HAIR[k]);
      tone[y * FACE_W + x] = -2;
    }

  // Brows: heavy, angled down toward the nose when hurt
  const angry = level >= 2 || look === 2 ? 1 : 0;
  for (let i = 0; i < 8; i++) {
    const dy = i >= 5 ? angry : 0;
    for (const x of [10 + i, 30 - i]) { put(x, 16 + dy, HAIR[0]); put(x, 17 + dy, HAIR[1]); }
  }
  // Eyes
  const ex = look === 2 ? 0 : look;
  for (const [x0, swollen] of [[12, level >= 3], [23, false]]) {
    for (let x = 0; x < 6; x++) shift(x0 + x, 19, -2);
    const rows = swollen ? 1 : look === 2 ? 3 : 2;
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < 6; x++) {
        if ((x === 0 || x === 5) && y === rows - 1 && rows > 1) continue;
        put(x0 + x, 20 + y, y === 0 ? [206, 198, 190] : [238, 232, 224]);
      }
    if (look !== 2 && !swollen) {
      const ix = x0 + 2 + ex;
      put(ix, 20, [34, 58, 108]); put(ix + 1, 20, [52, 88, 150]);
      put(ix, 21, [18, 26, 50]); put(ix + 1, 21, [44, 76, 140]);
      put(ix + 1, 20, [200, 220, 255]);
    } else if (look === 2) {
      put(x0 + 2, 21, [20, 16, 16]); put(x0 + 3, 21, [20, 16, 16]);
    }
    for (let x = 0; x < 6; x++) shift(x0 + x, 20 + rows, -1);
  }
  // Stubble dither on the jaw, chin and upper lip
  for (let y = 29; y < 39; y++)
    for (let x = 9; x < 32; x++) {
      if (tone[y * FACE_W + x] < 0) continue;
      const lip = y >= 31 && y <= 34 && Math.abs(x - 20) < 5;
      if (lip) continue;
      if ((x + y) % 2 === 0 && rng() < 0.6) shift(x, y, -1);
    }
  // Mouth
  if (look === 2) {
    for (let y = 30; y < 36; y++) for (let x = 17; x < 24; x++) {
      const edge = y === 30 || y === 35 || x === 17 || x === 23;
      put(x, y, edge ? SKIN[1] : y === 31 ? [220, 214, 200] : [36, 8, 8]);
    }
  } else if (level >= 2) {
    for (let x = 14; x < 27; x++) { put(x, 31, SKIN[1]); put(x, 32, x % 2 ? [226, 220, 206] : [190, 182, 168]); put(x, 33, SKIN[1]); }
  } else if (grin) {
    for (let x = 14; x < 27; x++) {
      const lift = x < 16 || x > 24 ? -1 : 0;
      put(x, 31 + lift, SKIN[1]); if (x > 15 && x < 25) put(x, 32, [232, 226, 212]); put(x, 33, SKIN[2]);
    }
  } else {
    for (let x = 15; x < 26; x++) put(x, 32, SKIN[1]);
    put(14, 31, SKIN[2]); put(26, 31, SKIN[2]);
  }

  // Armor collar and shoulder plates
  for (let y = 38; y < FACE_H; y++)
    for (let x = 0; x < FACE_W; x++) {
      const collar = y >= 40 && Math.abs(x - 20) < 11 + (y - 40) * 1.2;
      const pad = y >= 39 && (x < 9 || x > 31) && Math.abs(x - 20) < 20;
      if (!collar && !pad) continue;
      let k = 2;
      if (y === 40 || (pad && y === 39)) k = 4;
      else if (y === 41) k = 3;
      if (x < 6 || x > 34) k -= 1;
      if (Math.abs(x - 20) < 4 && y > 41) k = 1;
      put(x, y, ARMOR[Math.max(0, k)]);
    }
  for (const x of [9, 31]) for (let y = 40; y < FACE_H; y++) put(x, y, ARMOR[0]);

  // Damage
  const blood = [[110, 6, 6], [160, 14, 12], [80, 2, 2]];
  if (level >= 1) { put(27, 11, blood[1]); put(28, 12, blood[0]); put(12, 27, blood[0]); put(13, 28, blood[2]); }
  if (level >= 2) {
    for (let y = 10; y < 23; y++) put(26 + (((y / 4) | 0) % 2), y, blood[y % 2]);
    for (let y = 22; y < 26; y++) for (let x = 11; x < 17; x++) if (rng() < 0.5) put(x, y, [110, 62, 104]);
  }
  if (level >= 3) {
    for (let i = 0; i < 36; i++) put(8 + ((rng() * 24) | 0), 5 + ((rng() * 32) | 0), blood[(rng() * 3) | 0]);
    for (let y = 30; y < 40; y++) put(24, y, blood[1]);
  }

  g.putImageData(img, 0, 0);
  // Outline
  const src = g.getImageData(0, 0, FACE_W, FACE_H);
  const a = (x, y) => (x < 0 || y < 0 || x >= FACE_W || y >= FACE_H ? 0 : src.data[(y * FACE_W + x) * 4 + 3]);
  const out = new Uint8ClampedArray(src.data);
  for (let y = 0; y < FACE_H; y++)
    for (let x = 0; x < FACE_W; x++) {
      const i = (y * FACE_W + x) * 4;
      if (src.data[i + 3]) continue;
      if (a(x - 1, y) || a(x + 1, y) || a(x, y - 1) || a(x, y + 1)) { out[i] = 10; out[i + 1] = 6; out[i + 2] = 4; out[i + 3] = 255; }
    }
  g.putImageData(new ImageData(out, FACE_W, FACE_H), 0, 0);
  return c;
}

// faces[level][look + 1] (look 2 = ouch); faces.grin[level] after a pickup.
export function buildFaces() {
  const faces = [];
  for (let level = 0; level < 4; level++) faces.push([-1, 0, 1, 2].map((look) => face(level, look, false)));
  faces.grin = [0, 1, 2, 3].map((level) => face(level, 0, true));
  return faces;
}
