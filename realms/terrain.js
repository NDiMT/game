// =====================================================================
// HEX REALMS terrain: painterly procedural ground textures (one texture
// array, 13 layers of 256²), the bevelled hex planet surface with cliff
// strata, cobbled roads, fog of war, and animated water with depth colour,
// shore foam and sun glints.
// =====================================================================
import * as THREE from 'three';

export const LAYER = { SEABED: 0, GRASS: 1, DIRT: 2, SAND: 3, SNOW: 4, SWAMP: 5, ROUGH: 6, LAVA: 7, MOUNT: 8, FOREST: 9, ROAD: 10, CLIFF: 11, FOG: 12 };
const NLAYERS = 13;
const S = 256;

// ------------------------------------------------------------------ small helpers
function mulberry(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
function lhash(i, j, seed) {
  let n = Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(seed, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
// tileable value noise on a lattice of period p
function vnoise(x, y, p, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const x0 = ((xi % p) + p) % p, y0 = ((yi % p) + p) % p, x1 = (x0 + 1) % p, y1 = (y0 + 1) % p;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  return lerp(lerp(lhash(x0, y0, seed), lhash(x1, y0, seed), sx), lerp(lhash(x0, y1, seed), lhash(x1, y1, seed), sx), sy);
}
// a tileable fbm field over the tile, roughly 0..1
function fbm(seed, base = 4, oct = 4, gain = 0.5) {
  const f = new Float32Array(S * S);
  let norm = 0;
  for (let o = 0, a = 1; o < oct; o++, a *= gain) norm += a;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let s = 0, a = 1, p = base;
    for (let o = 0; o < oct; o++) { s += a * vnoise((x / S) * p, (y / S) * p, p, seed + o * 31); a *= gain; p *= 2; }
    f[y * S + x] = s / norm;
  }
  // stretch the contrast to roughly 0..1
  let lo = 1, hi = 0;
  for (let i = 0; i < f.length; i++) { if (f[i] < lo) lo = f[i]; if (f[i] > hi) hi = f[i]; }
  for (let i = 0; i < f.length; i++) f[i] = (f[i] - lo) / (hi - lo);
  return f;
}
// tileable voronoi: F1, F2 (in cell units), cell id and offset to the feature point
function voronoi(n, seed, jitter = 0.85) {
  const r = mulberry(seed), px = new Float32Array(n * n), py = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) { px[i] = 0.5 + (r() - 0.5) * jitter; py[i] = 0.5 + (r() - 0.5) * jitter; }
  const F1 = new Float32Array(S * S), F2 = new Float32Array(S * S), ID = new Int32Array(S * S), DX = new Float32Array(S * S), DY = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = (x / S) * n, v = (y / S) * n, cx = Math.floor(u), cy = Math.floor(v);
    let f1 = 9, f2 = 9, id = 0, dx = 0, dy = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const gx = cx + i, gy = cy + j, wx = ((gx % n) + n) % n, wy = ((gy % n) + n) % n, k = wy * n + wx;
      const ox = gx + px[k] - u, oy = gy + py[k] - v, d = Math.sqrt(ox * ox + oy * oy);
      if (d < f1) { f2 = f1; f1 = d; id = k; dx = ox; dy = oy; } else if (d < f2) f2 = d;
    }
    const q = y * S + x;
    F1[q] = f1; F2[q] = f2; ID[q] = id; DX[q] = dx; DY[q] = dy;
  }
  return { F1, F2, ID, DX, DY };
}

// one layer: per-pixel base, then canvas strokes (drawn wrapped so the tile repeats), then a glow mask in alpha
function paintLayer(ctx, base, strokes, glowFn) {
  const img = ctx.createImageData(S, S), d = img.data;
  const glow = new Float32Array(S * S);
  const set = (q, r, g, b) => { d[q * 4] = r; d[q * 4 + 1] = g; d[q * 4 + 2] = b; d[q * 4 + 3] = 255; };
  for (let q = 0; q < S * S; q++) base(q, q % S, (q / S) | 0, set, glow);
  ctx.putImageData(img, 0, 0);
  if (strokes) {
    const wrap = (x, y, m, fn) => {
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const X = x + i * S, Y = y + j * S;
        if (X < -m || X > S + m || Y < -m || Y > S + m) continue;
        fn(X, Y);
      }
    };
    strokes(ctx, wrap, glow);
  }
  const out = ctx.getImageData(0, 0, S, S).data;
  if (glowFn) glowFn(out, glow);
  for (let q = 0; q < S * S; q++) out[q * 4 + 3] = Math.round(clamp01(glow[q]) * 255);
  return out;
}
const rgb = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

function pebbles(ctx, wrap, r, n, rmin, rmax, cols, shadow = 0.45) {
  for (let i = 0; i < n; i++) {
    const x = r() * S, y = r() * S, rad = rmin + r() * (rmax - rmin), ry = rad * (0.6 + r() * 0.35), ang = r() * Math.PI;
    const c = cols[(r() * cols.length) | 0], k = 0.85 + r() * 0.3;
    wrap(x, y, rmax + 3, (X, Y) => {
      ctx.fillStyle = `rgba(20,14,8,${shadow})`; ctx.beginPath(); ctx.ellipse(X + 1.1, Y + 1.3, rad * 1.05, ry * 1.05, ang, 0, 6.283); ctx.fill();
      ctx.fillStyle = rgb([c[0] * k, c[1] * k, c[2] * k]); ctx.beginPath(); ctx.ellipse(X, Y, rad, ry, ang, 0, 6.283); ctx.fill();
      ctx.fillStyle = 'rgba(255,250,235,0.38)'; ctx.beginPath(); ctx.ellipse(X - rad * 0.3, Y - ry * 0.35, rad * 0.45, ry * 0.4, ang, 0, 6.283); ctx.fill();
    });
  }
}
function cracks(ctx, wrap, r, n, steps, col, light, width = 1.2) {
  for (let i = 0; i < n; i++) {
    let x = r() * S, y = r() * S, a = r() * 6.283;
    const pts = [[x, y]];
    const len = steps * (0.5 + r());
    for (let s = 0; s < len; s++) { a += (r() - 0.5) * 0.9; x += Math.cos(a) * 3; y += Math.sin(a) * 3; pts.push([x, y]); if (r() < 0.05) a += (r() - 0.5) * 2.5; }
    const x0 = pts[0][0], y0 = pts[0][1];
    wrap(x0, y0, len * 3 + 4, (X, Y) => {
      const ox = X - x0, oy = Y - y0;
      if (light) { ctx.strokeStyle = light; ctx.lineWidth = width; ctx.beginPath(); pts.forEach(([px, py], k) => (k ? ctx.lineTo(px + ox + 0.9, py + oy + 0.9) : ctx.moveTo(px + ox + 0.9, py + oy + 0.9))); ctx.stroke(); }
      ctx.strokeStyle = col; ctx.lineWidth = width; ctx.beginPath(); pts.forEach(([px, py], k) => (k ? ctx.lineTo(px + ox, py + oy) : ctx.moveTo(px + ox, py + oy))); ctx.stroke();
    });
  }
}

// ------------------------------------------------------------------ the painters
const PAINT = [];
// 0 seabed: pale sand with weed and stones (seen through the water)
PAINT[LAYER.SEABED] = (ctx) => {
  const n1 = fbm(11, 4, 4), n2 = fbm(12, 8, 3), r = mulberry(13);
  return paintLayer(ctx, (q, x, y, set) => {
    const rip = 0.5 + 0.5 * Math.sin(6.283 * (y / S * 7 + x / S * 2 + n2[q] * 1.2));
    let c = mixc([150, 150, 112], [206, 196, 146], n1[q]);
    c = mixc(c, [92, 120, 80], sstep(0.6, 0.85, n2[q]) * 0.7);
    const k = 0.9 + rip * 0.14 + (lhash(x, y, 5) - 0.5) * 0.08;
    set(q, c[0] * k, c[1] * k, c[2] * k);
  }, (ctx, wrap) => {
    pebbles(ctx, wrap, r, 40, 1.5, 4, [[140, 134, 120], [120, 116, 104], [170, 160, 140]], 0.3);
    for (let i = 0; i < 40; i++) {
      const x = r() * S, y = r() * S, a = -1.57 + (r() - 0.5) * 1.2, l = 5 + r() * 7;
      wrap(x, y, 14, (X, Y) => { ctx.strokeStyle = rgba([60, 110, 60], 0.7); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(X, Y); ctx.quadraticCurveTo(X + 3, Y - l / 2, X + Math.cos(a) * l, Y + Math.sin(a) * l); ctx.stroke(); });
    }
  });
};
// 1 grass: blades, clover and wild flowers
PAINT[LAYER.GRASS] = (ctx) => {
  const n1 = fbm(21, 4, 4), n2 = fbm(22, 3, 3), r = mulberry(23);
  return paintLayer(ctx, (q, x, y, set) => {
    let c = mixc([50, 108, 30], [112, 176, 52], n1[q]);
    c = mixc(c, [150, 172, 58], sstep(0.62, 0.9, n2[q]) * 0.55);
    const k = 0.92 + lhash(x, y, 7) * 0.14;
    set(q, c[0] * k, c[1] * k, c[2] * k);
  }, (ctx, wrap) => {
    ctx.lineCap = 'round';
    for (let i = 0; i < 3400; i++) {
      const x = r() * S, y = r() * S, l = 3 + r() * 5, a = -1.57 + (r() - 0.5) * 1.3, hh = 78 + r() * 34, li = 20 + r() * 34;
      wrap(x, y, 9, (X, Y) => { ctx.strokeStyle = `hsl(${hh},${48 + r() * 22}%,${li}%)`; ctx.lineWidth = 0.8 + r() * 0.8; ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X + Math.cos(a) * l, Y + Math.sin(a) * l); ctx.stroke(); });
    }
    for (let i = 0; i < 26; i++) {
      const x = r() * S, y = r() * S, rot = r() * 6.28, s = 1.8 + r() * 0.8;
      wrap(x, y, 8, (X, Y) => {
        for (let p = 0; p < 3; p++) {
          const a = rot + p * 2.094;
          ctx.fillStyle = 'rgba(20,50,16,0.5)'; ctx.beginPath(); ctx.arc(X + Math.cos(a) * s + 0.8, Y + Math.sin(a) * s + 0.8, s, 0, 6.283); ctx.fill();
          ctx.fillStyle = 'rgb(46,118,52)'; ctx.beginPath(); ctx.arc(X + Math.cos(a) * s, Y + Math.sin(a) * s, s, 0, 6.283); ctx.fill();
          ctx.fillStyle = 'rgba(170,220,150,0.5)'; ctx.beginPath(); ctx.arc(X + Math.cos(a) * s * 1.1, Y + Math.sin(a) * s * 1.1, s * 0.35, 0, 6.283); ctx.fill();
        }
      });
    }
    const petals = [[255, 255, 245], [255, 226, 60], [250, 140, 190], [150, 180, 255], [200, 130, 240], [255, 120, 80]];
    for (let i = 0; i < 70; i++) {
      const x = r() * S, y = r() * S, c = petals[(r() * petals.length) | 0], s = 1.1 + r() * 0.9;
      wrap(x, y, 6, (X, Y) => {
        ctx.fillStyle = 'rgba(16,40,10,0.45)'; ctx.beginPath(); ctx.arc(X + 1, Y + 1.2, s * 1.9, 0, 6.283); ctx.fill();
        ctx.fillStyle = rgb(c);
        for (let p = 0; p < 5; p++) { const a = p * 1.2566; ctx.beginPath(); ctx.arc(X + Math.cos(a) * s, Y + Math.sin(a) * s, s * 0.8, 0, 6.283); ctx.fill(); }
        ctx.fillStyle = 'rgb(255,200,40)'; ctx.beginPath(); ctx.arc(X, Y, s * 0.55, 0, 6.283); ctx.fill();
      });
    }
  });
};
// 2 dirt: earthy browns, cracks and pebbles
PAINT[LAYER.DIRT] = (ctx) => {
  const n1 = fbm(31, 4, 4), n2 = fbm(32, 10, 2), r = mulberry(33);
  return paintLayer(ctx, (q, x, y, set) => {
    let c = mixc([112, 78, 44], [170, 130, 82], n1[q]);
    c = mixc(c, [92, 62, 36], sstep(0.55, 0.85, n2[q]) * 0.5);
    const k = 0.9 + lhash(x, y, 9) * 0.18;
    set(q, c[0] * k, c[1] * k, c[2] * k);
  }, (ctx, wrap) => {
    cracks(ctx, wrap, r, 12, 18, 'rgba(58,36,20,0.85)', 'rgba(214,180,130,0.35)', 1.3);
    pebbles(ctx, wrap, r, 110, 1.4, 3.8, [[150, 130, 110], [120, 100, 80], [176, 160, 136], [130, 118, 106]]);
    for (let i = 0; i < 500; i++) { const x = r() * S, y = r() * S; ctx.fillStyle = r() < 0.5 ? 'rgba(60,40,20,0.5)' : 'rgba(220,190,140,0.4)'; ctx.fillRect(x, y, 1.2, 1.2); }
  });
};
// 3 sand: warm dunes with wind ripples
PAINT[LAYER.SAND] = (ctx) => {
  const n1 = fbm(41, 4, 4), w = fbm(42, 3, 3), r = mulberry(43);
  return paintLayer(ctx, (q, x, y, set) => {
    const ph = y / S * 11 + x / S * 2 + w[q] * 2.2;
    const s = Math.sin(6.283 * ph), rip = s > 0 ? Math.pow(s, 3) : s * 0.4;
    const c = mixc([214, 182, 116], [244, 218, 150], n1[q]);
    const k = 0.95 + rip * 0.09 + (lhash(x, y, 11) - 0.5) * 0.1;
    set(q, c[0] * k, c[1] * k, c[2] * k);
  }, (ctx, wrap) => {
    for (let i = 0; i < 900; i++) { const x = r() * S, y = r() * S; ctx.fillStyle = r() < 0.5 ? 'rgba(150,110,60,0.45)' : 'rgba(255,245,215,0.6)'; ctx.fillRect(x, y, 1, 1); }
    pebbles(ctx, wrap, r, 10, 1.2, 2.6, [[230, 220, 200], [190, 160, 130]], 0.25);
    for (let i = 0; i < 6; i++) {
      const x = r() * S, y = r() * S;
      wrap(x, y, 5, (X, Y) => { ctx.fillStyle = 'rgba(250,230,220,0.95)'; ctx.beginPath(); ctx.arc(X, Y, 2.2, 3.14, 6.283); ctx.fill(); ctx.strokeStyle = 'rgba(200,140,120,0.8)'; ctx.lineWidth = 0.6; for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X + k * 1.8, Y - 1.8); ctx.stroke(); } });
    }
  });
};
// 4 snow: drifts, blue shadows and sparkles
PAINT[LAYER.SNOW] = (ctx) => {
  const n1 = fbm(51, 3, 4), w = fbm(52, 2, 3), r = mulberry(53);
  return paintLayer(ctx, (q, x, y, set) => {
    const ph = y / S * 4 + x / S + w[q] * 1.6, s = 0.5 + 0.5 * Math.sin(6.283 * ph);
    const sh = sstep(0.25, 0.9, s) * 0.55 + (1 - n1[q]) * 0.45;
    const c = mixc([246, 250, 255], [168, 190, 228], sh * 0.75);
    const k = 0.98 + (lhash(x, y, 13) - 0.5) * 0.05;
    set(q, c[0] * k, c[1] * k, c[2] * k);
  }, (ctx, wrap, glow) => {
    for (let i = 0; i < 260; i++) {
      const x = (r() * S) | 0, y = (r() * S) | 0;
      ctx.fillStyle = 'rgb(255,255,255)'; ctx.fillRect(x, y, 1, 1);
      glow[y * S + x] = 0.25 + r() * 0.3;
    }
    for (let i = 0; i < 18; i++) {
      const x = r() * S, y = r() * S, l = 10 + r() * 20;
      wrap(x, y, l, (X, Y) => { ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(X, Y); ctx.quadraticCurveTo(X + l / 2, Y - 3, X + l, Y); ctx.stroke(); ctx.strokeStyle = 'rgba(140,165,215,0.45)'; ctx.beginPath(); ctx.moveTo(X, Y + 1.6); ctx.quadraticCurveTo(X + l / 2, Y - 1.4, X + l, Y + 1.6); ctx.stroke(); });
    }
  });
};
// 5 swamp: murky moss, puddles, lily pads and reeds
PAINT[LAYER.SWAMP] = (ctx) => {
  const n1 = fbm(61, 4, 4), pud = fbm(62, 4, 4), r = mulberry(63);
  return paintLayer(ctx, (q, x, y, set) => {
    let c = mixc([54, 66, 34], [100, 110, 52], n1[q]);
    const p = pud[q];
    if (p > 0.6) { const dd = sstep(0.6, 0.72, p); c = mixc([70, 92, 70], [30, 52, 52], dd); const sp = lhash(x, y, 3) > 0.985 ? 30 : 0; c = [c[0] + sp, c[1] + sp, c[2] + sp]; }
    else if (p > 0.55) c = mixc(c, [128, 132, 72], sstep(0.55, 0.6, p) * 0.6);
    const k = 0.92 + lhash(x, y, 15) * 0.14;
    set(q, c[0] * k, c[1] * k, c[2] * k);
  }, (ctx, wrap) => {
    for (let i = 0; i < 700; i++) {
      const x = r() * S, y = r() * S, q = ((y | 0) % S) * S + ((x | 0) % S);
      if (pud[q] > 0.58) continue;
      ctx.fillStyle = r() < 0.6 ? 'rgba(112,146,48,0.75)' : 'rgba(40,52,26,0.6)'; ctx.beginPath(); ctx.arc(x, y, 0.8 + r() * 1.4, 0, 6.283); ctx.fill();
    }
    let pads = 0;
    for (let i = 0; i < 400 && pads < 16; i++) {
      const x = r() * S, y = r() * S, q = ((y | 0) % S) * S + ((x | 0) % S);
      if (pud[q] < 0.68) continue;
      pads++;
      const s = 2.4 + r() * 1.6, a = r() * 6.28;
      wrap(x, y, 7, (X, Y) => {
        ctx.fillStyle = 'rgba(10,20,20,0.45)'; ctx.beginPath(); ctx.arc(X + 0.8, Y + 1, s, 0, 6.283); ctx.fill();
        ctx.fillStyle = 'rgb(84,140,54)'; ctx.beginPath(); ctx.moveTo(X, Y); ctx.arc(X, Y, s, a + 0.5, a + 6.0); ctx.closePath(); ctx.fill();
        if (r() < 0.35) { ctx.fillStyle = 'rgb(250,220,240)'; ctx.beginPath(); ctx.arc(X, Y, 1.2, 0, 6.283); ctx.fill(); }
      });
    }
    for (let i = 0; i < 70; i++) {
      const x = r() * S, y = r() * S, q = ((y | 0) % S) * S + ((x | 0) % S);
      if (pud[q] > 0.6) continue;
      const l = 5 + r() * 6, a = -1.57 + (r() - 0.5) * 0.6;
      wrap(x, y, 12, (X, Y) => { ctx.strokeStyle = 'rgb(70,86,36)'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X + Math.cos(a) * l, Y + Math.sin(a) * l); ctx.stroke(); ctx.fillStyle = 'rgb(110,74,40)'; ctx.fillRect(X + Math.cos(a) * l - 0.8, Y + Math.sin(a) * l - 1.5, 1.6, 2.6); });
    }
  });
};
// 6 rough: cracked stone plates and gravel
PAINT[LAYER.ROUGH] = (ctx) => {
  const vo = voronoi(7, 71), n1 = fbm(72, 6, 3), r = mulberry(73);
  return paintLayer(ctx, (q, x, y, set) => {
    const id = vo.ID[q], e = vo.F2[q] - vo.F1[q];
    const tone = lhash(id, 1, 74);
    let c = mixc([126, 114, 92], [176, 162, 132], tone * 0.7 + n1[q] * 0.3);
    const sh = 1 + (vo.DX[q] + vo.DY[q]) * 0.25;
    const crack = 1 - sstep(0.02, 0.07, e);
    c = mixc(c.map((v) => v * sh), [64, 54, 44], crack * 0.85);
    const k = 0.9 + lhash(x, y, 17) * 0.18;
    set(q, c[0] * k, c[1] * k, c[2] * k);
  }, (ctx, wrap) => {
    pebbles(ctx, wrap, r, 160, 0.8, 2.2, [[150, 140, 120], [110, 100, 88], [184, 172, 150]], 0.4);
    cracks(ctx, wrap, r, 8, 8, 'rgba(60,50,40,0.7)', null, 0.9);
  });
};
// 7 lava: black crust with glowing veins (alpha = glow)
PAINT[LAYER.LAVA] = (ctx) => {
  const vo = voronoi(6, 81, 0.9), n1 = fbm(82, 6, 3), n2 = fbm(83, 3, 3), r = mulberry(84);
  return paintLayer(ctx, (q, x, y, set, glow) => {
    const id = vo.ID[q], e = vo.F2[q] - vo.F1[q];
    const tone = lhash(id, 2, 85);
    let c = mixc([30, 22, 22], [66, 46, 40], tone * 0.5 + n1[q] * 0.5);
    const sh = 1 + (vo.DX[q] + vo.DY[q]) * 0.35;
    c = c.map((v) => v * sh);
    const wid = 0.05 + n2[q] * 0.09;
    const vein = 1 - sstep(0.0, wid, e), core = 1 - sstep(0.0, wid * 0.4, e);
    const heat = 1 - sstep(wid, wid * 2.4, e);
    c = mixc(c, [120, 36, 16], heat * 0.6);
    c = mixc(c, [255, 92, 14], vein);
    c = mixc(c, [255, 214, 90], core);
    glow[q] = Math.max(vein * 0.9, heat * 0.12);
    set(q, c[0], c[1], c[2]);
  }, (ctx, wrap, glow) => {
    for (let i = 0; i < 90; i++) {
      const x = (r() * S) | 0, y = (r() * S) | 0;
      ctx.fillStyle = 'rgb(255,140,40)'; ctx.fillRect(x, y, 1, 1);
      glow[y * S + x] = 0.7;
    }
  });
};
// 8 mountain rock: chiselled grey stone, layered, with lichen
PAINT[LAYER.MOUNT] = (ctx) => {
  const vo = voronoi(4, 91, 0.9), n1 = fbm(92, 5, 4), w = fbm(93, 3, 3), li = fbm(94, 6, 3), r = mulberry(95);
  return paintLayer(ctx, (q, x, y, set) => {
    const band = 0.5 + 0.5 * Math.sin(6.283 * (y / S * 6 + w[q] * 2.5));
    let c = mixc([104, 98, 92], [162, 154, 142], n1[q] * 0.6 + band * 0.4);
    const facet = 1 + vo.DX[q] * 0.45 - vo.DY[q] * 0.2;
    c = c.map((v) => v * facet);
    const e = vo.F2[q] - vo.F1[q];
    c = mixc(c, [58, 54, 52], (1 - sstep(0.01, 0.05, e)) * 0.8);
    const l = sstep(0.68, 0.8, li[q]) * (lhash(x, y, 19) > 0.35 ? 1 : 0.4);
    c = mixc(c, [150, 160, 74], l * 0.75);
    const k = 0.92 + lhash(x, y, 21) * 0.14;
    set(q, c[0] * k, c[1] * k, c[2] * k);
  }, (ctx, wrap) => { cracks(ctx, wrap, r, 10, 10, 'rgba(48,44,42,0.75)', 'rgba(220,214,200,0.3)', 1); });
};
// 9 forest floor: moss, leaf litter and needles
PAINT[LAYER.FOREST] = (ctx) => {
  const n1 = fbm(101, 4, 4), n2 = fbm(102, 6, 3), r = mulberry(103);
  return paintLayer(ctx, (q, x, y, set) => {
    let c = mixc([40, 62, 28], [80, 100, 42], n1[q]);
    c = mixc(c, [92, 70, 40], sstep(0.55, 0.85, n2[q]) * 0.6);
    const k = 0.9 + lhash(x, y, 23) * 0.16;
    set(q, c[0] * k, c[1] * k, c[2] * k);
  }, (ctx, wrap) => {
    const leaf = [[96, 120, 44], [130, 110, 46], [150, 96, 40], [70, 96, 38], [170, 140, 60]];
    for (let i = 0; i < 1100; i++) {
      const x = r() * S, y = r() * S, a = r() * 6.28, c = leaf[(r() * leaf.length) | 0], s = 1.6 + r() * 1.6;
      wrap(x, y, 5, (X, Y) => { ctx.fillStyle = rgba(c, 0.9); ctx.beginPath(); ctx.ellipse(X, Y, s, s * 0.45, a, 0, 6.283); ctx.fill(); });
    }
    for (let i = 0; i < 600; i++) {
      const x = r() * S, y = r() * S, a = r() * 6.28;
      wrap(x, y, 6, (X, Y) => { ctx.strokeStyle = 'rgba(120,84,44,0.8)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X + Math.cos(a) * 4, Y + Math.sin(a) * 4); ctx.stroke(); });
    }
    pebbles(ctx, wrap, r, 14, 1.5, 3, [[110, 110, 100], [90, 96, 80]]);
    for (let i = 0; i < 12; i++) {
      const x = r() * S, y = r() * S;
      wrap(x, y, 6, (X, Y) => { ctx.fillStyle = 'rgb(200,40,30)'; ctx.beginPath(); ctx.arc(X, Y, 1.8, 3.14, 6.283); ctx.fill(); ctx.fillStyle = 'rgb(240,230,210)'; ctx.fillRect(X - 0.5, Y, 1, 1.8); ctx.fillRect(X - 0.8, Y - 1.2, 0.8, 0.8); });
    }
  });
};
// 10 road: cobblestones bedded in packed dirt
PAINT[LAYER.ROAD] = (ctx) => {
  const vo = voronoi(9, 111, 0.7), n1 = fbm(112, 6, 3);
  const stones = [[176, 162, 138], [158, 146, 126], [190, 176, 150], [146, 134, 116], [168, 150, 120]];
  return paintLayer(ctx, (q, x, y, set) => {
    const id = vo.ID[q], e = vo.F2[q] - vo.F1[q];
    const st = stones[(lhash(id, 3, 113) * stones.length) | 0];
    const round = 1 + (-vo.DX[q] - vo.DY[q]) * 0.0 + (0.45 - vo.F1[q]) * 0.35 - (vo.DX[q] + vo.DY[q]) * 0.3;
    let c = st.map((v) => v * round * (0.92 + n1[q] * 0.16));
    const rim = sstep(0.05, 0.22, e);
    c = c.map((v) => v * (0.7 + 0.3 * rim));
    const mortar = 1 - sstep(0.05, 0.11, e);
    c = mixc(c, [104, 82, 54].map((v) => v * (0.85 + n1[q] * 0.3)), mortar);
    const k = 0.94 + lhash(x, y, 25) * 0.1;
    set(q, c[0] * k, c[1] * k, c[2] * k);
  }, null);
};
// 11 cliff: layered rock strata
PAINT[LAYER.CLIFF] = (ctx) => {
  const w = fbm(121, 4, 3), n1 = fbm(122, 8, 3), r = mulberry(123);
  const pal = [[168, 128, 86], [136, 102, 72], [186, 150, 104], [118, 90, 66], [156, 120, 84], [196, 164, 118], [128, 96, 70], [150, 112, 78]];
  return paintLayer(ctx, (q, x, y, set) => {
    const yy = y / S * 9 + (w[q] - 0.5) * 1.1 + Math.sin(x / S * 6.283) * 0.2;
    const b = Math.floor(yy), f = yy - b;
    const bi = ((b % 9) + 9) % 9;
    let c = pal[bi % pal.length];
    // a lit ledge on top of each band and a shadowed seam underneath
    const top = 1 - sstep(0.0, 0.14, f), bot = sstep(0.82, 1.0, f);
    let k = 1 + top * 0.22 - bot * 0.38;
    const vcr = Math.abs(Math.sin(6.283 * (x / S * 7 + (n1[q] - 0.5) * 0.8 + bi * 0.37)));
    k *= 1 - (1 - sstep(0.0, 0.07, vcr)) * 0.45;
    k *= 0.88 + n1[q] * 0.2 + (lhash(x, y, 27) - 0.5) * 0.08;
    set(q, c[0] * k, c[1] * k, c[2] * k);
  }, (ctx, wrap) => { pebbles(ctx, wrap, r, 30, 1, 2.4, [[150, 120, 90], [120, 96, 72]], 0.35); });
};
// 12 fog: the unexplored, a dark cloudy murk
PAINT[LAYER.FOG] = (ctx) => {
  const n1 = fbm(131, 3, 4), n2 = fbm(132, 8, 2);
  return paintLayer(ctx, (q, x, y, set) => {
    const c = mixc([14, 16, 28], [34, 38, 60], n1[q] * 0.75 + n2[q] * 0.25);
    set(q, c[0], c[1], c[2]);
  }, null);
};

// average colour of each layer (linear 0..1), handy for minimaps or debugging
export const LAYER_AVG = [];
let texCache = null;
export function terrainTexture() {
  if (texCache) return texCache;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const data = new Uint8Array(S * S * 4 * NLAYERS);
  for (let l = 0; l < NLAYERS; l++) {
    ctx.clearRect(0, 0, S, S);
    const px = PAINT[l](ctx);
    data.set(px, l * S * S * 4);
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < S * S * 4; i += 4) { r += px[i]; g += px[i + 1]; b += px[i + 2]; }
    LAYER_AVG[l] = new THREE.Color().setRGB(r / S / S / 255, g / S / S / 255, b / S / S / 255, THREE.SRGBColorSpace);
  }
  const tex = new THREE.DataArrayTexture(data, S, S, NLAYERS);
  tex.format = THREE.RGBAFormat;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  texCache = tex;
  return tex;
}
// a flat 2D canvas of one layer, for previews and UI
export function layerCanvas(l) {
  const tex = terrainTexture();
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(S, S);
  img.data.set(tex.image.data.subarray(l * S * S * 4, (l + 1) * S * S * 4));
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = 255;
  ctx.putImageData(img, 0, 0);
  return cv;
}

// ------------------------------------------------------------------ materials
const uTime = { value: 0 };
const tick = () => { uTime.value = performance.now() / 1000; };

export function createPlanetMaterial(waterLevel) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
  const uniforms = { uTer: { value: terrainTexture() }, uTime, uWater: { value: waterLevel }, uGlow: { value: 2.6 } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 tdat;\nvarying vec4 vT;\nvarying float vRad;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvT = tdat; vRad = length(position);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform highp sampler2DArray uTer;\nuniform float uTime, uWater, uGlow;\nvarying vec4 vT;\nvarying float vRad;')
      .replace('#include <map_fragment>', `
        float lay = floor(vT.z + 0.5);
        vec4 tx = texture(uTer, vec3(vT.xy, lay));
        if (vT.w > 0.003) {
          vec2 q = vT.xy * 6.283;
          float nz = sin(q.x * 2.3 + sin(q.y * 1.7)) * 0.5 + sin(q.y * 3.1 - q.x * 1.3) * 0.5;
          float m = vT.w + nz * 0.1;
          vec4 rd = texture(uTer, vec3(vT.xy * 1.15, 10.0));
          tx.rgb *= 1.0 - 0.35 * smoothstep(0.18, 0.44, m) * (1.0 - smoothstep(0.46, 0.52, m));
          tx = mix(tx, vec4(rd.rgb, 0.0), smoothstep(0.47, 0.53, m));
        }
        diffuseColor.rgb *= tx.rgb;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          float fz = vRad - uWater;
          float lap = 0.012 + 0.008 * sin(uTime * 1.9 + (vT.x + vT.y) * 9.0);
          float foam = (1.0 - smoothstep(lap * 0.6, lap + 0.012, fz)) * smoothstep(-0.03, -0.005, fz);
          foam *= 0.75 + 0.25 * sin(vT.x * 70.0 + uTime * 3.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.96, 1.0), foam * step(lay, 11.5) * 0.85);
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += tx.rgb * tx.rgb * tx.a * uGlow * (0.8 + 0.2 * sin(uTime * 1.6 + vT.x * 5.0 + vT.y * 3.0)) * smoothstep(0.2, 0.5, vColor.g + vColor.r);`);
  };
  mat.customProgramCacheKey = () => 'hexrealms-terrain-1';
  return mat;
}

export function createWaterMaterial() {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, roughness: 0.16, metalness: 0.05 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 wd;\nvarying vec2 vWd;\nvarying vec3 vWPos;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWd = wd; vWPos = (modelMatrix * vec4(position, 1.0)).xyz;');
    const waves = `
      float wavesH(vec3 p, out vec3 g) {
        float t = uTime; float h = 0.0; g = vec3(0.0);
        vec3 D[5]; D[0] = normalize(vec3(1.0, 0.3, 0.2)); D[1] = normalize(vec3(-0.3, 1.0, 0.5)); D[2] = normalize(vec3(0.4, -0.6, 1.0)); D[3] = normalize(vec3(-1.0, -0.2, 0.7)); D[4] = normalize(vec3(0.6, 0.9, -0.8));
        float F[5]; F[0] = 23.0; F[1] = 31.0; F[2] = 47.0; F[3] = 71.0; F[4] = 113.0;
        float A[5]; A[0] = 1.0; A[1] = 0.8; A[2] = 0.55; A[3] = 0.35; A[4] = 0.22;
        for (int i = 0; i < 5; i++) { float ph = dot(D[i], p) * F[i] + t * (1.1 + float(i) * 0.45); h += A[i] * sin(ph); g += A[i] * F[i] * cos(ph) * D[i]; }
        return h;
      }`;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec2 vWd;\nvarying vec3 vWPos;\n' + waves)
      .replace('#include <color_fragment>', `
        vec3 wg; float wh = wavesH(vWPos, wg);
        float shore = vWd.x, depth = vWd.y;
        vec3 shallow = vec3(0.06, 0.52, 0.56), mid = vec3(0.03, 0.26, 0.52), deep = vec3(0.012, 0.08, 0.26);
        vec3 wc = mix(shallow, mid, smoothstep(0.0, 0.55, depth));
        wc = mix(wc, deep, smoothstep(0.5, 1.0, depth));
        wc *= 0.92 + 0.08 * wh / 2.9;
        float fn = 0.5 + 0.5 * sin(dot(vWPos, vec3(61.0, -43.0, 37.0)) + uTime * 1.3) * sin(dot(vWPos, vec3(-29.0, 53.0, 47.0)) - uTime * 0.9);
        float edge = 0.2 + 0.05 * sin(uTime * 1.4 + wh * 0.6);
        float foam = 1.0 - smoothstep(edge * 0.45, edge, shore + (fn - 0.5) * 0.12);
        float ring = 0.32 + 0.1 * fract(uTime * 0.18 + wh * 0.02);
        float foam2 = (1.0 - smoothstep(0.0, 0.035, abs(shore - ring))) * (1.0 - smoothstep(0.2, 0.5, shore)) * smoothstep(0.35, 0.8, fn);
        float crest = smoothstep(2.1, 2.7, wh) * 0.35 * (1.0 - depth * 0.5);
        float f = clamp(foam * (0.75 + 0.25 * fn) + foam2 * 0.6 + crest, 0.0, 1.0);
        diffuseColor.rgb = mix(wc, vec3(0.93, 0.97, 1.0), f) * vColor;
        diffuseColor.a = clamp(mix(0.62, 0.95, smoothstep(0.0, 0.9, depth)) + f, 0.0, 1.0);
        float lit = smoothstep(0.15, 0.45, vColor.g);
        diffuseColor.a = mix(1.0, diffuseColor.a, lit);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(1.0, roughnessFactor + f * 0.5, lit);')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec3 up = normalize(vWPos);
          vec3 gt = wg - up * dot(wg, up);
          vec3 gv = (viewMatrix * vec4(gt, 0.0)).xyz;
          normal = normalize(normal - gv * 0.0016 * lit);
        }`);
  };
  mat.customProgramCacheKey = () => 'hexrealms-water-1';
  return mat;
}

// ------------------------------------------------------------------ the planet builder
// ctx: { R, STEP, SEA, DIRS, CORN, FACES, CELLS, WATER (terrain id of water, 0) }
// Returns { planet, water, triCell, rebuild(ter, h, road, seen) }.
// The planet mesh is indexed; triCell[faceIndex] gives the cell of a raycast hit.
const TILE = 0.4; // world units per texture repeat
const BEV = 0.8, DROP = 0.024;
// cliff tint per terrain (multiplies the strata texture)
const CLIFF_TINT = [[0.85, 0.95, 0.95], [1.0, 0.95, 0.88], [1.0, 0.9, 0.8], [1.3, 1.16, 0.9], [1.45, 1.5, 1.62], [0.78, 0.82, 0.7], [0.95, 0.94, 0.95], [0.55, 0.42, 0.42], [0.92, 0.92, 0.98], [0.9, 0.9, 0.8]];
export function createPlanet(ctx) {
  const { R, STEP, SEA, DIRS, CORN, CELLS } = ctx;
  const FACES = ctx.FACES;
  const NV = DIRS.length;
  const waterLevel = R + (SEA - 0.35) * STEP;
  // static per-cell templates: unit directions, normals and uv for the 1 + 4k top/bevel vertices
  let maxV = 0, maxT = 0;
  const tmpl = [];
  const Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), tg = new THREE.Vector3();
  for (let v = 0; v < NV; v++) {
    const cell = CELLS[v], k = cell.fs.length, d = DIRS[v];
    const r = mulberry(v * 7919 + 17);
    const t1 = new THREE.Vector3().crossVectors(d, Math.abs(d.y) < 0.9 ? Y : X).normalize(), t2 = d.clone().cross(t1);
    const ang = r() * 6.283, ca = Math.cos(ang), sa = Math.sin(ang);
    const u1 = t1.clone().multiplyScalar(ca).addScaledVector(t2, sa), u2 = t1.clone().multiplyScalar(-sa).addScaledVector(t2, ca);
    const ou = r() * 10, ov = r() * 10;
    const nV = 1 + 4 * k;
    const dir = new Float32Array(nV * 3), nor = new Float32Array(nV * 3), uv = new Float32Array(nV * 2);
    const put = (i, p, n) => {
      dir[i * 3] = p.x; dir[i * 3 + 1] = p.y; dir[i * 3 + 2] = p.z;
      nor[i * 3] = n.x; nor[i * 3 + 1] = n.y; nor[i * 3 + 2] = n.z;
      a.copy(p).sub(d).multiplyScalar(R);
      uv[i * 2] = a.dot(u1) / TILE + ou; uv[i * 2 + 1] = a.dot(u2) / TILE + ov;
    };
    put(0, d, d);
    for (let i = 0; i < k; i++) {
      const j = (i + 1) % k, ci = CORN[cell.fs[i]], cj = CORN[cell.fs[j]];
      a.copy(d).multiplyScalar(1 - BEV).addScaledVector(ci, BEV).normalize(); put(1 + i, a, d);
      b.copy(d).multiplyScalar(1 - BEV).addScaledVector(cj, BEV).normalize(); a.add(b).normalize(); put(1 + k + i, a, d);
      tg.copy(ci).addScaledVector(d, -ci.dot(d)).normalize(); a.copy(d).addScaledVector(tg, 0.85).normalize(); put(1 + 2 * k + i, ci, a);
      b.copy(ci).add(cj).normalize(); tg.copy(b).addScaledVector(d, -b.dot(d)).normalize(); a.copy(d).addScaledVector(tg, 0.85).normalize(); put(1 + 3 * k + i, b, a);
    }
    // low-frequency painterly tint, fixed per cell
    const lf1 = Math.sin(d.x * 5.1 + d.y * 3.3 + 1.7) * Math.sin(d.z * 4.3 - d.y * 2.1);
    const lf2 = Math.sin(d.y * 6.7 - d.z * 2.9 + 0.4);
    const jit = 0.93 + r() * 0.12;
    tmpl.push({ k, dir, nor, uv, tint: [jit * (1 + 0.07 * lf1), jit * (1 + 0.035 * lf2), jit * (1 - 0.06 * lf1)], wallU: r() * 10 });
    maxV += nV + 4 * k; maxT += 6 * k + 2 * k;
  }
  const geo = new THREE.BufferGeometry();
  const P = new Float32Array(maxV * 3), N = new Float32Array(maxV * 3), C = new Float32Array(maxV * 3), TD = new Float32Array(maxV * 4);
  const IDX = new Uint32Array(maxT * 3);
  const triCell = new Int32Array(maxT);
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(C, 3));
  geo.setAttribute('tdat', new THREE.BufferAttribute(TD, 4));
  geo.setIndex(new THREE.BufferAttribute(IDX, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R + 2);
  const planet = new THREE.Mesh(geo, createPlanetMaterial(waterLevel));
  planet.onBeforeRender = tick;

  // water: per water cell a flat hex fan at sea level
  let wMaxV = NV * 13, wMaxT = NV * 12;
  const wgeo = new THREE.BufferGeometry();
  const WP = new Float32Array(wMaxV * 3), WN = new Float32Array(wMaxV * 3), WC = new Float32Array(wMaxV * 3), WD = new Float32Array(wMaxV * 2), WI = new Uint32Array(wMaxT * 3);
  wgeo.setAttribute('position', new THREE.BufferAttribute(WP, 3));
  wgeo.setAttribute('normal', new THREE.BufferAttribute(WN, 3));
  wgeo.setAttribute('color', new THREE.BufferAttribute(WC, 3));
  wgeo.setAttribute('wd', new THREE.BufferAttribute(WD, 2));
  wgeo.setIndex(new THREE.BufferAttribute(WI, 1));
  wgeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R + 2);
  const water = new THREE.Mesh(wgeo, createWaterMaterial());
  water.onBeforeRender = tick;
  water.renderOrder = 1;

  const pa = new THREE.Vector3(), pb = new THREE.Vector3(), qa = new THREE.Vector3(), qb = new THREE.Vector3(), wn = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  function rebuild(ter, h, road, seen) {
    const WATER = 0;
    const isW = (x) => ter[x] === WATER;
    let nv = 0, ni = 0, nt = 0;
    const vert = (x, y, z, nx, ny, nz, r, g, bb, u, vv, lay, rm) => {
      const o = nv * 3, o4 = nv * 4;
      P[o] = x; P[o + 1] = y; P[o + 2] = z; N[o] = nx; N[o + 1] = ny; N[o + 2] = nz; C[o] = r; C[o + 1] = g; C[o + 2] = bb;
      TD[o4] = u; TD[o4 + 1] = vv; TD[o4 + 2] = lay; TD[o4 + 3] = rm;
      return nv++;
    };
    const tri = (i0, i1, i2, cell) => { IDX[ni++] = i0; IDX[ni++] = i1; IDX[ni++] = i2; triCell[nt++] = cell; };
    for (let v = 0; v < NV; v++) {
      const T = tmpl[v], k = T.k, rad = R + h[v] * STEP, vis = !!seen[v], w = isW(v);
      const lay = !vis ? LAYER.FOG : ter[v];
      const isRoad = vis && !w && road[v];
      let tr = 1, tgc = 1, tb = 1;
      if (vis) { tr = T.tint[0]; tgc = T.tint[1]; tb = T.tint[2]; if (w) { const dk = 1 - (SEA - h[v] - 1) * 0.25; tr *= dk * 0.8; tgc *= dk * 0.9; tb *= dk; } }
      else { const f = 0.85 + T.tint[0] * 0.2; tr = tgc = tb = f; }
      const base = nv;
      const { dir, nor, uv } = T;
      for (let i = 0; i < 1 + 4 * k; i++) {
        const ring = i === 0 ? 0 : ((i - 1) / k) | 0; // 0 inner, 1 inner mid, 2 outer, 3 outer mid
        const rr = ring >= 2 ? rad - DROP : rad;
        const sh = ring >= 2 ? (ring === 2 ? 0.74 : 0.8) : 1;
        let rm = 0;
        if (isRoad) {
          if (i === 0) rm = 1;
          else if (ring === 1 || ring === 3) { const n = CELLS[v].nb[(i - 1) % k]; rm = road[n] && !isW(n) && seen[n] ? 1 : 0; }
        }
        vert(dir[i * 3] * rr, dir[i * 3 + 1] * rr, dir[i * 3 + 2] * rr, nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2], tr * sh, tgc * sh, tb * sh, uv[i * 2], uv[i * 2 + 1], lay, rm);
      }
      const C0 = base, I = (i) => base + 1 + i, IM = (i) => base + 1 + k + i, O = (i) => base + 1 + 2 * k + i, OM = (i) => base + 1 + 3 * k + i;
      for (let i = 0; i < k; i++) {
        const j = (i + 1) % k;
        tri(C0, I(i), IM(i), v); tri(C0, IM(i), I(j), v);
        tri(I(i), O(i), OM(i), v); tri(I(i), OM(i), IM(i), v); tri(IM(i), OM(i), O(j), v); tri(IM(i), O(j), I(j), v);
      }
      // cliff walls down to lower neighbours
      const ct = CLIFF_TINT[ter[v]] || CLIFF_TINT[2];
      let wu = T.wallU;
      for (let i = 0; i < k; i++) {
        const n = CELLS[v].nb[i];
        if (h[n] >= h[v]) continue;
        const j = (i + 1) % k, ci = CORN[CELLS[v].fs[i]], cj = CORN[CELLS[v].fs[j]];
        const rt = rad - DROP, rb = R + h[n] * STEP - DROP;
        pa.copy(ci).multiplyScalar(rt); pb.copy(cj).multiplyScalar(rt); qa.copy(ci).multiplyScalar(rb); qb.copy(cj).multiplyScalar(rb);
        e1.subVectors(pb, pa); e2.subVectors(qa, pa); wn.crossVectors(e1, e2).normalize();
        if (wn.dot(e1.copy(DIRS[n]).sub(DIRS[v])) < 0) wn.negate();
        const len = pa.distanceTo(pb) / TILE;
        const wl = vis ? LAYER.CLIFF : LAYER.FOG;
        const top = vis ? 1.08 : 0.9, bot = vis ? 0.5 : 0.7;
        const cr = vis ? ct[0] : 1, cg = vis ? ct[1] : 1, cb = vis ? ct[2] : 1;
        const vt = rt / (TILE * 1.6), vb = rb / (TILE * 1.6);
        const i0 = vert(pa.x, pa.y, pa.z, wn.x, wn.y, wn.z, cr * top, cg * top, cb * top, wu, vt, wl, 0);
        const i1 = vert(pb.x, pb.y, pb.z, wn.x, wn.y, wn.z, cr * top, cg * top, cb * top, wu + len, vt, wl, 0);
        const i2 = vert(qb.x, qb.y, qb.z, wn.x, wn.y, wn.z, cr * bot, cg * bot, cb * bot, wu + len, vb, wl, 0);
        const i3 = vert(qa.x, qa.y, qa.z, wn.x, wn.y, wn.z, cr * bot, cg * bot, cb * bot, wu, vb, wl, 0);
        // wind so the face points outward
        e1.subVectors(pb, pa); e2.subVectors(qb, pa);
        if (e1.cross(e2).dot(wn) > 0) { tri(i0, i1, i2, v); tri(i0, i2, i3, v); } else { tri(i0, i2, i1, v); tri(i0, i3, i2, v); }
        wu += len;
      }
    }
    geo.setDrawRange(0, ni);
    for (const k of ['position', 'normal', 'color', 'tdat']) { const at = geo.attributes[k]; at.clearUpdateRanges(); at.addUpdateRange(0, nv * at.itemSize); at.needsUpdate = true; }
    geo.index.clearUpdateRanges(); geo.index.addUpdateRange(0, ni); geo.index.needsUpdate = true;

    // ---- water
    let wv = 0, wi = 0;
    const depthOf = (x) => (isW(x) ? Math.min(1, Math.max(0.25, (SEA - h[x]) / 2)) : 0);
    const wvert = (p, r, sh, dp, col) => {
      const o = wv * 3;
      WP[o] = p.x * r; WP[o + 1] = p.y * r; WP[o + 2] = p.z * r; WN[o] = p.x; WN[o + 1] = p.y; WN[o + 2] = p.z;
      WC[o] = col; WC[o + 1] = col; WC[o + 2] = col; WD[wv * 2] = sh; WD[wv * 2 + 1] = dp;
      return wv++;
    };
    const cs = new Float32Array(6), cd = new Float32Array(6);
    for (let v = 0; v < NV; v++) {
      if (!isW(v)) continue;
      const cell = CELLS[v], k = cell.fs.length, col = seen[v] ? 1 : 0.1;
      for (let i = 0; i < k; i++) {
        const f = FACES[cell.fs[i]];
        cs[i] = isW(f[0]) && isW(f[1]) && isW(f[2]) ? 1 : 0;
        cd[i] = (depthOf(f[0]) + depthOf(f[1]) + depthOf(f[2])) / 3;
      }
      const c0 = wvert(DIRS[v], waterLevel, 1, depthOf(v), col);
      const first = wv;
      for (let i = 0; i < k; i++) {
        const j = (i + 1) % k, n = cell.nb[i];
        wvert(CORN[cell.fs[i]], waterLevel, cs[i], cd[i], col);
        pa.copy(CORN[cell.fs[i]]).add(CORN[cell.fs[j]]).normalize();
        wvert(pa, waterLevel, isW(n) ? 0.35 + 0.65 * 0.5 * (cs[i] + cs[j]) : 0, (cd[i] + cd[j] + depthOf(n) + depthOf(v)) / 4, col);
      }
      for (let i = 0; i < k; i++) {
        const cI = first + i * 2, mI = cI + 1, cJ = first + ((i + 1) % k) * 2;
        WI[wi++] = c0; WI[wi++] = cI; WI[wi++] = mI;
        WI[wi++] = c0; WI[wi++] = mI; WI[wi++] = cJ;
      }
    }
    wgeo.setDrawRange(0, wi);
    for (const k of ['position', 'normal', 'color', 'wd']) wgeo.attributes[k].needsUpdate = true;
    wgeo.index.needsUpdate = true;
  }
  const api = { planet, water, triCell, rebuild, waterLevel };
  globalThis.__hexTerrain = api; // debug handle for previews
  return api;
}
