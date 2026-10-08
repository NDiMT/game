import * as THREE from 'three';

// =====================================================================
// HEX REALMS: Haven town-interior buildings (HoMM3 "Castle" style).
//   havenTownBuilding(id) -> { body, glow }
// ids: village, hall2, hall3, fort, market, tavern, mage1..mage3, d1..d7, u1..u7.
// Town-view units (1 unit is about a small house). Base at y = 0, front faces +Z.
// body: position, normal, color, uv (world-scaled). glow: emissive bits.
// =====================================================================

const TAU = Math.PI * 2;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function rand(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ palette (bright, sunny)
const C = {
  stone: 0xf4efe2, stone2: 0xe9e1cf, trim: 0xd9cfb8, cool: 0xc9cfe4, roof: 0x3b74ec, roof2: 0x2f62d6, roofL: 0x5b8ff8,
  gold: 0xffc63a, goldD: 0xe0a428, win: 0xffcf6a, banner: 0x2f63e6, red: 0xe0412f, white: 0xffffff,
  wood: 0xb07a44, woodD: 0x8a5a34, plaster: 0xfcf4e2, path: 0xe2cfa2, pave: 0xd8ccb4, grass: 0x86c650,
  straw: 0xeac862, strawD: 0xc89a40, steel: 0xdfe6f0, holy: 0xfff1b8, magic: 0x9fdcff, leaf: 0x5fae3c, water: 0x7fd4ff,
};

// ------------------------------------------------------------------ modelling kit
// Every add() is transformed by the current frame (k.at pushes a local frame).
function makeKit(seed) {
  const r = rand(seed);
  const B = [], G = [];
  const stack = [new THREE.Matrix4()];
  const tf = (g, o = {}) => {
    if (o.s !== undefined) { const s = o.s; Array.isArray(s) ? g.scale(s[0], s[1], s[2]) : g.scale(s, s, s); }
    if (o.rx) g.rotateX(o.rx);
    if (o.rz) g.rotateZ(o.rz);
    if (o.ry) g.rotateY(o.ry);
    return g;
  };
  const add = (g, c, o = {}) => {
    let ng = g.index ? g.toNonIndexed() : g;
    ng.applyMatrix4(stack[stack.length - 1]);
    (o.glow ? G : B).push({ g: ng, c, o });
    return ng;
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const k = {
    r, add, B, G,
    at(x, y, z, ry, s, fn) {
      const m = new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), ry || 0), V(s || 1, s || 1, s || 1));
      stack.push(stack[stack.length - 1].clone().multiply(m)); fn(); stack.pop();
    },
    box(w, h, d, x, y, z, c, o = {}) { return add(tf(new THREE.BoxGeometry(w, h, d), o).translate(x, y + h / 2, z), c, o); },
    cyl(rt, rb, h, x, y, z, c, seg = 8, o = {}) { return add(tf(new THREE.CylinderGeometry(rt, rb, h, seg, 1, !!o.open), o).translate(x, y + h / 2, z), c, o); },
    cone(rad, h, x, y, z, c, seg = 8, o = {}) { return add(tf(new THREE.ConeGeometry(rad, h, seg).translate(0, h / 2, 0), o).translate(x, y, z), c, o); },
    ball(rad, x, y, z, c, det = 1, o = {}) { return add(tf(new THREE.IcosahedronGeometry(rad, det), o).translate(x, y, z), c, o); },
    lathe(pts, x, y, z, c, seg = 8, o = {}) {
      const g = new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(Math.max(a, 0.0001), b)), seg, o.phi || 0);
      return add(tf(g, o).translate(x, y, z), c, o);
    },
    limb(a, b, r1, r2, c, seg = 6, o = {}) {
      const va = V(...a), vb = V(...b), len = va.distanceTo(vb);
      const g = new THREE.CylinderGeometry(r2, r1, len, seg, 1, false);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), vb.clone().sub(va).normalize()));
      g.translate((va.x + vb.x) / 2, (va.y + vb.y) / 2, (va.z + vb.z) / 2);
      return add(g, c, o);
    },
    tor(rad, tube, x, y, z, c, arc = TAU, o = {}) { return add(tf(new THREE.TorusGeometry(rad, tube, o.ts || 4, o.rs || 12, arc), o).translate(x, y, z), c, o); },
    // flat disc facing +Z (in the current frame)
    disc(rad, th, x, y, z, c, seg = 10, o = {}) { return add(tf(new THREE.CylinderGeometry(rad, rad, th, seg).rotateX(Math.PI / 2), o).translate(x, y, z), c, o); },
    // gable roof, ridge along local x; slopes in roof colour, gable ends in wall colour
    gable(w, h, d, x, y, z, roofC, wallC, ry = 0, ov = 0.06) {
      const W = w / 2, D = d / 2 + ov, Wo = W + ov;
      const sl = [-Wo, 0, D, Wo, 0, D, Wo, h, 0, -Wo, 0, D, Wo, h, 0, -Wo, h, 0,
        Wo, 0, -D, -Wo, 0, -D, -Wo, h, 0, Wo, 0, -D, -Wo, h, 0, Wo, h, 0,
        // undersides so the overhang never shows a hole
        Wo, 0, D, -Wo, 0, D, Wo, h, 0, -Wo, 0, D, -Wo, h, 0, Wo, h, 0,
        -Wo, 0, -D, Wo, 0, -D, -Wo, h, 0, Wo, 0, -D, Wo, h, 0, -Wo, h, 0];
      const ge = [W, 0, d / 2, W, 0, -d / 2, W, h * (d / 2) / D, 0, -W, 0, -d / 2, -W, 0, d / 2, -W, h * (d / 2) / D, 0];
      const g1 = new THREE.BufferGeometry(); g1.setAttribute('position', new THREE.Float32BufferAttribute(sl, 3));
      const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(ge, 3));
      add(g1.rotateY(ry).translate(x, y, z), roofC, { top: 1.18, bot: 0.86, ao: false });
      add(g2.rotateY(ry).translate(x, y, z), wallC, { top: 1.04, bot: 0.95 });
      // ridge cap
      k.box(w + ov * 2.2, h * 0.07, h * 0.09, x, y + h * 0.97, z, C.goldD, { ry, ao: false });
    },
    // hipped / pyramid roof
    hip(w, h, d, x, y, z, c, o = {}) {
      const g = new THREE.ConeGeometry(1, h, 4, 1).rotateY(Math.PI / 4).translate(0, h / 2, 0).scale(w / 2 / Math.SQRT1_2, 1, d / 2 / Math.SQRT1_2);
      return add(tf(g, o).translate(x, y, z), c, { top: 1.25, bot: 0.85, ao: false, ...o });
    },
    // grid sheet f(u, v) -> [x, y, z]; double-sided
    sheet(nu, nv, f, c, o = {}) {
      const P = [], S = [];
      const sh = (i, j) => (o.shade ? o.shade(i / nu, j / nv) : 1);
      const A = [V(), V(), V()], e1 = V(), e2 = V();
      for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
        const q = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
        for (const t of [[0, 1, 2], [0, 2, 3]]) {
          for (let m = 0; m < 3; m++) A[m].set(...f(q[t[m]][0] / nu, q[t[m]][1] / nv));
          for (let m = 0; m < 3; m++) { P.push(A[m].x, A[m].y, A[m].z); S.push(sh(...q[t[m]])); }
          if (o.double !== false) {
            const nn = e1.subVectors(A[1], A[0]).cross(e2.subVectors(A[2], A[0])).normalize().multiplyScalar(-(o.thick ?? 0.012));
            for (const m of [0, 2, 1]) { P.push(A[m].x + nn.x, A[m].y + nn.y, A[m].z + nn.z); S.push(sh(...q[t[m]]) * 0.88); }
          }
        }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      return add(g, c, { ...o, cols: S });
    },
    // merlons around a w x d rectangle top at height y
    crenels(w, d, y, x, z, c, o = {}) {
      const m = o.m || 0.13, hgt = o.h || 0.16, step = o.step || 0.27, th = o.th || 0.12;
      const sides = o.sides || 'nsew';
      const run = (len, f) => { const n = Math.max(2, Math.round(len / step)); for (let i = 0; i < n; i++) f(((i + 0.5) / n - 0.5) * len); };
      if (sides.includes('s')) run(w, (t) => k.box(m, hgt, th, x + t, y, z + d / 2 - th / 2, c, { top: 1.12 }));
      if (sides.includes('n')) run(w, (t) => k.box(m, hgt, th, x + t, y, z - d / 2 + th / 2, c, { top: 1.12 }));
      if (sides.includes('e')) run(d, (t) => k.box(th, hgt, m, x + w / 2 - th / 2, y, z + t, c, { top: 1.12 }));
      if (sides.includes('w')) run(d, (t) => k.box(th, hgt, m, x - w / 2 + th / 2, y, z + t, c, { top: 1.12 }));
    },
    crenelRing(rad, y, x, z, c, n = 8, o = {}) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        k.box(o.m || 0.12, o.h || 0.15, 0.1, x + Math.sin(a) * rad, y, z + Math.cos(a) * rad, c, { ry: a, top: 1.12 });
      }
    },
    // arched glowing window facing +Z of frame ry; (x, z) on the wall face, y = sill
    win(x, y, z, w, h, ry = 0, o = {}) {
      k.at(x, 0, z, ry, 1, () => {
        const fr = o.frame ?? C.trim;
        if (fr !== false) {
          k.box(w + 0.07, h + 0.04, 0.03, 0, y - 0.035, 0.008, fr, { ao: false });
          if (!o.square) k.disc(w / 2 + 0.035, 0.03, 0, y + h, 0.008, fr, 8, { ao: false });
          k.box(w + 0.12, 0.035, 0.07, 0, y - 0.05, 0.03, fr, { ao: false });
        }
        k.box(w, h, 0.03, 0, y, 0.022, o.c || C.win, { glow: true });
        if (!o.square) k.disc(w / 2, 0.03, 0, y + h, 0.022, o.c || C.win, 8, { glow: true });
        if (w > 0.13 && o.mull !== false) {
          k.box(0.018, h + w * 0.45, 0.012, 0, y, 0.042, C.goldD, { ao: false });
          k.box(w, 0.018, 0.012, 0, y + h * 0.55, 0.042, C.goldD, { ao: false });
        }
      });
    },
    // window on a round tower of radius rad centred (cx, cz), facing angle a (0 = +Z)
    winCyl(cx, cz, rad, a, y, w, h, o = {}) { k.win(cx + Math.sin(a) * rad, y, cz + Math.cos(a) * rad, w, h, a, o); },
    // hanging banner with swallow tail and gold rod/emblem; (x, ytop, z) on a wall facing +Z of frame ry
    banner(x, ytop, z, w, h, ry = 0, c = C.banner, o = {}) {
      k.at(x, 0, z, ry, 1, () => {
        k.sheet(2, 5, (u, v) => {
          const yy = ytop - v * h + (v === 1 ? (1 - Math.abs(u - 0.5) * 2) * h * 0.22 : 0);
          return [(u - 0.5) * w, yy, 0.03 + Math.sin(v * 3.5 + x) * 0.025 * v];
        }, c, { top: 1.12, bot: 0.86, ao: false, j: 0.02 });
        k.limb([-w * 0.62, ytop + 0.01, 0.035], [w * 0.62, ytop + 0.01, 0.035], 0.018, 0.018, C.gold, 5, { ao: false });
        if (o.emblem !== false) {
          k.box(w * 0.32, w * 0.32, 0.02, 0, ytop - h * 0.42, 0.05 + Math.sin(1.4 + x) * 0.012, C.gold, { rz: Math.PI / 4, ao: false });
          k.box(w * 0.08, w * 0.4, 0.024, 0, ytop - h * 0.42 - w * 0.2, 0.055, C.white, { ao: false });
        }
        k.box(w * 0.98, 0.03, 0.02, 0, ytop - h * 0.12, 0.05, C.gold, { ao: false });
      });
    },
    // pole with a waving pennant (wave toward +x by default)
    flag(x, y, z, hp, len, hgt, c = C.banner, o = {}) {
      k.limb([x, y, z], [x, y + hp, z], 0.025, 0.02, o.pole ?? C.goldD, 5);
      k.ball(0.04, x, y + hp + 0.02, z, C.gold, 0);
      const dir = o.dir ?? 1, ph = o.phase ?? 0;
      k.sheet(6, 3, (u, v) => {
        const taper = 1 - u * 0.5;
        let along = u * len - Math.max(0, 1 - Math.abs(v - 0.5) * 4) * 0.3 * len * smooth(0.55, 1, u);
        return [x + dir * along, y + hp - 0.05 - hgt / 2 + (v - 0.5) * hgt * taper - u * u * hgt * 0.2, z + Math.sin(u * 9 + ph) * 0.05 * u];
      }, c, { shade: (u) => 0.92 + 0.18 * Math.cos(u * 9 + ph), ao: false, j: 0.02 });
    },
    // round tower: lathe shaft, corbelled crown, conical roof, finial, windows
    tower(x, z, o) {
      const { r: rr, h } = o, y = o.y || 0, seg = o.seg || 10, c = o.c || C.stone;
      k.lathe([[rr * 1.14, 0], [rr * 1.1, Math.min(0.25, h * 0.12)], [rr, Math.min(0.32, h * 0.16)], [rr, h]], x, y, z, c, seg, { top: 1.06, bot: 0.86 });
      k.tor(rr * 1.01, 0.03, x, y + h * 0.55, z, C.trim, TAU, { rx: Math.PI / 2, rs: seg });
      let top = y + h;
      if (o.crown !== false) {
        k.lathe([[rr, 0], [rr * 1.2, 0.14], [rr * 1.2, 0.22], [rr * 1.12, 0.22]], x, top, z, C.stone2, seg, { top: 1.1, bot: 0.8, ao: false });
        top += 0.22;
      }
      if (o.cren) { k.crenelRing(rr * 1.12, top, x, z, c, o.cren); top += 0.15; }
      if (o.roofH) {
        const rad = rr * (o.roofR || 1.32);
        k.lathe([[rad, 0], [rad * 0.74, o.roofH * 0.3], [rad * 0.4, o.roofH * 0.65], [0, o.roofH]], x, o.cren ? top - 0.15 : top, z, o.roofC || C.roof, seg, { top: 1.3, bot: 0.82, ao: false });
        top = (o.cren ? top - 0.15 : top) + o.roofH;
        if (o.finial !== false) {
          k.ball(0.06, x, top, z, C.gold, 1, { ao: false });
          k.cone(0.025, 0.2, x, top + 0.04, z, C.gold, 4, { ao: false });
        }
      }
      if (o.flag) k.flag(x, top + 0.05, z, o.flagH ?? 0.5, 0.55 * (o.flagH ?? 0.5) / 0.5, 0.22 * Math.min(1, (o.flagH ?? 0.5) / 0.4), o.flag === true ? C.banner : o.flag, { dir: o.flagDir ?? 1, phase: x });
      for (const [a, f, ww, wh] of (o.wins || [[0, 0.62, 0.11, 0.22]])) k.winCyl(x, z, rr * 0.99, a, y + h * f, ww, wh, { mull: false });
      return top;
    },
    // a stone block with base course, cornice, optional crenels
    block(w, h, d, x, y, z, c = C.stone, o = {}) {
      k.box(w, h, d, x, y, z, c, { top: 1.06, bot: 0.86, ...o });
      k.box(w + 0.06, 0.12, d + 0.06, x, y, z, C.stone2, { top: 1.0, bot: 0.86 });
      if (o.cornice !== false) k.box(w + 0.08, 0.07, d + 0.08, x, y + h - 0.05, z, C.trim, { ao: false });
      if (o.cren) k.crenels(w + 0.06, d + 0.06, y + h, x, z, c, o.cren === true ? {} : o.cren);
    },
    // a paved pad under a building
    pad(w, d, c = C.pave, o = {}) {
      k.box(w, 0.04, d, o.x || 0, 0, o.z || 0, c, { top: 1.0, bot: 0.9, j: 0.04, ao: false });
      k.box(w - 0.12, 0.012, d - 0.12, o.x || 0, 0.04, o.z || 0, C.path, { j: 0.08, ao: false });
    },
    door(x, y, z, w, h, ry = 0, o = {}) {
      k.at(x, 0, z, ry, 1, () => {
        k.box(w + 0.1, h + 0.05, 0.04, 0, y, 0.01, C.trim, { ao: false });
        k.disc(w / 2 + 0.05, 0.04, 0, y + h, 0.01, C.trim, 8, { ao: false });
        k.box(w, h, 0.04, 0, y, 0.03, o.c || C.woodD, { top: 1.1, bot: 0.9, ao: false });
        k.disc(w / 2, 0.04, 0, y + h, 0.03, o.c || C.woodD, 8, { ao: false });
        k.box(w * 1.02, 0.03, 0.02, 0, y + h * 0.3, 0.055, C.gold, { ao: false });
        k.box(w * 1.02, 0.03, 0.02, 0, y + h * 0.75, 0.055, C.gold, { ao: false });
        k.box(0.015, h + w * 0.4, 0.015, 0, y, 0.05, C.wood, { ao: false });
      });
    },
    // simple standing figure statue (angel-ish when wings)
    statue(x, y, z, s, c = C.white, o = {}) {
      k.at(x, y, z, o.ry || 0, s, () => {
        k.lathe([[0.16, 0], [0.13, 0.35], [0.08, 0.62], [0.1, 0.7], [0.0, 0.72]], 0, 0, 0, c, 7, { ao: false });
        k.ball(0.075, 0, 0.8, 0, c, 1, { ao: false });
        if (o.halo) k.tor(0.08, 0.012, 0, 0.92, -0.02, C.gold, TAU, { rx: Math.PI / 2 - 0.3, ao: false });
        if (o.wings) for (const s2 of [-1, 1]) k.sheet(4, 2, (u, v) => [s2 * (0.04 + u * 0.42), 0.62 + u * 0.32 - v * (0.55 - u * 0.25) + Math.sin(u * 3) * 0.05, -0.07 - u * 0.12], o.wingC || c, { ao: false, top: 1.1, bot: 0.9 });
        if (o.sword) { k.box(0.03, 0.5, 0.012, 0.14, 0.45, 0.1, C.steel, { ao: false }); k.box(0.14, 0.025, 0.03, 0.14, 0.45, 0.1, C.gold, { ao: false }); }
      });
    },
    barrel(x, y, z, s = 1, c = C.wood) {
      k.lathe([[0.1 * s, 0], [0.125 * s, 0.13 * s], [0.1 * s, 0.26 * s]], x, y, z, c, 8);
      k.tor(0.118 * s, 0.01 * s, x, y + 0.07 * s, z, C.goldD, TAU, { rx: Math.PI / 2, rs: 8, ts: 3 });
      k.tor(0.118 * s, 0.01 * s, x, y + 0.19 * s, z, C.goldD, TAU, { rx: Math.PI / 2, rs: 8, ts: 3 });
    },
    crate(x, y, z, s = 1, ry = 0) { k.box(0.22 * s, 0.2 * s, 0.22 * s, x, y, z, C.wood, { ry, j: 0.1 }); k.box(0.23 * s, 0.03, 0.23 * s, x, y + 0.17 * s, z, C.woodD, { ry }); },
    bush(x, z, s = 1) { k.ball(0.2 * s, x, 0.13 * s, z, C.leaf, 1, { s: [1, 0.8, 1], top: 1.35, bot: 0.85 }); },
    tree(x, z, s = 1) {
      k.cyl(0.04 * s, 0.06 * s, 0.4 * s, x, 0, z, C.woodD, 6);
      k.ball(0.28 * s, x, 0.55 * s, z, C.leaf, 1, { top: 1.35, bot: 0.8 });
      k.ball(0.2 * s, x + 0.12 * s, 0.75 * s, z - 0.05 * s, 0x72c048, 1, { top: 1.3, bot: 0.85 });
    },
  };
  return k;
}

// ------------------------------------------------------------------ bake: vertex colours with soft coloured AO
const tmpC = new THREE.Color();
function bake(parts, r, glow, uv) {
  let n = 0;
  for (const p of parts) n += p.g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), uvs = uv ? new Float32Array(n * 2) : null;
  let o = 0;
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), fn = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (const p of parts) {
    const P = p.g.attributes.position.array, cnt = P.length / 3;
    let ymin = Infinity, ymax = -Infinity;
    for (let i = 1; i < P.length; i += 3) { ymin = Math.min(ymin, P[i]); ymax = Math.max(ymax, P[i]); }
    const span = Math.max(1e-4, ymax - ymin);
    const top = p.o.top ?? 1.04, bot = p.o.bot ?? 0.94, jit = p.o.j ?? (glow ? 0.0 : 0.035);
    const base = typeof p.c === 'number' ? new THREE.Color(p.c) : p.c;
    for (let t = 0; t < cnt; t += 3) {
      a.fromArray(P, t * 3); b.fromArray(P, t * 3 + 3); c.fromArray(P, t * 3 + 6);
      fn.crossVectors(e1.subVectors(c, b), e2.subVectors(a, b)).normalize();
      const jf = 1 + (r() - 0.5) * 2 * jit;
      for (let v = 0; v < 3; v++) {
        const vi = t + v, x = P[vi * 3], y = P[vi * 3 + 1], z = P[vi * 3 + 2];
        pos.set([x, y, z], o * 3); nor.set([fn.x, fn.y, fn.z], o * 3);
        let m = jf * (bot + (top - bot) * ((y - ymin) / span));
        if (p.o.cols) m *= p.o.cols[vi];
        tmpC.copy(base).multiplyScalar(m);
        if (!glow && p.o.ao !== false) {
          // soft, cool-violet contact shade near the ground, never black
          const s = smooth(0.0, 0.45, y);
          tmpC.r *= 0.8 + 0.2 * s; tmpC.g *= 0.84 + 0.16 * s; tmpC.b *= 0.95 + 0.05 * s;
        }
        col.set([Math.min(1, tmpC.r), Math.min(1, tmpC.g), Math.min(1, tmpC.b)], o * 3);
        if (uvs) {
          const ax = Math.abs(fn.x), ay = Math.abs(fn.y), az = Math.abs(fn.z);
          if (ay >= ax && ay >= az) uvs.set([x, z], o * 2); else if (ax >= az) uvs.set([z, y], o * 2); else uvs.set([x, y], o * 2);
        }
        o++;
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (uvs) g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.computeBoundingSphere(); g.computeBoundingBox();
  return g;
}
const finish = (k) => ({ body: bake(k.B, k.r, false, true), glow: k.G.length ? bake(k.G, k.r, true, false) : null });

// ================================================================== civic buildings
function village() {
  const k = makeKit(101);
  k.pad(2.2, 2.2);
  // central round keep
  k.tower(0, -0.35, { r: 0.42, h: 1.45, roofH: 0.85, flag: true, wins: [[0, 0.6, 0.13, 0.24], [0.9, 0.35, 0.1, 0.18], [-0.9, 0.35, 0.1, 0.18]] });
  // plaster hall with blue gable roof (left)
  k.box(1.0, 0.7, 0.75, -0.55, 0.04, 0.35, C.plaster, { top: 1.05, bot: 0.88 });
  k.box(1.02, 0.12, 0.77, -0.55, 0.04, 0.35, C.stone2);
  for (const x of [-0.95, -0.55, -0.15]) k.box(0.05, 0.7, 0.04, x, 0.04, 0.73, C.woodD);
  k.box(1.02, 0.05, 0.04, -0.55, 0.42, 0.73, C.woodD);
  k.gable(1.0, 0.5, 0.75, -0.55, 0.74, 0.35, C.roof, C.plaster);
  k.win(-0.75, 0.48, 0.73, 0.12, 0.16, 0, { frame: false, square: true });
  k.door(-0.35, 0.04, 0.73, 0.18, 0.28);
  k.box(0.14, 0.4, 0.14, -0.85, 1.0, 0.25, C.stone2); // chimney
  // cottage (right)
  k.box(0.65, 0.55, 0.6, 0.62, 0.04, 0.45, C.plaster, { top: 1.05, bot: 0.88 });
  k.gable(0.6, 0.38, 0.65, 0.62, 0.59, 0.45, C.red, C.plaster, Math.PI / 2);
  k.win(0.62, 0.3, 0.75, 0.12, 0.14, 0, { frame: false });
  k.win(0.94, 0.3, 0.45, 0.1, 0.14, Math.PI / 2, { frame: false });
  // low wall at the back and a well, trees
  k.box(2.0, 0.35, 0.14, 0, 0.04, -0.98, C.stone2, { top: 1.1 });
  k.crenels(2.0, 0.14, 0.39, 0, -0.98, C.stone2, { sides: 's', m: 0.1, h: 0.1, th: 0.14 });
  k.cyl(0.14, 0.15, 0.2, 0.25, 0.04, 0.8, C.stone2, 8);
  k.cyl(0.11, 0.11, 0.01, 0.25, 0.235, 0.8, C.water, 8, { glow: true });
  k.limb([0.12, 0.24, 0.8], [0.12, 0.5, 0.8], 0.015, 0.015, C.wood, 4); k.limb([0.38, 0.24, 0.8], [0.38, 0.5, 0.8], 0.015, 0.015, C.wood, 4);
  k.hip(0.36, 0.14, 0.2, 0.25, 0.5, 0.8, C.roof);
  k.tree(0.85, -0.7, 1); k.bush(-1.0, -0.6, 0.9); k.bush(0.95, 0.98, 0.7);
  k.banner(0, 1.25, -0.35 + 0.42, 0.22, 0.45);
  return finish(k);
}

function townHall(grand) {
  const k = makeKit(grand ? 103 : 102);
  k.pad(2.4, 2.4);
  // stairs
  for (let i = 0; i < 3; i++) k.box(1.3 - i * 0.1, 0.08, 0.2, 0, 0.04 + i * 0.08, 1.05 - i * 0.12, C.stone2, { ao: false });
  const bw = grand ? 2.05 : 1.8, bh = grand ? 1.15 : 1.0, bd = grand ? 1.3 : 1.15, bz = -0.2;
  k.block(bw, bh, bd, 0, 0.04, bz, C.stone);
  // pilasters & windows on the front
  const fz = bz + bd / 2;
  for (const x of [-0.75, -0.45, 0.45, 0.75].map((v) => v * bw / 1.8)) k.win(x, 0.45, fz, 0.16, 0.32);
  for (const x of [-0.9, -0.6, 0.6, 0.9].map((v) => v * bw / 1.8)) k.box(0.07, bh - 0.12, 0.05, x, 0.16, fz + 0.02, C.trim);
  for (const s of [-1, 1]) for (const z of [-0.25, 0.15]) k.win(s * bw / 2, 0.45, bz + z, 0.14, 0.28, s * Math.PI / 2);
  // roof
  if (!grand) k.gable(bw, 0.6, bd, 0, 0.04 + bh, bz, C.roof, C.stone);
  else k.hip(bw + 0.14, 0.55, bd + 0.14, 0, 0.04 + bh, bz, C.roof);
  // portico with columns + pediment
  const pw = grand ? 1.2 : 1.0, ph = grand ? 1.0 : 0.88, pz = fz + 0.28;
  k.box(pw + 0.1, 0.06, 0.6, 0, 0.28, fz + 0.25, C.stone2);
  const nc = grand ? 6 : 4;
  for (let i = 0; i < nc; i++) {
    const x = (i / (nc - 1) - 0.5) * pw;
    k.cyl(0.055, 0.065, ph - 0.1, x, 0.34, pz, C.stone, 8, { top: 1.08, bot: 0.9 });
    k.box(0.15, 0.06, 0.15, x, 0.34 + ph - 0.12, pz, C.gold, { ao: false });
  }
  k.box(pw + 0.24, 0.12, 0.62, 0, 0.3 + ph - 0.06, fz + 0.24, C.trim);
  k.gable(0.62, 0.32, pw + 0.24, 0, 0.3 + ph + 0.06, fz + 0.24, C.roof, C.stone, Math.PI / 2, 0.04);
  k.disc(0.09, 0.03, 0, 0.3 + ph + 0.17, fz + 0.56, C.gold, 10, { ao: false });
  k.door(0, 0.34, fz + 0.01, 0.26, 0.42);
  if (!grand) {
    // central bell tower behind the portico
    const tz = bz - 0.05;
    k.box(0.56, 1.0, 0.56, 0, 1.0, tz, C.stone, { top: 1.08, bot: 0.92 });
    k.box(0.64, 0.07, 0.64, 0, 1.98, tz, C.trim);
    k.disc(0.16, 0.04, 0, 1.68, tz + 0.29, C.white, 12, { ao: false }); // clock
    k.disc(0.12, 0.04, 0, 1.68, tz + 0.3, C.holy, 12, { glow: true });
    k.box(0.02, 0.1, 0.02, 0, 1.68, tz + 0.33, C.goldD, { ao: false }); k.box(0.07, 0.02, 0.02, 0.03, 1.68, tz + 0.33, C.goldD, { ao: false });
    for (const a of [0, Math.PI / 2, -Math.PI / 2]) k.winCyl(0, tz, 0.28, a, 2.1, 0.12, 0.2, { mull: false });
    k.lathe([[0.3, 0], [0.3, 0.38], [0.36, 0.42], [0.36, 0.48], [0.3, 0.48]], 0, 2.02, tz, C.stone2, 8, { ao: false, phi: Math.PI / 8 });
    k.lathe([[0.42, 0], [0.3, 0.25], [0.12, 0.62], [0, 0.82]], 0, 2.5, tz, C.roof, 8, { top: 1.3, bot: 0.82, ao: false, phi: Math.PI / 8 });
    k.ball(0.06, 0, 3.32, tz, C.gold, 1, { ao: false });
    k.cone(0.025, 0.18, 0, 3.36, tz, C.gold, 4);
    for (const s of [-1, 1]) k.banner(s * 0.62, 0.95, fz + 0.01, 0.2, 0.5);
    k.bush(-0.95, 1.0, 0.8); k.bush(0.95, 1.0, 0.8);
  } else {
    // side towers with blue spires
    for (const s of [-1, 1]) {
      k.tower(s * (bw / 2 - 0.2), bz + bd / 2 - 0.05, { r: 0.3, h: 1.85, roofH: 0.9, flagH: 0.4, flag: true, flagDir: s, wins: [[0, 0.75, 0.1, 0.2], [s * 1.2, 0.75, 0.1, 0.2], [0, 0.42, 0.1, 0.2]] });
      k.banner(s * 0.66, 1.0, fz + 0.01, 0.2, 0.55);
    }
    // central drum with golden dome and lantern
    const dz = bz - 0.05;
    k.cyl(0.5, 0.52, 0.55, 0, 1.15, dz, C.stone, 12, { top: 1.08, bot: 0.92 });
    for (let i = -2; i <= 2; i++) k.winCyl(0, dz, 0.5, i * 0.55, 1.28, 0.1, 0.2, { mull: false, frame: C.trim });
    k.tor(0.53, 0.04, 0, 1.7, dz, C.trim, TAU, { rx: Math.PI / 2, rs: 12 });
    const dome = []; for (let i = 0; i <= 6; i++) { const t = (i / 6) * Math.PI / 2; dome.push([0.52 * Math.cos(t), 0.6 * Math.sin(t)]); }
    k.lathe(dome, 0, 1.7, dz, C.gold, 12, { top: 1.25, bot: 0.85, ao: false });
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; k.box(0.025, 0.45, 0.03, Math.sin(a) * 0.38, 1.82, dz + Math.cos(a) * 0.38, C.goldD, { ry: a, rx: -0.6 * 0, ao: false }); }
    k.cyl(0.1, 0.12, 0.25, 0, 2.28, dz, C.stone, 8);
    for (const a of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) k.winCyl(0, dz, 0.1, a, 2.32, 0.05, 0.12, { frame: false });
    k.cone(0.15, 0.4, 0, 2.53, dz, C.roof, 8, { top: 1.3, ao: false });
    k.ball(0.06, 0, 2.95, dz, C.gold, 1, { ao: false });
    k.flag(0, 2.95, dz, 0.5, 0.6, 0.24, C.banner);
    // statues on the portico corners
    for (const s of [-1, 1]) k.statue(s * 0.68, 1.36, pz, 0.38, C.white, { wings: true, halo: true });
    k.tree(-1.0, 0.95, 0.8); k.tree(1.0, 0.95, 0.8);
  }
  return finish(k);
}

function fort() {
  const k = makeKit(104);
  const wh = 1.3, th = 0.55;
  // curtain wall segments with walkway crenels on the front
  const segs = [[-4.2, -2.3], [-2.0, -0.75], [0.75, 2.0], [2.3, 4.2]];
  for (const [a, b] of segs) {
    const w = b - a, x = (a + b) / 2;
    k.box(w, wh, th, x, 0, 0, C.stone, { top: 1.06, bot: 0.86 });
    k.box(w + 0.02, 0.15, th + 0.1, x, 0, 0, C.stone2);
    k.box(w + 0.02, 0.06, th + 0.08, x, wh - 0.06, 0, C.trim, { ao: false });
    k.crenels(w, th + 0.06, wh, x, 0, C.stone, { sides: 'sn', step: 0.3, m: 0.16 });
    // arrow slits glowing faintly + buttresses
    for (let i = 0; i < Math.round(w / 0.6); i++) {
      const xx = a + (i + 0.5) * w / Math.round(w / 0.6);
      k.box(0.05, 0.22, 0.02, xx, 0.75, th / 2 + 0.005, C.win, { glow: true });
      k.box(0.16, 0.5, 0.12, xx + w / Math.round(w / 0.6) / 2 - 0.02, 0, th / 2 + 0.05, C.stone2, { top: 1.0 });
    }
  }
  // towers: big corners, middle ones
  for (const s of [-1, 1]) {
    k.tower(s * 4.2, 0.05, { r: 0.42, h: 1.38, roofH: 0.62, flag: true, flagH: 0.3, flagDir: s, wins: [[0, 0.6, 0.1, 0.22], [s * 1.1, 0.6, 0.1, 0.2]] });
    k.tower(s * 2.15, 0.05, { r: 0.36, h: 1.36, roofH: 0.62, wins: [[0, 0.58, 0.1, 0.2]] });
    k.banner(s * 3.2, 1.1, th / 2 + 0.01, 0.26, 0.6);
  }
  // gatehouse
  k.block(1.5, 1.5, 0.85, 0, 0, 0.05, C.stone);
  k.crenels(1.56, 0.91, 1.5, 0, 0.05, C.stone, { step: 0.26, m: 0.15 });
  const gz = 0.05 + 0.425;
  k.box(0.7, 0.75, 0.04, 0, 0.0, gz, C.woodD, { ao: false });
  k.disc(0.35, 0.04, 0, 0.75, gz, C.woodD, 12, { ao: false });
  k.tor(0.4, 0.06, 0, 0.75, gz + 0.02, C.trim, Math.PI, { rs: 8, ts: 4 });
  for (const s of [-1, 1]) k.box(0.1, 0.78, 0.1, s * 0.4, 0, gz, C.trim);
  // portcullis bars in gold
  for (let i = -3; i <= 3; i++) k.box(0.025, 0.95 - Math.abs(i) * 0.04, 0.02, i * 0.09, 0.08, gz + 0.04, C.gold, { ao: false });
  for (const y of [0.3, 0.6]) k.box(0.66, 0.025, 0.02, 0, y, gz + 0.045, C.gold, { ao: false });
  k.disc(0.16, 0.03, 0, 1.3, gz + 0.01, C.gold, 10, { ao: false });
  k.disc(0.11, 0.03, 0, 1.3, gz + 0.03, C.banner, 10, { ao: false });
  for (const s of [-1, 1]) {
    k.tower(s * 0.8, 0.35, { r: 0.28, h: 1.5, roofH: 0.55, flag: true, flagH: 0.3, flagDir: s, wins: [[0, 0.62, 0.09, 0.18], [s * 1.2, 0.4, 0.08, 0.16]] });
    k.banner(s * 0.48, 1.38, gz, 0.2, 0.5);
  }
  return finish(k);
}

function market() {
  const k = makeKit(105);
  k.pad(2.0, 2.0);
  // arcaded trade hall at the back
  const hz = -0.45;
  k.box(1.7, 0.85, 0.8, 0, 0.04, hz, C.plaster, { top: 1.05, bot: 0.9 });
  k.box(1.72, 0.1, 0.82, 0, 0.04, hz, C.stone2);
  for (let i = 0; i < 4; i++) { const x = -0.6 + i * 0.4; k.door(x, 0.04, hz + 0.4, 0.22, 0.32, 0, { c: 0xe8a050 }); }
  k.box(1.72, 0.06, 0.06, 0, 0.62, hz + 0.41, C.trim, { ao: false });
  k.gable(1.7, 0.5, 0.8, 0, 0.89, hz, C.roof, C.plaster);
  // dormer with gold scales emblem
  k.box(0.36, 0.3, 0.2, 0, 0.92, hz + 0.32, C.plaster);
  k.gable(0.22, 0.18, 0.36, 0, 1.22, hz + 0.32, C.roof2, C.plaster, Math.PI / 2, 0.03);
  k.disc(0.11, 0.02, 0, 1.06, hz + 0.43, C.gold, 10, { ao: false });
  k.limb([-0.07, 1.06, hz + 0.45], [0.07, 1.06, hz + 0.45], 0.008, 0.008, C.goldD, 4);
  // stalls with striped awnings
  const stall = (x, z, ry, c1) => k.at(x, 0, z, ry, 1, () => {
    k.box(0.62, 0.3, 0.3, 0, 0.04, 0, C.wood, { top: 1.05 });
    for (const sx of [-0.29, 0.29]) for (const sz of [-0.13, 0.13]) k.box(0.04, sz < 0 ? 0.8 : 0.62, 0.04, sx, 0.04, sz, C.woodD);
    for (let i = 0; i < 6; i++) k.box(0.115, 0.025, 0.42, -0.29 + 0.0575 + i * 0.1166, 0.75, 0.0, i % 2 ? C.white : c1, { rx: 0.4, ao: false });
    k.sheet(6, 1, (u, v) => [-0.35 + u * 0.7, 0.63 - v * 0.08 + (Math.floor(u * 6 + 0.001) % 2 ? 0 : 0), 0.21 + v * 0.01], c1, { ao: false, shade: (u) => (Math.floor(u * 6) % 2 ? 1.3 : 1) });
    // wares
    k.ball(0.06, -0.15, 0.4, 0.05, 0xff8a3a, 0); k.ball(0.06, -0.06, 0.4, 0.05, 0xff8a3a, 0); k.ball(0.05, 0.12, 0.4, 0.04, 0x8ad04a, 0);
    k.box(0.12, 0.08, 0.1, 0.18, 0.34, -0.05, 0xf2e2a0);
  });
  stall(-0.55, 0.45, 0.35, C.banner);
  stall(0.55, 0.45, -0.35, C.red);
  // fountain in the middle front
  k.lathe([[0.28, 0], [0.3, 0.14], [0.26, 0.14], [0.26, 0.1], [0, 0.1]], 0, 0.04, 0.72, C.stone, 10);
  k.cyl(0.25, 0.25, 0.01, 0, 0.16, 0.72, C.water, 10, { glow: true });
  k.cyl(0.04, 0.05, 0.32, 0, 0.14, 0.72, C.stone, 6);
  k.lathe([[0.12, 0], [0.13, 0.04], [0.02, 0.06]], 0, 0.44, 0.72, C.stone2, 8);
  k.ball(0.04, 0, 0.52, 0.72, C.gold, 0);
  // crates, barrels, sacks
  k.crate(0.85, 0.04, -0.05, 1, 0.3); k.crate(0.83, 0.24, -0.05, 0.8, 0.1); k.barrel(-0.85, 0.04, -0.05); k.barrel(-0.78, 0.04, 0.2, 0.85);
  for (const [x, z] of [[0.82, 0.25], [0.95, 0.35]]) k.ball(0.09, x, 0.12, z, 0xe8d29a, 1, { s: [1, 1.1, 1] });
  return finish(k);
}

function tavern() {
  const k = makeKit(106);
  k.pad(1.8, 1.8);
  const z0 = -0.15;
  k.block(1.3, 0.62, 0.95, 0, 0.04, z0, C.stone2, { cornice: false });
  // timber-framed upper floor, overhanging
  k.box(1.42, 0.62, 1.05, 0, 0.66, z0, C.plaster, { top: 1.04, bot: 0.92 });
  for (const x of [-0.69, -0.35, 0, 0.35, 0.69]) k.box(0.05, 0.62, 1.07, x, 0.66, z0, C.woodD);
  k.box(1.46, 0.06, 1.09, 0, 0.64, z0, C.woodD); k.box(1.46, 0.05, 1.09, 0, 1.26, z0, C.woodD);
  for (const x of [-0.52, 0.52]) { k.limb([x - 0.14, 0.7, z0 + 0.53], [x + 0.14, 1.22, z0 + 0.53], 0.018, 0.018, C.woodD, 4); }
  k.gable(1.46, 0.75, 1.07, 0, 1.28, z0, C.roof, C.plaster);
  // dormer
  k.box(0.3, 0.28, 0.3, 0.2, 1.3, z0 + 0.3, C.plaster);
  k.gable(0.3, 0.18, 0.34, 0.2, 1.58, z0 + 0.3, C.roof2, C.plaster, Math.PI / 2, 0.03);
  k.win(0.2, 1.36, z0 + 0.45, 0.1, 0.12, 0, { frame: false, square: true });
  k.box(0.18, 0.55, 0.18, -0.45, 1.5, z0 - 0.2, C.stone2); k.box(0.22, 0.05, 0.22, -0.45, 2.04, z0 - 0.2, C.trim);
  // windows: warm and cosy
  const fz = z0 + 0.53;
  for (const x of [-0.52, 0.52]) k.win(x, 0.82, fz, 0.18, 0.2, 0, { frame: false, square: true });
  k.win(0, 0.86, fz, 0.14, 0.18, 0, { frame: false, square: true });
  for (const x of [-0.42, 0.42]) k.win(x, 0.22, fz - 0.05, 0.2, 0.2, 0, { mull: true });
  k.door(0, 0.04, fz - 0.05, 0.22, 0.34, 0, { c: 0xe89a40 });
  for (const z of [-0.2, 0.15]) { k.win(0.71, 0.84, z0 + z, 0.14, 0.18, Math.PI / 2, { frame: false, square: true }); k.win(-0.71, 0.84, z0 + z, 0.14, 0.18, -Math.PI / 2, { frame: false, square: true }); }
  // hanging sign with a golden tankard
  k.limb([0.66, 1.08, fz], [0.66, 1.08, fz + 0.35], 0.018, 0.018, C.woodD, 4);
  k.box(0.04, 0.12, 0.012, 0.66, 0.96, fz + 0.32, C.goldD, { ry: Math.PI / 2 });
  k.box(0.03, 0.26, 0.24, 0.66, 0.72, fz + 0.3, C.banner, { ao: false });
  k.cyl(0.05, 0.05, 0.1, 0.67, 0.8, fz + 0.3, C.gold, 8, { ao: false });
  // porch: lanterns, barrels, bench
  for (const x of [-0.18, 0.18]) k.box(0.06, 0.1, 0.06, x, 0.46, fz, C.win, { glow: true });
  k.barrel(-0.72, 0.04, 0.68); k.barrel(-0.5, 0.04, 0.72, 0.9); k.barrel(-0.62, 0.27, 0.68, 0.8);
  k.box(0.5, 0.04, 0.14, 0.42, 0.18, 0.62, C.wood); for (const x of [0.22, 0.62]) k.box(0.04, 0.16, 0.12, x, 0.04, 0.62, C.woodD);
  k.bush(0.82, -0.75, 0.8);
  return finish(k);
}

function mageGuild(lvl) {
  const k = makeKit(106 + lvl);
  k.pad(1.6, 1.6);
  k.block(1.15, 0.22, 1.15, 0, 0.04, 0, C.stone2, { cornice: false });
  for (let i = 0; i < 3; i++) k.box(0.5 - i * 0.04, 0.07, 0.14, 0, 0.04 + i * 0.07, 0.66 - i * 0.1, C.stone2, { ao: false });
  let y = 0.26, rr = 0.46;
  const hs = [1.15, 0.55, 0.6];
  for (let t = 0; t < lvl; t++) {
    const h = hs[t];
    k.lathe([[rr * 1.08, 0], [rr, 0.12], [rr * 0.94, h]], 0, y, 0, C.stone, 8, { top: 1.06, bot: 0.9, phi: Math.PI / 8 });
    // tall arched windows with magic glow
    const n = t === 0 ? 3 : 4;
    for (let i = 0; i < n; i++) {
      const a = t === 0 ? (i - 1) * 0.95 : (i / n) * TAU + 0.4;
      k.winCyl(0, 0, rr * 0.95, a, y + h * 0.3, t === 0 ? 0.13 : 0.1, h * 0.42, { c: C.magic, mull: t === 0 });
    }
    if (t === 0) k.door(0, y - 0.0, rr * 1.0, 0.24, 0.32);
    y += h;
    // balcony with gold rail
    k.lathe([[rr * 0.92, 0], [rr * 1.18, 0.1], [rr * 1.18, 0.16], [rr * 0.85, 0.16]], 0, y, 0, C.trim, 8, { ao: false, phi: Math.PI / 8 });
    if (t < lvl - 1) {
      k.tor(rr * 1.14, 0.02, 0, y + 0.3, 0, C.gold, TAU, { rx: Math.PI / 2, rs: 12, ao: false });
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; k.box(0.025, 0.14, 0.025, Math.sin(a) * rr * 1.14, y + 0.16, Math.cos(a) * rr * 1.14, C.gold, { ao: false }); }
    }
    y += 0.16;
    rr *= 0.8;
  }
  // roof
  const rh = lvl === 1 ? 0.85 : lvl === 2 ? 0.8 : 0.85;
  const rad = rr / 0.8 * 1.25;
  k.lathe([[rad, 0], [rad * 0.72, rh * 0.25], [rad * 0.35, rh * 0.62], [0, rh]], 0, y - 0.04, 0, C.roof, 8, { top: 1.35, bot: 0.82, ao: false, phi: Math.PI / 8 });
  // gold star bands on the roof
  k.tor(rad * 0.86, 0.02, 0, y + rh * 0.12, 0, C.gold, TAU, { rx: Math.PI / 2, rs: 8, ao: false, ry: Math.PI / 8 });
  y += rh - 0.04;
  k.limb([0, y, 0], [0, y + 0.18, 0], 0.025, 0.02, C.gold, 5);
  const orb = 0.08 + lvl * 0.025;
  k.ball(orb, 0, y + 0.18 + orb, 0, C.magic, 1, { glow: true });
  if (lvl >= 2) k.tor(orb * 1.6, 0.012, 0, y + 0.18 + orb, 0, C.gold, TAU, { rx: Math.PI / 2 - 0.4, ao: false, rs: 14 });
  if (lvl >= 3) {
    k.tor(orb * 1.6, 0.012, 0, y + 0.18 + orb, 0, C.gold, TAU, { rx: 0.5, ry: 0.8, ao: false, rs: 14 });
    // orbiting crystals
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.4; k.ball(0.06, Math.sin(a) * 0.62, 2.6 + (i % 2) * 0.4, Math.cos(a) * 0.62, i % 2 ? C.magic : 0xd8b0ff, 0, { glow: true, s: [0.7, 1.4, 0.7] }); }
  }
  // book lecterns / banners
  for (const s of [-1, 1]) { const a = s * 0.48; k.banner(Math.sin(a) * 0.43, 1.3, Math.cos(a) * 0.43, 0.13, 0.4, a, C.banner, { emblem: true }); }
  return finish(k);
}

// ================================================================== dwellings
// d1/u1: pikeman guardhouse / halberdier barracks
function guardhouse(up) {
  const k = makeKit(110 + up);
  k.pad(1.8, 1.8);
  const w = up ? 1.2 : 1.15, h = up ? 0.95 : 0.8, z0 = -0.2;
  k.block(w, h, 0.95, 0, 0.04, z0, C.stone, { cren: { step: 0.24, m: 0.13 } });
  const fz = z0 + 0.475;
  k.door(0, 0.04, fz, 0.26, 0.36);
  for (const s of [-1, 1]) k.win(s * w * 0.3, 0.42, fz, 0.12, 0.2);
  k.banner(0, h - 0.04, fz, 0.18, 0.3, 0, C.banner, { emblem: false });
  // corner turret(s)
  k.tower(-w / 2, z0 - 0.4, { r: up ? 0.22 : 0.24, flagH: 0.4, h: h + 0.55, roofH: 0.62, flag: up ? true : false, flagDir: -1, wins: [[0.4, 0.62, 0.08, 0.16]] });
  if (up) {
    k.tower(w / 2, z0 - 0.4, { r: 0.22, flagH: 0.4, h: h + 0.55, roofH: 0.62, flag: true, wins: [[-0.4, 0.62, 0.08, 0.16]] });
    k.hip(w * 0.6, 0.4, 0.5, 0, 0.04 + h + 0.0, z0 - 0.12, C.roof);
    for (const s of [-1, 1]) k.banner(s * w * 0.5 + s * 0.02, h - 0.1, fz, 0.16, 0.38, 0, C.banner);
  }
  // pike rack: pikes leaning against a rail
  // pike rack beside the door, seen side-on
  k.at(0.62, 0, 0.42, -0.5, 1, () => {
    k.limb([-0.22, 0.36, 0], [0.22, 0.36, 0], 0.02, 0.02, C.woodD, 4);
    for (const x of [-0.22, 0.22]) k.box(0.05, 0.38, 0.05, x, 0.04, 0, C.woodD);
    const np = up ? 5 : 4;
    for (let i = 0; i < np; i++) {
      const x = -0.18 + i * 0.36 / (np - 1);
      k.limb([x, 0.04, 0.1], [x, 1.0, -0.06], 0.015, 0.012, C.wood, 4);
      if (up && i % 2 === 0) k.box(0.12, 0.09, 0.012, x + 0.05, 0.86, -0.05, C.steel, { ao: false, ry: Math.PI / 2 });
      k.cone(0.03, 0.13, x, 0.99, -0.06, C.steel, 4, { ao: false });
    }
  });
  // training dummy / shields
  k.at(-0.6, 0, 0.55, 0.3, 1, () => {
    k.limb([0, 0.04, 0], [0, 0.65, 0], 0.025, 0.025, C.woodD, 4);
    k.limb([-0.2, 0.5, 0], [0.2, 0.5, 0], 0.02, 0.02, C.woodD, 4);
    k.ball(0.13, 0, 0.48, 0, C.straw, 1, { s: [1, 1.3, 0.8] });
    k.ball(0.08, 0, 0.7, 0, C.straw, 1);
  });
  for (const s of [-1, 1]) { k.disc(0.11, 0.03, s * (w / 2 + 0.02), 0.5, z0 + 0.1, C.banner, 10, { ry: s * Math.PI / 2, ao: false }); k.disc(0.04, 0.04, s * (w / 2 + 0.03), 0.5, z0 + 0.1, C.gold, 6, { ry: s * Math.PI / 2, ao: false }); }
  return finish(k);
}

// d2/u2: archer tower / marksman tower
function archerTower(up) {
  const k = makeKit(120 + up);
  k.pad(1.8, 1.8);
  const tx = up ? -0.18 : 0, tz = -0.15, h = up ? 2.0 : 1.7, rr = up ? 0.42 : 0.4;
  // wooden hoarding below the roof
  const top = k.tower(tx, tz, { r: rr, h, crown: false, roofH: 0, wins: [[0, 0.3, 0.1, 0.18], [0.9, 0.55, 0.05, 0.2], [-0.9, 0.55, 0.05, 0.2]] });
  k.cyl(rr * 1.3, rr * 1.3, 0.32, tx, h - 0.02, tz, C.wood, 10, { top: 1.1, bot: 0.85 });
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; k.box(0.06, 0.18, 0.02, tx + Math.sin(a) * rr * 1.31, h + 0.06, tz + Math.cos(a) * rr * 1.31, C.win, { glow: true, ry: a }); }
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.3; k.limb([tx + Math.sin(a) * rr, h - 0.3, tz + Math.cos(a) * rr], [tx + Math.sin(a) * rr * 1.28, h, tz + Math.cos(a) * rr * 1.28], 0.025, 0.025, C.woodD, 4); }
  k.lathe([[rr * 1.5, 0], [rr * 1.05, 0.3], [rr * 0.5, 0.7], [0, 0.95]], tx, h + 0.3, tz, C.roof, 10, { top: 1.3, bot: 0.82, ao: false });
  k.flag(tx, h + 1.25, tz, 0.45, 0.5, 0.2, C.banner);
  k.ball(0.06, tx, h + 1.25, tz, C.gold, 1);
  k.door(tx, 0.04, tz + rr, 0.2, 0.3);
  // archery targets
  const target = (x, z, ry) => k.at(x, 0, z, ry, 1, () => {
    for (const s of [-1, 1]) k.limb([s * 0.15, 0.04, -0.12], [s * 0.1, 0.62, 0], 0.02, 0.02, C.woodD, 4);
    k.limb([0, 0.04, 0.2], [0, 0.55, 0], 0.02, 0.02, C.woodD, 4);
    k.disc(0.23, 0.05, 0, 0.45, 0.03, C.straw, 12, { rx: -0.2 });
    k.disc(0.18, 0.05, 0, 0.45, 0.04, C.white, 12, { rx: -0.2 });
    k.disc(0.12, 0.05, 0, 0.45, 0.05, C.red, 12, { rx: -0.2 });
    k.disc(0.055, 0.05, 0, 0.45, 0.06, C.gold, 10, { rx: -0.2 });
    k.limb([0.04, 0.47, 0.08], [0.12, 0.55, 0.35], 0.008, 0.008, C.woodD, 3);
  });
  target(0.6, 0.55, -0.4);
  if (up) {
    target(-0.7, 0.62, 0.3);
    // second tower bridged to the main one
    k.tower(0.55, -0.35, { r: 0.26, h: 1.35, roofH: 0.65, flag: C.banner, wins: [[0, 0.6, 0.08, 0.18], [-0.9, 0.6, 0.08, 0.18]] });
    k.box(0.5, 0.12, 0.22, 0.2, 1.2, -0.25, C.wood, { ry: -0.25 });
    k.box(0.5, 0.18, 0.03, 0.22, 1.32, -0.15, C.woodD, { ry: -0.25 });
    k.tor(rr * 1.3, 0.035, tx, h + 0.3, tz, C.gold, TAU, { rx: Math.PI / 2, rs: 10, ao: false });
    k.banner(tx, h - 0.1, tz + rr * 1.31, 0.2, 0.5);
  } else {
    // quiver barrel with arrows
    k.barrel(-0.55, 0.04, 0.45, 1, C.wood);
    for (let i = 0; i < 6; i++) k.limb([-0.55 + (i % 3 - 1) * 0.04, 0.2, 0.45 + (i > 2 ? 0.04 : -0.04)], [-0.55 + (i % 3 - 1) * 0.08, 0.48, 0.45 + (i > 2 ? 0.08 : -0.08)], 0.008, 0.008, C.woodD, 3);
    k.bush(0.65, -0.6, 0.8);
  }
  return finish(k);
}

// d3/u3: griffin tower / griffin bastion
function nest(k, x, y, z, s) {
  k.tor(0.3 * s, 0.1 * s, x, y + 0.08 * s, z, C.straw, TAU, { rx: Math.PI / 2, rs: 10, ts: 5, j: 0.15 });
  k.cyl(0.3 * s, 0.22 * s, 0.1 * s, x, y, z, C.strawD, 8, { j: 0.1 });
  for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; k.limb([x + Math.sin(a) * 0.3 * s, y + 0.1 * s, z + Math.cos(a) * 0.3 * s], [x + Math.sin(a + 0.6) * 0.42 * s, y + 0.2 * s, z + Math.cos(a + 0.6) * 0.42 * s], 0.012 * s, 0.008 * s, C.strawD, 3, { ao: false }); }
  for (const [dx, dz] of [[-0.06, 0.02], [0.07, -0.03], [0.0, 0.08]]) k.ball(0.07 * s, x + dx * s, y + 0.15 * s, z + dz * s, 0xfff6e0, 1, { s: [1, 1.3, 1], ao: false });
}
function griffinTower(up) {
  const k = makeKit(130 + up);
  k.pad(1.8, 1.8);
  const tz = -0.15, h = up ? 2.25 : 1.9, rr = up ? 0.42 : 0.38;
  k.tower(0, tz, { r: rr, h, crown: true, cren: 10, wins: [[0, 0.3, 0.1, 0.2], [0, 0.72, 0.12, 0.24], [1.1, 0.55, 0.09, 0.2], [-1.1, 0.55, 0.09, 0.2]] });
  const topY = h + 0.22;
  if (!up) {
    nest(k, 0, topY, tz, 1.25);
    // perch beam with side nest
    k.limb([rr * 0.8, h * 0.62, tz], [rr + 0.45, h * 0.62, tz + 0.1], 0.04, 0.04, C.woodD, 5);
    k.limb([rr * 0.8, h * 0.48, tz], [rr + 0.45, h * 0.62, tz + 0.08], 0.025, 0.025, C.woodD, 4);
    nest(k, rr + 0.38, h * 0.62 + 0.03, tz + 0.1, 0.65);
    k.banner(0, h * 0.95, tz + rr, 0.2, 0.42);
    // golden wing ornaments
    for (const s of [-1, 1]) k.sheet(4, 1, (u, v) => [s * (rr * 1.0 + u * 0.4), h * 0.85 + u * 0.25 - v * (0.3 - u * 0.15), tz + rr * 0.5], C.gold, { ao: false });
    k.bush(-0.65, 0.55, 0.8);
  } else {
    // canopy on pillars sheltering a great nest
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.3; k.cyl(0.04, 0.04, 0.7, Math.sin(a) * rr * 1.05, topY, tz + Math.cos(a) * rr * 1.05, C.stone, 6); }
    nest(k, 0, topY, tz, 1.1);
    k.lathe([[rr * 1.5, 0], [rr * 1.1, 0.25], [rr * 0.5, 0.6], [0, 0.8]], 0, topY + 0.7, tz, C.roof, 10, { top: 1.3, bot: 0.82, ao: false });
    k.tor(rr * 1.42, 0.03, 0, topY + 0.72, tz, C.gold, TAU, { rx: Math.PI / 2, rs: 10, ao: false });
    k.flag(0, topY + 1.5, tz, 0.4, 0.5, 0.2, C.banner);
    // two cantilevered nest platforms
    for (const s of [-1, 1]) {
      const px = s * (rr + 0.34), py = h * 0.55;
      k.box(0.5, 0.1, 0.5, s * (rr + 0.24), py - 0.1, tz + 0.05, C.stone2);
      k.limb([s * rr, py - 0.45, tz + 0.05], [s * (rr + 0.45), py - 0.1, tz + 0.05], 0.04, 0.04, C.stone2, 5);
      nest(k, px, py, tz + 0.05, 0.6);
    }
    // grand gold wings over the door
    for (const s of [-1, 1]) k.sheet(5, 2, (u, v) => [s * (0.08 + u * 0.55), h * 0.85 + Math.sin(u * 2.4) * 0.3 - v * (0.4 - u * 0.25), tz + rr + 0.04], C.gold, { ao: false });
    k.disc(0.12, 0.05, 0, h * 0.82, tz + rr + 0.05, C.banner, 10, { ao: false });
    for (const s of [-1, 1]) k.banner(s * 0.24, h * 0.45, tz + rr * 0.9, 0.16, 0.4, s * 0.5);
  }
  k.door(0, 0.04, tz + rr, 0.22, 0.3);
  return finish(k);
}

// d4/u4: sword barracks / crusader hall
function swordBarracks(up) {
  const k = makeKit(140 + up);
  k.pad(2.0, 2.0);
  const z0 = -0.3, w = up ? 1.5 : 1.4, h = 0.85;
  k.block(w, h, 0.9, 0, 0.04, z0, C.stone);
  k.gable(w, 0.55, 0.9, 0, 0.04 + h, z0, C.roof, C.stone);
  const fz = z0 + 0.45;
  for (const x of [-0.5, -0.25, 0.25, 0.5]) k.win(x * w / 1.4, 0.42, fz, 0.1, 0.22, 0, { mull: false });
  // gate tower in front
  const gh = up ? 1.75 : 1.5;
  k.block(0.62, gh, 0.5, 0, 0.04, fz + 0.1, C.stone, { cren: { step: 0.2, m: 0.11, h: 0.14 } });
  k.door(0, 0.04, fz + 0.35, 0.26, 0.4);
  k.win(0, gh - 0.55, fz + 0.35, 0.14, 0.24);
  // crossed swords crest
  for (const s of [-1, 1]) k.box(0.035, 0.48, 0.02, 0, 0.62, fz + 0.37, C.steel, { rz: s * 0.7, ao: false });
  k.disc(0.09, 0.03, 0, 0.82, fz + 0.38, C.banner, 10, { ao: false });
  k.disc(0.04, 0.03, 0, 0.82, fz + 0.4, C.gold, 8, { ao: false });
  // shields along the hall front
  for (const x of [-0.6, 0.6]) { k.disc(0.1, 0.03, x * w / 1.4, 0.75, fz + 0.01, C.red, 3, { rz: Math.PI, ao: false }); k.box(0.02, 0.1, 0.01, x * w / 1.4, 0.68, fz + 0.03, C.white, { ao: false }); }
  // great sword monument in a stone
  const mx = up ? 0.7 : 0.62, mz = 0.6;
  k.lathe([[0.22, 0], [0.2, 0.12], [0.12, 0.2], [0, 0.22]], mx, 0.04, mz, C.stone2, 7);
  k.box(0.07, up ? 0.9 : 0.7, 0.02, mx, 0.2, mz, C.steel, { ao: false, top: 1.15, bot: 0.95 });
  k.box(0.3, 0.05, 0.06, mx, up ? 1.1 : 0.9, mz, C.gold, { ao: false });
  k.box(0.04, 0.18, 0.04, mx, up ? 1.15 : 0.95, mz, C.goldD, { ao: false });
  k.ball(0.04, mx, up ? 1.35 : 1.15, mz, C.gold, 0, { ao: false });
  if (up) {
    k.box(0.02, 0.6, 0.012, mx, 0.35, mz + 0.012, C.holy, { glow: true });
    for (const s of [-1, 1]) {
      k.tower(s * (w / 2 - 0.15), z0 - 0.32, { r: 0.24, h: 1.45, roofH: 0.85, flagH: 0.4, flag: C.red, flagDir: s, wins: [[0, 0.65, 0.08, 0.18]] });
      k.banner(s * 0.5, 1.4, fz + 0.36 - 0.25, 0.16, 0.5, 0, C.red);
    }
    k.flag(0, 0.04 + gh + 0.12, fz + 0.1, 0.5, 0.5, 0.22, C.banner);
  } else {
    k.banner(-0.48, 0.8, fz, 0.16, 0.38, 0, C.banner);
    k.flag(0, 0.04 + gh + 0.12, fz + 0.1, 0.4, 0.45, 0.2, C.banner);
    k.barrel(-0.7, 0.04, 0.6, 0.9);
  }
  return finish(k);
}

// d5/u5: monastery / cathedral
function monastery(up) {
  const k = makeKit(150 + up);
  k.pad(2.0, 2.0);
  const nw = up ? 0.95 : 0.85, nl = up ? 1.35 : 1.25, nh = up ? 1.05 : 0.9, nx = up ? 0 : -0.15, nz = -0.15;
  k.block(nw, nh, nl, nx, 0.04, nz, C.stone);
  k.gable(nl, 0.6, nw, nx, 0.04 + nh, nz, C.roof, C.stone, Math.PI / 2);
  const fz = nz + nl / 2;
  // buttresses + lancet windows along the side
  for (const z of [-0.4, 0, 0.4]) for (const s of [-1, 1]) {
    k.box(0.12, nh * 0.8, 0.1, nx + s * (nw / 2 + 0.04), 0.04, nz + z + 0.2, C.stone2, { top: 1.0 });
    k.win(nx + s * nw / 2, 0.38, nz + z, 0.1, 0.32, s * Math.PI / 2, { c: 0xffd890, mull: false });
  }
  // rose window and doorway in the front gable
  k.disc(0.2, 0.04, nx, nh + 0.15, fz + 0.01, C.trim, 12, { ao: false });
  k.disc(0.16, 0.04, nx, nh + 0.15, fz + 0.03, 0xffc070, 12, { glow: true });
  for (let i = 0; i < 4; i++) k.box(0.015, 0.32, 0.01, nx, nh - 0.01, fz + 0.055, C.goldD, { rz: i * Math.PI / 4, ao: false });
  k.door(nx, 0.04, fz, 0.28, 0.42, 0, { c: 0x9a5a30 });
  k.win(nx - 0.28, 0.4, fz, 0.08, 0.26, 0, { mull: false }); k.win(nx + 0.28, 0.4, fz, 0.08, 0.26, 0, { mull: false });
  if (!up) {
    // bell tower beside the nave
    const bx = 0.6, bz = -0.35;
    k.block(0.45, 1.6, 0.45, bx, 0.04, bz, C.stone);
    k.win(bx, 1.25, bz + 0.225, 0.14, 0.22, 0, { c: C.holy, mull: false });
    k.win(bx - 0.225, 1.25, bz, 0.14, 0.22, -Math.PI / 2, { c: C.holy, mull: false });
    k.cone(0.06, 0.1, bx, 1.27, bz, C.gold, 6); // bell
    k.hip(0.55, 0.85, 0.55, bx, 1.64, bz, C.roof);
    k.limb([bx, 2.49, bz], [bx, 2.75, bz], 0.02, 0.02, C.gold, 4); k.box(0.16, 0.03, 0.03, bx, 2.65, bz, C.gold, { ao: false });
    // cloister wall + herb garden
    k.box(0.8, 0.35, 0.1, 0.45, 0.04, 0.55, C.stone2, { top: 1.1 });
    for (const x of [0.15, 0.45, 0.75]) k.door(x, 0.04, 0.6, 0.12, 0.14, 0, { c: 0x86c650 });
    k.tree(0.75, 0.2, 0.7); k.bush(-0.75, 0.75, 0.6);
    k.box(0.12, 0.38, 0.12, nx, 0.04 + nh + 0.6, fz - 0.02, C.gold, { s: [0.3, 1, 0.3], ao: false });
    k.box(0.22, 0.04, 0.04, nx, 0.04 + nh + 0.88, fz - 0.02, C.gold, { ao: false });
  } else {
    // twin west towers with spires flanking the facade
    for (const s of [-1, 1]) {
      const tx = nx + s * (nw / 2 + 0.18), tz = fz - 0.12;
      k.block(0.4, 1.9, 0.4, tx, 0.04, tz, C.stone);
      k.win(tx, 1.25, tz + 0.2, 0.12, 0.3, 0, { c: C.holy, mull: false });
      k.win(tx, 0.55, tz + 0.2, 0.1, 0.24, 0, { mull: false });
      for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.cone(0.05, 0.25, tx + cx * 0.18, 1.94, tz + cz * 0.18, C.stone2, 4);
      k.cone(0.24, 1.05, tx, 1.94, tz, C.roof, 8, { top: 1.3, bot: 0.82, ao: false, ry: Math.PI / 8 });
      k.ball(0.05, tx, 3.0, tz, C.gold, 1, { ao: false });
      k.box(0.03, 0.22, 0.03, tx, 3.02, tz, C.gold, { ao: false }); k.box(0.12, 0.03, 0.03, tx, 3.14, tz, C.gold, { ao: false });
      k.banner(tx + s * 0.21, 1.6, tz, 0.15, 0.48, s * Math.PI / 2, C.banner);
    }
    // crossing spire with golden dome
    k.cyl(0.22, 0.24, 0.35, nx, nh + 0.45, nz - 0.25, C.stone, 8);
    for (const a of [0, Math.PI / 2, -Math.PI / 2]) k.winCyl(nx, nz - 0.25, 0.22, a, nh + 0.53, 0.07, 0.16, { frame: false, c: C.holy });
    k.cone(0.28, 0.75, nx, nh + 0.8, nz - 0.25, C.gold, 8, { top: 1.25, ao: false });
    // statues + cloister garden
    for (const s of [-1, 1]) k.statue(nx + s * 0.75, 0.04, fz + 0.3, 0.42, C.white, { halo: true });
    k.tree(-0.85, -0.65, 0.6); k.tree(0.85, -0.65, 0.6);
  }
  return finish(k);
}

// d6/u6: training grounds (jousting arena) / royal tourney
function arena(up) {
  const k = makeKit(160 + up);
  k.pad(2.4, 2.4, C.pave);
  k.box(1.96, 0.02, 1.1, 0, 0.04, 0.24, 0xe6c88a, { j: 0.06, ao: false }); // sanded list field
  k.box(1.86, 0.015, 1.0, 0, 0.055, 0.24, 0x9ad25a, { j: 0.05, ao: false });
  // fence posts and rails around the field
  const fx = 0.98, fz0 = -0.3, fz1 = 0.78;
  const posts = [];
  for (let i = 0; i <= 8; i++) posts.push([-fx + i * (2 * fx / 8), fz1]);
  for (let i = 1; i < 4; i++) { posts.push([-fx, fz0 + i * (fz1 - fz0) / 4]); posts.push([fx, fz0 + i * (fz1 - fz0) / 4]); }
  for (const [x, z] of posts) { k.box(0.05, 0.28, 0.05, x, 0.04, z, C.white); k.ball(0.03, x, 0.34, z, C.gold, 0, { ao: false }); }
  for (const y of [0.14, 0.26]) {
    k.box(2 * fx, 0.04, 0.03, 0, y, fz1, y > 0.2 ? C.banner : C.white, { ao: false });
    for (const s of [-1, 1]) k.box(0.03, 0.04, fz1 - fz0, s * fx, y, (fz0 + fz1) / 2, y > 0.2 ? C.banner : C.white, { ao: false });
  }
  // tilt barrier down the middle
  k.box(1.5, 0.22, 0.05, 0, 0.06, 0.26, C.banner, { ao: false });
  k.box(1.52, 0.04, 0.07, 0, 0.27, 0.26, C.gold, { ao: false });
  for (let i = 0; i < 6; i++) k.box(0.05, 0.22, 0.06, -0.75 + i * 0.3, 0.06, 0.26, C.white, { ao: false });
  // grandstand along the back
  const gz = -0.68;
  if (!up) {
    for (let i = 0; i < 3; i++) k.box(1.8, 0.16 + i * 0.16, 0.18, 0, 0.04, gz + 0.18 - i * 0.18, C.wood, { top: 1.1, bot: 0.85 });
    for (const x of [-0.88, 0, 0.88]) k.limb([x, 0.04, gz + 0.25], [x, 1.05, gz + 0.25], 0.03, 0.03, C.woodD, 4);
    for (const x of [-0.88, 0, 0.88]) k.limb([x, 0.04, gz - 0.25], [x, 1.15, gz - 0.25], 0.03, 0.03, C.woodD, 4);
    // striped canopy
    for (let i = 0; i < 8; i++) k.box(0.235, 0.025, 0.6, -0.82 + i * 0.235, 1.1, gz, i % 2 ? C.white : C.banner, { rx: 0.15, ao: false });
    for (let i = 0; i < 8; i++) k.cone(0.12, 0.12, -0.82 + i * 0.235, 1.05, gz + 0.32, i % 2 ? C.white : C.banner, 3, { rx: Math.PI, ao: false });
  } else {
    // stone grandstand with arcade and a royal box
    k.box(1.9, 0.5, 0.6, 0, 0.04, gz, C.stone, { top: 1.06, bot: 0.86 });
    for (let i = 0; i < 6; i++) k.door(-0.8 + i * 0.32, 0.04, gz + 0.3, 0.18, 0.22, 0, { c: 0xc8b8f0 });
    for (let i = 0; i < 2; i++) k.box(1.9, 0.14, 0.2, 0, 0.54 + i * 0.14, gz + 0.1 - i * 0.2, C.stone2, { ao: false });
    k.crenels(1.9, 0.6, 0.82, 0, gz, C.stone, { sides: 'n', step: 0.28 });
    // royal box
    k.box(0.6, 0.45, 0.42, 0, 0.82, gz, C.stone, {});
    for (const x of [-0.26, 0.26]) k.cyl(0.03, 0.03, 0.45, x, 1.27, gz + 0.18, C.gold, 6, { ao: false });
    k.hip(0.75, 0.42, 0.55, 0, 1.72, gz, C.roof);
    k.ball(0.05, 0, 2.15, gz, C.gold, 1, { ao: false });
    k.banner(0, 1.22, gz + 0.21, 0.32, 0.36);
    k.sheet(4, 1, (u, v) => [-0.3 + u * 0.6, 1.72 - v * 0.12 - Math.sin(u * Math.PI) * 0.05, gz + 0.28], C.red, { ao: false });
    for (const s of [-1, 1]) {
      k.tower(s * 0.92, gz - 0.12, { r: 0.2, h: 1.15, roofH: 0.6, flagH: 0.35, flag: C.banner, flagDir: s, wins: [[0, 0.6, 0.08, 0.16]] });
    }
    // flag poles along the front
    for (const x of [-0.45, 0.45]) k.flag(x, 0.04, 1.02, 0.95, 0.4, 0.17, x < 0 ? C.banner : C.red, { dir: 1, phase: x * 4 });
  }
  // pavilion tents with pennants
  const tent = (x, z, c1, s) => {
    k.cyl(0.24 * s, 0.26 * s, 0.32 * s, x, 0.04, z, C.white, 8, { top: 1.0, bot: 0.92 });
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; if (i % 2) k.box(0.18 * s, 0.32 * s, 0.01, x + Math.sin(a + TAU / 16) * 0.255 * s, 0.04, z + Math.cos(a + TAU / 16) * 0.255 * s, c1, { ry: a + TAU / 16, ao: false }); }
    k.cone(0.3 * s, 0.36 * s, x, 0.36 * s + 0.04, z, c1, 8, { top: 1.3, bot: 0.9, ao: false });
    k.flag(x, 0.72 * s + 0.04, z, 0.3, 0.25, 0.1, c1 === C.red ? C.banner : C.red, { phase: x * 3 });
  };
  tent(-0.88, 0.98, C.banner, 0.8); tent(0.88, 0.98, C.red, 0.8);
  // lance rack
  k.limb([-0.35, 0.3, 0.95], [0.05, 0.3, 0.95], 0.015, 0.015, C.woodD, 4);
  for (let i = 0; i < 4; i++) { const x = -0.3 + i * 0.1; k.limb([x, 0.04, 0.98], [x - 0.05, 0.95, 0.9], 0.025, 0.012, i % 2 ? C.banner : C.white, 5, { ao: false }); }
  return finish(k);
}

// d7/u7: portal of glory
function portal(up) {
  const k = makeKit(170 + up);
  k.pad(2.8, 2.8);
  const R = up ? 1.3 : 1.2;
  // stepped round dais
  for (let i = 0; i < 3; i++) k.cyl(R - i * 0.18, R - i * 0.18 + 0.03, 0.1, 0, 0.04 + i * 0.1, -0.05, i === 2 ? C.stone : C.stone2, 14, { top: 1.1, bot: 0.9 });
  const Y = 0.34, pz = -0.15;
  k.cyl(R - 0.42, R - 0.42, 0.012, 0, Y, -0.05, 0xf2d890, 14, { glow: false, ao: false });
  k.tor(R - 0.55, 0.03, 0, Y + 0.012, -0.05, 0xffe08a, TAU, { glow: true, rx: Math.PI / 2, rs: 16 });
  // ring of columns
  const nc = up ? 8 : 6, ch = up ? 1.7 : 1.35, cr = R - 0.2;
  for (let i = 0; i < nc; i++) {
    const a = (i + 0.5) / nc * TAU;
    if (Math.cos(a) > 0.85) continue; // keep the front open
    const x = Math.sin(a) * cr, z = -0.05 + Math.cos(a) * cr;
    k.lathe([[0.1, 0], [0.08, 0.06], [0.065, 0.12], [0.06, ch - 0.1], [0.09, ch - 0.04], [0.11, ch]], x, Y - 0.2, z, C.stone, 8, { top: 1.1, bot: 0.92 });
    k.box(0.22, 0.05, 0.22, x, Y - 0.2 + ch, z, C.gold, { ao: false, ry: a });
    if (up) k.statue(x, Y - 0.15 + ch, z, 0.4, C.white, { wings: true, halo: true, ry: a + Math.PI * 0 });
    else k.cone(0.08, 0.22, x, Y - 0.15 + ch, z, C.gold, 6, { ao: false });
  }
  // the portal ring standing upright, facing +Z
  const pr = up ? 0.86 : 0.78, cy = Y + pr + 0.15;
  k.tor(pr, up ? 0.13 : 0.11, 0, cy, pz, C.stone, TAU, { ts: 6, rs: 20, top: 1.12, bot: 0.9, ao: false });
  k.tor(pr - 0.12, 0.035, 0, cy, pz + 0.06, C.gold, TAU, { ts: 4, rs: 20, ao: false });
  k.tor(pr + 0.12, 0.03, 0, cy, pz + 0.06, C.gold, TAU, { ts: 4, rs: 20, ao: false });
  // glowing heart: layered discs
  k.disc(pr - 0.08, 0.02, 0, cy, pz, 0xffc85a, 20, { glow: true });
  k.disc(pr * 0.66, 0.02, 0, cy, pz + 0.025, 0xffe08a, 18, { glow: true });
  k.disc(pr * 0.4, 0.02, 0, cy, pz + 0.045, 0xfff2c0, 14, { glow: true });
  k.disc(pr * 0.16, 0.02, 0, cy, pz + 0.065, C.white, 10, { glow: true });
  // the ring's plinths
  for (const s of [-1, 1]) {
    k.box(0.36, 0.4, 0.4, s * 0.5, Y, pz, C.stone2, { top: 1.05 });
    k.box(0.4, 0.05, 0.44, s * 0.5, Y + 0.4, pz, C.gold, { ao: false });
  }
  // gold rays / keystone
  const nr = up ? 12 : 8;
  for (let i = 0; i < nr; i++) {
    const a = (i / (nr - 1) - 0.5) * (up ? 2.6 : 2.2);
    const len = (i % 2 ? 0.22 : 0.38) * (up ? 1.2 : 1);
    k.box(0.05, len, 0.04, Math.sin(a) * (pr + 0.14 + len / 2), cy + Math.cos(a) * (pr + 0.14 + len / 2) - len / 2, pz, C.gold, { rz: -a, ao: false });
  }
  k.ball(0.14, 0, cy + pr + 0.15, pz, C.holy, 1, { glow: true });
  // wings sweeping from the ring
  for (const s of [-1, 1]) {
    const span = up ? 0.52 : 0.58;
    for (let f = 0; f < 3; f++) k.sheet(5, 1, (u, v) => {
      const x = s * (pr + 0.05 + u * span), y = cy + 0.15 + Math.sin(u * 2.2) * 0.35 * span - f * 0.14 - v * (0.32 - u * 0.2) * (1 - f * 0.15) - u * f * 0.12;
      return [x, y, pz - 0.05 - f * 0.03 - u * 0.15];
    }, f === 0 ? C.white : f === 1 ? 0xfff4d8 : 0xf4e6c4, { ao: false, top: 1.1, bot: 0.9 });
  }
  // light pillars rising from the dais (thin glowing shafts)
  if (up) {
    for (const s of [-1, 1]) { k.box(0.06, 1.2, 0.06, s * 0.35, Y, 0.55, C.holy, { glow: true }); k.ball(0.1, s * 0.35, Y + 1.25, 0.55, C.holy, 1, { glow: true }); }
    // floating gold crown above
    k.tor(0.2, 0.03, 0, cy + pr + 0.62, pz, C.gold, TAU, { rx: Math.PI / 2 - 0.25, rs: 14, ao: false });
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; k.cone(0.035, 0.12, Math.sin(a) * 0.2, cy + pr + 0.62, pz + Math.cos(a) * 0.2, C.gold, 4, { ao: false }); }
    k.flag(-1.15, 0.04, 0.9, 1.3, 0.45, 0.2, C.banner, { phase: 1 }); k.flag(1.15, 0.04, 0.9, 1.3, 0.45, 0.2, C.banner, { phase: 2, dir: -1 });
  }
  // front steps
  for (let i = 0; i < 3; i++) k.box(0.9, 0.1 * (i + 1), 0.16, 0, 0.04, R - 0.05 + 0.16 * (2 - i) * 0.5 - 0.0, C.stone2, { ao: false });
  for (const s of [-1, 1]) k.statue(s * 0.6, 0.04, R + 0.15, 0.55, C.white, { wings: true, halo: true, sword: true });
  return finish(k);
}

// ================================================================== export
const BUILDERS = {
  village,
  hall2: () => townHall(false),
  hall3: () => townHall(true),
  fort,
  market,
  tavern,
  mage1: () => mageGuild(1), mage2: () => mageGuild(2), mage3: () => mageGuild(3),
  d1: () => guardhouse(0), u1: () => guardhouse(1),
  d2: () => archerTower(0), u2: () => archerTower(1),
  d3: () => griffinTower(0), u3: () => griffinTower(1),
  d4: () => swordBarracks(0), u4: () => swordBarracks(1),
  d5: () => monastery(0), u5: () => monastery(1),
  d6: () => arena(0), u6: () => arena(1),
  d7: () => portal(0), u7: () => portal(1),
};
export const HAVEN_TOWN_IDS = Object.keys(BUILDERS);
const cache = new Map();
// Returns { body, glow } for a Haven town building id, or null for an unknown id.
// Results are cached and shared: clone before mutating.
export function havenTownBuilding(id) {
  if (!BUILDERS[id]) return null;
  if (!cache.has(id)) cache.set(id, BUILDERS[id]());
  return cache.get(id);
}
