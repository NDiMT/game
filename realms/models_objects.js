import * as THREE from 'three';

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
  const k = {
    r, B, G,
    rr: (a, b) => a + r() * (b - a),
    // generic: geometry already built at origin; o: {s, rx, rz, ry, glow, jit, ao}
    add(g, x, y, z, c, o = {}) {
      g = g.index ? g.toNonIndexed() : g;
      place(g, o).translate(x, y, z);
      (o.glow ? G : B).push({ g, c, jit: o.jit ?? 0.1, ao: o.ao ?? true, seed: (r() * 1e9) | 0 });
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

function finish(parts, glow, aoH) {
  let n = 0;
  for (const p of parts) n += p.g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), uv = glow ? null : new Float32Array(n * 2);
  let o = 0;
  for (const p of parts) {
    const g = p.g;
    g.computeVertexNormals();
    const P = g.attributes.position.array, N = g.attributes.normal.array, cnt = g.attributes.position.count;
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
        if (p.ao) f *= 0.55 + 0.45 * Math.min(1, Math.max(0, y / aoH));
        f *= 1 + 0.12 * Math.max(0, ny);
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
  geo.computeBoundingSphere();
  return geo;
}
const done = (k, aoH = 0.25) => ({ body: finish(k.B, false, aoH), glow: k.G.length ? finish(k.G, true, aoH) : null });

// ---------------------------------------------------------------- palette
const C = {
  gold: 0xffc020, goldD: 0xa86a08, goldL: 0xffe070,
  wood: 0x8a5a32, woodD: 0x4a2e18, woodL: 0xc08a50, plank: 0xa87444, bark: 0x5a3a22, ring: 0xe8c88a,
  iron: 0x4a4a54, ironL: 0x8a8c98, steel: 0xc8ccd8,
  stone: 0x9a9488, stoneD: 0x5e5a54, stoneL: 0xd2ccbe, marble: 0xeee6d6, sand: 0xd8b878,
  rock: 0x8a7a68, rockD: 0x4a4038, rockL: 0xb8a890,
  dirt: 0x7a5a3a, grass: 0x5a9a3a, grassL: 0x8ac04a,
  red: 0xc8322a, redD: 0x7a1a18, blue: 0x2a5ac8, blueD: 0x1a2a6a, purple: 0x7a3ac8, cyan: 0x3ad8ff,
  roofR: 0xb83a28, roofB: 0x2a4aa8, thatch: 0xc8a050, cloth: 0xf0e6cc, dark: 0x16121a,
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
    c.set(0xa8743a).lerp(_c2.set(ringC), Math.min(1, d / (rad * 0.9)));
  }, { jit: 0.06, ao: false });
}
function coin(k, x, y, z, tilt = 0, yaw = 0, rad = 0.05) {
  k.cyl(rad, rad, 0.014, x, y, z, (c, px, py, pz, nx, ny) => c.set(Math.abs(ny) > 0.9 ? C.gold : C.goldD), 9, { rx: tilt, ry: yaw, jit: 0.12, ctr: true });
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
function cart(k, x, z, ry, load, loadCol, glowLoad = false) {
  const sub = makeKit(7);
  // bin: tapered square
  sub.add(new THREE.CylinderGeometry(0.17, 0.12, 0.13, 4).rotateY(Math.PI / 4).scale(1, 1, 0.75).translate(0, 0.065, 0), 0, 0.06, 0, [C.woodD, C.plank], { jit: 0.08 });
  sub.box(0.25, 0.018, 0.2, 0, 0.17, 0, C.iron);
  sub.box(0.25, 0.018, 0.2, 0, 0.09, 0, C.iron);
  for (const [wx, wz] of [[-0.09, 0.1], [0.09, 0.1], [-0.09, -0.1], [0.09, -0.1]]) sub.cyl(0.045, 0.045, 0.02, wx, 0.045, wz, C.iron, 8, { rx: Math.PI / 2, ctr: true });
  for (let i = 0; i < 6; i++) {
    const lx = (i % 3 - 1) * 0.07, lz = (Math.floor(i / 3) - 0.5) * 0.08;
    if (load === 'gold') sub.ball(0.045, lx, 0.19 + (i % 2) * 0.02, lz, glowLoad ? GL.gold : C.gold, { det: 0, glow: glowLoad && i % 2 === 0 });
    else sub.rock(0.05, lx, 0.17 + (i % 2) * 0.02, lz, loadCol, { flat: false, amp: 0.3 });
  }
  if (load === 'gold') for (let i = 0; i < 4; i++) sub.ball(0.04, (i - 1.5) * 0.05, 0.2, 0, C.gold, { det: 0 });
  for (const p of sub.B) { p.g.rotateY(ry).translate(x, 0, z); k.B.push(p); }
  for (const p of sub.G) { p.g.rotateY(ry).translate(x, 0, z); k.G.push(p); }
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
function goldPile(k) {
  patch(k, 0.34, 0x8a6a40, 0, 0.012);
  // sack
  k.lathe([[0.001, 0], [0.13, 0.01], [0.17, 0.08], [0.16, 0.17], [0.11, 0.24], [0.05, 0.27], [0.035, 0.29]], 9, -0.1, 0.012, -0.08, [0xa07848, 0xd8b078], { jit: 0.12 });
  k.lathe([[0.001, 0], [0.045, 0.0], [0.07, 0.06], [0.05, 0.08], [0.001, 0.085]], 7, -0.1, 0.29, -0.08, [0xb88a58, 0xd8b078]);
  k.torus(0.04, 0.012, -0.1, 0.29, -0.08, 0x6a3a1a, { rx: Math.PI / 2, rs: 10, ts: 4 });
  k.lathe([[0.001, 0.0], [0.07, 0.0], [0.04, 0.035], [0.001, 0.045]], 7, -0.1, 0.11, 0.06, C.gold, { jit: 0.18 }); // coins at the sack mouth? small bump of gold
  // a mound of gold coins
  k.lathe([[0.001, 0], [0.2, 0], [0.17, 0.04], [0.1, 0.09], [0.001, 0.11]], 10, 0.07, 0.01, 0.06, [0x8a4a06, 0xd89a18], { jit: 0.25 });
  for (let i = 0; i < 16; i++) {
    const a = k.r() * TAU, d = 0.04 + k.r() * 0.16;
    const x = 0.07 + Math.cos(a) * d, z = 0.06 + Math.sin(a) * d;
    const y = 0.012 + Math.max(0, 0.1 * (1 - d / 0.2)) + 0.01;
    coin(k, x, y, z, k.rr(-0.6, 0.6), k.r() * TAU);
  }
  for (let i = 0; i < 7; i++) { const a = k.r() * TAU, d = 0.24 + k.r() * 0.1; coin(k, 0.05 + Math.cos(a) * d, 0.02, 0.05 + Math.sin(a) * d, k.rr(-0.2, 0.2), k.r() * 3); }
  // two gold bars
  k.box(0.14, 0.045, 0.06, 0.18, 0.012, -0.14, [C.goldD, C.gold], { bev: 0.012, ry: 0.4 });
  k.box(0.14, 0.045, 0.06, 0.16, 0.057, -0.13, [C.goldD, C.goldL], { bev: 0.012, ry: 0.2 });
  sparkle(k, 0.07, 0.2, 0.06, 0.035, 0xfff0b0); sparkle(k, -0.04, 0.12, 0.2, 0.025, 0xfff0b0); sparkle(k, 0.22, 0.13, -0.12, 0.025, 0xfff0b0);
}
function woodPile(k) {
  patch(k, 0.36, 0x6a5030, 0, 0.012);
  // a pyramid of logs running front to back, ring ends facing the viewer
  const L = 0.46, rad = 0.058;
  const rows = [[-0.18, -0.06, 0.06, 0.18], [-0.12, 0, 0.12], [-0.06, 0.06]];
  rows.forEach((row, ri) => row.forEach((x) => {
    const y = 0.012 + rad + ri * rad * 1.72, off = (k.r() - 0.5) * 0.08, rr = rad * k.rr(0.9, 1.06);
    log(k, [x + (k.r() - 0.5) * 0.02, y, -L / 2 + off - 0.04], [x, y, L / 2 + off - 0.04], rr, { seg: 8, bark: [0x3a2412, 0x8a5a30] });
  }));
  // a stump with an axe
  k.cyl(0.07, 0.085, 0.1, 0.27, 0.012, 0.24, (c, x, y, z, nx, ny) => c.set(ny > 0.9 ? C.ring : C.bark), 8);
  k.plank([0.27, 0.11, 0.24], [0.36, 0.27, 0.3], 0.022, 0.022, C.woodL);
  k.box(0.02, 0.06, 0.07, 0.28, 0.09, 0.24, C.steel, { rz: -0.9, ry: 0.3 });
  // chips
  for (let i = 0; i < 5; i++) k.box(0.04, 0.008, 0.02, k.rr(-0.25, 0.2), 0.012, k.rr(0.22, 0.32), C.ring, { ry: k.r() * 3 });
}
function orePile(k) {
  patch(k, 0.38, 0x5a5048, 0, 0.012);
  cart(k, -0.08, -0.06, 0.5, 'ore', [0x4a4a58, 0x9a9aac]);
  // heaped chunks: iron-grey and rust-red ore, with metallic flecks
  const cols = [[0x3a3a46, 0x9a9cae], [0x5a2a1a, 0xb8603a], [0x34343e, 0x8a8c9c]];
  for (let i = 0; i < 8; i++) {
    const a = -0.5 + i * 0.75, d = 0.18 + k.r() * 0.08;
    k.rock(0.06 + k.r() * 0.04, Math.cos(a) * d + 0.05, 0.012, Math.sin(a) * d + 0.08, cols[i % 3], { amp: 0.3, s: [1, 0.8, 1] });
  }
  k.rock(0.11, 0.12, 0.012, 0.14, cols[0], { amp: 0.25, s: [1, 0.75, 1] });
  for (let i = 0; i < 8; i++) k.add(new THREE.OctahedronGeometry(0.02, 0), k.rr(-0.15, 0.3), 0.04 + k.r() * 0.06, k.rr(0.0, 0.3), i % 2 ? 0xe08a4a : 0xe8ecf8, { jit: 0.02 });
  // pickaxe leaning on the cart
  k.plank([0.12, 0.012, 0.16], [0.07, 0.3, 0.0], 0.02, 0.02, C.woodL);
  k.add(new THREE.BoxGeometry(0.2, 0.025, 0.025), 0.07, 0.3, 0.0, C.ironL, { rz: 0.25, ry: -0.3 });
  sparkle(k, 0.14, 0.2, 0.18, 0.025, 0xe0f0ff);
}
function gemPile(k) {
  k.rock(0.22, 0, 0, 0, [0x4a4058, 0x7a6a88], { s: [1.1, 0.35, 1], amp: 0.2 });
  const cols = [[0x7a1030, 0xff4a8a], [0x0a5a4a, 0x4affd0], [0x2a1a6a, 0xa070ff], [0x0a2a7a, 0x5ab0ff], [0x7a1030, 0xff6a6a]];
  const set = [[0, 0, 0.42, 0.075, 0.05, 0], [0.12, 0.04, 0.3, 0.06, -0.5, 0.4], [-0.12, 0.05, 0.32, 0.06, 0.55, -0.2], [0.04, -0.12, 0.26, 0.055, -0.35, 1.8], [-0.06, 0.13, 0.22, 0.05, 0.4, 2.6], [0.18, -0.1, 0.18, 0.045, -0.7, 0.9], [-0.18, -0.06, 0.2, 0.045, 0.7, -0.5]];
  set.forEach(([x, z, len, rad, tilt, yaw], i) => {
    k.crystal(x, 0.03, z, len, rad, cols[i % cols.length], tilt, yaw, { jit: 0.06 });
  });
  // inner glow cores and sparkles
  k.crystal(0, 0.05, 0, 0.3, 0.035, GL.pink, 0.05, 0, { glow: true });
  k.crystal(0.12, 0.06, 0.04, 0.2, 0.025, GL.cyan, -0.5, 0.4, { glow: true });
  k.crystal(-0.12, 0.06, 0.05, 0.22, 0.025, GL.violet, 0.55, -0.2, { glow: true });
  for (let i = 0; i < 5; i++) k.add(new THREE.OctahedronGeometry(0.03, 0).scale(1, 1.4, 1), Math.cos(i * 1.3) * 0.27, 0.025, Math.sin(i * 1.3) * 0.27, [0xff4a8a, 0x4affd0, 0xa070ff, 0x5ab0ff, 0xffd040][i], { jit: 0.05 });
  sparkle(k, 0.02, 0.5, 0.02, 0.035, 0xffd0f0); sparkle(k, -0.18, 0.3, 0.1, 0.025, 0xc0f0ff);
}

// ---------------------------------------------------------------- treasure
function chest(k) {
  patch(k, 0.36, 0x7a6040, 0, 0.012);
  const W = 0.4, D = 0.26, H = 0.18, y0 = 0.012, z0 = -0.02;
  k.box(W, H, D, 0, y0, z0, [0x5a3418, 0x9a6230], { bev: 0.012 });
  // dark inside and a heap of gold
  k.box(W - 0.04, 0.01, D - 0.04, 0, y0 + H - 0.005, z0, 0x1a0e08, { ao: false });
  k.lathe([[0.001, 0], [0.19, 0], [0.15, 0.04], [0.07, 0.075], [0.001, 0.085]], 10, 0, y0 + H - 0.01, z0, [0x8a4a06, 0xd89a18], { s: [1, 1, 0.62], jit: 0.25 });
  for (let i = 0; i < 8; i++) coin(k, k.rr(-0.14, 0.14), y0 + H + 0.03 + k.r() * 0.03, z0 + k.rr(-0.07, 0.07), k.rr(-0.5, 0.5), k.r() * 3, 0.035);
  // metal bands and corners
  for (const x of [-0.13, 0.13]) k.box(0.035, H + 0.008, D + 0.012, x, y0 - 0.004, z0, [C.goldD, C.gold], { jit: 0.05 });
  k.box(W + 0.012, 0.03, D + 0.012, 0, y0, z0, C.goldD, { jit: 0.05 });
  // lock plate
  k.box(0.07, 0.08, 0.02, 0, y0 + H - 0.09, z0 + D / 2 + 0.005, C.gold, { bev: 0.008 });
  k.box(0.018, 0.03, 0.01, 0, y0 + H - 0.07, z0 + D / 2 + 0.017, C.dark);
  // the open lid: half cylinder hinged at the back, tipped back
  // built in hinge space: dome up, spanning z in [0, D], then tipped back about the hinge
  const lg = new THREE.CylinderGeometry(D / 2, D / 2, W, 9, 1, false, 0, Math.PI).toNonIndexed();
  lg.rotateZ(Math.PI / 2).scale(1, 0.7, 1).translate(0, 0, D / 2);
  lg.rotateX(-1.95);
  k.add(new THREE.BoxGeometry(W - 0.01, 0.012, D - 0.01).translate(0, 0.006, D / 2).rotateX(-1.95), 0, y0 + H, z0 - D / 2, 0x3a200e, { jit: 0.05 });
  k.add(lg, 0, y0 + H, z0 - D / 2, [0x6a3e1c, 0xa86c34], { jit: 0.1 });
  const band = (x) => {
    const bg = new THREE.CylinderGeometry(D / 2 + 0.006, D / 2 + 0.006, 0.035, 9, 1, false, 0, Math.PI).toNonIndexed();
    bg.rotateZ(Math.PI / 2).scale(1, 0.7, 1).translate(x, 0, D / 2).rotateX(-1.95);
    k.add(bg, 0, y0 + H, z0 - D / 2, C.goldD, { jit: 0.05 });
  };
  band(-0.13); band(0.13);
  // spilling coins down the front and on the ground, a gem and a goblet
  for (let i = 0; i < 9; i++) coin(k, k.rr(-0.14, 0.14), y0 + 0.01 + k.r() * 0.01, z0 + D / 2 + 0.04 + k.r() * 0.12, k.rr(-0.3, 0.3), k.r() * 3, 0.04);
  coin(k, 0.05, y0 + 0.12, z0 + D / 2 + 0.02, 1.3, 0.2, 0.04);
  coin(k, -0.06, y0 + 0.06, z0 + D / 2 + 0.03, 1.1, -0.3, 0.04);
  k.lathe([[0.001, 0], [0.04, 0], [0.012, 0.02], [0.01, 0.07], [0.045, 0.1], [0.05, 0.14], [0.04, 0.14], [0.001, 0.105]], 8, 0.24, y0, 0.08, [C.goldD, C.goldL]);
  k.add(new THREE.OctahedronGeometry(0.035, 0).scale(1, 1.3, 1), -0.24, 0.045, 0.1, 0xff3a5a, { jit: 0.05 });
  k.add(new THREE.OctahedronGeometry(0.028, 0).scale(1, 1.3, 1), 0.06, y0 + H + 0.08, z0, 0x3ad0ff, { jit: 0.05 });
  // a warm glow coming off the gold
  k.lathe([[0.001, 0], [0.12, 0], [0.06, 0.035], [0.001, 0.05]], 8, 0, y0 + H + 0.03, z0, 0x8a5a10, { glow: true, s: [1, 1, 0.6] });
  sparkle(k, -0.05, y0 + H + 0.12, z0, 0.04, 0xfff0b0); sparkle(k, 0.1, y0 + H + 0.08, z0 + 0.05, 0.03, 0xfff0b0);
}
function artifact(k) {
  // dais and a carved pedestal
  k.cyl(0.3, 0.33, 0.05, 0, 0, 0, mottle(C.stoneD, C.stone), 8);
  k.cyl(0.24, 0.26, 0.05, 0, 0.05, 0, mottle(C.stone, C.stoneL), 8);
  k.lathe([[0.001, 0.1], [0.14, 0.1], [0.14, 0.14], [0.1, 0.17], [0.075, 0.2], [0.07, 0.42], [0.1, 0.45], [0.14, 0.48], [0.14, 0.51], [0.001, 0.51]], 8, 0, 0, 0, [C.stone, C.marble], { jit: 0.06 });
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; k.box(0.025, 0.12, 0.006, Math.sin(a) * 0.073, 0.25, Math.cos(a) * 0.073, GL.cyan, { glow: true, ry: a }); }
  // the relic: a gold-caged gem floating above
  const y = 0.72;
  k.add(new THREE.OctahedronGeometry(0.11, 0).scale(1, 1.45, 1), 0, y, 0, GL.violet, { glow: true });
  k.add(new THREE.OctahedronGeometry(0.06, 0).scale(1, 1.45, 1), 0, y, 0, 0xffe0ff, { glow: true, s: 1.05 });
  k.torus(0.15, 0.014, 0, y, 0, [C.goldD, C.goldL], { rx: Math.PI / 2 + 0.3, rs: 18 });
  k.torus(0.15, 0.014, 0, y, 0, [C.goldD, C.goldL], { ry: 0.6, rx: 0.2, rs: 18 });
  k.cone(0.03, 0.06, 0, y + 0.16, 0, C.gold, 4);
  k.cone(0.03, 0.06, 0, y - 0.16, 0, C.gold, 4, { rx: Math.PI });
  // light pooling on the pedestal and halo rings
  k.cyl(0.12, 0.12, 0.004, 0, 0.512, 0, 0x6a3aa0, 10, { glow: true });
  k.torus(0.23, 0.008, 0, y - 0.02, 0, 0x8a5ad0, { glow: true, rx: Math.PI / 2, rs: 20, ts: 3 });
  sparkle(k, 0.18, y + 0.15, 0.06, 0.04, 0xf0d8ff); sparkle(k, -0.16, y - 0.12, 0.1, 0.03, 0xf0d8ff); sparkle(k, 0.04, y + 0.28, -0.05, 0.03, 0xf0d8ff);
}
function campfire(k) {
  patch(k, 0.4, 0x5a4434, 0, 0.012);
  // ash bed and a ring of stones
  k.cyl(0.16, 0.17, 0.012, 0, 0.012, 0, 0x3a3230, 10);
  for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; k.rock(0.05, Math.cos(a) * 0.19, 0.012, Math.sin(a) * 0.19, [0x5a5650, 0x9a948a], { amp: 0.25, s: [1, 0.75, 1] }); }
  // crossed logs (teepee)
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + 0.3; log(k, [Math.cos(a) * 0.15, 0.02, Math.sin(a) * 0.15], [Math.cos(a) * 0.02, 0.2, Math.sin(a) * 0.02], 0.022, { seg: 5, bark: [0x2a1a10, 0x6a4024] }); }
  // flames: nested glowing tongues
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; k.cone(0.06, 0.2 + k.r() * 0.08, Math.cos(a) * 0.045, 0.03, Math.sin(a) * 0.045, GL.fire, 5, { glow: true, rz: Math.cos(a) * 0.25, rx: -Math.sin(a) * 0.25 }); }
  k.cone(0.08, 0.34, 0, 0.03, 0, 0xe0501a, 6, { glow: true });
  k.cone(0.045, 0.24, 0, 0.04, 0, GL.fireY, 5, { glow: true });
  for (let i = 0; i < 7; i++) k.add(new THREE.OctahedronGeometry(0.012, 0), k.rr(-0.1, 0.1), 0.3 + k.r() * 0.25, k.rr(-0.1, 0.1), GL.fireY, { glow: true });
  for (let i = 0; i < 6; i++) k.box(0.025, 0.012, 0.02, k.rr(-0.1, 0.1), 0.022, k.rr(-0.1, 0.1), GL.red, { glow: true, ry: k.r() * 3 });
  // tripod and a hanging pot
  const top = [0, 0.5, 0];
  for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + 0.5; k.beam([Math.cos(a) * 0.26, 0.012, Math.sin(a) * 0.26], [Math.cos(a) * 0.015, 0.52, Math.sin(a) * 0.015], 0.012, C.woodD, 5); }
  k.beam(top, [0, 0.36, 0], 0.004, 0x2a2a2a, 3);
  k.lathe([[0.001, 0.25], [0.05, 0.25], [0.085, 0.29], [0.085, 0.33], [0.07, 0.36], [0.075, 0.37], [0.06, 0.37]], 9, 0, 0, 0, [0x1a1a1e, 0x4a4a52], { jit: 0.05 });
  k.cyl(0.062, 0.062, 0.005, 0, 0.36, 0, 0x7a8a3a, 9);
  k.ball(0.02, 0.03, 0.4, 0, 0xc8d0d8, { glow: false, det: 0 });
  // log seat and a sack of supplies
  log(k, [-0.32, 0.045, 0.1], [-0.28, 0.045, -0.2], 0.04, { bark: [0x4a2e18, 0x7a4e2a] });
  k.lathe([[0.001, 0], [0.07, 0], [0.09, 0.06], [0.07, 0.13], [0.03, 0.15], [0.001, 0.15]], 7, 0.3, 0.012, -0.15, [0x9a7a50, 0xc8a878]);
  // warm light on the ground
  k.cyl(0.15, 0.15, 0.003, 0, 0.025, 0, 0x6a2a08, 10, { glow: true });
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
function mineEntrance(k, x, z, w = 0.3, h = 0.3) {
  // dark tunnel, timber posts and lintel with braces
  k.box(w, h, 0.25, x, 0.0, z - 0.1, 0x0a0608, { ao: false, jit: 0 });
  k.box(w - 0.06, h - 0.03, 0.04, x, 0.0, z - 0.07, 0x000000, { jit: 0, ao: false });
  for (const s of [-1, 1]) {
    k.box(0.05, h + 0.02, 0.06, x + s * (w / 2 + 0.01), 0, z + 0.03, [C.woodD, C.wood], { bev: 0.008 });
    k.plank([x + s * (w / 2 + 0.01), h - 0.07, z + 0.07], [x + s * (w / 2 - 0.07), h + 0.0, z + 0.07], 0.025, 0.02, C.wood);
  }
  k.box(w + 0.12, 0.05, 0.07, x, h + 0.01, z + 0.03, [C.woodD, C.woodL], { bev: 0.008 });
  k.box(w + 0.06, 0.04, 0.05, x, h + 0.06, z + 0.0, C.wood, { bev: 0.006 });
}
function goldmine(k) {
  patch(k, 0.62, 0x7a6448, 0, 0.012, 12, 0, 0.0);
  const cols = (c, x, y, z, nx, ny) => { c.set(0x4a3a2e).lerp(_c2.set(0xc8a878), Math.min(1, y / 0.6)); if (ny > 0.8 && y > 0.45) c.lerp(_c2.set(0xe8dcc8), 0.5); };
  mountain(k, cols);
  // gold veins: glowing seams and nuggets on the rock faces
  const veins = [[0, -0.5, 0.5], [0, 0.6, 0.3], [0, 0.0, 0.85], [1, -0.4, 0.5], [2, 0.5, 0.6], [2, -0.2, 0.25], [5, 0.3, 0.7], [1, 0.9, 0.2]];
  for (const [pi, az, el] of veins) {
    const { p, n } = onPeak(pi, az, el, 0.9);
    const t = [n[2], 0.5, -n[0]];
    k.plank([p[0] - t[0] * 0.05, p[1] - 0.025, p[2] - t[2] * 0.05], [p[0] + t[0] * 0.05, p[1] + 0.025, p[2] + t[2] * 0.05], 0.022, 0.05, GL.gold, { glow: true });
    k.add(new THREE.OctahedronGeometry(0.03, 0), p[0] + n[0] * 0.03, p[1] + n[1] * 0.03 + 0.03, p[2] + n[2] * 0.03, C.gold, { jit: 0.1 });
  }
  mineEntrance(k, 0, 0.12, 0.3, 0.32);
  rails(k, 0, 0.02, 0.06, 0.58);
  cart(k, 0.05, 0.42, 0.1, 'gold', C.gold, true);
  lantern(k, -0.205, 0.3, 0.2);
  // spill of gold nuggets and a pickaxe
  for (let i = 0; i < 6; i++) k.add(new THREE.OctahedronGeometry(0.025, 0), k.rr(-0.38, -0.16), 0.03, k.rr(0.3, 0.48), C.gold);
  k.plank([-0.3, 0.012, 0.46], [-0.24, 0.2, 0.32], 0.02, 0.02, C.woodL);
  k.add(new THREE.BoxGeometry(0.18, 0.022, 0.022), -0.24, 0.2, 0.32, C.ironL, { rz: 0.3, ry: 0.6 });
  sparkle(k, -0.12, 0.62, -0.05, 0.04, 0xfff0b0); sparkle(k, 0.38, 0.42, -0.02, 0.035, 0xfff0b0);
}
function orepit(k) {
  // a quarry: rock walls ringing a sunken floor, cut blocks, a crane
  k.cyl(0.58, 0.6, 0.02, 0, 0, 0, 0x6a6058, 12);
  k.cyl(0.36, 0.38, 0.005, 0.0, 0.02, 0.02, 0x3a3634, 10);
  const cols = (c, x, y, z, nx, ny) => { c.set(0x4a4a52).lerp(_c2.set(0x9a9aa8), Math.min(1, y / 0.45)); if (ny > 0.7 && y > 0.25) c.lerp(_c2.set(0x6a9a48), 0.5); };
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (1.05 + i / 8 * 0.95) + (k.r() - 0.5) * 0.15, d = 0.42;
    const big = i > 1 && i < 7;
    k.rock(big ? 0.22 : 0.16, Math.cos(a) * d, 0, Math.sin(a) * d * 0.9, cols, { amp: 0.25, s: [1, big ? 1.6 : 1.1, 1] });
  }
  // terraced cut faces
  k.box(0.42, 0.14, 0.12, 0, 0.02, -0.24, mottle(0x5a5a64, 0x8a8a98, 14), { bev: 0.015 });
  k.box(0.3, 0.12, 0.1, 0, 0.16, -0.32, mottle(0x6a6a74, 0x9a9aa8, 14), { bev: 0.015 });
  // ore seams
  for (let i = 0; i < 5; i++) k.add(new THREE.OctahedronGeometry(0.03, 0), k.rr(-0.18, 0.18), 0.06 + k.r() * 0.2, -0.17 - k.r() * 0.12, i % 2 ? 0xc06a3a : 0xc8ccd8, { jit: 0.04 });
  // cut blocks
  k.box(0.12, 0.08, 0.09, 0.3, 0.02, 0.25, [0x7a7a84, 0xa8a8b4], { bev: 0.012, ry: 0.3 });
  k.box(0.1, 0.07, 0.08, 0.31, 0.1, 0.24, [0x7a7a84, 0xa8a8b4], { bev: 0.012, ry: 0.1 });
  k.box(0.12, 0.08, 0.09, 0.42, 0.02, 0.12, [0x7a7a84, 0xa8a8b4], { bev: 0.012, ry: -0.4 });
  // ore heap and cart
  for (let i = 0; i < 7; i++) k.rock(0.05 + k.r() * 0.03, -0.12 + k.rr(-0.1, 0.1), 0.02 + (i > 4 ? 0.05 : 0), 0.12 + k.rr(-0.06, 0.06), [0x3a3a44, 0x7a7a8a], { amp: 0.3 });
  cart(k, 0.1, 0.12, -0.6, 'ore', 0x5a5a66);
  // wooden crane: tripod with a boom and a hanging bucket
  const base = [-0.3, 0.02, 0.15];
  for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + 0.4; k.beam([base[0] + Math.cos(a) * 0.12, 0.02, base[2] + Math.sin(a) * 0.12], [base[0], 0.6, base[2]], 0.015, C.wood, 5); }
  k.beam([base[0] - 0.08, 0.5, base[2] - 0.05], [base[0] + 0.32, 0.66, base[2] - 0.12], 0.014, C.woodL, 5);
  k.beam([base[0] + 0.3, 0.65, base[2] - 0.12], [base[0] + 0.3, 0.3, base[2] - 0.12], 0.004, 0xc8b080, 3);
  k.cyl(0.04, 0.03, 0.06, base[0] + 0.3, 0.25, base[2] - 0.12, [C.woodD, C.wood], 7);
  k.box(0.06, 0.06, 0.06, base[0] - 0.09, 0.42, base[2] - 0.05, C.stoneD, { bev: 0.01 });
  lantern(k, base[0], 0.56, base[2] + 0.02);
  lantern(k, 0.26, 0.012, -0.05);
}
function gemmine(k) {
  patch(k, 0.62, 0x3a3450, 0, 0.012, 12, 0, 0.0);
  const cols = (c, x, y, z, nx, ny) => { c.set(0x241e34).lerp(_c2.set(0x8070a8), Math.min(1, y / 0.6)); };
  mountain(k, cols);
  // the cavern mouth: a dark arch ringed with rocks
  k.lathe([[0.001, 0], [0.19, 0], [0.19, 0.17], [0.13, 0.27], [0.001, 0.3]], 8, 0, 0, 0.06, 0x06040a, { s: [1, 1, 0.5], ao: false, jit: 0 });
  for (let i = 0; i < 7; i++) { const a = Math.PI * i / 6; k.rock(0.065, Math.cos(a) * 0.23, Math.max(0, Math.sin(a) * 0.3 - 0.03), 0.13, cols, { amp: 0.3, flat: false }); }
  // giant crystals bursting from the rock, each with a glowing core
  const tint = [[0x3a1070, 0xc080ff], [0x0a3a6a, 0x60d0ff], [0x6a0a3a, 0xff70b0], [0x0a5a4a, 0x60ffd0]];
  const gtint = [GL.violet, GL.cyan, GL.pink, GL.green];
  const big = [[0, 0.15, 1.2, 0.5, 0.085, 0], [0, -0.7, 0.55, 0.4, 0.07, 2], [0, 0.8, 0.5, 0.38, 0.065, 3], [1, -0.6, 0.6, 0.38, 0.07, 1], [2, 0.6, 0.65, 0.42, 0.075, 0], [5, 0.0, 1.0, 0.36, 0.065, 1], [3, -0.4, 0.5, 0.26, 0.055, 2], [4, 0.5, 0.6, 0.26, 0.055, 3], [1, 0.4, 1.0, 0.26, 0.055, 2]];
  for (const [pi, az, el, len, rad, ci] of big) {
    const { p, n } = onPeak(pi, az, el, 0.86);
    crystalAlong(k, p, n, len, rad, tint[ci], { jit: 0.05, ao: false });
    crystalAlong(k, p, n, len * 0.55, rad * 1.12, gtint[ci], { glow: true });
  }
  // little glowing crystals inside the mouth and on the ground
  for (let i = 0; i < 4; i++) k.crystal(-0.1 + i * 0.065, 0, 0.06, 0.08 + (i % 2) * 0.05, 0.02, gtint[i], (i - 1.5) * 0.3, 0, { glow: true });
  for (let i = 0; i < 6; i++) { const a = 0.4 + i * 0.45; k.crystal(Math.cos(a) * 0.45, 0.012, 0.28 + Math.sin(a) * 0.14, 0.1, 0.025, tint[i % 4], k.rr(-0.4, 0.4), k.r() * 3); }
  k.cyl(0.18, 0.2, 0.004, 0, 0.014, 0.28, 0x30205a, 10, { glow: true, s: [1, 1, 0.5] });
  sparkle(k, -0.3, 0.6, 0.05, 0.04, 0xe0c0ff); sparkle(k, 0.34, 0.7, -0.05, 0.04, 0xc0f0ff); sparkle(k, 0.06, 0.95, -0.2, 0.035, 0xffc0e0);
}
function sawmill(k) {
  patch(k, 0.6, 0x6a5a3a, 0, 0.012);
  // stream and pool beside the mill
  k.box(0.26, 0.012, 1.1, 0.44, 0.006, 0, [0x2a6ab8, 0x3a8ad8], { jit: 0.05, ao: false });
  for (let i = 0; i < 6; i++) k.rock(0.045, 0.31 + (i % 2) * 0.26, 0.006, -0.48 + i * 0.19, [0x5a5650, 0x9a948a], { amp: 0.3 });
  // stone footing and timber walls
  k.box(0.62, 0.08, 0.46, -0.08, 0, -0.05, mottle(C.stoneD, C.stone), { bev: 0.015 });
  const plank = (c, x, y, z) => { const t = (Math.sin(y * 90) + 1) / 2; c.set(0x7a4e28).lerp(_c2.set(0xb07a44), 0.35 + t * 0.5); };
  k.box(0.56, 0.3, 0.4, -0.08, 0.08, -0.05, plank, { jit: 0.05 });
  for (const [x, z] of [[-0.36, 0.15], [0.2, 0.15], [-0.36, -0.25], [0.2, -0.25]]) k.box(0.04, 0.32, 0.04, x, 0.08, z, C.woodD);
  k.box(0.6, 0.035, 0.44, -0.08, 0.36, -0.05, C.woodD);
  k.gable(0.56, 0.22, 0.4, -0.08, 0.38, -0.05, plank);
  shingles(k, 0.7, 0.24, 0.54, -0.08, 0.37, -0.05, [0x7a2a18, 0xc04a2a], [0x8a3420, 0xd85a32]);
  // door and windows
  k.box(0.12, 0.18, 0.02, -0.2, 0.08, 0.16, 0x3a2414);
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
  k.cyl(R1 + 0.04, R1 + 0.06, 0.03, 0, 0, 0, mottle(C.stoneD, C.stone), 16);
  k.cyl(R0, R0, 0.012, 0, 0.03, 0, [C.sand, 0xe8cc90], 16, { ao: false });
  const wall = mottle(0xc8b490, 0xe8dcc0, 11);
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
  ringBand(0.23, 0.045, R0 - 0.01, R1 + 0.01, [0xb8a480, 0xe0d4b8]);
  ringBand(0.42, 0.05, R0, R1, [0xc8b490, 0xf0e6d0]);
  // inner seating steps visible from above
  k.lathe([[R0 - 0.0, 0.03], [R0 - 0.0, 0.1], [R0 - 0.05, 0.1], [R0 - 0.05, 0.05], [R0 - 0.0, 0.03]].reverse(), 20, 0, 0, 0, 0xa89070);
  // banners on poles
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * TAU + Math.PI / 4, x = Math.sin(a) * 0.49, z = Math.cos(a) * 0.49;
    k.beam([x, 0.47, z], [x, 0.78, z], 0.01, C.woodD, 5);
    k.poly([[x, 0.77, z], [x + Math.cos(a) * 0.14, 0.77, z - Math.sin(a) * 0.14], [x + Math.cos(a) * 0.12, 0.7, z - Math.sin(a) * 0.12], [x, 0.67, z]], i % 2 ? C.red : C.blue, { ds: true, ao: false });
    k.cone(0.018, 0.04, x, 0.78, z, C.gold, 5);
  }
  // fighting posts and crossed weapons in the sand
  k.cyl(0.03, 0.035, 0.14, -0.12, 0.04, -0.05, [C.woodD, C.wood], 6);
  k.plank([-0.17, 0.12, -0.05], [-0.07, 0.12, -0.05], 0.015, 0.015, C.wood);
  k.plank([0.1, 0.04, 0.05], [0.18, 0.2, 0.0], 0.012, 0.006, C.steel);
  k.plank([0.2, 0.04, 0.05], [0.1, 0.2, 0.0], 0.012, 0.006, C.steel);
  k.cyl(0.06, 0.06, 0.012, 0.05, 0.042, 0.15, [C.redD, C.red], 10, { rx: 0.4, ctr: true });
}
function tower(k) {
  k.rock(0.3, 0, 0, 0, [0x5a5a64, 0x8a8a98], { amp: 0.2, s: [1.3, 0.35, 1.3] });
  // tapered stone tower
  const stone = (c, x, y, z) => { const b = Math.floor(y * 22) % 2; const v = (Math.sin(Math.atan2(z, x) * 4 + b * 2) + 1) / 2; c.set(0x6a6a8a).lerp(_c2.set(0xa8a8c8), 0.3 + v * 0.35 + Math.min(0.3, y * 0.2)); };
  k.lathe([[0.001, 0.05], [0.22, 0.05], [0.2, 0.12], [0.16, 0.22], [0.14, 0.9], [0.18, 0.95], [0.001, 0.95]], 8, 0, 0, 0, stone, { jit: 0.05 });
  for (const y of [0.4, 0.68]) k.cyl(0.16, 0.16, 0.03, 0, y, 0, 0x4a4a6a, 8);
  // balcony and parapet
  k.cyl(0.24, 0.2, 0.05, 0, 0.92, 0, mottle(0x5a5a7a, 0x8a8aaa), 10);
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; k.box(0.04, 0.05, 0.025, Math.cos(a) * 0.22, 0.97, Math.sin(a) * 0.22, 0x8a8aaa, { ry: -a }); }
  // upper chamber and the starry conical roof
  k.cyl(0.13, 0.14, 0.18, 0, 0.97, 0, stone, 8);
  const roof = (c, x, y, z) => c.set(0x1a2a7a).lerp(_c2.set(0x4a5ad0), Math.min(1, (y - 1.1) / 0.5));
  k.cone(0.2, 0.52, 0, 1.13, 0, roof, 8);
  for (let i = 0; i < 8; i++) { const t = 0.15 + (i % 4) * 0.18, a = i * 2.4; const rad = 0.2 * (1 - t) + 0.01; k.add(new THREE.OctahedronGeometry(0.014, 0), Math.cos(a) * rad, 1.13 + t * 0.52, Math.sin(a) * rad, 0xffe080, { glow: true }); }
  // star finial
  k.beam([0, 1.62, 0], [0, 1.72, 0], 0.008, C.gold, 4);
  k.add(new THREE.OctahedronGeometry(0.05, 0).scale(1, 1, 0.35), 0, 1.76, 0, GL.gold, { glow: true });
  k.add(new THREE.OctahedronGeometry(0.035, 0).scale(0.35, 0.35, 1).rotateZ(0.78), 0, 1.76, 0, GL.gold, { glow: true, s: [1.6, 1.6, 1] });
  // glowing windows
  for (const [y, a] of [[0.3, 0.3], [0.55, -0.6], [0.8, 0.5], [1.03, 0.0], [1.03, 2.1], [1.03, -2.1]]) {
    const rad = y > 0.95 ? 0.135 : 0.155 - (y - 0.22) * 0.02;
    k.box(0.04, 0.07, 0.01, Math.sin(a) * rad, y, Math.cos(a) * rad, GL.cyan, { glow: true, ry: a });
  }
  k.box(0.08, 0.13, 0.02, 0, 0.05, 0.19, 0x2a1a10, { ry: 0 });
  // brass telescope on the balcony pointing at the sky
  k.beam([0.12, 1.0, 0.1], [0.12, 1.08, 0.1], 0.01, C.iron, 4);
  k.beam([0.06, 1.04, 0.04], [0.3, 1.24, 0.24], 0.022, [0xa06a20, 0xe8b850], 8, { taper: 1.5 });
  k.cyl(0.035, 0.035, 0.03, 0.3, 1.24, 0.24, C.goldD, 8, { ctr: true, rx: 0.9, ry: -0.8 });
  // a floating rune ring
  k.torus(0.3, 0.008, 0, 0.6, 0, GL.cyan, { glow: true, rx: Math.PI / 2 + 0.15, rs: 24, ts: 3 });
  sparkle(k, 0.28, 0.6, 0.1, 0.03, 0xc0f0ff); sparkle(k, -0.25, 0.65, -0.15, 0.025, 0xc0f0ff);
}
function library(k) {
  // steps and plinth
  k.box(0.9, 0.04, 0.7, 0, 0, 0, mottle(C.stoneD, C.stone), { bev: 0.01 });
  k.box(0.8, 0.04, 0.6, 0, 0.04, -0.03, mottle(C.stone, C.stoneL), { bev: 0.01 });
  // drum with windows and the big dome
  const wall = mottle(0xd8ccb0, 0xf0e8d8, 12);
  k.box(0.62, 0.32, 0.38, 0, 0.08, -0.1, wall, { bev: 0.01 });
  k.cyl(0.24, 0.25, 0.12, 0, 0.4, -0.1, wall, 12);
  k.cyl(0.26, 0.26, 0.025, 0, 0.52, -0.1, C.goldD, 12);
  k.sphere(0.25, 0, 0.54, -0.1, [0x1a6a72, 0x7ae0c8], 12, 5, { half: true, jit: 0.05 });
  for (let i = 0; i < 6; i++) k.torus(0.255, 0.012, 0, 0.54, -0.1, C.gold, { arc: Math.PI / 2, rs: 6, ts: 3, ry: i / 6 * TAU });
  k.cyl(0.04, 0.05, 0.06, 0, 0.78, -0.1, C.gold, 6);
  k.cone(0.03, 0.08, 0, 0.84, -0.1, C.gold, 6);
  k.ball(0.025, 0, 0.93, -0.1, GL.gold, { glow: true, det: 0 });
  // portico: columns, entablature and pediment
  for (let i = 0; i < 5; i++) {
    const x = -0.28 + i * 0.14;
    k.cyl(0.028, 0.032, 0.27, x, 0.08, 0.17, [0xd8d0c0, 0xf8f4ec], 7);
    k.box(0.07, 0.025, 0.07, x, 0.08, 0.17, C.marble);
    k.box(0.07, 0.025, 0.07, x, 0.335, 0.17, C.marble);
  }
  k.box(0.68, 0.05, 0.14, 0, 0.36, 0.12, [0xd8ccb0, 0xf0e8d8], { bev: 0.008 });
  k.gable(0.7, 0.13, 0.16, 0, 0.41, 0.12, wall, { ry: 0, s: 1 });
  k.roof(0.74, 0.14, 0.2, 0, 0.41, 0.12, [0x8a3a2a, 0xb85a3a], { ry: 0 });
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
  const bc = [0x8a2a2a, 0x2a4a8a, 0x2a6a3a, 0x7a5a2a];
  for (let i = 0; i < 4; i++) k.box(0.1, 0.025, 0.07, 0.36, 0.0 + i * 0.025, 0.3, bc[i], { ry: i * 0.3, bev: 0.004 });
  k.box(0.1, 0.025, 0.07, -0.36, 0.0, 0.3, bc[1], { ry: 0.5, bev: 0.004 });
  k.box(0.1, 0.025, 0.07, -0.36, 0.025, 0.3, bc[3], { ry: 0.2, bev: 0.004 });
}
function stone(k) {
  patch(k, 0.45, 0x5a7a3a, 0, 0.012);
  // the monolith: a rounded standing stone
  const sc = (c, x, y, z, nx, ny) => { c.set(0x6a7078).lerp(_c2.set(0xaab0b4), Math.min(1, y / 0.8)); if (ny > 0.6) c.lerp(_c2.set(0x6a9a4a), 0.45); };
  k.rock(0.3, 0, -0.02, -0.02, sc, { det: 1, amp: 0.1, s: [0.85, 1.7, 0.5], sink: 0.0 });
  // glowing runes on the front face
  const runes = [[0, 0.62, [[0, -0.05], [0, 0.05]], [[-0.03, 0.03], [0.03, 0.0]]], [-0.06, 0.42, [[0, -0.05], [0, 0.05]], [[0, 0.05], [0.04, 0.0]]], [0.07, 0.3, [[-0.03, -0.04], [0.03, 0.04]], [[0.03, -0.04], [-0.03, 0.04]]], [0.0, 0.18, [[-0.04, 0], [0.04, 0]], [[0, -0.04], [0, 0.04]]]];
  for (const [x, y, ...strokes] of runes) {
    const z = 0.155 - Math.abs(y - 0.4) * 0.18;
    for (const [[ax, ay], [bx, by]] of strokes) k.plank([x + ax, y + ay, z], [x + bx, y + by, z], 0.014, 0.01, GL.cyan, { glow: true });
  }
  // circle of small stones and a glow pool
  for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + 0.2; k.rock(0.06, Math.cos(a) * 0.36, 0.012, Math.sin(a) * 0.32, [0x5a6068, 0x9aa0a8], { amp: 0.25, s: [1, 1.3, 1] }); }
  k.cyl(0.22, 0.22, 0.003, 0, 0.014, 0.08, 0x185a6a, 12, { glow: true, s: [1, 1, 0.7] });
  for (let i = 0; i < 5; i++) k.add(new THREE.OctahedronGeometry(0.018, 0), k.rr(-0.25, 0.25), 0.2 + k.r() * 0.6, k.rr(0.05, 0.25), 0x90f0ff, { glow: true });
  // grass tufts
  for (let i = 0; i < 6; i++) { const a = k.r() * TAU, d = 0.25 + k.r() * 0.15; k.cone(0.03, 0.07, Math.cos(a) * d, 0.012, Math.sin(a) * d, C.grassL, 4); }
}
function obelisk(k) {
  // stepped base
  k.box(0.56, 0.06, 0.56, 0, 0, 0, mottle(0x5a5048, 0x8a7a6a), { bev: 0.012 });
  k.box(0.42, 0.06, 0.42, 0, 0.06, 0, mottle(0x6a6050, 0x9a8a78), { bev: 0.012 });
  k.box(0.3, 0.08, 0.3, 0, 0.12, 0, mottle(0x7a7060, 0xaa9a88), { bev: 0.012 });
  // tall tapered shaft and gold pyramidion
  const sh = (c, x, y, z) => c.set(0x5a5a68).lerp(_c2.set(0xa8a8b8), Math.min(1, (y - 0.2) / 1.1));
  k.cyl(0.075 * Math.SQRT2, 0.12 * Math.SQRT2, 1.1, 0, 0.2, 0, sh, 4, { ry: Math.PI / 4, jit: 0.04 });
  k.cone(0.075 * Math.SQRT2, 0.14, 0, 1.3, 0, [C.goldD, C.goldL], 4, { ry: Math.PI / 4 });
  // carved glowing glyphs on all four faces
  for (let f = 0; f < 4; f++) {
    const a = f * Math.PI / 2;
    for (let j = 0; j < 5; j++) {
      const y = 0.35 + j * 0.17, half = 0.12 - (y - 0.2) / 1.1 * 0.045 + 0.003;
      const glyph = (j + f) % 3;
      const nx = Math.sin(a), nz = Math.cos(a), tx = Math.cos(a), tz = -Math.sin(a);
      const pt = (u, v) => [nx * half + tx * u, y + v, nz * half + tz * u];
      if (glyph === 0) { k.plank(pt(0, -0.05), pt(0, 0.05), 0.012, 0.006, GL.violet, { glow: true }); k.plank(pt(-0.03, 0.02), pt(0.03, 0.02), 0.012, 0.006, GL.violet, { glow: true }); }
      else if (glyph === 1) { k.torus(0.025, 0.006, ...pt(0, 0), GL.violet, { glow: true, ry: a, rs: 8, ts: 3 }); }
      else { k.plank(pt(-0.03, -0.04), pt(0, 0.04), 0.01, 0.006, GL.violet, { glow: true }); k.plank(pt(0, 0.04), pt(0.03, -0.04), 0.01, 0.006, GL.violet, { glow: true }); }
    }
  }
  k.add(new THREE.OctahedronGeometry(0.035, 0), 0, 1.5, 0, GL.violet, { glow: true });
  // braziers on the corners
  for (const [x, z] of [[-0.22, 0.22], [0.22, 0.22]]) {
    k.lathe([[0.001, 0.06], [0.02, 0.06], [0.015, 0.12], [0.04, 0.15], [0.045, 0.17]], 6, x, 0, z, C.iron);
    k.cone(0.03, 0.08, x, 0.16, z, GL.fire, 5, { glow: true });
  }
}
function shrine(k) {
  // round stepped platform
  k.cyl(0.52, 0.55, 0.05, 0, 0, 0, mottle(0x7a7468, 0xa8a090), 12);
  k.cyl(0.42, 0.44, 0.05, 0, 0.05, 0, mottle(0xc8c0b0, 0xe8e0d0), 12);
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
  k.lathe([[0.32, 0.67], [0.42, 0.67], [0.42, 0.72], [0.32, 0.72], [0.32, 0.67]], 12, 0, 0, 0, [0xd8d0c0, 0xf0e8d8]);
  // open onion canopy of ribs meeting at a spire
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * TAU + Math.PI / 6;
    const P = [[0.37, 0.72], [0.36, 0.82], [0.26, 0.94], [0.1, 1.02], [0.0, 1.06]];
    for (let j = 0; j < P.length - 1; j++) k.beam([Math.sin(a) * P[j][0], P[j][1], Math.cos(a) * P[j][0]], [Math.sin(a) * P[j + 1][0], P[j + 1][1], Math.cos(a) * P[j + 1][0]], 0.016, C.gold, 4);
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
  for (let i = 0; i < 6; i++) { const a = i * 1.05; k.add(new THREE.OctahedronGeometry(0.016, 0), Math.cos(a) * 0.26, 0.4 + (i % 3) * 0.12, Math.sin(a) * 0.26, 0xe0c0ff, { glow: true }); }
}
function well(k) {
  patch(k, 0.5, 0x7a6a50, 0, 0.012);
  // flagstones
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; k.box(0.12, 0.012, 0.09, Math.sin(a) * 0.38, 0.012, Math.cos(a) * 0.38, mottle(0x8a8478, 0xb0a898), { ry: a, bev: 0.004 }); }
  // the round stone wall: banded blocks
  const blocks = (c, x, y, z) => { const row = Math.floor(y / 0.06), ang = Math.atan2(z, x) + row * 0.35; const t = (Math.floor(ang * 9 / Math.PI) % 2 === 0) ? 0.2 : 0.65; c.set(0x6a665e).lerp(_c2.set(0xb8b2a4), t + Math.min(0.25, y)); };
  k.lathe([[0.2, 0.012], [0.28, 0.012], [0.28, 0.24], [0.3, 0.25], [0.3, 0.28], [0.21, 0.28], [0.21, 0.27], [0.2, 0.27], [0.2, 0.012]].reverse(), 12, 0, 0, 0, blocks, { jit: 0.06 });
  k.lathe([[0.2, 0.012], [0.28, 0.012], [0.28, 0.24], [0.3, 0.25], [0.3, 0.28], [0.21, 0.28]], 12, 0, 0, 0, blocks, { jit: 0.06 });
  // glowing water
  k.cyl(0.205, 0.205, 0.01, 0, 0.2, 0, 0x30b8e8, 12, { glow: true });
  k.cyl(0.1, 0.1, 0.004, 0, 0.21, 0, 0xa0f0ff, 8, { glow: true });
  // wooden posts, crank and a little shingled roof
  for (const s of [-1, 1]) k.box(0.04, 0.5, 0.05, s * 0.25, 0.25, 0, [C.woodD, C.wood], { bev: 0.006 });
  k.cyl(0.03, 0.03, 0.56, 0, 0.6, 0, C.wood, 7, { rz: Math.PI / 2, ctr: true });
  k.beam([0.28, 0.6, 0], [0.32, 0.6, 0], 0.012, C.iron, 4);
  k.beam([0.32, 0.6, 0], [0.32, 0.53, 0.04], 0.01, C.iron, 4);
  k.beam([0, 0.6, 0], [0, 0.42, 0], 0.004, 0xc8b080, 3);
  k.lathe([[0.001, 0.34], [0.04, 0.34], [0.05, 0.42], [0.001, 0.42]], 7, 0, 0, 0, [C.woodD, C.wood]);
  k.box(0.6, 0.03, 0.06, 0, 0.73, 0, C.woodD);
  k.gable(0.5, 0.18, 0.36, 0, 0.73, 0, C.woodD);
  shingles(k, 0.66, 0.2, 0.44, 0, 0.72, 0, [0x1a3080, 0x3a5ac8], [0x22388a, 0x4a6ad8], 3);
  k.ball(0.03, 0, 0.94, 0, GL.cyan, { glow: true, det: 0 });
  // magic motes rising
  for (let i = 0; i < 7; i++) { const a = i * 0.9; k.add(new THREE.OctahedronGeometry(0.016, 0), Math.cos(a) * 0.12, 0.3 + i * 0.05, Math.sin(a) * 0.12, 0xa0f0ff, { glow: true }); }
  // bucket by the side
  k.lathe([[0.001, 0.012], [0.045, 0.012], [0.055, 0.09], [0.001, 0.09]], 7, 0.32, 0, 0.25, [C.woodD, C.wood]);
  k.cyl(0.05, 0.05, 0.004, 0.32, 0.086, 0.25, GL.cyan, 7, { glow: true });
}
function windmill(k) {
  patch(k, 0.5, 0x6a8a40, 0, 0.012);
  // whitewashed stone tower
  const wall = (c, x, y, z) => { const t = Math.min(1, y / 0.8); c.set(0xb8ac98).lerp(_c2.set(0xf4ece0), t); if (y < 0.1) c.set(0x7a7468); };
  k.lathe([[0.001, 0.012], [0.27, 0.012], [0.27, 0.1], [0.23, 0.12], [0.18, 0.8], [0.2, 0.82], [0.001, 0.82]], 9, 0, 0, -0.05, wall, { jit: 0.05 });
  // conical thatched cap
  k.lathe([[0.001, 0.8], [0.24, 0.8], [0.22, 0.86], [0.15, 0.98], [0.06, 1.08], [0.001, 1.12]], 9, 0, 0, -0.05, [0x8a6a30, 0xd8b060], { jit: 0.12 });
  k.ball(0.025, 0, 1.13, -0.05, C.goldD, { det: 0 });
  // door, windows
  k.box(0.1, 0.18, 0.03, 0, 0.012, 0.2, [0x4a2a14, 0x6a4020], { bev: 0.006 });
  k.box(0.13, 0.03, 0.04, 0, 0.19, 0.2, C.woodD);
  k.box(0.05, 0.07, 0.01, 0.08, 0.42, 0.15, GL.warm, { glow: true, ry: 0.4 });
  k.box(0.05, 0.07, 0.01, -0.1, 0.6, 0.12, GL.warm, { glow: true, ry: -0.5 });
  // hub and four lattice sails facing +z
  const hz = 0.2, hy = 0.78;
  k.cyl(0.035, 0.045, 0.14, 0, hy, hz - 0.05, C.woodD, 8, { rx: Math.PI / 2, ctr: true });
  k.ball(0.045, 0, hy, hz + 0.03, C.iron, { det: 0 });
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + 0.35, dx = Math.sin(a), dy = Math.cos(a), px = Math.cos(a), py = -Math.sin(a);
    const L = 0.6;
    k.plank([0, hy, hz + 0.02], [dx * L, hy + dy * L, hz + 0.02], 0.025, 0.02, C.woodD);
    // cloth panel on one side of the spar
    const p0 = [dx * 0.12, hy + dy * 0.12, hz + 0.01], p1 = [dx * L, hy + dy * L, hz + 0.01];
    const w = 0.13, q0 = [p0[0] + px * w, p0[1] + py * w, hz + 0.0], q1 = [p1[0] + px * w, p1[1] + py * w, hz + 0.0];
    k.poly([p0, p1, q1, q0], (c, x, y, z) => c.set(0xf0e4c8), { ds: true, ao: false, jit: 0.04 });
    // lattice slats
    for (let j = 0; j < 4; j++) { const t = 0.2 + j * 0.14; k.plank([dx * t, hy + dy * t, hz + 0.018], [dx * t + px * w, hy + dy * t + py * w, hz + 0.018], 0.01, 0.008, C.wood); }
    k.plank(q0, q1, 0.01, 0.01, C.wood);
  }
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
  patch(k, 0.6, 0x7a6a44, 0, 0.012);
  const plank = (c, x, y, z) => { const t = (Math.sin(x * 70) + 1) / 2; c.set(0x7a4a26).lerp(_c2.set(0xb0743e), 0.3 + t * 0.5); };
  // the barn: back wall, side walls and a long gable roof; open stalls at the front
  k.box(0.8, 0.3, 0.05, 0, 0.012, -0.25, plank);
  for (const s of [-1, 1]) k.box(0.05, 0.3, 0.32, s * 0.4, 0.012, -0.1, plank);
  k.gable(0.8, 0.16, 0.36, 0, 0.312, -0.1, plank, { ry: 0 });
  k.box(0.78, 0.012, 0.3, 0, 0.012, -0.1, 0x9a8048, { ao: false });
  for (let i = 0; i < 5; i++) { const x = -0.4 + i * 0.2; k.box(0.035, 0.32, 0.035, x, 0.012, 0.06, [C.woodD, C.wood]); if (i > 0 && i < 4) k.box(0.02, 0.18, 0.28, x, 0.012, -0.09, C.wood); }
  // stall half-doors
  for (const x of [-0.3, 0.1]) k.box(0.15, 0.12, 0.02, x, 0.012, 0.06, plank);
  shingles(k, 0.92, 0.2, 0.5, 0, 0.3, -0.1, [0x6a3a1a, 0xa86a30], [0x7a4420, 0xb87838]);
  // a horse head peeking from the left stall
  k.beam([-0.3, 0.2, -0.04], [-0.3, 0.17, 0.07], 0.028, 0x4a2a14, 6, { taper: 0.7 });
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
  patch(k, 0.58, 0x5a5a38, 0, 0.012);
  // a rocky den with a hide-covered hut on top
  const cols = (c, x, y, z, nx, ny) => { c.set(0x5a5040).lerp(_c2.set(0xb8a882), Math.min(1, y / 0.55)); if (ny > 0.7 && y > 0.25) c.lerp(_c2.set(0x5a8a3a), 0.6); };
  k.rock(0.42, 0, 0, -0.12, cols, { det: 1, amp: 0.16, s: [1.25, 0.95, 0.9] });
  k.rock(0.2, -0.38, 0, 0.05, cols, { amp: 0.3 });
  k.rock(0.18, 0.4, 0, 0.02, cols, { amp: 0.3 });
  // the cave maw with glowing eyes
  k.lathe([[0.001, 0], [0.17, 0], [0.16, 0.14], [0.1, 0.22], [0.001, 0.24]], 8, 0, 0, 0.18, 0x050304, { s: [1, 1, 0.4], ao: false, jit: 0 });
  for (const s of [-1, 1]) k.ball(0.014, s * 0.035, 0.11, 0.24, 0xffc020, { glow: true, det: 0, s: [1.4, 0.8, 1] });
  for (const s of [-1, 1]) k.ball(0.012, -0.08 + s * 0.025, 0.07, 0.235, GL.red, { glow: true, det: 0, s: [1.4, 0.8, 1] });
  // fangs of stone around the mouth
  for (let i = 0; i < 5; i++) k.cone(0.02, 0.06, -0.1 + i * 0.05, 0.16, 0.24, 0xe0d8c0, 4, { rx: Math.PI });
  // hide tent on the rock
  k.cone(0.2, 0.32, 0.05, 0.38, -0.2, [0x8a5a34, 0xc89a64], 6, { jit: 0.12 });
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.3; k.beam([0.05 + Math.cos(a) * 0.05, 0.62, -0.2 + Math.sin(a) * 0.05], [0.05 + Math.cos(a) * 0.1, 0.78, -0.2 + Math.sin(a) * 0.1], 0.008, C.woodD, 4); }
  k.box(0.07, 0.12, 0.01, 0.05, 0.4, -0.02, 0x1a0e08, { rx: -0.5 });
  // totem with horned skull, bones around
  k.beam([-0.32, 0.012, 0.32], [-0.32, 0.62, 0.32], 0.025, [C.woodD, C.wood], 6);
  k.ball(0.06, -0.32, 0.62, 0.34, 0xe8e0c8, { det: 1, s: [1, 0.9, 1.1] });
  for (const s of [-1, 1]) k.beam([-0.32 + s * 0.05, 0.65, 0.34], [-0.32 + s * 0.14, 0.75, 0.3], 0.015, 0xd8ccb0, 5, { taper: 0.2 });
  for (const s of [-1, 1]) k.ball(0.012, -0.32 + s * 0.022, 0.63, 0.395, GL.red, { glow: true, det: 0 });
  k.poly([[-0.3, 0.55, 0.33], [-0.18, 0.55, 0.36], [-0.2, 0.4, 0.37], [-0.3, 0.42, 0.33]], 0x8a2a2a, { ds: true, ao: false });
  for (let i = 0; i < 4; i++) k.beam([k.rr(0.05, 0.3), 0.02, k.rr(0.3, 0.45)], [k.rr(0.05, 0.3), 0.02, k.rr(0.3, 0.45)], 0.01, 0xe8e0c8, 4);
  // a small fire by the entrance
  k.cone(0.04, 0.12, 0.22, 0.012, 0.36, GL.fire, 5, { glow: true });
  k.cone(0.022, 0.08, 0.22, 0.012, 0.36, GL.fireY, 5, { glow: true });
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; k.rock(0.025, 0.22 + Math.cos(a) * 0.06, 0.012, 0.36 + Math.sin(a) * 0.06, 0x5a5650); }
}

const BUILDERS = { gold: goldPile, wood: woodPile, ore: orePile, gems: gemPile, chest, artifact, campfire, goldmine, orepit, gemmine, sawmill, arena, tower, library, stone, obelisk, shrine, well, windmill, stables, dwelling };
const AOH = { gold: 0.12, wood: 0.12, ore: 0.12, gems: 0.12, chest: 0.12, campfire: 0.12 };
export const OBJECT_IDS = Object.keys(BUILDERS);

export function objectModel(id) {
  const k = makeKit([...id].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) >>> 0);
  const f = BUILDERS[id];
  if (!f) { k.box(0.3, 0.3, 0.3, 0, 0, 0, 0xff00ff); return done(k); }
  f(k);
  return done(k, AOH[id] ?? 0.25);
}
