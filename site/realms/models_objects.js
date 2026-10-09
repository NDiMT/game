import * as THREE from 'three';
import { BONE, tagRange, ensureRig } from './rig.js?v=0.8';

// =====================================================================
// HEX REALMS: adventure-map objects (resources, treasure, mines, sites).
// objectModel(id) -> { body, glow }. Base at y = 0, front faces +Z,
// footprint about 1.2 units (resource piles about 0.7).
// Body: position, normal, color (painted vertex colours) and uv
// (triplanar, 1 unit = 1 uv). Glow: unlit emissive parts.
// =====================================================================

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const TAU = Math.PI * 2;
const _c = new THREE.Color(), _c2 = new THREE.Color();

// orient each triangle away from the origin (for convex shapes built at the origin)
function orientOut(arr) {
  for (let i = 0; i < arr.length; i += 9) {
    const ax = arr[i], ay = arr[i + 1], az = arr[i + 2];
    const ux = arr[i + 3] - ax, uy = arr[i + 4] - ay, uz = arr[i + 5] - az;
    const vx = arr[i + 6] - ax, vy = arr[i + 7] - ay, vz = arr[i + 8] - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const cx = (ax + arr[i + 3] + arr[i + 6]), cy = (ay + arr[i + 4] + arr[i + 7]), cz = (az + arr[i + 5] + arr[i + 8]);
    if (nx * cx + ny * cy + nz * cz < 0) for (let k = 0; k < 3; k++) { const t = arr[i + 3 + k]; arr[i + 3 + k] = arr[i + 6 + k]; arr[i + 6 + k] = t; }
  }
  return arr;
}
function fromTris(arr) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
  return g;
}
// a box with chamfered edges, centred at the origin
function chamferBox(w, h, d, b) {
  const H = [w / 2, h / 2, d / 2];
  b = Math.min(b, H[0] * 0.9, H[1] * 0.9, H[2] * 0.9);
  const V = (a, s) => [0, 1, 2].map((i) => (i === a ? s[i] * H[i] : s[i] * (H[i] - b)));
  const T = [];
  const quad = (p, q, r, s) => T.push(...p, ...q, ...r, ...p, ...r, ...s);
  for (let a = 0; a < 3; a++) for (const sa of [-1, 1]) {
    const o = [0, 1, 2].filter((i) => i !== a);
    const S = (u, v) => { const s = [0, 0, 0]; s[a] = sa; s[o[0]] = u; s[o[1]] = v; return s; };
    quad(V(a, S(-1, -1)), V(a, S(1, -1)), V(a, S(1, 1)), V(a, S(-1, 1)));
  }
  for (let a = 0; a < 3; a++) for (let c = a + 1; c < 3; c++) {
    const e = 3 - a - c;
    for (const sa of [-1, 1]) for (const sc of [-1, 1]) {
      const S = (se) => { const s = [0, 0, 0]; s[a] = sa; s[c] = sc; s[e] = se; return s; };
      quad(V(a, S(-1)), V(a, S(1)), V(c, S(1)), V(c, S(-1)));
    }
  }
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) { const s = [sx, sy, sz]; T.push(...V(0, s), ...V(1, s), ...V(2, s)); }
  return fromTris(orientOut(T));
}

// a small painterly kit: every part gets a colour (flat, a [bottom, top] gradient or a
// function), per-face jitter, ground occlusion and a sky-facing lift when merged.
function makeKit(seed) {
  const r = rng(seed);
  const B = [], G = [];
  const place = (g, o = {}) => {
    if (o.s) { const s = Array.isArray(o.s) ? o.s : [o.s, o.s, o.s]; g.scale(s[0], s[1], s[2]); }
    if (o.rx) g.rotateX(o.rx);
    if (o.rz) g.rotateZ(o.rz);
    if (o.ry) g.rotateY(o.ry);
    return g;
  };
  // shader rig: parts added inside k.bone(b, pivot, fn) carry that bone + pivot (model space)
  let rig = null;
  const k = {
    r, B, G,
    rr: (a, b) => a + r() * (b - a),
    bone(b, pivot, fn) { const old = rig; rig = { b, p: pivot }; fn(); rig = old; },
    // generic: geometry already built at origin; o: {s, rx, rz, ry, glow, jit, ao}
    add(g, x, y, z, c, o = {}) {
      g = g.index ? g.toNonIndexed() : g;
      place(g, o).translate(x, y, z);
      (o.glow ? G : B).push({ g, c, jit: o.jit ?? 0.1, ao: o.ao ?? true, seed: (r() * 1e9) | 0, rig });
      return g;
    },
    // box standing on y (base)
    box(w, h, d, x, y, z, c, o = {}) {
      const g = o.bev ? chamferBox(w, h, d, o.bev) : new THREE.BoxGeometry(w, h, d);
      if (o.ctr) return k.add(g, x, y, z, c, o);
      g.translate(0, h / 2, 0);
      return k.add(g, x, y, z, c, o);
    },
    cyl(r1, r2, h, x, y, z, c, seg = 8, o = {}) { return k.add(new THREE.CylinderGeometry(r1, r2, h, seg, 1, !!o.open).translate(0, o.ctr ? 0 : h / 2, 0), x, y, z, c, o); },
    cone(rad, h, x, y, z, c, seg = 7, o = {}) { return k.add(new THREE.ConeGeometry(rad, h, seg).translate(0, h / 2, 0), x, y, z, c, o); },
    ball(rad, x, y, z, c, o = {}) { return k.add(new THREE.IcosahedronGeometry(rad, o.det ?? 1), x, y, z, c, o); },
    sphere(rad, x, y, z, c, ws = 10, hs = 6, o = {}) { return k.add(new THREE.SphereGeometry(rad, ws, hs, 0, TAU, 0, o.half ? Math.PI / 2 : Math.PI), x, y, z, c, o); },
    // lathe from [[radius, y], ...] going upward
    lathe(pts, seg, x, y, z, c, o = {}) { return k.add(new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), seg), x, y, z, c, o); },
    torus(R, t, x, y, z, c, o = {}) { return k.add(new THREE.TorusGeometry(R, t, o.ts ?? 5, o.rs ?? 16, o.arc ?? TAU), x, y, z, c, o); },
    // a cylinder between two points
    beam(a, b, rad, c, seg = 6, o = {}) {
      const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), len = va.distanceTo(vb);
      const g = new THREE.CylinderGeometry(rad * (o.taper ?? 1), rad, len, seg);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize()));
      return k.add(g, (va.x + vb.x) / 2, (va.y + vb.y) / 2, (va.z + vb.z) / 2, c, o);
    },
    // a square-section plank between two points
    plank(a, b, w, t, c, o = {}) {
      const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), len = va.distanceTo(vb);
      const g = new THREE.BoxGeometry(w, len, t);
      const dir = vb.clone().sub(va).normalize();
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
      return k.add(g, (va.x + vb.x) / 2, (va.y + vb.y) / 2, (va.z + vb.z) / 2, c, o);
    },
    // lumpy rock; flat=true squashes everything below the local base to y = 0
    rock(rad, x, y, z, c, o = {}) {
      const g = new THREE.IcosahedronGeometry(rad, o.det ?? 0);
      const p = g.attributes.position.array, amp = o.amp ?? 0.28, keyR = new Map();
      for (let i = 0; i < p.length; i += 3) {
        const key = `${p[i].toFixed(3)},${p[i + 1].toFixed(3)},${p[i + 2].toFixed(3)}`;
        if (!keyR.has(key)) keyR.set(key, 1 + (r() - 0.5) * 2 * amp);
        const f = keyR.get(key); p[i] *= f; p[i + 1] *= f; p[i + 2] *= f;
      }
      place(g, o);
      if (o.flat !== false) for (let i = 1; i < p.length; i += 3) if (p[i] < -(o.sink ?? 0) ) p[i] = -(o.sink ?? 0);
      return k.add(g, x, y, z, c, { ...o, s: undefined, rx: 0, ry: 0, rz: 0 });
    },
    // a pointed crystal (hex prism + tip) from base point along a direction
    crystal(x, y, z, len, rad, c, tilt = 0, yaw = 0, o = {}) {
      const g = new THREE.CylinderGeometry(rad, rad * 0.85, len * 0.7, 6).translate(0, len * 0.35, 0).toNonIndexed();
      const t = new THREE.ConeGeometry(rad, len * 0.3, 6).translate(0, len * 0.85, 0).toNonIndexed();
      const m = new THREE.BufferGeometry();
      const a = new Float32Array(g.attributes.position.array.length + t.attributes.position.array.length);
      a.set(g.attributes.position.array); a.set(t.attributes.position.array, g.attributes.position.array.length);
      m.setAttribute('position', new THREE.BufferAttribute(a, 3));
      m.rotateZ(tilt).rotateY(yaw);
      return k.add(m, x, y, z, c, o);
    },
    // a flat polygon (list of [x,y,z] in order), double sided if ds
    poly(pts, c, o = {}) {
      const T = [];
      for (let i = 1; i < pts.length - 1; i++) { T.push(...pts[0], ...pts[i], ...pts[i + 1]); if (o.ds) T.push(...pts[0], ...pts[i + 1], ...pts[i]); }
      return k.add(fromTris(T), 0, 0, 0, c, o);
    },
    // a gable roof: w along x, d along z, ridge along x
    roof(w, h, d, x, y, z, c, o = {}) {
      const W = w / 2, D = d / 2, t = o.t ?? 0.03;
      const P = [
        [-W, 0, D], [W, 0, D], [W, h, 0], [-W, 0, D], [W, h, 0], [-W, h, 0],
        [W, 0, -D], [-W, 0, -D], [-W, h, 0], [W, 0, -D], [-W, h, 0], [W, h, 0],
        [-W, -t, D], [-W, h - t, 0], [W, h - t, 0], [-W, -t, D], [W, h - t, 0], [W, -t, D],
        [W, -t, -D], [W, h - t, 0], [-W, h - t, 0], [W, -t, -D], [-W, h - t, 0], [-W, -t, -D],
      ];
      const g = fromTris(P.flat());
      return k.add(g, x, y, z, c, o);
    },
    gable(w, h, d, x, y, z, c, o = {}) { // the triangular end walls (solid prism) below a roof
      const W = w / 2, D = d / 2;
      const P = [[-W, 0, D], [W, 0, D], [W, h, 0], [-W, 0, D], [W, h, 0], [-W, h, 0], [W, 0, -D], [-W, 0, -D], [-W, h, 0], [W, 0, -D], [-W, h, 0], [W, h, 0], [-W, 0, -D], [-W, 0, D], [-W, h, 0], [W, 0, D], [W, 0, -D], [W, h, 0]];
      return k.add(fromTris(P.flat()), x, y, z, c, o);
    },
  };
  return k;
}

// Round 3 grade, applied in sRGB: push saturation so objects pop against the calmer ground.
// No dark lift any more: objects use the full value range (bright lit tops, darker
// openings and seams); only true near-black is floored so nothing turns to murk.
const toS = (v) => Math.pow(Math.max(0, v), 1 / 2.2), toL = (v) => Math.pow(Math.max(0, v), 2.2);
function grade(c) {
  let r = toS(c.r), g = toS(c.g), b = toS(c.b);
  const l = r * 0.299 + g * 0.587 + b * 0.114, sat = 1.22;
  r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat;
  // a tiny floor (warm, not grey) so the darkest accents stay coloured
  const k = 0.05 * Math.pow(1 - Math.min(1, l), 3);
  r += k; g += k * 0.8; b += k * 0.85;
  c.r = toL(Math.min(1, r)); c.g = toL(Math.min(1, g)); c.b = toL(Math.min(1, b));
}

function finish(parts, glow, aoH) {
  let n = 0;
  for (const p of parts) n += p.g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), uv = glow ? null : new Float32Array(n * 2);
  let o = 0;
  const ranges = [];
  for (const p of parts) {
    const g = p.g;
    g.computeVertexNormals();
    const P = g.attributes.position.array, N = g.attributes.normal.array, cnt = g.attributes.position.count;
    if (p.rig) ranges.push([o, cnt, p.rig]);
    let y0 = Infinity, y1 = -Infinity;
    for (let i = 1; i < P.length; i += 3) { y0 = Math.min(y0, P[i]); y1 = Math.max(y1, P[i]); }
    const rr = rng(p.seed);
    let jf = 1;
    for (let v = 0; v < cnt; v++) {
      const i3 = v * 3, x = P[i3], y = P[i3 + 1], z = P[i3 + 2], nx = N[i3], ny = N[i3 + 1], nz = N[i3 + 2];
      if (v % 3 === 0) jf = 1 + (rr() - 0.5) * 2 * p.jit;
      const c = p.c;
      if (typeof c === 'function') c(_c, x, y, z, nx, ny, nz, (y - y0) / Math.max(1e-6, y1 - y0));
      else if (Array.isArray(c)) { const t = (y - y0) / Math.max(1e-6, y1 - y0); _c.set(c[0]).lerp(_c2.set(c[1]), t); }
      else _c.set(c);
      let f = jf;
      if (!glow) {
        // the shared material already darkens near the ground: keep ours soft and warm
        // value structure: lit tops bright, sides mid, undersides and the base darker
        if (p.ao) f *= 0.74 + 0.26 * Math.min(1, Math.max(0, y / aoH));
        f *= ny > 0 ? 1 + 0.24 * ny : 1 + 0.2 * ny;
        grade(_c);
      }
      pos[o * 3] = x; pos[o * 3 + 1] = y; pos[o * 3 + 2] = z;
      nor[o * 3] = nx; nor[o * 3 + 1] = ny; nor[o * 3 + 2] = nz;
      col[o * 3] = Math.min(1, _c.r * f); col[o * 3 + 1] = Math.min(1, _c.g * f); col[o * 3 + 2] = Math.min(1, _c.b * f);
      if (uv) {
        const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
        if (ax >= ay && ax >= az) { uv[o * 2] = z; uv[o * 2 + 1] = y; }
        else if (ay >= az) { uv[o * 2] = x; uv[o * 2 + 1] = z; }
        else { uv[o * 2] = x; uv[o * 2 + 1] = y; }
      }
      o++;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (uv) geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  ensureRig(THREE, geo); // every geometry drawn with the shared rig-aware materials carries aBone/aPivot
  for (const [start, count, rg] of ranges) tagRange(THREE, geo, start, count, rg.b, rg.p);
  geo.computeBoundingSphere();
  return geo;
}
const done = (k, aoH = 0.25) => ({ body: finish(k.B, false, aoH), glow: k.G.length ? finish(k.G, true, aoH) : null });

// ---------------------------------------------------------------- palette
const C = {
  gold: 0xffc020, goldD: 0xc8861a, goldL: 0xffe070,
  wood: 0xa86a38, woodD: 0x74482a, woodL: 0xd89a58, plank: 0xc08a50, bark: 0x7a4e2c, ring: 0xe8c88a,
  iron: 0x6e7286, ironL: 0xa8acc0, steel: 0xc8ccd8,
  stone: 0xb8b0a0, stoneD: 0x8a8274, stoneL: 0xd2ccbe, marble: 0xeee6d6, sand: 0xd8b878,
  rock: 0xa8967e, rockD: 0x7a6a58, rockL: 0xb8a890,
  dirt: 0x7a5a3a, grass: 0x5a9a3a, grassL: 0x8ac04a,
  red: 0xc8322a, redD: 0x7a1a18, blue: 0x2a5ac8, blueD: 0x1a2a6a, purple: 0x7a3ac8, cyan: 0x3ad8ff,
  roofR: 0xb83a28, roofB: 0x2a4aa8, thatch: 0xc8a050, cloth: 0xf0e6cc, dark: 0x4a2e2a,
};
// glow colours are multiplied ~2.2x by the game's glow material
const GL = { fire: 0xff8a20, fireY: 0xffd860, gold: 0xffc040, cyan: 0x40d0ff, violet: 0xb060ff, pink: 0xff50a0, green: 0x50ff90, warm: 0xffb048, white: 0xd8e8ff, red: 0xff3020 };

// stone with random block mottling
const mottle = (a, b, sc = 9) => (c, x, y, z) => { const t = (Math.sin(x * sc + Math.floor(y * sc * 0.7) * 2.1) * Math.cos(z * sc * 1.3 + y * 3) + 1) / 2; c.set(a).lerp(_c2.set(b), t); };
// a log: bark on the side, pale rings on the caps (log axis along local y before rotation)
const logCol = (bark, ringC) => (c, x, y, z, nx, ny, nz, t) => c.set(Math.abs(ny) > 0.95 ? ringC : bark);

function log(k, a, b, rad, o = {}) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), len = va.distanceTo(vb);
  const g = new THREE.CylinderGeometry(rad, rad, len, o.seg ?? 7).toNonIndexed();
  // colour by local normal before rotation: tag via a temporary colour function
  const P = g.attributes.position.array, isCap = [];
  for (let i = 0; i < P.length; i += 9) isCap.push(Math.abs(P[i + 1] - P[i + 4]) < 1e-6 && Math.abs(P[i + 1] - P[i + 7]) < 1e-6);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize()));
  g.translate((va.x + vb.x) / 2, (va.y + vb.y) / 2, (va.z + vb.z) / 2);
  // split into bark and caps
  const bark = [], caps = [];
  for (let f = 0; f < isCap.length; f++) (isCap[f] ? caps : bark).push(...P.slice(f * 9, f * 9 + 9));
  k.add(fromTris(bark), 0, 0, 0, o.bark ?? [C.woodD, C.wood], { jit: 0.14 });
  const ringC = o.ring ?? C.ring;
  k.add(fromTris(caps), 0, 0, 0, (c, x, y, z) => {
    const d = Math.min(Math.hypot(x - va.x, y - va.y, z - va.z), Math.hypot(x - vb.x, y - vb.y, z - vb.z));
    c.set(0xc88a48).lerp(_c2.set(ringC), Math.min(1, d / (rad * 0.9)));
  }, { jit: 0.06, ao: false });
}
function coin(k, x, y, z, tilt = 0, yaw = 0, rad = 0.05) {
  // R4: thick, bright pale-gold face with a deep amber rim (reads as a coin, not a speck)
  k.cyl(rad, rad, Math.max(0.014, rad * 0.28), x, y, z, (c, px, py, pz, nx, ny) => c.set(Math.abs(ny) > 0.9 ? 0xffe066 : C.goldD), 9, { rx: tilt, ry: yaw, jit: 0.06, ctr: true });
}
function sparkle(k, x, y, z, s = 0.03, c = GL.goldL ?? 0xfff0b0) {
  k.add(new THREE.OctahedronGeometry(s, 0).scale(0.35, 1.6, 0.35), x, y, z, c, { glow: true });
  k.add(new THREE.OctahedronGeometry(s, 0).scale(1.6, 0.35, 0.35), x, y, z, c, { glow: true });
}
function lantern(k, x, y, z, c = GL.warm) {
  k.box(0.05, 0.012, 0.05, x, y, z, C.iron);
  k.box(0.035, 0.05, 0.035, x, y + 0.012, z, c, { glow: true });
  k.cone(0.035, 0.03, x, y + 0.062, z, C.iron, 4, { ry: Math.PI / 4 });
}
// a ground patch, irregular disc
function patch(k, rad, c, y = 0, h = 0.03, seg = 11, x = 0, z = 0) {
  const g = new THREE.CylinderGeometry(rad, rad * 1.06, h, seg).toNonIndexed();
  const p = g.attributes.position.array, m = new Map();
  for (let i = 0; i < p.length; i += 3) {
    const key = Math.atan2(p[i + 2], p[i]).toFixed(2);
    if (Math.hypot(p[i], p[i + 2]) < 1e-4) continue;
    if (!m.has(key)) m.set(key, 0.85 + k.r() * 0.3);
    const f = m.get(key); p[i] *= f; p[i + 2] *= f;
  }
  g.translate(0, h / 2, 0);
  k.add(g, x, y, z, c, { ao: false, jit: 0.08 });
}
// a cobbled pad for visit sites: cool grey-brown stones with dark joints, a darker kerb.
// Mid value + neutral hue so it separates from green grass, ochre sand, white snow and brown dirt.
function pad(k, rad, x = 0, z = 0, seg = 12) {
  k.cyl(rad, rad * 1.04, 0.03, x, 0, z, (c, px, py, pz, nx, ny) => c.set(ny > 0.5 ? 0x7e746a : 0x4e4440), seg, { ao: false, jit: 0.06 });
  // a ring of paler flagstones near the edge: breaks the disc into readable cobbles
  const n = Math.round(rad * 22);
  for (let i = 0; i < n; i++) {
    const a = (i + 0.5) / n * TAU, r = rad * 0.8;
    k.box(rad * 0.3, 0.014, rad * 0.2, x + Math.sin(a) * r, 0.03, z + Math.cos(a) * r, [0xa49888, 0xbcb0a0, 0x988c7e][i % 3], { ry: a, ao: false, jit: 0.04 });
  }
}
// a torch on a post: dark iron cup with a bright flame
function torch(k, x, y, z, h = 0.26) {
  k.beam([x, y, z], [x, y + h, z], 0.014, [0x4a2a18, 0x7a4a28], 5);
  k.lathe([[0.001, 0], [0.02, 0], [0.04, 0.04], [0.035, 0.045]], 6, x, y + h, z, 0x3a3236);
  k.bone(BONE.CLOTH, [x, y + h + 0.03, z], () => { // flame flicker
    k.cone(0.035, 0.11, x, y + h + 0.03, z, GL.fire, 5, { glow: true });
    k.cone(0.02, 0.07, x, y + h + 0.035, z, GL.fireY, 5, { glow: true });
  });
}
// a tall pole with a hanging banner facing +z
function banner(k, x, y, z, h, c, w = 0.14, bh = 0.22) {
  k.beam([x, y, z], [x, y + h, z], 0.014, [0x4a2a18, 0x8a5430], 5);
  k.beam([x - 0.01, y + h - 0.02, z + 0.015], [x + w + 0.01, y + h - 0.02, z + 0.015], 0.01, 0x5a3420, 4);
  const top = y + h - 0.03, bot = top - bh;
  k.bone(BONE.FLAG, [x, top, z + 0.02], () => {
    k.poly([[x, top, z + 0.02], [x + w, top, z + 0.02], [x + w, bot, z + 0.02], [x + w / 2, bot + 0.05, z + 0.02], [x, bot, z + 0.02]], (cc, px, py) => cc.set(c).lerp(_c2.set(0xffffff), py > top - 0.03 ? 0.15 : 0), { ds: true, ao: false, jit: 0.03 });
    k.box(w * 0.4, w * 0.4, 0.008, x + w / 2, top - bh * 0.55, z + 0.024, C.gold, { ctr: true, rz: Math.PI / 4, ao: false });
  });
  k.ball(0.022, x, y + h + 0.012, z, C.gold, { det: 0 });
}
function cart(k, x, z, ry, load, loadCol, glowLoad = false, sc = 1) {
  const sub = makeKit(7);
  // bin: tapered square
  sub.add(new THREE.CylinderGeometry(0.17, 0.12, 0.13, 4).rotateY(Math.PI / 4).scale(1, 1, 0.75).translate(0, 0.065, 0), 0, 0.06, 0, [0x9a5a2e, 0xd08a48], { jit: 0.08 });
  sub.box(0.25, 0.018, 0.2, 0, 0.17, 0, C.iron);
  sub.box(0.25, 0.018, 0.2, 0, 0.09, 0, C.iron);
  for (const [wx, wz] of [[-0.09, 0.1], [0.09, 0.1], [-0.09, -0.1], [0.09, -0.1]]) sub.cyl(0.045, 0.045, 0.02, wx, 0.045, wz, C.iron, 8, { rx: Math.PI / 2, ctr: true });
  for (let i = 0; i < 6; i++) {
    const lx = (i % 3 - 1) * 0.07, lz = (Math.floor(i / 3) - 0.5) * 0.08;
    if (load === 'gold') sub.ball(0.045, lx, 0.19 + (i % 2) * 0.02, lz, glowLoad ? GL.gold : C.gold, { det: 0, glow: glowLoad && i % 2 === 0 });
    else sub.rock(0.05, lx, 0.17 + (i % 2) * 0.02, lz, loadCol, { flat: false, amp: 0.3 });
  }
  if (load === 'gold') for (let i = 0; i < 4; i++) sub.ball(0.04, (i - 1.5) * 0.05, 0.2, 0, C.gold, { det: 0 });
  for (const p of sub.B) { p.g.scale(sc, sc, sc).rotateY(ry).translate(x, 0, z); k.B.push(p); }
  for (const p of sub.G) { p.g.scale(sc, sc, sc).rotateY(ry).translate(x, 0, z); k.G.push(p); }
}
function rails(k, x0, z0, x1, z1, y = 0.012) {
  const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len, px = -uz, pz = ux;
  for (const s of [-1, 1]) k.plank([x0 + px * 0.075 * s, y + 0.02, z0 + pz * 0.075 * s], [x1 + px * 0.075 * s, y + 0.02, z1 + pz * 0.075 * s], 0.014, 0.014, C.ironL, { jit: 0.02 });
  const n = Math.max(2, Math.round(len / 0.1));
  for (let i = 0; i <= n; i++) {
    const t = i / n, cx = x0 + dx * t, cz = z0 + dz * t;
    k.box(0.22, 0.018, 0.04, cx, y, cz, C.woodD, { ry: Math.atan2(ux, uz) });
  }
}

// a roof of overlapping shingle rows; ridge along x, eaves at z = ±d/2
function shingles(k, w, h, d, x, y, z, ca, cb, rows = 4) {
  const D = d / 2, a = Math.atan2(h, D), L = Math.hypot(h, D), seg = L / rows;
  for (const s of [-1, 1]) for (let i = 0; i < rows; i++) {
    const t = (i + 0.5) / rows, lift = 0.012 * (rows - i);
    k.box(w + (i === 0 ? 0.02 : 0), 0.022, seg * 1.3, x, y + h * t + lift * Math.cos(a), z + s * (D * (1 - t) + lift * Math.sin(a) * 0.4), i % 2 ? cb : ca, { ctr: true, rx: s * a, jit: 0.1 });
  }
  k.beam([x - w / 2 - 0.01, y + h + 0.02, z], [x + w / 2 + 0.01, y + h + 0.02, z], 0.022, C.woodD, 5);
}

// ---------------------------------------------------------------- resource piles (~0.7)
// R4 (mobile read): pickups are ~30-40 px on the map, so each is built from a few big
// identity shapes (big coins and bars, big crystals, a domed chest lid, fat logs) with
// strong colour blocks and light-top / dark-underside value bands. No scattered micro bits.
function bar(k, x, y, z, ry, s = 1) {
  // a gold ingot: trapezoid with a bright top face and a deeper amber side
  const g = new THREE.CylinderGeometry(0.075 * Math.SQRT1_2, 0.1 * Math.SQRT1_2, 0.055, 4, 1).rotateY(Math.PI / 4).scale(1.9, 1, 1).toNonIndexed();
  k.add(g, x, y + 0.0275 * s, z, (c, px, py, pz, nx, ny) => c.set(ny > 0.8 ? 0xffe46a : 0xe0951a), { s, ry, jit: 0.03 });
}
function goldPile(k) {
  // a low mound of gold, a few BIG coins on it, a stack of three bars and one big upright coin
  // the mound is a deeper amber so the bright coins and bars on it stand apart (value bands)
  k.lathe([[0.001, 0], [0.31, 0], [0.28, 0.06], [0.19, 0.15], [0.08, 0.21], [0.001, 0.225]], 9, 0.0, 0.0, -0.03, [0xb87010, 0xf4b82c], { jit: 0.1 });
  const coins = [[-0.12, 0.15, 0.02, 0.4, 0.3], [0.08, 0.17, -0.1, -0.35, 1.2], [-0.03, 0.22, -0.11, 0.2, 2.0], [0.2, 0.07, 0.04, -0.55, 0.6], [-0.24, 0.07, -0.1, 0.6, 2.6]];
  for (const [x, y, z, t, yw] of coins) coin(k, x, y, z, t, yw, 0.095);
  // the bar stack (front right): the strongest "treasury" shape
  bar(k, 0.14, 0.0, 0.2, 0.25, 1.2); bar(k, 0.27, 0.0, 0.09, 0.25, 1.2); bar(k, 0.205, 0.066, 0.145, 0.25, 1.2);
  // a big upright coin at the front left: the icon, with a raised rim and a bright face
  k.cyl(0.14, 0.14, 0.04, -0.12, 0.14, 0.19, (c, x, y, z, nx, ny, nz) => c.set(Math.abs(nz) > 0.8 ? 0xffd030 : 0xd08a18), 12, { rx: Math.PI / 2 - 0.35, ry: 0.25, ctr: true, jit: 0.03 });
  k.cyl(0.09, 0.09, 0.048, -0.12, 0.14, 0.19, 0xfff09a, 12, { rx: Math.PI / 2 - 0.35, ry: 0.25, ctr: true, jit: 0.02 });
  sparkle(k, -0.02, 0.27, -0.04, 0.06, 0xfff0b0); sparkle(k, 0.2, 0.17, 0.12, 0.045, 0xfff0b0);
}
function woodPile(k) {
  // a pyramid of fat logs running front to back, pale ring ends facing the viewer
  const L = 0.5, rad = 0.082;
  const rows = [[-0.246, -0.082, 0.082, 0.246], [-0.164, 0, 0.164], [-0.082, 0.082]];
  rows.forEach((row, ri) => row.forEach((x) => {
    const y = 0.006 + rad + ri * rad * 1.72, off = (k.r() - 0.5) * 0.06, rr = rad * k.rr(0.94, 1.04);
    log(k, [x + (k.r() - 0.5) * 0.02, y, -L / 2 + off - 0.04], [x, y, L / 2 + off - 0.04], rr, { seg: 7, bark: [0x8a5430, 0xc88a4c] });
  }));
  // a stump with a big axe
  k.cyl(0.08, 0.095, 0.11, 0.28, 0.0, 0.25, (c, x, y, z, nx, ny) => c.set(ny > 0.9 ? C.ring : C.bark), 7);
  k.plank([0.28, 0.11, 0.25], [0.38, 0.32, 0.31], 0.03, 0.03, C.woodL);
  k.box(0.03, 0.09, 0.11, 0.29, 0.1, 0.25, C.steel, { rz: -0.9, ry: 0.3, bev: 0.008 });
}
function orePile(k) {
  cart(k, -0.1, -0.08, 0.5, 'ore', [0x3a4a78, 0x8a9ad0], false, 1.3);
  // a few big chunks of iron-grey and rust-red ore in front of the cart
  const cols = [[0x3a4a78, 0x9aaae0], [0x8a2a10, 0xf0884a]];
  const set = [[0.16, 0.13, 0.12], [-0.03, 0.22, 0.1], [0.27, -0.02, 0.09], [-0.2, 0.16, 0.08]];
  set.forEach(([x, z, r], i) => k.rock(r, x, 0.0, z, cols[i % 2], { amp: 0.22, s: [1, 0.8, 1] }));
  // pickaxe leaning on the cart: a thick handle and a big steel head
  k.plank([0.12, 0.0, 0.0], [0.05, 0.32, -0.12], 0.03, 0.03, C.woodL);
  k.add(new THREE.BoxGeometry(0.26, 0.04, 0.04), 0.05, 0.32, -0.12, C.steel, { rz: 0.25, ry: -0.3 });
}
function gemPile(k) {
  // three BIG crystals in strong, distinct hues on a pale rock, one small blue at the front
  k.rock(0.22, 0, 0, 0, [0x9a88b8, 0xd8ccf0], { s: [1.15, 0.32, 1], amp: 0.18 });
  const set = [
    [0.0, -0.03, 0.5, 0.1, 0.06, 0, [0xc8185a, 0xff8ab8]], // magenta: the tall centre stone
    [0.14, 0.04, 0.34, 0.085, -0.55, 0.5, [0x10a088, 0x80ffe0]], // emerald-teal
    [-0.15, 0.05, 0.36, 0.085, 0.55, -0.3, [0x6030d8, 0xc8a0ff]], // violet
    [0.02, 0.17, 0.2, 0.065, 0.45, 2.4, [0x1a58e0, 0x90d0ff]], // sapphire
  ];
  for (const [x, z, len, rad, tilt, yaw, c] of set) k.crystal(x, 0.03, z, len, rad, c, tilt, yaw, { jit: 0.05 });
  // inner glow in the big stone so it glints from any side
  k.crystal(0, 0.05, -0.03, 0.36, 0.045, GL.pink, 0.06, 0, { glow: true });
  sparkle(k, 0.03, 0.56, -0.02, 0.05, 0xffd0f0);
}

// ---------------------------------------------------------------- treasure
function chest(k) {
  // THE CHEST: one bold red-brown box, thick bright-gold bands, a big lock, a big DOMED lid
  // thrown open on a heap of gold. No planks, rivets or scattered coins.
  const W = 0.46, D = 0.3, H = 0.21, y0 = 0, z0 = -0.02;
  k.box(W, H, D, 0, y0, z0, [0x5e180a, 0x9a3016], { bev: 0.014, jit: 0.04 });
  // dark inside rim, a high heap of gold
  k.box(W - 0.04, 0.01, D - 0.04, 0, y0 + H - 0.004, z0, 0x2e1008, { ao: false, jit: 0 });
  k.lathe([[0.001, 0], [0.21, 0], [0.17, 0.05], [0.09, 0.105], [0.001, 0.125]], 9, 0, y0 + H - 0.01, z0, [0xe09a10, 0xfff070], { s: [1, 1, 0.62], jit: 0.12 });
  coin(k, 0.08, y0 + H + 0.07, z0 + 0.01, 0.4, 0.5, 0.075);
  // thick gold bands, a base band and corner caps
  const gold = [0xd88a10, 0xffd448];
  for (const x of [-0.15, 0.15]) k.box(0.07, H + 0.012, D + 0.022, x, y0 - 0.004, z0, gold, { jit: 0.03, bev: 0.008 });
  k.box(W + 0.02, 0.045, D + 0.02, 0, y0, z0, [0xb06a0c, 0xe8a828], { jit: 0.03, bev: 0.006 });
  // big lock plate with a dark keyhole
  k.box(0.13, 0.14, 0.03, 0, y0 + H - 0.15, z0 + D / 2 + 0.008, [0xe0a020, 0xffe878], { bev: 0.014 });
  k.box(0.03, 0.055, 0.012, 0, y0 + H - 0.125, z0 + D / 2 + 0.026, 0x241008, { ao: false, jit: 0 });
  // the open lid: a tall half-cylinder dome hinged at the back, tipped back so it stands up
  // behind the chest (a tall, readable silhouette)
  const tip = -1.9;
  const lg = new THREE.CylinderGeometry(D / 2, D / 2, W, 9, 1, false, 0, Math.PI).toNonIndexed();
  lg.rotateZ(Math.PI / 2).scale(1, 1.05, 1).translate(0, 0, D / 2);
  lg.rotateX(tip);
  k.add(new THREE.BoxGeometry(W - 0.01, 0.012, D - 0.01).translate(0, 0.006, D / 2).rotateX(tip), 0, y0 + H, z0 - D / 2, 0x3a140a, { jit: 0.03, ao: false });
  k.add(lg, 0, y0 + H, z0 - D / 2, [0x8a2812, 0xc44a22], { jit: 0.06, ao: false });
  // gold trim along the lid's free edge (catches the light at the top of the silhouette)
  { const e = new THREE.BoxGeometry(W + 0.012, 0.04, 0.04).translate(0, 0, D).rotateX(tip); k.add(e, 0, y0 + H, z0 - D / 2, C.goldL, { jit: 0.03, ao: false }); }
  const band = (x) => {
    const bg = new THREE.CylinderGeometry(D / 2 + 0.012, D / 2 + 0.012, 0.07, 9, 1, false, 0, Math.PI).toNonIndexed();
    bg.rotateZ(Math.PI / 2).scale(1, 1.05, 1).translate(x, 0, D / 2).rotateX(tip);
    k.add(bg, 0, y0 + H, z0 - D / 2, gold, { jit: 0.03, ao: false });
  };
  band(-0.15); band(0.15);
  // two big coins spilling at the front and one big red gem on the heap
  coin(k, -0.12, 0.008, z0 + D / 2 + 0.1, 0.1, 0.4, 0.075);
  coin(k, 0.13, 0.008, z0 + D / 2 + 0.12, -0.1, 1.3, 0.07);
  k.add(new THREE.OctahedronGeometry(0.06, 0).scale(1, 1.3, 1), -0.08, y0 + H + 0.11, z0 + 0.02, 0xff2a4a, { jit: 0.04 });
  // a warm glow coming off the gold and a bright glint
  k.lathe([[0.001, 0], [0.13, 0], [0.07, 0.045], [0.001, 0.06]], 8, 0, y0 + H + 0.05, z0, 0x9a6410, { glow: true, s: [1, 1, 0.6] });
  sparkle(k, -0.03, y0 + H + 0.19, z0, 0.065, 0xfff0b0);
}
function artifact(k) {
  // dais and a plain pedestal (big shapes), the relic floating above: a big violet gem in a
  // thick gold cage. No runes or scattered sparkles.
  k.cyl(0.3, 0.33, 0.06, 0, 0, 0, [C.stoneD, C.stone], 8);
  k.lathe([[0.001, 0.06], [0.16, 0.06], [0.16, 0.11], [0.1, 0.15], [0.085, 0.2], [0.085, 0.4], [0.12, 0.44], [0.16, 0.47], [0.16, 0.51], [0.001, 0.51]], 8, 0, 0, 0, [C.stone, C.marble], { jit: 0.05 });
  const y = 0.74;
  k.add(new THREE.OctahedronGeometry(0.14, 0).scale(1, 1.45, 1), 0, y, 0, GL.violet, { glow: true });
  k.add(new THREE.OctahedronGeometry(0.075, 0).scale(1, 1.45, 1), 0, y, 0, 0xffe0ff, { glow: true, s: 1.05 });
  k.torus(0.18, 0.024, 0, y, 0, [C.goldD, C.goldL], { rx: Math.PI / 2 + 0.3, rs: 14, ts: 4 });
  k.torus(0.18, 0.024, 0, y, 0, [C.goldD, C.goldL], { ry: 0.6, rx: 0.2, rs: 14, ts: 4 });
  k.cone(0.04, 0.08, 0, y + 0.2, 0, C.gold, 4);
  k.cone(0.04, 0.08, 0, y - 0.2, 0, C.gold, 4, { rx: Math.PI });
  // light pooling on the pedestal top
  k.cyl(0.14, 0.14, 0.004, 0, 0.512, 0, 0x6a3aa0, 10, { glow: true });
  sparkle(k, 0.2, y + 0.16, 0.06, 0.05, 0xf0d8ff);
}
function campfire(k) {
  // R3/R4: a tall flame gives a vertical silhouette that reads on any ground (swamp included);
  // a ring of a few big pale stones and a warm glow disc mark the spot from above.
  k.cyl(0.17, 0.18, 0.012, 0, 0.012, 0, 0x5a4034, 10);
  for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; k.rock(0.085, Math.cos(a) * 0.23, 0.0, Math.sin(a) * 0.23, [0xa8a296, 0xf0e8d8], { amp: 0.2, s: [1, 0.75, 1] }); }
  // crossed logs (teepee): fewer, thicker
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.4; log(k, [Math.cos(a) * 0.17, 0.02, Math.sin(a) * 0.17], [Math.cos(a) * 0.02, 0.22, Math.sin(a) * 0.02], 0.034, { seg: 5, bark: [0x5a3418, 0x9a6034] }); }
  // flames: a big orange cone, a yellow core and three outer tongues (CLOTH: flicker about the base)
  k.bone(BONE.CLOTH, [0, 0.03, 0], () => {
    for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; k.cone(0.08, 0.3 + k.r() * 0.08, Math.cos(a) * 0.05, 0.03, Math.sin(a) * 0.05, GL.fire, 5, { glow: true, rz: Math.cos(a) * 0.25, rx: -Math.sin(a) * 0.25 }); }
    k.cone(0.11, 0.54, 0, 0.03, 0, 0xf05a1a, 6, { glow: true });
    k.cone(0.065, 0.4, 0, 0.04, 0, GL.fireY, 5, { glow: true });
  });
  // two log seats
  log(k, [-0.36, 0.05, 0.12], [-0.32, 0.05, -0.2], 0.05, { bark: [0x4a2e18, 0x7a4e2a] });
  log(k, [0.12, 0.05, 0.38], [0.38, 0.05, 0.2], 0.05, { bark: [0x4a2e18, 0x7a4e2a] });
  // warm light pooled on the ground: wide, so the spot reads even from above
  k.cyl(0.3, 0.3, 0.003, 0, 0.006, 0, 0x7a3008, 14, { glow: true });
  k.cyl(0.16, 0.16, 0.003, 0, 0.026, 0, 0x8a3a0a, 10, { glow: true });
}

// ---------------------------------------------------------------- mines
// a craggy massif behind the front edge; returns the peaks as ellipsoids for placing details
const PEAKS = [[0, -0.24, 0.34, 0.66, 0.28], [-0.33, -0.14, 0.24, 0.4, 0.22], [0.34, -0.17, 0.22, 0.48, 0.2], [-0.33, 0.1, 0.17, 0.16, 0.14], [0.32, 0.08, 0.16, 0.14, 0.13], [0.12, -0.42, 0.2, 0.36, 0.16]];
function mountain(k, cols) {
  for (const [x, z, rx, ry, rz] of PEAKS) k.rock(1, x, 0, z, cols, { det: 1, amp: 0.14, s: [rx, ry, rz] });
  return PEAKS;
}
// a point on a peak's surface (az 0 = facing +z) and its outward direction
function onPeak(i, az, el, out = 0.92) {
  const [x, z, rx, ry, rz] = PEAKS[i];
  const d = [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
  const n = new THREE.Vector3(d[0] / rx, d[1] / ry, d[2] / rz).normalize();
  return { p: [x + d[0] * rx * out, d[1] * ry * out, z + d[2] * rz * out], n: [n.x, n.y, n.z] };
}
function crystalAlong(k, p, n, len, rad, c, o) {
  const v = new THREE.Vector3(n[0], n[1] + 1.1, n[2]).normalize(); n = [v.x, v.y, v.z];
  const tilt = Math.acos(Math.max(-1, Math.min(1, n[1]))), yaw = Math.atan2(n[2], -n[0]);
  k.crystal(p[0], p[1], p[2], len, rad, c, tilt, yaw, o);
}
function mineEntrance(k, x, z, w = 0.3, h = 0.3, inner = GL.gold) {
  // a dark adit (a small, deliberate dark accent) with a lamp-lit glow deep inside,
  // framed by heavy, bright timbers so the opening reads at a glance
  k.box(w + 0.02, h, 0.25, x, 0.0, z - 0.15, 0x22120c, { ao: false, jit: 0 });
  k.box(w * 0.4, h * 0.35, 0.01, x, 0.0, z - 0.02, inner, { glow: true });
  for (const s of [-1, 1]) {
    k.box(0.075, h + 0.02, 0.08, x + s * (w / 2 + 0.03), 0, z + 0.03, [0x8a4a1e, 0xd08848], { bev: 0.012 });
    k.plank([x + s * (w / 2 + 0.01), h - 0.08, z + 0.085], [x + s * (w / 2 - 0.08), h + 0.0, z + 0.085], 0.035, 0.025, 0xe0a058);
  }
  k.box(w + 0.2, 0.075, 0.09, x, h + 0.01, z + 0.03, [0x9a5424, 0xe8a058], { bev: 0.012 });
  k.box(w + 0.08, 0.045, 0.06, x, h + 0.085, z + 0.0, 0xf0b468, { bev: 0.008 });
}
// a big glittering nugget cluster
function nuggets(k, x, y, z, s = 1) {
  k.add(new THREE.IcosahedronGeometry(0.06 * s, 0).scale(1.2, 0.8, 1), x, y + 0.03 * s, z, [0xe8a010, 0xfff070], { jit: 0.12 });
  k.add(new THREE.IcosahedronGeometry(0.04 * s, 0), x + 0.06 * s, y + 0.02 * s, z + 0.02 * s, [0xe8a010, 0xffe050], { jit: 0.12 });
  k.add(new THREE.IcosahedronGeometry(0.035 * s, 0), x - 0.05 * s, y + 0.015 * s, z + 0.03 * s, [0xe8a010, 0xffe050], { jit: 0.12 });
}
function pennant(k, x, y, z, h, c, pole = C.woodD) {
  k.beam([x, y, z], [x, y + h, z], 0.012, pole, 5);
  k.bone(BONE.FLAG, [x, y + h - 0.01, z], () => k.poly([[x, y + h - 0.01, z], [x + 0.2, y + h - 0.05, z + 0.02], [x, y + h - 0.11, z]], c, { ds: true, ao: false, jit: 0.04 }));
  k.ball(0.022, x, y + h + 0.01, z, C.gold, { det: 0 });
}
function goldmine(k) {
  // GOLD MINE (R3): a light grey-brown rock crag with a BIG dark adit under a heavy timber frame.
  // Gold is kept to accents (nuggets, a heaped cart, the glow deep in the mouth, a few seams)
  // so it can no longer be mistaken for the gold pile.
  const cols = (c, x, y, z, nx, ny) => { c.set(C.rockD).lerp(_c2.set(C.rockL), Math.min(1, 0.25 + y / 0.55)); if (ny > 0.65 && y > 0.25) c.lerp(_c2.set(0xe0d6c4), 0.45); };
  mountain(k, cols);
  // a few gold seams glinting on the faces (accents only)
  const veins = [[0, -0.5, 0.45], [2, 0.5, 0.55], [1, -0.4, 0.5], [5, 0.3, 0.7]];
  veins.forEach(([pi, az, el], vi) => {
    const { p, n } = onPeak(pi, az, el, 0.93);
    const t = [n[2], 0.55, -n[0]];
    k.plank([p[0] - t[0] * 0.07, p[1] - 0.035, p[2] - t[2] * 0.07], [p[0] + t[0] * 0.07, p[1] + 0.035, p[2] + t[2] * 0.07], 0.035, 0.05, vi % 2 === 0 ? GL.gold : [0xe89a18, 0xffe060], { glow: vi % 2 === 0, jit: 0.08 });
  });
  nuggets(k, 0.0, 0.6, -0.24, 1.1);
  // the mouth: a large dark arch cut into the crag, ringed by pale boulders
  k.lathe([[0.001, 0], [0.27, 0], [0.27, 0.24], [0.2, 0.36], [0.001, 0.41]], 10, 0, 0, 0.1, 0x24140e, { s: [1, 1, 0.55], ao: false, jit: 0 });
  k.lathe([[0.001, 0], [0.1, 0], [0.1, 0.1], [0.06, 0.15], [0.001, 0.17]], 8, 0, 0, 0.16, GL.gold, { s: [1, 1, 0.4], glow: true });
  for (let i = 0; i < 9; i++) { const a = Math.PI * i / 8; k.rock(0.075, Math.cos(a) * 0.31, Math.max(0, Math.sin(a) * 0.4 - 0.04), 0.15, [0x8a8070, 0xd8d0c0], { amp: 0.3, flat: false }); }
  // heavy timber frame (posts, lintel, braces) standing proud of the mouth
  const fz = 0.25, fw = 0.42, fh = 0.4;
  for (const s of [-1, 1]) {
    k.box(0.08, fh, 0.08, s * (fw / 2 + 0.01), 0, fz, [0x7a3e18, 0xc87a3a], { bev: 0.012 });
    k.plank([s * (fw / 2 - 0.0), fh - 0.1, fz + 0.045], [s * (fw / 2 - 0.1), fh - 0.0, fz + 0.045], 0.04, 0.03, 0xd89048);
  }
  k.box(fw + 0.18, 0.08, 0.1, 0, fh, fz, [0x8a4a1e, 0xe0a058], { bev: 0.012 });
  k.box(fw + 0.06, 0.05, 0.07, 0, fh + 0.08, fz - 0.01, 0xf0b468, { bev: 0.008 });
  k.box(0.1, 0.06, 0.012, 0, fh + 0.01, fz + 0.052, C.gold, { bev: 0.004 }); // brass plaque
  rails(k, 0, 0.16, 0.06, 0.6);
  // the iconic cart, heaped with gold, rolling out of the mine
  cart(k, 0.07, 0.46, 0.1, 'gold', C.gold, true, 1.05);
  lantern(k, -0.22, 0.28, 0.3);
  // spilled nuggets, a pickaxe and a pennant
  nuggets(k, -0.3, 0.012, 0.42, 1.0);
  nuggets(k, 0.34, 0.012, 0.3, 0.8);
  k.plank([-0.4, 0.012, 0.32], [-0.34, 0.22, 0.22], 0.022, 0.022, C.woodL);
  k.add(new THREE.BoxGeometry(0.2, 0.026, 0.026), -0.34, 0.22, 0.22, C.steel, { rz: 0.3, ry: 0.6 });
  pennant(k, 0.36, 0.38, -0.12, 0.38, 0xffcc20);
  sparkle(k, -0.12, 0.66, -0.05, 0.04, 0xfff0b0); sparkle(k, 0.08, 0.42, 0.5, 0.04, 0xfff0b0);
}
function orepit(k) {
  // ORE PIT: an open slate-blue quarry with a tall timber headframe and a big rust-and-iron ore heap
  k.cyl(0.58, 0.6, 0.02, 0, 0, 0, 0x5e5a5c, 12, { ao: false });
  k.cyl(0.36, 0.38, 0.006, 0.0, 0.02, 0.02, 0x4a4446, 10, { ao: false });
  const cols = (c, x, y, z, nx, ny) => { c.set(0x45507a).lerp(_c2.set(0xa8b8e4), Math.min(1, y / 0.45)); if (ny > 0.7 && y > 0.22) c.lerp(_c2.set(0xd8e2ff), 0.3); };
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (1.05 + i / 8 * 0.95) + (k.r() - 0.5) * 0.15, d = 0.42;
    const big = i > 1 && i < 7;
    k.rock(big ? 0.22 : 0.16, Math.cos(a) * d, 0, Math.sin(a) * d * 0.9, cols, { amp: 0.25, s: [1, big ? 1.5 : 1.05, 1] });
  }
  // terraced cut faces with rust-red ore seams
  k.box(0.42, 0.14, 0.12, 0, 0.02, -0.24, mottle(0x8a94a8, 0xbcc4d4, 14), { bev: 0.015 });
  k.box(0.3, 0.12, 0.1, 0, 0.16, -0.32, mottle(0x98a2b4, 0xc8d0de, 14), { bev: 0.015 });
  for (let i = 0; i < 6; i++) k.add(new THREE.OctahedronGeometry(0.04, 0), -0.18 + i * 0.07, 0.07 + (i % 3) * 0.08, -0.17 - (i % 2) * 0.08, i % 2 ? 0xe06a30 : 0xe8ecf8, { jit: 0.04 });
  // THE ore heap: big rust-red and silver-blue chunks
  const oc = [[0xb04a22, 0xf08a4a], [0x7a88a0, 0xd0d8ea], [0xc05a2a, 0xff9a58]];
  for (let i = 0; i < 9; i++) { const a = i * 0.7, d = i < 3 ? 0.02 : 0.1; k.rock(0.075 + k.r() * 0.03, 0.18 + Math.cos(a) * d, 0.02 + (i < 3 ? 0.08 : 0), 0.22 + Math.sin(a) * d * 0.8, oc[i % 3], { amp: 0.3, flat: i >= 3 }); }
  for (let i = 0; i < 4; i++) sparkle(k, 0.1 + i * 0.05, 0.2 + (i % 2) * 0.05, 0.2 + (i % 2) * 0.06, 0.025, 0xe0f0ff);
  cart(k, -0.12, 0.3, -0.5, 'ore', [0xa04a26, 0xf0904e]);
  // tall headframe: two A-frames, a crossbeam and a big pulley wheel
  const hx = -0.26, hz = -0.02, H = 0.78;
  for (const s of [-1, 1]) {
    k.beam([hx + s * 0.13, 0.02, hz + 0.1], [hx + s * 0.05, H, hz], 0.03, [0x6a3416, 0xb06a30], 5);
    k.beam([hx + s * 0.13, 0.02, hz - 0.12], [hx + s * 0.05, H, hz], 0.03, [0x6a3416, 0xb06a30], 5);
    k.plank([hx + s * 0.11, 0.3, hz + 0.08], [hx + s * 0.11, 0.3, hz - 0.1], 0.026, 0.026, 0xc07a38);
  }
  k.beam([hx - 0.08, H, hz], [hx + 0.08, H, hz], 0.03, 0xc07a38, 5);
  k.torus(0.11, 0.024, hx, H + 0.02, hz, [0xb06030, 0xe08a48], { rs: 14, ts: 4 });
  for (let i = 0; i < 4; i++) k.plank([hx, H + 0.02, hz], [hx + Math.cos(i * 0.785) * 0.1, H + 0.02 + Math.sin(i * 0.785) * 0.1, hz], 0.012, 0.012, C.woodL);
  k.beam([hx + 0.1, H + 0.02, hz], [hx + 0.1, 0.28, hz], 0.004, 0xe0d0a0, 3);
  k.cyl(0.05, 0.04, 0.07, hx + 0.1, 0.22, hz, [C.wood, C.woodL], 7);
  for (let i = 0; i < 3; i++) k.rock(0.025, hx + 0.1 + (i - 1) * 0.02, 0.28, hz, 0xe07a40, { flat: false });
  pennant(k, hx, H + 0.1, hz, 0.22, 0xd84a2a);
  lantern(k, 0.3, 0.012, -0.08);
}
function gemmine(k) {
  // GEM MINE (R3p4): a compact grey-lavender crag (inside the ~1.2 footprint) with a dark cave
  // mouth under a timber frame, and a modest cluster of saturated crystals as accents.
  const cols = (c, x, y, z, nx, ny) => { c.set(0x6a6478).lerp(_c2.set(0xc4bccc), Math.min(1, 0.2 + y / 0.5)); if (ny > 0.65 && y > 0.22) c.lerp(_c2.set(0xe6e0ea), 0.4); };
  const crag = [[0, -0.2, 0.3, 0.5, 0.24], [-0.29, -0.1, 0.2, 0.32, 0.19], [0.29, -0.13, 0.2, 0.38, 0.18], [-0.3, 0.1, 0.13, 0.13, 0.12], [0.3, 0.09, 0.12, 0.12, 0.11], [0.08, -0.38, 0.18, 0.3, 0.14]];
  for (const [x, z, rx, ry, rz] of crag) k.rock(1, x, 0, z, cols, { det: 1, amp: 0.14, s: [rx, ry, rz] });
  // the mouth: a dark arch cut into the crag, a faint violet gleam deep inside, pale rim boulders
  k.lathe([[0.001, 0], [0.22, 0], [0.22, 0.2], [0.16, 0.3], [0.001, 0.34]], 10, 0, 0, 0.06, 0x1e1428, { s: [1, 1, 0.55], ao: false, jit: 0 });
  k.lathe([[0.001, 0], [0.08, 0], [0.08, 0.08], [0.05, 0.12], [0.001, 0.13]], 8, 0, 0, 0.12, 0x9050e0, { s: [1, 1, 0.4], glow: true });
  for (let i = 0; i < 8; i++) { const a = Math.PI * i / 7; k.rock(0.06, Math.cos(a) * 0.26, Math.max(0, Math.sin(a) * 0.33 - 0.03), 0.11, [0x8a8292, 0xdcd6e0], { amp: 0.3, flat: false }); }
  // timber frame standing proud of the mouth
  const fz = 0.2, fw = 0.34, fh = 0.33;
  for (const s of [-1, 1]) {
    k.box(0.07, fh, 0.07, s * (fw / 2 + 0.01), 0, fz, [0x7a3e18, 0xc87a3a], { bev: 0.01 });
    k.plank([s * fw / 2, fh - 0.09, fz + 0.04], [s * (fw / 2 - 0.09), fh, fz + 0.04], 0.035, 0.026, 0xd89048);
  }
  k.box(fw + 0.16, 0.07, 0.09, 0, fh, fz, [0x8a4a1e, 0xe0a058], { bev: 0.01 });
  k.box(fw + 0.05, 0.045, 0.06, 0, fh + 0.07, fz - 0.01, 0xf0b468, { bev: 0.008 });
  // a modest crystal cluster on the right shoulder and a smaller one on the left: saturated accents
  const tint = [[0x7a30d8, 0xd8a0ff], [0x1080d0, 0x8ae4ff], [0xd02070, 0xff88c0]];
  const gtint = [GL.violet, GL.cyan, GL.pink];
  const cl = [[0.22, 0.26, -0.12, 0.34, 0.06, -0.25, 0.4, 0], [0.3, 0.22, -0.06, 0.24, 0.05, -0.6, 0.9, 1], [0.15, 0.24, -0.05, 0.22, 0.045, 0.35, 0.2, 2], [0.28, 0.2, -0.2, 0.2, 0.045, -0.35, -0.6, 0],
    [-0.27, 0.16, -0.04, 0.2, 0.045, 0.45, 0.3, 1], [-0.33, 0.12, 0.02, 0.15, 0.038, 0.7, -0.4, 0]];
  for (const [x, y, z, len, rad, tilt, yaw, ci] of cl) {
    k.crystal(x, y, z, len, rad, tint[ci], tilt, yaw, { jit: 0.05, ao: false });
    k.crystal(x, y, z, len * 0.55, rad * 1.12, gtint[ci], tilt, yaw, { glow: true });
  }
  // a small cart of gems on short rails and two loose crystals by the mouth
  rails(k, 0, 0.12, 0.05, 0.5);
  cart(k, 0.2, 0.42, -0.25, 'gems', [0x8040e0, 0xe0b0ff], false, 0.85);
  k.crystal(-0.28, 0.012, 0.36, 0.12, 0.032, tint[2], 0.3, 0.5);
  k.crystal(-0.22, 0.012, 0.42, 0.09, 0.028, tint[1], -0.4, 1.2);
  lantern(k, -0.2, 0.26, 0.26, 0xd0a0ff);
  sparkle(k, 0.26, 0.6, -0.1, 0.04, 0xe0c0ff); sparkle(k, -0.3, 0.38, 0.02, 0.035, 0xc0f0ff);
}
function sawmill(k) {
  pad(k, 0.58);
  // stream and pool beside the mill
  k.box(0.26, 0.012, 1.1, 0.44, 0.006, 0, [0x3a8ad8, 0x6ac0f0], { jit: 0.05, ao: false });
  for (let i = 0; i < 6; i++) k.rock(0.045, 0.31 + (i % 2) * 0.26, 0.006, -0.48 + i * 0.19, [0x9a9488, 0xd0c8b8], { amp: 0.3 });
  // stone footing and timber walls
  k.box(0.62, 0.08, 0.46, -0.08, 0, -0.05, mottle(C.stoneD, C.stone), { bev: 0.015 });
  const plank = (c, x, y, z) => { const t = (Math.sin(y * 90) + 1) / 2; c.set(0x9a6034).lerp(_c2.set(0xd09450), 0.35 + t * 0.5); };
  k.box(0.56, 0.3, 0.4, -0.08, 0.08, -0.05, plank, { jit: 0.05 });
  for (const [x, z] of [[-0.36, 0.15], [0.2, 0.15], [-0.36, -0.25], [0.2, -0.25]]) k.box(0.04, 0.32, 0.04, x, 0.08, z, C.woodD);
  k.box(0.6, 0.035, 0.44, -0.08, 0.36, -0.05, C.woodD);
  k.gable(0.56, 0.22, 0.4, -0.08, 0.38, -0.05, plank);
  shingles(k, 0.7, 0.24, 0.54, -0.08, 0.37, -0.05, [0xb83a22, 0xf06a3a], [0xc8442a, 0xff7a48]);
  // door and windows
  k.box(0.12, 0.18, 0.02, -0.2, 0.08, 0.16, 0x7a4424);
  k.box(0.09, 0.07, 0.01, 0.05, 0.2, 0.155, GL.warm, { glow: true });
  k.box(0.11, 0.015, 0.02, 0.05, 0.19, 0.16, C.woodD);
  // the water wheel on the stream side (+x), with paddles
  const wx = 0.36, wy = 0.28, wz = 0.0, R = 0.24;
  for (const s of [-0.045, 0.045]) k.torus(R, 0.014, wx + s, wy, wz, C.woodD, { ry: Math.PI / 2, rs: 14, ts: 4 });
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU, cy = Math.cos(a), sz = Math.sin(a);
    k.plank([wx, wy, wz], [wx, wy + cy * R, wz + sz * R], 0.016, 0.016, C.wood);
    k.box(0.11, 0.07, 0.012, wx, wy + cy * (R + 0.01), wz + sz * (R + 0.01), C.plank, { ctr: true, rx: -a + Math.PI / 2 });
  }
  k.cyl(0.03, 0.03, 0.16, wx - 0.05, wy, wz, C.iron, 8, { rz: Math.PI / 2, ctr: true });
  // splash where the wheel meets the water
  k.ball(0.06, wx, 0.04, wz + 0.2, 0xb0e8ff, { det: 0, glow: true, s: [1.5, 0.6, 1] });
  k.ball(0.05, wx, 0.03, wz - 0.18, 0xb0e8ff, { det: 0, glow: true, s: [1.3, 0.6, 1] });
  // log pile and a saw bench in front
  for (let i = 0; i < 3; i++) log(k, [-0.42, 0.05 + (i === 2 ? 0.08 : 0), 0.28 + (i === 2 ? 0.045 : i * 0.09)], [0.0, 0.05 + (i === 2 ? 0.08 : 0), 0.3 + (i === 2 ? 0.045 : i * 0.09)], 0.045, { bark: [0x4a2e18, 0x7a4e2a] });
  k.box(0.2, 0.08, 0.1, 0.12, 0.012, 0.3, C.woodD);
  k.cyl(0.07, 0.07, 0.008, 0.12, 0.1, 0.3, (c, x, y, z, nx, ny) => c.set(Math.abs(nx) > 0.9 ? 0xe0e4ec : 0xa0a4b0), 12, { rz: Math.PI / 2, ctr: true });
  for (let i = 0; i < 5; i++) k.box(0.05, 0.006, 0.03, k.rr(0.0, 0.25), 0.012, k.rr(0.38, 0.5), 0xe0c890, { ry: k.r() * 3 });
}

// ---------------------------------------------------------------- visit sites
function arena(k) {
  const R0 = 0.42, R1 = 0.56;
  // R3: darker warm footing, a warm ochre floor and a red/gold crown so it holds on snow
  k.cyl(R1 + 0.04, R1 + 0.06, 0.03, 0, 0, 0, mottle(0x6a5444, 0x8a7058), 16);
  k.cyl(R0, R0, 0.012, 0, 0.03, 0, [0xc89458, 0xdcae74], 16, { ao: false });
  const wall = mottle(0xb8845a, 0xe8c494, 11);
  const ringBand = (y, h, ri, ro, c, gap = 0) => k.lathe([[ri, y], [ro, y], [ro, y + h], [ri, y + h], [ri, y]], 20, 0, 0, 0, c, { jit: 0.06 });
  // two arcade tiers: piers between bands
  const N = 16;
  for (let i = 0; i < N; i++) {
    const a = (i + 0.5) / N * TAU;
    if (Math.abs(Math.sin(a) - 1) < 0.05 && Math.cos(a) > -0.3 && Math.cos(a) < 0.3) { /* keep */ }
    const x = Math.sin(a), z = Math.cos(a);
    const front = z > 0.9; // the entrance gap faces +z
    if (!front) k.box(0.075, 0.2, 0.12, x * (R0 + R1) / 2, 0.03, z * (R0 + R1) / 2, wall, { ry: a });
    k.box(0.07, 0.15, 0.1, x * (R0 + R1) / 2 * 0.99, 0.27, z * (R0 + R1) / 2 * 0.99, wall, { ry: a });
  }
  // gate pillars at the entrance
  for (const s of [-1, 1]) { const a = s * (TAU / N); k.box(0.1, 0.24, 0.14, Math.sin(a) * 0.49, 0.03, Math.cos(a) * 0.49, [0xb8a480, 0xe0d4b8], { ry: a, bev: 0.01 }); }
  ringBand(0.23, 0.045, R0 - 0.01, R1 + 0.01, [0x9a5a3a, 0xc87a50]);
  ringBand(0.42, 0.05, R0, R1, (c, x, y, z) => c.set(Math.floor((Math.atan2(z, x) / TAU + 0.5) * 16) % 2 ? 0xb82a22 : 0xe8d8b8));
  // inner seating steps visible from above
  k.lathe([[R0 - 0.0, 0.03], [R0 - 0.0, 0.1], [R0 - 0.05, 0.1], [R0 - 0.05, 0.05], [R0 - 0.0, 0.03]].reverse(), 20, 0, 0, 0, 0xa89070);
  // banners on poles
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * TAU + Math.PI / 4, x = Math.sin(a) * 0.49, z = Math.cos(a) * 0.49;
    k.beam([x, 0.47, z], [x, 0.87, z], 0.016, C.woodD, 5);
    k.bone(BONE.FLAG, [x, 0.86, z], () => k.poly([[x, 0.86, z], [x + Math.cos(a) * 0.26, 0.86, z - Math.sin(a) * 0.26], [x + Math.cos(a) * 0.22, 0.74, z - Math.sin(a) * 0.22], [x, 0.68, z]], i % 2 ? 0xe02a20 : 0x1a48e0, { ds: true, ao: false }));
    k.cone(0.026, 0.06, x, 0.87, z, C.gold, 5);
  }
  // fighting posts and crossed weapons in the sand
  k.cyl(0.03, 0.035, 0.14, -0.12, 0.04, -0.05, [C.woodD, C.wood], 6);
  k.plank([-0.17, 0.12, -0.05], [-0.07, 0.12, -0.05], 0.015, 0.015, C.wood);
  k.cyl(0.09, 0.09, 0.02, 0.08, 0.05, 0.12, [C.redD, C.red], 10, { rx: 0.4, ctr: true });
}
function tower(k) {
  k.rock(0.3, 0, 0, 0, [0x8a8a98, 0xb8b8c8], { amp: 0.2, s: [1.3, 0.35, 1.3] });
  // tapered stone tower
  const stone = (c, x, y, z) => { const b = Math.floor(y * 22) % 2; const v = (Math.sin(Math.atan2(z, x) * 4 + b * 2) + 1) / 2; c.set(0x9a9ab8).lerp(_c2.set(0xdadaf0), 0.3 + v * 0.35 + Math.min(0.3, y * 0.2)); };
  k.lathe([[0.001, 0.05], [0.22, 0.05], [0.2, 0.12], [0.16, 0.22], [0.14, 0.9], [0.18, 0.95], [0.001, 0.95]], 8, 0, 0, 0, stone, { jit: 0.05 });
  for (const y of [0.4, 0.68]) k.cyl(0.16, 0.16, 0.03, 0, y, 0, 0x3a4aa8, 8);
  // balcony and parapet (R3: deep slate-blue so the top reads as a ring around the roof)
  k.cyl(0.26, 0.2, 0.05, 0, 0.92, 0, mottle(0x3a3e78, 0x5a62a8), 10);
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; k.box(0.045, 0.055, 0.025, Math.cos(a) * 0.24, 0.97, Math.sin(a) * 0.24, 0x4a4e90, { ry: -a }); }
  // long blue-and-gold banners hanging from the balcony (front and sides)
  for (const a of [0.15, 2.2, -2.0]) {
    const x = Math.sin(a) * 0.17, z = Math.cos(a) * 0.17, tx = Math.cos(a) * 0.05, tz = -Math.sin(a) * 0.05;
    k.bone(BONE.FLAG, [x + Math.sin(a) * 0.01, 0.9, z + Math.cos(a) * 0.01], () => {
      k.poly([[x - tx, 0.9, z], [x + tx, 0.9, z], [x + tx, 0.6, z], [x, 0.54, z], [x - tx, 0.6, z]].map(([px, py, pz]) => [px + Math.sin(a) * 0.01, py, pz + Math.cos(a) * 0.01]), 0x1a3ad8, { ds: true, ao: false, jit: 0.03 });
      k.box(0.04, 0.04, 0.006, x + Math.sin(a) * 0.016, 0.74, z + Math.cos(a) * 0.016, C.gold, { ctr: true, ry: a, rz: Math.PI / 4, ao: false });
    });
  }
  // upper chamber and the starry conical roof
  k.cyl(0.13, 0.14, 0.18, 0, 0.97, 0, stone, 8);
  // R3: a broad, deep royal-blue witch-hat roof with gold eaves: the tower's top-down read
  const roof = (c, x, y, z) => c.set(0x1428b8).lerp(_c2.set(0x4a78ff), Math.min(1, (y - 1.1) / 0.55));
  k.cone(0.29, 0.58, 0, 1.11, 0, roof, 10);
  k.torus(0.28, 0.016, 0, 1.12, 0, C.gold, { rx: Math.PI / 2, rs: 20, ts: 4 });
  // star finial
  k.beam([0, 1.66, 0], [0, 1.74, 0], 0.008, C.gold, 4);
  k.add(new THREE.OctahedronGeometry(0.05, 0).scale(1, 1, 0.35), 0, 1.78, 0, GL.gold, { glow: true });
  k.add(new THREE.OctahedronGeometry(0.035, 0).scale(0.35, 0.35, 1).rotateZ(0.78), 0, 1.78, 0, GL.gold, { glow: true, s: [1.6, 1.6, 1] });
  // glowing windows
  for (const [y, a] of [[0.3, 0.3], [0.55, -0.6], [0.8, 0.5], [1.03, 0.0], [1.03, 2.1], [1.03, -2.1]]) {
    const rad = y > 0.95 ? 0.135 : 0.155 - (y - 0.22) * 0.02;
    k.box(0.04, 0.07, 0.01, Math.sin(a) * rad, y, Math.cos(a) * rad, GL.cyan, { glow: true, ry: a });
  }
  k.box(0.08, 0.13, 0.02, 0, 0.05, 0.19, 0x6a4024, { ry: 0 });
  // brass telescope on the balcony pointing at the sky
  k.beam([0.06, 1.04, 0.04], [0.3, 1.24, 0.24], 0.035, [0xa06a20, 0xe8b850], 6, { taper: 1.5 });
  // a floating rune ring
  k.torus(0.3, 0.016, 0, 0.6, 0, GL.cyan, { glow: true, rx: Math.PI / 2 + 0.15, rs: 20, ts: 3 });
}
function library(k) {
  // steps and plinth
  // R3: a mid grey-brown plinth (not cream) so the walls, dome and roof stand out on any ground
  k.box(0.9, 0.04, 0.7, 0, 0, 0, mottle(0x5e564e, 0x7a7066), { bev: 0.01 });
  k.box(0.8, 0.04, 0.6, 0, 0.04, -0.03, mottle(0x7e746a, 0x948a7e), { bev: 0.01 });
  // drum with windows and the big dome
  const wall = mottle(0xd8ccb0, 0xf0e8d8, 12);
  k.box(0.62, 0.32, 0.38, 0, 0.08, -0.1, wall, { bev: 0.01 });
  k.cyl(0.24, 0.25, 0.12, 0, 0.4, -0.1, wall, 12);
  k.cyl(0.29, 0.29, 0.03, 0, 0.52, -0.1, C.gold, 12);
  k.sphere(0.28, 0, 0.54, -0.1, [0x08707a, 0x30e0c0], 14, 6, { half: true, jit: 0.04 });
  for (let i = 0; i < 6; i++) k.torus(0.285, 0.014, 0, 0.54, -0.1, C.gold, { arc: Math.PI / 2, rs: 6, ts: 3, ry: i / 6 * TAU });
  k.cyl(0.045, 0.055, 0.07, 0, 0.81, -0.1, C.gold, 6);
  k.cone(0.035, 0.09, 0, 0.88, -0.1, C.gold, 6);
  k.ball(0.03, 0, 0.98, -0.1, GL.gold, { glow: true, det: 0 });
  // portico: columns, entablature and pediment
  for (let i = 0; i < 5; i++) {
    const x = -0.28 + i * 0.14;
    k.cyl(0.028, 0.032, 0.27, x, 0.08, 0.17, [0xd8d0c0, 0xf8f4ec], 7);
    k.box(0.07, 0.025, 0.07, x, 0.08, 0.17, C.marble);
    k.box(0.07, 0.025, 0.07, x, 0.335, 0.17, C.marble);
  }
  k.box(0.68, 0.05, 0.14, 0, 0.36, 0.12, [0xd8ccb0, 0xf0e8d8], { bev: 0.008 });
  k.gable(0.7, 0.13, 0.16, 0, 0.41, 0.12, wall, { ry: 0, s: 1 });
  k.roof(0.76, 0.15, 0.22, 0, 0.41, 0.12, [0xa82818, 0xe85030], { ry: 0 });
  // the pediment faces +z: a gold book emblem
  // (roof ridge runs along x, so the gable ends face ±x; add a front triangle instead)
  k.poly([[-0.3, 0.41, 0.2], [0.3, 0.41, 0.2], [0, 0.53, 0.2]], [0xd8ccb0, 0xf0e8d8]);
  k.box(0.06, 0.04, 0.008, 0, 0.44, 0.203, GL.gold, { glow: true });
  // warm windows and door
  for (const x of [-0.22, 0.22]) k.box(0.06, 0.12, 0.01, x, 0.16, 0.091, GL.warm, { glow: true });
  k.box(0.1, 0.18, 0.01, 0, 0.08, 0.091, 0x6a3a1a);
  k.box(0.06, 0.12, 0.012, 0, 0.08, 0.092, 0x8a5a10, { glow: true });
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; k.box(0.035, 0.06, 0.01, Math.sin(a) * 0.245, 0.43, -0.1 + Math.cos(a) * 0.245, GL.warm, { glow: true, ry: a }); }
  // stacked books and a lectern by the steps
  // one big book on a lectern-block by the steps (identity: books)
  k.box(0.14, 0.05, 0.1, 0.36, 0.0, 0.3, [0x6a1e1e, 0xa83030], { ry: 0.3, bev: 0.01 });
  k.box(0.12, 0.012, 0.085, 0.36, 0.05, 0.3, 0xf4ead0, { ry: 0.3 });
}
function stone(k) {
  pad(k, 0.44);
  // the monolith: a rounded standing stone
  const sc = (c, x, y, z, nx, ny) => { c.set(0x343c62).lerp(_c2.set(0x7a88b8), Math.min(1, y / 0.8)); if (ny > 0.6) c.lerp(_c2.set(0xb8c4e8), 0.4); };
  k.rock(0.3, 0, -0.02, -0.02, sc, { det: 1, amp: 0.1, s: [0.95, 1.9, 0.6], sink: 0.0 });
  // a bright rune ring on the pad so the site reads from above
  k.torus(0.3, 0.022, 0, 0.045, 0.0, GL.cyan, { glow: true, rx: Math.PI / 2, rs: 20, ts: 3 });
  // glowing runes on the front face
  const runes = [[0, 0.62, [[0, -0.05], [0, 0.05]], [[-0.03, 0.03], [0.03, 0.0]]], [-0.06, 0.42, [[0, -0.05], [0, 0.05]], [[0, 0.05], [0.04, 0.0]]], [0.07, 0.3, [[-0.03, -0.04], [0.03, 0.04]], [[0.03, -0.04], [-0.03, 0.04]]], [0.0, 0.18, [[-0.04, 0], [0.04, 0]], [[0, -0.04], [0, 0.04]]]];
  for (const [x, y, ...strokes] of runes) {
    const z = 0.155 - Math.abs(y - 0.4) * 0.18;
    for (const [[ax, ay], [bx, by]] of strokes) k.plank([x + ax * 1.3, y + ay * 1.3, z], [x + bx * 1.3, y + by * 1.3, z], 0.024, 0.012, GL.cyan, { glow: true });
  }
  // circle of small stones and a glow pool
  for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + 0.2; k.rock(0.06, Math.cos(a) * 0.38, 0.03, Math.sin(a) * 0.36, [0x3a4262, 0x8a96c0], { amp: 0.25, s: [1, 1.5, 1] }); }
  k.cyl(0.22, 0.22, 0.003, 0, 0.014, 0.08, 0x185a6a, 12, { glow: true, s: [1, 1, 0.7] });
  sparkle(k, 0.2, 0.7, 0.1, 0.04, 0x90f0ff);
}
function obelisk(k) {
  // stepped base
  k.box(0.56, 0.06, 0.56, 0, 0, 0, mottle(0x9a8a76, 0xc8b8a0), { bev: 0.012 });
  k.box(0.42, 0.06, 0.42, 0, 0.06, 0, mottle(0xa89a84, 0xd4c4ac), { bev: 0.012 });
  k.box(0.3, 0.08, 0.3, 0, 0.12, 0, mottle(0xb8aa94, 0xe0d2bc), { bev: 0.012 });
  // R4: a thick tapered shaft (it was a 3-px needle at map zoom), a big gold pyramidion and
  // one bold glowing rune band per face instead of twenty tiny glyphs
  const sh = (c, x, y, z) => c.set(0x8a86a8).lerp(_c2.set(0xd8d4ec), Math.min(1, (y - 0.2) / 1.1));
  const tw = 0.105, bw = 0.155;
  k.cyl(tw * Math.SQRT2, bw * Math.SQRT2, 1.05, 0, 0.2, 0, sh, 4, { ry: Math.PI / 4, jit: 0.04 });
  k.cone(tw * Math.SQRT2 * 1.05, 0.2, 0, 1.25, 0, [C.goldD, C.goldL], 4, { ry: Math.PI / 4 });
  for (let f = 0; f < 4; f++) {
    const a = f * Math.PI / 2, nx = Math.sin(a), nz = Math.cos(a);
    const at = (y) => bw - (bw - tw) * (y - 0.2) / 1.05 + 0.004;
    for (const [y0, y1] of [[0.34, 0.62], [0.72, 1.0]]) {
      const ym = (y0 + y1) / 2;
      k.plank([nx * at(y0), y0, nz * at(y0)], [nx * at(y1), y1, nz * at(y1)], 0.04, 0.008, GL.violet, { glow: true });
      k.plank([nx * at(ym) - nz * 0.05, ym, nz * at(ym) + nx * 0.05], [nx * at(ym) + nz * 0.05, ym, nz * at(ym) - nx * 0.05], 0.03, 0.008, GL.violet, { glow: true });
    }
  }
  k.add(new THREE.OctahedronGeometry(0.05, 0), 0, 1.52, 0, GL.violet, { glow: true });
  // braziers on the corners
  for (const [x, z] of [[-0.22, 0.22], [0.22, 0.22]]) {
    k.lathe([[0.001, 0.06], [0.03, 0.06], [0.025, 0.12], [0.06, 0.16], [0.065, 0.19]], 6, x, 0, z, C.iron);
    k.cone(0.05, 0.13, x, 0.17, z, GL.fire, 5, { glow: true });
  }
}
function shrine(k) {
  // round stepped platform
  // R3: saturated indigo steps with a gold kerb so the site holds on snow and pale sand
  k.cyl(0.52, 0.55, 0.05, 0, 0, 0, (c, x, y, z, nx, ny) => c.set(ny > 0.5 ? 0x3a3c9a : 0x262670), 12);
  k.torus(0.5, 0.014, 0, 0.05, 0, C.gold, { rx: Math.PI / 2, rs: 24, ts: 3 });
  k.cyl(0.42, 0.44, 0.05, 0, 0.05, 0, (c, x, y, z, nx, ny) => c.set(ny > 0.5 ? 0x5a2aa8 : 0xc8a050), 12);
  // magic circle inlaid on the floor
  k.torus(0.33, 0.01, 0, 0.102, 0, 0x6a3ad0, { glow: true, rx: Math.PI / 2, rs: 24, ts: 3 });
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU, b = (i + 2) / 5 * TAU; k.plank([Math.sin(a) * 0.33, 0.102, Math.cos(a) * 0.33], [Math.sin(b) * 0.33, 0.102, Math.cos(b) * 0.33], 0.012, 0.004, 0x6a3ad0, { glow: true, rx: 0 }); }
  // six slender pillars with gold capitals and a ring lintel
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * TAU + Math.PI / 6, x = Math.sin(a) * 0.36, z = Math.cos(a) * 0.36;
    k.cyl(0.04, 0.04, 0.03, x, 0.1, z, C.goldD, 6);
    k.cyl(0.028, 0.032, 0.5, x, 0.13, z, [0xe8e0d8, 0xffffff], 6);
    k.cyl(0.045, 0.035, 0.04, x, 0.63, z, C.gold, 6);
  }
  k.lathe([[0.32, 0.67], [0.43, 0.67], [0.43, 0.73], [0.32, 0.73], [0.32, 0.67]], 12, 0, 0, 0, [0x3a2a9a, 0x6a4ad8]);
  // open onion canopy of ribs meeting at a spire
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * TAU + Math.PI / 6;
    const P = [[0.37, 0.72], [0.36, 0.82], [0.26, 0.94], [0.1, 1.02], [0.0, 1.06]];
    for (let j = 0; j < P.length - 1; j++) k.beam([Math.sin(a) * P[j][0], P[j][1], Math.cos(a) * P[j][0]], [Math.sin(a) * P[j + 1][0], P[j + 1][1], Math.cos(a) * P[j + 1][0]], 0.024, C.gold, 4);
    // violet canopy panels on alternate bays: a bold, coloured crown seen from above
    if (i % 2 === 0) { const b = a + TAU / 6; for (let j = 0; j < P.length - 1; j++) k.poly([[Math.sin(a) * P[j][0], P[j][1], Math.cos(a) * P[j][0]], [Math.sin(b) * P[j][0], P[j][1], Math.cos(b) * P[j][0]], [Math.sin(b) * P[j + 1][0], P[j + 1][1], Math.cos(b) * P[j + 1][0]], [Math.sin(a) * P[j + 1][0], P[j + 1][1], Math.cos(a) * P[j + 1][0]]], [0x5a22c0, 0x9a5af0], { ds: true, ao: false, jit: 0.04 }); }
  }
  k.cone(0.04, 0.2, 0, 1.04, 0, [C.goldD, C.goldL], 6);
  k.ball(0.03, 0, 1.25, 0, GL.violet, { glow: true, det: 0 });
  // central altar with the floating orb
  k.lathe([[0.001, 0.1], [0.12, 0.1], [0.1, 0.14], [0.07, 0.16], [0.07, 0.3], [0.11, 0.33], [0.11, 0.35], [0.001, 0.35]], 8, 0, 0, 0, [0x8a7a9a, 0xd8d0e8]);
  k.ball(0.11, 0, 0.5, 0, 0x9a50ff, { glow: true, det: 2 });
  k.ball(0.07, 0, 0.5, 0, 0xffe0ff, { glow: true, det: 1, s: 1.0 });
  k.torus(0.17, 0.009, 0, 0.5, 0, 0xc090ff, { glow: true, rx: 1.2, rs: 20, ts: 3 });
  k.torus(0.2, 0.007, 0, 0.5, 0, 0x80d0ff, { glow: true, rx: 1.9, ry: 0.8, rs: 20, ts: 3 });
  k.cyl(0.11, 0.11, 0.003, 0, 0.351, 0, 0x5a2aa0, 10, { glow: true });
}
function well(k) {
  pad(k, 0.48);
  // flagstones
  // the round stone wall: banded blocks
  const blocks = (c, x, y, z) => { const row = Math.floor(y / 0.06), ang = Math.atan2(z, x) + row * 0.35; const t = (Math.floor(ang * 9 / Math.PI) % 2 === 0) ? 0.2 : 0.65; c.set(0x9a9488).lerp(_c2.set(0xdcd6c8), t + Math.min(0.25, y)); };
  k.lathe([[0.2, 0.012], [0.28, 0.012], [0.28, 0.24], [0.3, 0.25], [0.3, 0.28], [0.21, 0.28], [0.21, 0.27], [0.2, 0.27], [0.2, 0.012]].reverse(), 12, 0, 0, 0, blocks, { jit: 0.06 });
  k.lathe([[0.2, 0.012], [0.28, 0.012], [0.28, 0.24], [0.3, 0.25], [0.3, 0.28], [0.21, 0.28]], 12, 0, 0, 0, blocks, { jit: 0.06 });
  // glowing water
  k.cyl(0.205, 0.205, 0.01, 0, 0.2, 0, 0x30b8e8, 12, { glow: true });
  k.cyl(0.1, 0.1, 0.004, 0, 0.21, 0, 0xa0f0ff, 8, { glow: true });
  // wooden posts, crank and a little shingled roof
  for (const s of [-1, 1]) k.box(0.04, 0.5, 0.05, s * 0.25, 0.25, 0, [C.woodD, C.wood], { bev: 0.006 });
  k.cyl(0.03, 0.03, 0.56, 0, 0.6, 0, C.wood, 7, { rz: Math.PI / 2, ctr: true });
  k.lathe([[0.001, 0.34], [0.04, 0.34], [0.05, 0.42], [0.001, 0.42]], 7, 0, 0, 0, [C.woodD, C.wood]);
  k.box(0.6, 0.03, 0.06, 0, 0.73, 0, C.woodD);
  k.gable(0.5, 0.18, 0.36, 0, 0.73, 0, C.woodD);
  shingles(k, 0.66, 0.2, 0.44, 0, 0.72, 0, [0x2a50c0, 0x5a88f0], [0x3058c8, 0x6a98ff], 3);
  k.ball(0.03, 0, 0.94, 0, GL.cyan, { glow: true, det: 0 });
  // magic motes rising
  // bucket by the side
  k.lathe([[0.001, 0.012], [0.045, 0.012], [0.055, 0.09], [0.001, 0.09]], 7, 0.32, 0, 0.25, [C.woodD, C.wood]);
  k.cyl(0.05, 0.05, 0.004, 0.32, 0.086, 0.25, GL.cyan, 7, { glow: true });
}
function windmill(k) {
  pad(k, 0.46);
  // whitewashed stone tower
  const wall = (c, x, y, z) => { const t = Math.min(1, y / 0.8); c.set(0xb8ac98).lerp(_c2.set(0xf4ece0), t); if (y < 0.1) c.set(0xa89e8c); };
  k.lathe([[0.001, 0.012], [0.27, 0.012], [0.27, 0.1], [0.23, 0.12], [0.18, 0.8], [0.2, 0.82], [0.001, 0.82]], 9, 0, 0, -0.05, wall, { jit: 0.05 });
  // conical thatched cap
  k.lathe([[0.001, 0.8], [0.25, 0.8], [0.23, 0.86], [0.15, 0.98], [0.06, 1.08], [0.001, 1.12]], 9, 0, 0, -0.05, [0x8a2014, 0xe05a34], { jit: 0.1 });
  k.ball(0.025, 0, 1.13, -0.05, C.goldD, { det: 0 });
  // door, windows
  k.box(0.1, 0.18, 0.03, 0, 0.012, 0.2, [0x7a4424, 0xa86438], { bev: 0.006 });
  k.box(0.13, 0.03, 0.04, 0, 0.19, 0.2, C.woodD);
  k.box(0.05, 0.07, 0.01, 0.08, 0.42, 0.15, GL.warm, { glow: true, ry: 0.4 });
  k.box(0.05, 0.07, 0.01, -0.1, 0.6, 0.12, GL.warm, { glow: true, ry: -0.5 });
  // hub and four lattice sails facing +z: SPIN about the axle (local +Z through the hub)
  const hz = 0.2, hy = 0.78;
  k.bone(BONE.SPIN, [0, hy, hz], () => {
    k.cyl(0.035, 0.045, 0.14, 0, hy, hz - 0.05, C.woodD, 8, { rx: Math.PI / 2, ctr: true });
    k.ball(0.045, 0, hy, hz + 0.03, C.iron, { det: 0 });
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + 0.35, dx = Math.sin(a), dy = Math.cos(a), px = Math.cos(a), py = -Math.sin(a);
      const L = 0.6;
      k.plank([0, hy, hz + 0.02], [dx * L, hy + dy * L, hz + 0.02], 0.025, 0.02, C.woodD);
      // cloth panel on one side of the spar
      const p0 = [dx * 0.12, hy + dy * 0.12, hz + 0.01], p1 = [dx * L, hy + dy * L, hz + 0.01];
      const w = 0.17, q0 = [p0[0] + px * w, p0[1] + py * w, hz + 0.0], q1 = [p1[0] + px * w, p1[1] + py * w, hz + 0.0];
      k.poly([p0, p1, q1, q0], (c, x, y, z) => c.set(0xf0e4c8), { ds: true, ao: false, jit: 0.04 });
      // lattice slats
      k.plank(q0, q1, 0.02, 0.016, C.wood);
    }
  });
  // flour sacks and a cart wheel
  for (const [x, z, r] of [[0.28, 0.2, 0], [0.36, 0.1, 0.5], [0.31, 0.12, 0.2]]) k.lathe([[0.001, 0], [0.05, 0], [0.06, 0.05], [0.045, 0.11], [0.02, 0.12], [0.001, 0.12]], 7, x, 0.012 + (x === 0.31 ? 0.07 : 0), z, [0xc8b890, 0xf0e8d0]);
}
function horse(k, x, z, ry, sc = 0.8) {
  const sub = makeKit(31);
  const body = [0x5a2e16, 0x9a5a2e], dark = 0x24160c, coat = 0x8a4a24;
  for (const [lx, lz] of [[-0.045, 0.1], [0.045, 0.1], [-0.045, -0.1], [0.045, -0.1]]) {
    sub.beam([lx, 0.02, lz], [lx, 0.2, lz], 0.017, [0x3a2010, coat], 5);
    sub.cyl(0.02, 0.022, 0.03, lx, 0, lz, dark, 5);
  }
  sub.ball(1, 0, 0.23, 0, body, { s: [0.075, 0.08, 0.16], det: 1 });
  sub.ball(1, 0, 0.25, 0.09, body, { s: [0.072, 0.085, 0.08], det: 1 });
  sub.beam([0, 0.27, 0.12], [0, 0.4, 0.19], 0.042, coat, 6, { taper: 0.7 });
  sub.beam([0, 0.42, 0.19], [0, 0.34, 0.29], 0.03, coat, 6, { taper: 0.6 });
  sub.ball(0.02, 0, 0.335, 0.29, 0x3a2416, { det: 0 });
  sub.box(0.016, 0.16, 0.035, 0, 0.29, 0.13, dark, { rx: 0.75 }); // mane
  sub.cone(0.012, 0.04, -0.018, 0.42, 0.18, coat, 4);
  sub.cone(0.012, 0.04, 0.018, 0.42, 0.18, coat, 4);
  sub.beam([0, 0.27, -0.15], [0, 0.1, -0.21], 0.022, dark, 5, { taper: 0.3 });
  sub.box(0.165, 0.02, 0.1, 0, 0.29, -0.01, C.red, { bev: 0.005 }); // saddle cloth
  sub.box(0.09, 0.03, 0.07, 0, 0.305, -0.01, 0x3a2010, { bev: 0.01 }); // saddle
  for (const p of sub.B) { p.g.scale(sc, sc, sc).rotateY(ry).translate(x, 0.012, z); k.B.push(p); }
}
function stables(k) {
  pad(k, 0.58);
  const plank = (c, x, y, z) => { const t = (Math.sin(x * 70) + 1) / 2; c.set(0x9a5e30).lerp(_c2.set(0xd08c4a), 0.3 + t * 0.5); };
  // the barn: back wall, side walls and a long gable roof; open stalls at the front
  k.box(0.8, 0.3, 0.05, 0, 0.012, -0.25, plank);
  for (const s of [-1, 1]) k.box(0.05, 0.3, 0.32, s * 0.4, 0.012, -0.1, plank);
  k.gable(0.8, 0.16, 0.36, 0, 0.312, -0.1, plank, { ry: 0 });
  k.box(0.78, 0.012, 0.3, 0, 0.012, -0.1, 0x9a8048, { ao: false });
  for (let i = 0; i < 5; i++) { const x = -0.4 + i * 0.2; k.box(0.035, 0.32, 0.035, x, 0.012, 0.06, [C.woodD, C.wood]); if (i > 0 && i < 4) k.box(0.02, 0.18, 0.28, x, 0.012, -0.09, C.wood); }
  // stall half-doors
  for (const x of [-0.3, 0.1]) k.box(0.15, 0.12, 0.02, x, 0.012, 0.06, plank);
  shingles(k, 0.92, 0.2, 0.5, 0, 0.3, -0.1, [0xa8502a, 0xe0803e], [0xb85a30, 0xf09048]);
  // a horse head peeking from the left stall
  k.beam([-0.3, 0.2, -0.04], [-0.3, 0.17, 0.07], 0.028, 0x8a5028, 6, { taper: 0.7 });
  // horseshoe sign
  k.torus(0.04, 0.01, 0, 0.4, 0.13, C.gold, { arc: Math.PI * 1.4, rz: -Math.PI * 0.2 + Math.PI, rs: 10, ts: 4 });
  // the horse out front, hay bales and a trough
  horse(k, 0.14, 0.33, 0.9);
  k.box(0.14, 0.08, 0.09, -0.32, 0.012, 0.3, [0xb0902a, 0xe8c860], { bev: 0.01, ry: 0.2 });
  k.box(0.14, 0.08, 0.09, -0.24, 0.012, 0.4, [0xb0902a, 0xe8c860], { bev: 0.01, ry: -0.3 });
  k.box(0.14, 0.08, 0.09, -0.29, 0.092, 0.34, [0xb0902a, 0xe8c860], { bev: 0.01, ry: 0.0 });
  k.box(0.22, 0.06, 0.08, 0.38, 0.012, 0.32, C.woodD, { ry: -0.4, bev: 0.006 });
  k.box(0.19, 0.005, 0.06, 0.38, 0.07, 0.32, 0x3a8ad8, { ry: -0.4 });
  // fence posts
  for (let i = 0; i < 3; i++) k.box(0.025, 0.14, 0.025, 0.46 + i * 0.0, 0.012, 0.0 - i * 0.14, C.woodD);
  k.plank([0.46, 0.12, 0.02], [0.46, 0.12, -0.3], 0.015, 0.02, C.wood);
}
function dwelling(k) {
  // CREATURE DEN: a pale limestone crag (no green tops: it must not melt into grass) around a
  // big DARK cave mouth with glowing eyes, framed by two torches, a red war banner and a hide tent.
  const cols = (c, x, y, z, nx, ny) => {
    c.set(0x6a6070).lerp(_c2.set(0xe4dccc), Math.min(1, 0.1 + y / 0.62));
    if (ny > 0.75 && y > 0.3) c.lerp(_c2.set(0xfff6e6), 0.35);
  };
  k.rock(0.44, 0, 0, -0.14, cols, { det: 1, amp: 0.14, s: [1.25, 1.05, 0.9] });
  k.rock(0.22, -0.4, 0, 0.0, cols, { amp: 0.25 });
  k.rock(0.2, 0.42, 0, -0.02, cols, { amp: 0.25 });
  // the cave mouth: a light rock rim around a deep dark arch
  const rim = (c, x, y) => c.set(0xb8aea0).lerp(_c2.set(0xf4ecdc), Math.min(1, y / 0.36));
  k.lathe([[0.001, 0], [0.25, 0], [0.25, 0.2], [0.17, 0.33], [0.001, 0.37]], 9, 0, 0, 0.17, rim, { s: [1, 1, 0.42], jit: 0.08 });
  k.lathe([[0.001, 0], [0.2, 0], [0.2, 0.17], [0.13, 0.28], [0.001, 0.31]], 9, 0, 0, 0.2, (c, x, y) => c.set(0x1c0e0c).lerp(_c2.set(0x3a2018), Math.min(1, y / 0.3) * 0.6), { s: [1, 1, 0.42], ao: false, jit: 0 });
  // a trodden dirt apron leading in
  k.cyl(0.2, 0.22, 0.008, 0, 0, 0.36, 0x5a3a26, 9, { s: [1, 1, 0.55], ao: false });
  // glowing eyes in the dark
  for (const s of [-1, 1]) k.ball(0.018, s * 0.04, 0.13, 0.27, 0xffc020, { glow: true, det: 0, s: [1.4, 0.8, 1] });
  for (const s of [-1, 1]) k.ball(0.014, -0.1 + s * 0.028, 0.07, 0.265, GL.red, { glow: true, det: 0, s: [1.4, 0.8, 1] });
  // stone fangs over the mouth
  for (let i = 0; i < 4; i++) k.cone(0.026, 0.075, -0.075 + i * 0.05, 0.2 + (i % 2 ? 0.02 : 0), 0.27, 0xfff4e0, 4, { rx: Math.PI });
  // torches either side of the mouth
  torch(k, -0.26, 0, 0.32, 0.28); torch(k, 0.26, 0, 0.32, 0.28);
  // striped hide tent on top of the crag
  const hide = (c, x, y) => c.set(Math.floor(y * 22) % 3 === 0 ? 0x9a2414 : 0xd88a3a).lerp(_c2.set(0xffd090), Math.max(0, (y - 0.5) * 1.2));
  k.cone(0.2, 0.34, 0.08, 0.38, -0.24, hide, 6, { jit: 0.08 });
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.3; k.beam([0.08 + Math.cos(a) * 0.04, 0.66, -0.24 + Math.sin(a) * 0.04], [0.08 + Math.cos(a) * 0.1, 0.8, -0.24 + Math.sin(a) * 0.1], 0.01, 0x4a2a18, 4); }
  k.bone(BONE.CLOTH, [0.08, 0.4 + 0.13 * Math.cos(0.5), -0.05 - 0.13 * Math.sin(0.5)], () => k.box(0.08, 0.13, 0.01, 0.08, 0.4, -0.05, 0x2a1410, { rx: -0.5, ao: false })); // tent flap
  // red war banner on a tall pole (the colour flag of the site)
  banner(k, -0.36, 0.1, 0.0, 0.72, 0xd0201a, 0.16, 0.26);
  // totem with horned skull
  k.beam([0.36, 0, 0.3], [0.36, 0.5, 0.3], 0.026, [0x4a2a18, 0x8a5430], 6);
  k.ball(0.065, 0.36, 0.52, 0.32, 0xf4ecd8, { det: 1, s: [1, 0.9, 1.1] });
  for (const s of [-1, 1]) k.beam([0.36 + s * 0.05, 0.55, 0.32], [0.36 + s * 0.15, 0.66, 0.28], 0.017, 0xfff4e0, 5, { taper: 0.2 });
  for (const s of [-1, 1]) k.box(0.022, 0.022, 0.01, 0.36 + s * 0.024, 0.52, 0.385, 0x1c0e0c, { ao: false, jit: 0 });
}

const BUILDERS = { gold: goldPile, wood: woodPile, ore: orePile, gems: gemPile, chest, artifact, campfire, goldmine, orepit, gemmine, sawmill, arena, tower, library, stone, obelisk, shrine, well, windmill, stables, dwelling };
const AOH = { gold: 0.12, wood: 0.12, ore: 0.12, gems: 0.12, chest: 0.12, campfire: 0.12 };
// small pickups are drawn bigger so they read as figures at map zoom (still inside the hex)
const GROW = { stone: 1.15, gold: 1.3, wood: 1.25, ore: 1.25, gems: 1.3, chest: 1.45, artifact: 1.1, campfire: 1.6 };
export const OBJECT_IDS = Object.keys(BUILDERS);

export function objectModel(id) {
  const k = makeKit([...id].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) >>> 0);
  const f = BUILDERS[id];
  if (!f) { k.box(0.3, 0.3, 0.3, 0, 0, 0, 0xff00ff); return done(k); }
  f(k);
  const m = done(k, AOH[id] ?? 0.25), g = GROW[id];
  // pivots scale with the positions
  const scalePivots = (geo) => { const a = geo.attributes.aPivot; for (let i = 0; i < a.array.length; i++) a.array[i] *= g; a.needsUpdate = true; };
  if (g) { m.body.scale(g, g, g); scalePivots(m.body); if (m.glow) { m.glow.scale(g, g, g); scalePivots(m.glow); } }
  return m;
}
