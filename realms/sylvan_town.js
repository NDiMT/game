import * as THREE from 'three';

// =====================================================================
// HEX REALMS: Sylvan town-interior buildings (HoMM3 "Rampart" style).
//   sylvanTownBuilding(id) -> { body, glow }   (cached, shared: clone before mutating)
//   SYLVAN_TOWN_IDS                              (every id this module builds)
// ids: village, hall2, hall3, fort, market, tavern, mage1..mage3, d1..d7, u1..u7.
// Town-view units (1 unit is about a small house). Base at y = 0, front faces +Z.
// body: position, normal, color, uv (world-scaled), aBone, aPivot.
// glow: emissive bits (lanterns, windows, magic), also with aBone/aPivot.
// Banners and pennants are tagged with the rig FLAG bone (rig.js BONE.FLAG = 15)
// so a rig-aware material can make them wave; everything else is static (0).
// Look: living-wood halls, giant tree houses, mossy stone, green and gold
// leaf-shaped roofs, warm lanterns. Bright and sunny, no murk.
// =====================================================================

const TAU = Math.PI * 2;
const FLAG = 15; // BONE.FLAG in rig.js
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
// stable per-position hash so shared vertices of a jittered rock move together
function hash3(x, y, z, s) {
  let h = Math.imul(Math.round(x * 997) ^ 0x9e3779b1, 0x85ebca6b) ^ Math.imul(Math.round(y * 991) + s * 7919, 0xc2b2ae35) ^ Math.imul(Math.round(z * 983), 0x27d4eb2f);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
  return ((h >>> 0) % 10007) / 10007;
}
function jitter(g, amt, seed = 1) {
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    P.setXYZ(i, x + (hash3(x, y, z, seed) - 0.5) * amt, y + (hash3(x, y, z, seed + 1) - 0.5) * amt, z + (hash3(x, y, z, seed + 2) - 0.5) * amt);
  }
  return g;
}

// ------------------------------------------------------------------ palette (bright, sunny forest)
const C = {
  bark: 0xb27a42, barkL: 0xcc955a, barkD: 0x956034,
  wood: 0xe2b070, woodL: 0xf0ca8e, woodD: 0xb27c48, door: 0x9a6a3e,
  stone: 0xe8e0c8, stone2: 0xd2c9aa, moss: 0x8fcc52, mossD: 0x6cb240,
  roof: 0x45b845, roofL: 0x86dc5a, roofD: 0x34a040,
  gold: 0xffc63a, goldD: 0xe0a428, goldL: 0xffe27a, goldLeaf: 0xf6c838, goldLeafL: 0xffe070,
  leaf: 0x58bf3e, leafL: 0x8ee25c, leafY: 0xc6e04a, silverLeaf: 0xa8e47a,
  win: 0xffe08a, lamp: 0xfff0a0, fairy: 0xdcff9a, magic: 0x8ff4ff, water: 0x7fe0ff, waterG: 0xc8fbff,
  banner: 0x2fb84a, bannerL: 0x46d060, white: 0xffffff, marble: 0xf6f3ea, silver: 0xe6eef6, pearl: 0xf6e8ff,
  rock: 0xd8bc8e, rockL: 0xeed8ae, rockD: 0xb8966c, grass: 0x8fd055, path: 0xeadcb0, pave: 0xd9d0b0,
  hay: 0xf2d462, red: 0xe8483a, pink: 0xff9ac8, steel: 0xdfe6f0, mine: 0x8a5a3a, emberG: 0xffa848,
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
    const ng = g.index ? g.toNonIndexed() : g;
    const m = stack[stack.length - 1];
    ng.applyMatrix4(m);
    let pv = null;
    if (o.bone) pv = new THREE.Vector3(...(o.pivot || [0, 0, 0])).applyMatrix4(m);
    (o.glow ? G : B).push({ g: ng, c, o, pv });
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
      if (o.jit) jitter(g, o.jit, o.js || 3);
      return add(tf(g, o).translate(x, y, z), c, o);
    },
    limb(a, b, r1, r2, c, seg = 6, o = {}) {
      const va = V(...a), vb = V(...b), len = va.distanceTo(vb);
      const g = new THREE.CylinderGeometry(r2, r1, len, seg, 1, false);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), vb.clone().sub(va).normalize()));
      g.translate((va.x + vb.x) / 2, (va.y + vb.y) / 2, (va.z + vb.z) / 2);
      return add(g, c, o);
    },
    // tapered organic tube along a Catmull-Rom curve (roots, branches, arches, vines)
    tube(pts, r0, r1, c, o = {}) {
      const curve = new THREE.CatmullRomCurve3(pts.map((p) => V(...p)));
      const n = o.n || 8, rs = o.rs || 6;
      const g = new THREE.TubeGeometry(curve, n, 1, rs, false);
      const P = g.attributes.position, t = V();
      for (let i = 0; i <= n; i++) {
        const cp = curve.getPointAt(i / n), rad = r0 + (r1 - r0) * (i / n);
        for (let j = 0; j <= rs; j++) { const id = i * (rs + 1) + j; t.fromBufferAttribute(P, id).sub(cp).multiplyScalar(rad).add(cp); P.setXYZ(id, t.x, t.y, t.z); }
      }
      add(g, c, o);
      if (o.cap) { const e = pts[pts.length - 1]; k.ball(r1 * 1.05, e[0], e[1], e[2], c, 0, { ao: o.ao }); }
    },
    tor(rad, tube, x, y, z, c, arc = TAU, o = {}) { return add(tf(new THREE.TorusGeometry(rad, tube, o.ts || 4, o.rs || 12, arc), o).translate(x, y, z), c, o); },
    // flat disc facing +Z (in the current frame); scale with o.s = [w, h, 1] AFTER the facing rotation
    disc(rad, th, x, y, z, c, seg = 10, o = {}) { return add(tf(new THREE.CylinderGeometry(rad, rad, th, seg).rotateX(Math.PI / 2), o).translate(x, y, z), c, o); },
    // lumpy boulder
    rock(x, y, z, sx, sy, sz, c = C.rock, o = {}) {
      const g = jitter(new THREE.IcosahedronGeometry(1, o.det || 0), o.jit ?? 0.45, o.seed || 5);
      g.scale(sx, sy, sz); if (o.ry) g.rotateY(o.ry);
      return add(g.translate(x, y, z), c, { top: 1.2, bot: 0.86, ...o });
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
    // ---------------------------------------------------------- sylvan pieces
    // dome of overlapping pointed leaves (the Rampart roof); returns apex y
    leafDome(rad, h, x, y, z, o = {}) {
      const n = o.n || 8, c1 = o.c || C.roof, c2 = o.c2 || C.roofL, ph = o.phi || 0, ext = o.ext ?? 1.14;
      k.lathe([[rad * 0.96, 0], [rad * 0.88, h * 0.32], [rad * 0.62, h * 0.68], [rad * 0.26, h * 0.92], [0, h]], x, y, z, o.cb || C.roofD, n, { top: 1.15, bot: 0.85, ao: false, phi: ph });
      for (let i = 0; i < n; i++) {
        const a = ph + (i + 0.5) / n * TAU;
        k.sheet(2, 5, (u, v) => {
          const t = v * ext;
          let rr, yy;
          if (t <= 1) { rr = rad * Math.pow(Math.sin(t * Math.PI / 2), 0.8); yy = h * (1 - Math.pow(t, 1.5)); }
          else { rr = rad * (1 + (t - 1) * 0.6); yy = -(t - 1) * h * 1.1; }
          const wdt = (Math.PI / n) * 1.3 * Math.pow(Math.sin(Math.PI * Math.min(v, 0.999)), 0.6);
          const ang = a + (u - 0.5) * 2 * wdt;
          const lift = 0.015 + (1 - Math.abs(u - 0.5) * 2) * rad * 0.07 * Math.sin(Math.PI * v);
          return [x + Math.sin(ang) * (rr + lift), y + yy + lift * 0.4, z + Math.cos(ang) * (rr + lift)];
        }, i % 2 ? c2 : c1, { ao: false, shade: (u, v) => 1.16 - v * 0.26 + (1 - Math.abs(u - 0.5) * 2) * 0.1, thick: 0.014 });
      }
      let top = y + h;
      if (o.finial !== false) {
        k.ball(0.05 * (o.fs || 1), x, top + 0.01, z, C.gold, 1, { ao: false });
        k.cone(0.03 * (o.fs || 1), 0.2 * (o.fs || 1), x, top + 0.04, z, o.fc || C.gold, 5, { ao: false });
        top += 0.22 * (o.fs || 1);
      }
      return top;
    },
    // gable roof (ridge along local x) thatched with big pointed leaves
    leafGable(w, h, d, x, y, z, ry = 0, o = {}) {
      const ov = o.ov ?? 0.08, D = d / 2 + ov, W = w / 2 + ov, wallC = o.wall || C.wood;
      k.at(x, y, z, ry, 1, () => {
        const sl = [-W, 0, D, W, 0, D, W, h, 0, -W, 0, D, W, h, 0, -W, h, 0, W, 0, -D, -W, 0, -D, -W, h, 0, W, 0, -D, -W, h, 0, W, h, 0];
        const g1 = new THREE.BufferGeometry(); g1.setAttribute('position', new THREE.Float32BufferAttribute(sl, 3));
        add(g1, o.cb || C.roofD, { top: 1.15, bot: 0.86, ao: false });
        const ge = [w / 2, 0, d / 2, w / 2, 0, -d / 2, w / 2, h * (d / 2) / D, 0, -w / 2, 0, -d / 2, -w / 2, 0, d / 2, -w / 2, h * (d / 2) / D, 0];
        const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(ge, 3));
        add(g2, wallC, { top: 1.04, bot: 0.95 });
        const n = Math.max(3, Math.round((w + ov * 2) / (o.lw || 0.26)));
        const hw = (w + ov * 2) / n * 0.68;
        for (const s of [-1, 1]) for (let i = 0; i < n; i++) {
          const cx = -W + (i + 0.5) * (2 * W) / n;
          k.sheet(2, 4, (u, v) => {
            const t = v * 1.16;
            const ww = hw * Math.pow(Math.sin(Math.PI * Math.min(v * 0.92 + 0.08, 0.999)), 0.6);
            const lift = 0.018 + (1 - Math.abs(u - 0.5) * 2) * 0.03;
            return [cx + (u - 0.5) * 2 * ww, h * (1 - t) + lift - (t > 1 ? (t - 1) * h * 0.4 : 0), s * t * D];
          }, (i + (s > 0 ? 0 : 1)) % 2 ? (o.c2 || C.roofL) : (o.c || C.roof), { ao: false, shade: (u, v) => 1.14 - v * 0.24 + (1 - Math.abs(u - 0.5) * 2) * 0.08 });
        }
        k.limb([-W - 0.04, h + 0.03, 0], [W + 0.04, h + 0.03, 0], 0.04, 0.04, o.ridge || C.barkL, 5, { ao: false });
        for (const s of [-1, 1]) k.cone(0.035, 0.16, s * (W + 0.03), h + 0.05, 0, C.gold, 5, { ao: false, rz: -s * 0.4 });
      });
    },
    // leaf-shaped (pointed oval) glowing window on a wall facing +Z of frame ry
    win(x, y, z, w, h, ry = 0, o = {}) {
      k.at(x, 0, z, ry, 1, () => {
        if (o.frame !== false) k.disc(0.5, 0.03, 0, y, 0.008, o.frame || C.barkD, 6, { s: [w + 0.07, h + 0.1, 1], ao: false });
        k.disc(0.5, 0.03, 0, y, 0.022, o.c || C.win, 6, { s: [w, h, 1], glow: true });
        if (o.mull !== false && w > 0.1) k.box(0.016, h * 0.8, 0.012, 0, y - h * 0.4, 0.04, C.goldD, { ao: false });
      });
    },
    winCyl(cx, cz, rad, a, y, w, h, o = {}) { k.win(cx + Math.sin(a) * rad, y, cz + Math.cos(a) * rad, w, h, a, o); },
    // pointed-arch door
    door(x, y, z, w, h, ry = 0, o = {}) {
      k.at(x, 0, z, ry, 1, () => {
        k.box(w + 0.08, h * 0.62, 0.04, 0, y, 0.0, o.frame || C.barkD, { ao: false });
        k.disc(0.5, 0.04, 0, y + h * 0.6, 0.0, o.frame || C.barkD, 6, { s: [w + 0.08, h * 0.85, 1], ao: false });
        k.box(w, h * 0.6, 0.04, 0, y, 0.02, o.c || C.door, { top: 1.12, bot: 0.92, ao: false });
        k.disc(0.5, 0.04, 0, y + h * 0.6, 0.02, o.c || C.door, 6, { s: [w, h * 0.78, 1], ao: false });
        k.box(0.016, h * 0.85, 0.015, 0, y, 0.045, C.woodD, { ao: false });
        k.ball(0.022, w * 0.25, y + h * 0.35, 0.05, C.gold, 0, { ao: false });
        if (o.leaf !== false) k.disc(0.5, 0.02, 0, y + h * 0.72, 0.05, C.gold, 6, { s: [w * 0.22, w * 0.42, 1], ao: false });
      });
    },
    // hanging green banner with gold leaf emblem (rig FLAG)
    banner(x, ytop, z, w, h, ry = 0, c = C.banner, o = {}) {
      k.at(x, 0, z, ry, 1, () => {
        const fo = { bone: FLAG, pivot: [0, ytop, 0.03] };
        k.sheet(2, 5, (u, v) => {
          const yy = ytop - v * h + (v === 1 ? (1 - Math.abs(u - 0.5) * 2) * h * 0.24 : 0);
          return [(u - 0.5) * w * (1 - v * 0.15), yy, 0.03 + Math.sin(v * 3.5 + x) * 0.025 * v];
        }, c, { top: 1.12, bot: 0.86, ao: false, j: 0.02, ...fo });
        k.limb([-w * 0.62, ytop + 0.01, 0.035], [w * 0.62, ytop + 0.01, 0.035], 0.018, 0.018, C.gold, 5, { ao: false });
        if (o.emblem !== false) k.disc(0.5, 0.02, 0, ytop - h * 0.45, 0.055 + Math.sin(1.6 + x) * 0.014, C.gold, 6, { s: [w * 0.36, w * 0.66, 1], ao: false, ...fo });
        k.box(w * 0.96, 0.03, 0.02, 0, ytop - h * 0.1, 0.05, C.gold, { ao: false, ...fo });
      });
    },
    // pole with a waving pennant (rig FLAG)
    flag(x, y, z, hp, len, hgt, c = C.banner, o = {}) {
      k.limb([x, y, z], [x, y + hp, z], 0.025, 0.02, o.pole ?? C.barkL, 5);
      k.cone(0.035, 0.12, x, y + hp, z, C.gold, 5, { ao: false });
      const dir = o.dir ?? 1, ph = o.phase ?? 0;
      k.sheet(6, 3, (u, v) => {
        const taper = 1 - u * 0.55;
        const along = u * len - Math.max(0, 1 - Math.abs(v - 0.5) * 4) * 0.3 * len * smooth(0.55, 1, u);
        return [x + dir * along, y + hp - 0.06 - hgt / 2 + (v - 0.5) * hgt * taper - u * u * hgt * 0.2, z + Math.sin(u * 9 + ph) * 0.05 * u];
      }, c, { shade: (u) => 0.94 + 0.16 * Math.cos(u * 9 + ph), ao: false, j: 0.02, bone: FLAG, pivot: [x, y + hp - 0.06, z] });
    },
    // round pad of mossy flagstones
    pad(rad, o = {}) {
      k.cyl(rad, rad + 0.03, 0.04, o.x || 0, 0, o.z || 0, o.c || C.pave, 16, { top: 1.0, bot: 0.9, j: 0.04, ao: false });
      k.cyl(rad - 0.1, rad - 0.1, 0.012, o.x || 0, 0.04, o.z || 0, o.c2 || C.path, 16, { j: 0.06, ao: false });
      const n = Math.round(rad * 7);
      for (let i = 0; i < n; i++) { const a = (i + r()) / n * TAU; k.ball(0.07 + r() * 0.05, (o.x || 0) + Math.sin(a) * rad, 0.02, (o.z || 0) + Math.cos(a) * rad, i % 2 ? C.moss : C.mossD, 0, { s: [1.3, 0.45, 1.1], ao: false, top: 1.25 }); }
    },
    canopy(x, y, z, rad, o = {}) {
      const g = jitter(new THREE.IcosahedronGeometry(1, 1), 0.28, o.seed || 7);
      g.scale(rad, rad * (o.sy || 0.86), rad);
      add(g.translate(x, y, z), o.c || C.leaf, { top: 1.32, bot: 0.78, ao: false, j: 0.06 });
    },
    // giant living tree; returns the canopy top y
    bigTree(x, z, o = {}) {
      const rr = o.r || 0.2, h = o.h || 1.2, cr = o.cr || 0.6, y = o.y || 0, ph = o.phi ?? 0.4;
      const c1 = o.c || C.leaf, c2 = o.c2 || C.leafL, bark = o.bark || C.bark;
      k.lathe([[rr * 1.9, 0], [rr * 1.3, h * 0.08], [rr * 1.05, h * 0.25], [rr, h * 0.6], [rr * 0.8, h]], x, y, z, bark, 9, { top: 1.14, bot: 0.86, jit: rr * 0.25 });
      const nr = o.roots ?? 5;
      for (let i = 0; i < nr; i++) {
        const a = ph + i / nr * TAU;
        const S = Math.sin(a), Cc = Math.cos(a);
        k.tube([[x + S * rr * 0.7, y + h * 0.2, z + Cc * rr * 0.7], [x + S * rr * 1.6, y + h * 0.07, z + Cc * rr * 1.6], [x + S * rr * 2.5, y - 0.01, z + Cc * rr * 2.5]], rr * 0.38, rr * 0.12, bark, { n: 4, rs: 5 });
      }
      const nb = o.nb ?? 3;
      for (let i = 0; i < nb; i++) {
        const a = ph + 0.9 + i / nb * TAU;
        const S = Math.sin(a), Cc = Math.cos(a);
        const e = [x + S * cr * 0.75, y + h + cr * 0.3, z + Cc * cr * 0.6];
        k.tube([[x, y + h * 0.82, z], [x + S * cr * 0.3, y + h + cr * 0.05, z + Cc * cr * 0.25], e], rr * 0.55, rr * 0.25, bark, { n: 4, rs: 5 });
        k.canopy(e[0], e[1] + cr * 0.12, e[2], cr * 0.62, { c: i % 2 ? c2 : c1, seed: i + 3 });
      }
      k.canopy(x, y + h + cr * 0.62, z, cr * 0.85, { c: c1, seed: 11 });
      k.canopy(x + cr * 0.15, y + h + cr * 1.05, z + cr * 0.1, cr * 0.55, { c: c2, seed: 12 });
      return y + h + cr * 1.5;
    },
    // round living-wood hall with mossy footing and a leaf dome; returns the roof top y
    roundHall(x, z, rad, h, o = {}) {
      const y = o.y || 0, seg = o.seg || 10;
      k.cyl(rad * 1.1, rad * 1.16, 0.14, x, y, z, C.stone2, seg, { top: 1.08 });
      k.cyl(rad * 1.11, rad * 1.11, 0.03, x, y + 0.14, z, C.moss, seg, { ao: false, top: 1.2 });
      k.cyl(rad, rad * 1.04, h, x, y + 0.14, z, o.wall || C.wood, seg, { top: 1.1, bot: 0.88 });
      const np = o.posts ?? 6;
      for (let i = 0; i < np; i++) {
        const a = (i + 0.5) / np * TAU;
        k.limb([x + Math.sin(a) * rad * 1.03, y + 0.14, z + Math.cos(a) * rad * 1.03], [x + Math.sin(a) * rad * 1.0, y + 0.14 + h, z + Math.cos(a) * rad * 1.0], 0.045, 0.035, C.bark, 5);
      }
      k.tor(rad * 1.02, 0.035, x, y + 0.14 + h, z, C.barkD, TAU, { rx: Math.PI / 2, rs: seg });
      const top = k.leafDome(rad * (o.ro || 1.24), o.roofH || rad * 1.3, x, y + 0.12 + h, z, { n: o.n || 8, c: o.roofC, c2: o.roofC2, cb: o.roofCb, fs: o.fs, finial: o.finial });
      for (const [a, f, ww, wh] of (o.wins || [[0.75, 0.55, 0.11, 0.2], [-0.75, 0.55, 0.11, 0.2]])) k.winCyl(x, z, rad * 1.01, a, y + 0.14 + h * f, ww, wh, { mull: ww > 0.12 });
      if (o.door !== false) { const dw = o.dw || Math.min(0.24, rad * 0.5); k.door(x, y + 0.04, z + rad * 1.03, dw, Math.min(h * 0.92, dw * 1.9)); }
      return top;
    },
    lantern(x, y, z, s = 1, c = C.lamp) {
      k.cone(0.055 * s, 0.07 * s, x, y + 0.08 * s, z, C.goldD, 5, { ao: false });
      k.ball(0.048 * s, x, y + 0.045 * s, z, c, 0, { glow: true });
    },
    lampPost(x, z, h = 0.55, s = 1) {
      k.tube([[x, 0, z], [x, h * 0.7, z], [x + 0.04, h, z], [x + 0.12, h * 1.02, z]], 0.03, 0.018, C.bark, { n: 4, rs: 4 });
      k.lantern(x + 0.12, h - 0.12 * s, z, s);
    },
    platform(x, y, z, rad, o = {}) {
      k.cyl(rad, rad * 0.94, 0.07, x, y - 0.07, z, C.woodD, 12, { top: 1.1 });
      const n = o.posts ?? 10;
      for (let i = 0; i < n; i++) { const a = i / n * TAU; k.limb([x + Math.sin(a) * rad * 0.95, y, z + Math.cos(a) * rad * 0.95], [x + Math.sin(a) * rad * 0.95, y + 0.14, z + Math.cos(a) * rad * 0.95], 0.014, 0.014, C.bark, 4, { ao: false }); }
      k.tor(rad * 0.95, 0.016, x, y + 0.14, z, C.barkL, TAU, { rx: Math.PI / 2, rs: 12, ts: 3, ao: false });
      // braces back to the trunk
      for (const a of (o.braces || [0.6, 2.6, 4.6])) k.limb([x + Math.sin(a) * rad * 0.8, y - 0.07, z + Math.cos(a) * rad * 0.8], [x + Math.sin(a) * rad * 0.15, y - 0.45, z + Math.cos(a) * rad * 0.15], 0.025, 0.02, C.barkD, 4);
    },
    bush(x, z, s = 1, c = C.leaf) { k.canopy(x, 0.13 * s, z, 0.2 * s, { c, sy: 0.75, seed: Math.round(x * 13 + z * 7) }); },
    flowers(x, z, s = 1, c = C.pink) {
      k.bush(x, z, s * 0.8, C.leafL);
      for (let i = 0; i < 4; i++) { const a = i * 1.7 + x; k.ball(0.035 * s, x + Math.sin(a) * 0.1 * s, 0.17 * s, z + Math.cos(a) * 0.1 * s, i % 2 ? c : C.white, 0, { ao: false }); }
    },
    tree(x, z, s = 1, c = C.leaf, c2 = C.leafL) {
      k.cyl(0.04 * s, 0.07 * s, 0.42 * s, x, 0, z, C.bark, 6);
      k.canopy(x, 0.6 * s, z, 0.3 * s, { c, seed: Math.round(x * 31 + z * 17) });
      k.canopy(x + 0.1 * s, 0.82 * s, z - 0.04 * s, 0.2 * s, { c: c2, seed: Math.round(x * 7 + z * 3) });
    },
    // tall elven cypress-like tree
    spireTree(x, z, s = 1, c = C.leaf) {
      k.cyl(0.035 * s, 0.05 * s, 0.25 * s, x, 0, z, C.bark, 5);
      k.lathe([[0.18 * s, 0], [0.22 * s, 0.25 * s], [0.15 * s, 0.65 * s], [0, 1.0 * s]], x, 0.15 * s, z, c, 7, { top: 1.3, bot: 0.8, ao: false, jit: 0.04 * s });
    },
    barrel(x, y, z, s = 1, c = C.wood) {
      k.lathe([[0.1 * s, 0], [0.125 * s, 0.13 * s], [0.1 * s, 0.26 * s]], x, y, z, c, 8);
      k.tor(0.118 * s, 0.012 * s, x, y + 0.07 * s, z, C.goldD, TAU, { rx: Math.PI / 2, rs: 8, ts: 3 });
      k.tor(0.118 * s, 0.012 * s, x, y + 0.19 * s, z, C.goldD, TAU, { rx: Math.PI / 2, rs: 8, ts: 3 });
    },
    crate(x, y, z, s = 1, ry = 0) { k.box(0.22 * s, 0.2 * s, 0.22 * s, x, y, z, C.wood, { ry, j: 0.1 }); k.box(0.23 * s, 0.03, 0.23 * s, x, y + 0.17 * s, z, C.woodD, { ry }); },
    basket(x, y, z, c = C.red, s = 1) {
      k.lathe([[0.08 * s, 0], [0.13 * s, 0.1 * s], [0.13 * s, 0.11 * s]], x, y, z, C.hay, 8, { ao: false });
      for (let i = 0; i < 4; i++) k.ball(0.05 * s, x + Math.sin(i * 1.6) * 0.06 * s, y + 0.12 * s, z + Math.cos(i * 1.6) * 0.06 * s, c, 0, { ao: false, top: 1.2 });
    },
    // horse-shaped statue/figure, side view facing +x of its frame. o: wings, horn, rider(bow), mane colour
    horse(x, y, z, s, ry, c, o = {}) {
      k.at(x, y, z, ry, s, () => {
        const mane = o.mane ?? c, B = 0.52;
        k.ball(0.2, 0, B, 0, c, 1, { s: [1.55, 0.9, 0.8], top: 1.15, bot: 0.86 });
        for (const [lx, lz, f] of [[0.2, 0.08, 1], [0.2, -0.08, -1], [-0.2, 0.08, 1], [-0.2, -0.08, -1]]) {
          const fr = lx > 0 ? (o.rear ? 0.12 : 0.05) : -0.02;
          if (o.rear && lx > 0) k.limb([lx, B, lz], [lx + 0.18, B + 0.02 + f * 0.03, lz], 0.05, 0.035, c, 5);
          else k.limb([lx, B, lz], [lx + fr, 0, lz], 0.05, 0.035, c, 5);
        }
        k.tube([[-0.28, B + 0.05, 0], [-0.4, B - 0.05, 0], [-0.44, B - 0.3, 0]], 0.05, 0.02, mane, { n: 4, rs: 4 });
        if (o.rider) {
          k.limb([0.22, B + 0.08, 0], [0.3, B + 0.45, 0], 0.09, 0.07, o.skin || 0xf0c49a, 6);
          k.ball(0.075, 0.32, B + 0.56, 0, o.skin || 0xf0c49a, 1);
          k.ball(0.06, 0.3, B + 0.6, -0.02, o.hair || 0xc87a34, 1, { s: [1.1, 0.8, 1.1] });
          k.tor(0.17, 0.014, 0.44, B + 0.44, 0.04, C.goldD, Math.PI, { rz: -Math.PI / 2, rs: 8, ts: 3, ao: false });
          k.limb([0.3, B + 0.4, 0.04], [0.44, B + 0.44, 0.04], 0.025, 0.02, o.skin || 0xf0c49a, 4);
        } else {
          k.limb([0.24, B + 0.05, 0], [0.38, B + 0.36, 0], 0.085, 0.065, c, 6);
          k.ball(0.075, 0.46, B + 0.38, 0, c, 1, { s: [1.65, 0.85, 0.85], rz: -0.55 });
          k.box(0.05, 0.2, 0.025, 0.32, B + 0.18, 0, mane, { rz: 0.6 });
          k.cone(0.02, 0.06, 0.38, B + 0.43, 0.03, c, 4); k.cone(0.02, 0.06, 0.38, B + 0.43, -0.03, c, 4);
          if (o.horn) k.cone(0.025, 0.24, 0.48, B + 0.43, 0, o.horn, 5, { rz: -0.75, ao: false });
        }
        if (o.wings) for (const sz of [-1, 1]) k.sheet(4, 2, (u, v) => [0.1 - u * 0.12 - v * 0.15 * u, B + 0.1 + u * 0.48 - v * (0.22 + u * 0.1), sz * (0.1 + u * 0.12)], o.wingC || c, { ao: false, top: 1.12, bot: 0.92 });
      });
    },
    // archery target on an easel, facing +Z of frame ry
    target(x, z, ry = 0, s = 1) {
      k.at(x, 0, z, ry, s, () => {
        k.limb([-0.14, 0, -0.06], [0, 0.6, 0.0], 0.02, 0.018, C.bark, 4); k.limb([0.14, 0, -0.06], [0, 0.6, 0.0], 0.02, 0.018, C.bark, 4); k.limb([0, 0, -0.2], [0, 0.55, -0.02], 0.02, 0.018, C.bark, 4);
        const cy = 0.4;
        k.disc(0.2, 0.06, 0, cy, 0.03, C.hay, 12, { rx: -0.2, ao: false });
        k.disc(0.165, 0.02, 0, cy + 0.007, 0.065, C.white, 12, { rx: -0.2, ao: false });
        k.disc(0.12, 0.02, 0, cy + 0.011, 0.075, C.red, 12, { rx: -0.2, ao: false });
        k.disc(0.075, 0.02, 0, cy + 0.015, 0.085, C.white, 12, { rx: -0.2, ao: false });
        k.disc(0.035, 0.02, 0, cy + 0.019, 0.095, C.gold, 10, { rx: -0.2, ao: false });
        for (const [ax, ay] of [[0.03, 0.05], [-0.06, -0.02]]) { k.limb([ax, cy + ay, 0.08], [ax + 0.04, cy + ay + 0.03, 0.26], 0.006, 0.006, C.barkL, 3, { ao: false }); k.box(0.02, 0.04, 0.035, ax + 0.04, cy + ay + 0.01, 0.25, C.white, { ao: false }); }
      });
    },
    // jagged rock spire; returns top y
    spire(x, z, h, rad, o = {}) {
      const y = o.y || 0;
      const pts = [[rad * 1.25, 0], [rad * 1.05, h * 0.15], [rad * 0.9, h * 0.35], [rad * 0.78, h * 0.55], [rad * 0.58, h * 0.75], [rad * 0.4, h * 0.9], [rad * 0.2, h]];
      k.lathe(pts, x, y, z, o.c || C.rock, 7, { top: 1.22, bot: 0.86, jit: rad * 0.32, js: Math.round(x * 10 + z * 3), phi: o.phi || 0 });
      return y + h;
    },
    crystal(x, y, z, s, c = C.fairy, o = {}) {
      k.add(new THREE.OctahedronGeometry(1, 0).scale(0.45 * s, 1 * s, 0.45 * s).rotateZ(o.rz || 0).rotateY(o.ry || 0.3).translate(x, y + s * 0.7, z), c, { glow: true });
    },
  };
  return k;
}

// ------------------------------------------------------------------ bake: vertex colours with soft coloured AO + rig tags
const tmpC = new THREE.Color();
function bake(parts, r, glow, uv) {
  let n = 0;
  for (const p of parts) n += p.g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), uvs = uv ? new Float32Array(n * 2) : null;
  const bone = new Float32Array(n), piv = new Float32Array(n * 3);
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
        pos[o * 3] = x; pos[o * 3 + 1] = y; pos[o * 3 + 2] = z;
        nor[o * 3] = fn.x; nor[o * 3 + 1] = fn.y; nor[o * 3 + 2] = fn.z;
        let m = jf * (bot + (top - bot) * ((y - ymin) / span));
        if (p.o.cols) m *= p.o.cols[vi];
        tmpC.copy(base).multiplyScalar(m);
        if (!glow && p.o.ao !== false) {
          // soft, cool-green contact shade near the ground, never black
          const s = smooth(0.0, 0.45, y);
          tmpC.r *= 0.82 + 0.18 * s; tmpC.g *= 0.88 + 0.12 * s; tmpC.b *= 0.93 + 0.07 * s;
        }
        col[o * 3] = Math.min(1, tmpC.r); col[o * 3 + 1] = Math.min(1, tmpC.g); col[o * 3 + 2] = Math.min(1, tmpC.b);
        if (p.pv) { bone[o] = p.o.bone; piv[o * 3] = p.pv.x; piv[o * 3 + 1] = p.pv.y; piv[o * 3 + 2] = p.pv.z; }
        if (uvs) {
          const ax = Math.abs(fn.x), ay = Math.abs(fn.y), az = Math.abs(fn.z);
          if (ay >= ax && ay >= az) { uvs[o * 2] = x; uvs[o * 2 + 1] = z; } else if (ax >= az) { uvs[o * 2] = z; uvs[o * 2 + 1] = y; } else { uvs[o * 2] = x; uvs[o * 2 + 1] = y; }
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
  g.setAttribute('aBone', new THREE.BufferAttribute(bone, 1));
  g.setAttribute('aPivot', new THREE.BufferAttribute(piv, 3));
  g.computeBoundingSphere(); g.computeBoundingBox();
  return g;
}
const finish = (k) => ({ body: bake(k.B, k.r, false, true), glow: k.G.length ? bake(k.G, k.r, true, false) : null });

// ================================================================== civic buildings
function village() {
  const k = makeKit(201);
  k.pad(1.15);
  k.bigTree(-0.5, -0.55, { r: 0.17, h: 1.05, cr: 0.55, nb: 3 });
  k.roundHall(0.32, 0.05, 0.46, 0.55, { roofH: 0.68, wins: [[0.8, 0.5, 0.11, 0.2], [-0.7, 0.5, 0.11, 0.2], [1.6, 0.5, 0.1, 0.18]] });
  k.roundHall(-0.62, 0.55, 0.24, 0.3, { roofH: 0.36, n: 6, posts: 4, roofC: C.goldLeaf, roofC2: C.goldLeafL, roofCb: C.goldD, wins: [[0.9, 0.5, 0.08, 0.13]], dw: 0.13, fs: 0.7 });
  k.flag(0.95, 0.04, -0.6, 1.1, 0.4, 0.18, C.banner, { phase: 1 });
  k.lampPost(-0.05, 0.85, 0.5); k.lampPost(0.9, 0.7, 0.5);
  k.flowers(0.95, 0.35, 0.8); k.flowers(-0.95, 0.05, 0.7, C.gold); k.bush(-0.15, -0.95, 0.9); k.bush(0.75, -0.85, 0.7);
  return finish(k);
}

function townHall(grand) {
  const k = makeKit(grand ? 203 : 202);
  k.pad(1.2);
  const tz = -0.5;
  if (!grand) {
    // great tree behind with a tree-house platform and the hall wrapped at its foot
    k.bigTree(0, tz, { r: 0.24, h: 1.65, cr: 0.72, nb: 3, phi: 0.2 });
    k.platform(0, 1.18, tz, 0.5, { braces: [0.4, 2.4, 4.4] });
    k.roundHall(0.18, tz + 0.12, 0.22, 0.24, { y: 1.18, roofH: 0.3, n: 6, posts: 4, wins: [[0, 0.5, 0.08, 0.12]], door: false, fs: 0.6, roofC: C.goldLeaf, roofC2: C.goldLeafL, roofCb: C.goldD });
    k.roundHall(0, 0.25, 0.58, 0.62, { roofH: 0.8, n: 10, posts: 8, dw: 0.26, wins: [[0.55, 0.5, 0.12, 0.22], [-0.55, 0.5, 0.12, 0.22], [1.2, 0.5, 0.11, 0.2], [-1.2, 0.5, 0.11, 0.2]] });
    for (const s of [-1, 1]) k.banner(s * 0.38, 0.72, 0.25 + 0.48, 0.18, 0.42, s * 0.62);
    k.lampPost(-0.75, 0.85, 0.55); k.lampPost(0.75, 0.85, 0.55);
    k.flowers(-0.95, 0.4, 0.8); k.flowers(0.95, 0.35, 0.8, C.gold); k.bush(-0.9, -0.8); k.bush(0.95, -0.7, 0.9);
    // front steps
    for (let i = 0; i < 2; i++) k.box(0.5 - i * 0.08, 0.06, 0.14, 0, 0.04 + i * 0.06, 0.95 - i * 0.1, C.stone2, { ao: false });
  } else {
    // golden great tree, bigger hall with gold dome, two side tree-towers
    k.bigTree(0, tz - 0.05, { r: 0.28, h: 1.85, cr: 0.8, nb: 4, phi: 0.2, c: C.goldLeaf, c2: C.leafL });
    k.platform(0, 1.32, tz - 0.05, 0.55, { braces: [0.4, 2.4, 4.4] });
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + 0.3; k.lantern(Math.sin(a) * 0.5, 1.12, tz - 0.05 + Math.cos(a) * 0.5, 0.9); }
    k.roundHall(0, 0.28, 0.62, 0.7, { roofH: 0.9, n: 10, posts: 8, dw: 0.28, roofC: C.goldLeaf, roofC2: C.goldLeafL, roofCb: C.goldD, fs: 1.3,
      wins: [[0.5, 0.5, 0.13, 0.24], [-0.5, 0.5, 0.13, 0.24], [1.1, 0.5, 0.12, 0.22], [-1.1, 0.5, 0.12, 0.22]] });
    for (const s of [-1, 1]) {
      const tx = s * 0.85, tzz = -0.2;
      k.lathe([[0.26, 0], [0.2, 0.15], [0.17, 0.6], [0.19, 1.45]], tx, 0, tzz, C.bark, 8, { top: 1.12, bot: 0.86, jit: 0.03 });
      k.tor(0.2, 0.03, tx, 1.0, tzz, C.gold, TAU, { rx: Math.PI / 2, rs: 8, ao: false });
      k.winCyl(tx, tzz, 0.18, s * 0.5, 0.95, 0.08, 0.16);
      k.leafDome(0.34, 0.55, tx, 1.43, tzz, { n: 7, finial: true });
      k.flag(tx, 2.2, tzz, 0.4, 0.4, 0.16, C.banner, { dir: s, phase: s });
      k.banner(s * 0.42, 0.82, 0.28 + 0.5, 0.2, 0.48, s * 0.7);
    }
    for (let i = 0; i < 3; i++) k.box(0.62 - i * 0.08, 0.06, 0.14, 0, 0.04 + i * 0.06, 1.04 - i * 0.1, C.stone2, { ao: false });
    for (const s of [-1, 1]) { k.box(0.14, 0.4, 0.14, s * 0.42, 0.04, 1.02, C.stone, { top: 1.1 }); k.lantern(s * 0.42, 0.44, 1.02, 1.2); }
    k.flowers(-1.0, 0.55, 0.8); k.flowers(1.0, 0.55, 0.8, C.gold); k.spireTree(-1.0, -0.8, 1.1); k.spireTree(1.0, -0.85, 1.0);
  }
  return finish(k);
}

function fort() {
  const k = makeKit(204);
  // mossy stone footing + living-wood palisade of pointed logs
  const segs = [[-4.25, -2.55], [-1.85, -0.95], [0.95, 1.85], [2.55, 4.25]];
  for (const [a, b] of segs) {
    const w = b - a, x = (a + b) / 2;
    k.box(w + 0.1, 0.42, 0.62, x, 0, 0, C.stone, { top: 1.08, bot: 0.86 });
    k.box(w + 0.14, 0.05, 0.66, x, 0.4, 0, C.moss, { ao: false, top: 1.2 });
    for (let i = 0; i < 4; i++) k.ball(0.12, a + (i + 0.5) * w / 4, 0.42, 0.3, C.mossD, 0, { s: [1.6, 0.5, 0.6], ao: false });
    const n = Math.round(w / 0.17);
    for (let i = 0; i < n; i++) {
      const xx = a + (i + 0.5) * w / n, hh = 0.95 + Math.sin(i * 2.3 + a) * 0.08;
      k.cyl(0.085, 0.09, hh, xx, 0.42, 0, i % 3 ? C.bark : C.barkL, 6);
      k.cone(0.088, 0.2, xx, 0.42 + hh, 0, C.woodL, 6, { ao: false });
    }
    // a walkway beam with lanterns and leaf garland
    k.box(w, 0.07, 0.08, x, 1.05, 0.12, C.barkD);
    for (let i = 0; i < Math.round(w / 0.6); i++) { const xx = a + (i + 0.5) * w / Math.round(w / 0.6); k.lantern(xx, 0.88, 0.17, 1.1); }
    k.tube([[a, 1.25, 0.13], [x, 1.05, 0.16], [b, 1.25, 0.13]], 0.04, 0.04, C.leaf, { n: 6, rs: 4 });
  }
  // tree towers
  const towers = [[-4.3, 0.46, 1.55], [-2.25, 0.4, 1.45], [2.25, 0.4, 1.45], [4.3, 0.46, 1.55]];
  for (const [tx, tr, th] of towers) {
    k.lathe([[tr * 1.5, 0], [tr * 1.1, 0.2], [tr, 0.6], [tr * 0.95, th], [tr * 1.12, th + 0.08]], tx, 0, 0.02, C.bark, 9, { top: 1.1, bot: 0.86, jit: 0.04 });
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.4; k.tube([[tx + Math.sin(a) * tr, 0.3, 0.02 + Math.cos(a) * tr], [tx + Math.sin(a) * tr * 1.5, 0.08, 0.02 + Math.cos(a) * tr * 1.5], [tx + Math.sin(a) * tr * 1.9, 0, 0.02 + Math.cos(a) * tr * 1.9]], 0.1, 0.04, C.bark, { n: 3, rs: 4 }); }
    k.platform(tx, th + 0.08, 0.02, tr * 1.25, { posts: 10, braces: [] });
    k.leafDome(tr * 1.3, 0.62, tx, th + 0.24, 0.02, { n: 8 });
    for (let i = 0; i < 4; i++) k.limb([tx + Math.sin(i * 1.57 + 0.78) * tr, th + 0.08, 0.02 + Math.cos(i * 1.57 + 0.78) * tr], [tx + Math.sin(i * 1.57 + 0.78) * tr, th + 0.28, 0.02 + Math.cos(i * 1.57 + 0.78) * tr], 0.03, 0.03, C.bark, 4);
    k.win(tx, 0.85, 0.02 + tr * 0.96, 0.12, 0.22);
    k.flag(tx, th + 0.84, 0.02, 0.3, 0.38, 0.15, C.banner, { dir: tx > 0 ? 1 : -1, phase: tx });
  }
  for (const s of [-1, 1]) k.banner(s * 3.4, 1.0, 0.32, 0.24, 0.5);
  // living gate: two great trunks arching into a leafy crown
  for (const s of [-1, 1]) {
    k.lathe([[0.36, 0], [0.26, 0.2], [0.22, 0.8], [0.2, 1.3]], s * 0.72, 0, 0.05, C.bark, 8, { top: 1.1, bot: 0.86, jit: 0.04 });
    k.tube([[s * 0.72, 1.2, 0.05], [s * 0.66, 1.65, 0.05], [s * 0.35, 1.95, 0.08], [0, 2.02, 0.1]], 0.2, 0.12, C.bark, { n: 6, rs: 6 });
    k.tube([[s * 0.72, 0.15, 0.1], [s * 1.0, 0.05, 0.3], [s * 1.2, 0.0, 0.45]], 0.12, 0.05, C.bark, { n: 3, rs: 4 });
    k.canopy(s * 0.55, 2.0, 0.0, 0.32, { c: s > 0 ? C.leafL : C.leaf, seed: 20 + s });
    k.lantern(s * 0.5, 1.48, 0.28, 1.3);
  }
  k.canopy(0, 2.15, 0.0, 0.36, { c: C.leaf, seed: 23 });
  // gold-leaf emblem in the crown
  k.disc(0.5, 0.04, 0, 1.75, 0.3, C.gold, 6, { s: [0.26, 0.42, 1], ao: false });
  k.disc(0.5, 0.04, 0, 1.75, 0.32, C.leafL, 6, { s: [0.15, 0.28, 1], ao: false });
  // gate doors (pointed wooden leaves)
  for (const s of [-1, 1]) {
    k.box(0.5, 1.05, 0.06, s * 0.26, 0, 0.12, C.woodD, { top: 1.12, bot: 0.92 });
    for (let i = 0; i < 3; i++) k.box(0.05, 1.05, 0.02, s * (0.08 + i * 0.16), 0, 0.16, C.wood, { ao: false });
    k.box(0.5, 0.05, 0.02, s * 0.26, 0.3, 0.17, C.gold, { ao: false }); k.box(0.5, 0.05, 0.02, s * 0.26, 0.75, 0.17, C.gold, { ao: false });
  }
  k.disc(0.5, 0.06, 0, 1.05, 0.12, C.woodD, 6, { s: [1.0, 0.75, 1] });
  return finish(k);
}

function market() {
  const k = makeKit(205);
  k.pad(1.0);
  // open leaf pavilion at the back
  const pz = -0.3;
  k.cyl(0.6, 0.64, 0.1, 0, 0.04, pz, C.stone2, 12);
  for (let i = 0; i < 6; i++) { const a = (i + 0.5) / 6 * TAU; k.tube([[Math.sin(a) * 0.52, 0.12, pz + Math.cos(a) * 0.52], [Math.sin(a) * 0.5, 0.5, pz + Math.cos(a) * 0.5], [Math.sin(a) * 0.55, 0.85, pz + Math.cos(a) * 0.55]], 0.045, 0.04, C.bark, { n: 3, rs: 5 }); }
  k.tor(0.55, 0.035, 0, 0.86, pz, C.barkD, TAU, { rx: Math.PI / 2, rs: 12 });
  k.leafDome(0.82, 0.55, 0, 0.84, pz, { n: 9, c: C.roof, c2: C.goldLeaf });
  k.disc(0.09, 0.03, 0, 1.6, pz, C.gold, 12, { ao: false }); // gold coin finial face
  // round counter of wares inside
  k.cyl(0.3, 0.3, 0.3, 0, 0.14, pz, C.wood, 10);
  k.basket(-0.12, 0.44, pz + 0.12, C.red); k.basket(0.14, 0.44, pz + 0.1, 0xffa030); k.basket(0, 0.44, pz - 0.15, 0xa060e0);
  k.lantern(0, 0.62, pz, 1.1);
  // two stalls with striped leaf-green / gold awnings
  const stall = (x, z, ry, c1) => k.at(x, 0, z, ry, 1, () => {
    k.box(0.56, 0.28, 0.28, 0, 0.04, 0, C.wood, { top: 1.06 });
    for (const sx of [-0.26, 0.26]) for (const sz of [-0.12, 0.12]) k.limb([sx, 0.04, sz], [sx, sz < 0 ? 0.74 : 0.6, sz], 0.022, 0.02, C.bark, 4);
    k.sheet(6, 2, (u, v) => [-0.33 + u * 0.66, 0.76 - v * 0.18 - Math.sin(u * Math.PI * 6) ** 2 * 0.03 * v, -0.16 + v * 0.4], c1, { ao: false, shade: (u) => (Math.floor(u * 6 - 0.001) % 2 ? 1.32 : 1) });
    k.basket(-0.14, 0.32, 0.02, 0xff8a3a, 0.8); k.basket(0.12, 0.32, 0.02, 0x8ad04a, 0.8);
    k.box(0.12, 0.08, 0.1, 0.02, 0.32, -0.08, 0xf2e2a0);
  });
  stall(-0.6, 0.45, 0.4, C.banner);
  stall(0.6, 0.45, -0.4, C.goldD);
  k.crate(-0.1, 0.04, 0.62, 0.8, 0.3); k.barrel(0.15, 0.04, 0.7, 0.9); k.basket(-0.32, 0.04, 0.8, C.red, 1.1);
  k.spireTree(-0.82, -0.62, 0.9); k.spireTree(0.82, -0.62, 0.8); k.flowers(0.85, 0.05, 0.7, C.gold);
  return finish(k);
}

function tavern() {
  const k = makeKit(206);
  k.pad(0.9);
  // side wing (behind left)
  k.roundHall(-0.42, -0.35, 0.28, 0.4, { roofH: 0.42, n: 7, posts: 4, door: false, wins: [[0.4, 0.5, 0.09, 0.15]], fs: 0.7, roofC: C.goldLeaf, roofC2: C.goldLeafL, roofCb: C.goldD });
  // chimney of mossy stone
  k.box(0.16, 0.95, 0.16, 0.42, 0.04, -0.4, C.stone2, { top: 1.1 });
  k.box(0.2, 0.05, 0.2, 0.42, 0.99, -0.4, C.moss, { ao: false });
  k.ball(0.07, 0.44, 1.1, -0.42, 0xf4f0e8, 0, { ao: false }); k.ball(0.05, 0.48, 1.2, -0.45, 0xf4f0e8, 0, { ao: false });
  k.roundHall(0.08, 0.05, 0.52, 0.6, { roofH: 0.66, n: 9, posts: 7, dw: 0.24, wins: [[0.65, 0.48, 0.13, 0.22], [-0.65, 0.48, 0.13, 0.22], [1.3, 0.48, 0.11, 0.2]] });
  // hanging sign with a golden mug
  k.limb([0.45, 0.62, 0.48], [0.72, 0.62, 0.62], 0.02, 0.02, C.barkD, 4);
  k.at(0.66, 0, 0.6, 0.45, 1, () => {
    k.box(0.22, 0.18, 0.025, 0, 0.36, 0, C.woodL, { ao: false });
    k.cyl(0.04, 0.04, 0.09, -0.01, 0.4, 0.02, C.gold, 8, { ao: false });
    k.tor(0.025, 0.008, 0.035, 0.445, 0.02, C.gold, TAU, { rs: 8, ts: 3, ao: false });
    k.ball(0.04, -0.01, 0.5, 0.02, C.white, 0, { s: [1.1, 0.5, 1] });
  });
  // outdoor table, benches, barrels, lanterns on a garland
  k.cyl(0.18, 0.18, 0.04, -0.5, 0.26, 0.55, C.woodL, 10); k.cyl(0.04, 0.06, 0.24, -0.5, 0.04, 0.55, C.bark, 6);
  k.box(0.32, 0.04, 0.08, -0.5, 0.15, 0.82, C.wood); k.box(0.06, 0.12, 0.06, -0.62, 0.04, 0.82, C.barkD); k.box(0.06, 0.12, 0.06, -0.38, 0.04, 0.82, C.barkD);
  k.cyl(0.03, 0.03, 0.07, -0.45, 0.3, 0.55, C.gold, 6, { ao: false });
  k.barrel(0.62, 0.04, 0.15, 1); k.barrel(0.72, 0.04, -0.12, 0.9); k.barrel(0.66, 0.29, 0.03, 0.8);
  k.tube([[-0.8, 0.9, 0.25], [-0.5, 0.72, 0.62], [-0.2, 0.86, 0.6]], 0.008, 0.008, C.barkD, { n: 5, rs: 3 });
  for (const t of [0.25, 0.5, 0.75]) { const x = -0.8 + t * 0.6, y = 0.86 - Math.sin(t * Math.PI) * 0.14, z = 0.25 + t * 0.45; k.lantern(x, y - 0.08, z, 0.8, [0xfff0a0, 0xffd080, 0xdcff9a][Math.round(t * 4) % 3]); }
  k.lampPost(-0.82, 0.25, 0.85);
  k.flowers(0.15, 0.82, 0.6); k.bush(-0.85, -0.7, 0.7);
  return finish(k);
}

function mageGuild(lvl) {
  const k = makeKit(207 + lvl);
  k.pad(0.8);
  const tiers = lvl === 1 ? [[0.42, 0.8], [0.29, 0.42]] : lvl === 2 ? [[0.45, 0.82], [0.35, 0.56], [0.26, 0.42]] : [[0.48, 0.86], [0.39, 0.66], [0.3, 0.52], [0.22, 0.42]];
  // mossy stone plinth with root buttresses
  k.cyl(0.6, 0.66, 0.16, 0, 0.04, 0, C.stone2, 8, { top: 1.08 });
  k.cyl(0.61, 0.61, 0.03, 0, 0.2, 0, C.moss, 8, { ao: false });
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + 0.6; k.tube([[Math.sin(a) * 0.36, 0.7, Math.cos(a) * 0.36], [Math.sin(a) * 0.5, 0.3, Math.cos(a) * 0.5], [Math.sin(a) * 0.68, 0.02, Math.cos(a) * 0.68]], 0.07, 0.03, C.bark, { n: 4, rs: 4 }); }
  let y = 0.2;
  tiers.forEach(([rr, hh], i) => {
    k.cyl(rr * 0.94, rr, hh, 0, y, 0, i % 2 ? C.marble : C.stone, 10, { top: 1.08, bot: 0.88 });
    k.tor(rr * 1.0, 0.025, 0, y + hh * 0.08, 0, C.gold, TAU, { rx: Math.PI / 2, rs: 10, ao: false });
    const nw = i === 0 ? 3 : 2;
    for (let w = 0; w < nw; w++) k.winCyl(0, 0, rr * 0.96, (w - (nw - 1) / 2) * 0.9, y + hh * 0.3, i === 0 ? 0.13 : 0.1, i === 0 ? 0.26 : 0.2, { c: i === 0 ? C.win : C.magic });
    if (i === 0) k.door(0, y, rr * 0.98, 0.18, 0.3);
    y += hh;
    if (i < tiers.length - 1) k.leafDome(rr * 1.26, 0.24, 0, y - 0.04, 0, { n: 8, finial: false, ext: 1.12, c: i % 2 ? C.goldLeaf : C.roof, c2: i % 2 ? C.goldLeafL : C.roofL, cb: i % 2 ? C.goldD : C.roofD });
  });
  // vine spiralling up the tower
  const vp = []; for (let i = 0; i <= 10; i++) { const t = i / 10, a = t * TAU * 1.5 + 0.8, rr = tiers[Math.min(tiers.length - 1, Math.floor(t * tiers.length))][0] + 0.03; vp.push([Math.sin(a) * rr, 0.25 + t * (y - 0.35), Math.cos(a) * rr]); }
  k.tube(vp, 0.026, 0.018, C.mossD, { n: 22, rs: 4 });
  for (let i = 1; i < 10; i += 2) k.ball(0.045, vp[i][0] * 1.08, vp[i][1], vp[i][2] * 1.08, C.leafL, 0, { ao: false });
  const last = tiers[tiers.length - 1][0];
  const top = k.leafDome(last * 1.6, 0.42 + lvl * 0.06, 0, y - 0.04, 0, { n: 8, finial: false, c: C.goldLeaf, c2: C.goldLeafL, cb: C.goldD });
  // floating crystal
  const cs = 0.14 + lvl * 0.03;
  k.crystal(0, top + 0.08, 0, cs * 1.2, C.magic);
  k.tor(0.16 + lvl * 0.03, 0.022, 0, top + 0.08 + cs * 0.85, 0, C.gold, TAU, { rx: Math.PI / 2 - 0.35, rs: 14, ao: false });
  if (lvl >= 2) for (let i = 0; i < 2 + lvl; i++) { const a = i / (2 + lvl) * TAU; k.ball(0.04, Math.sin(a) * (0.3 + lvl * 0.04), top + 0.25, Math.cos(a) * (0.3 + lvl * 0.04), i % 2 ? C.fairy : C.magic, 0, { glow: true }); }
  if (lvl === 3) {
    k.tor(0.5, 0.025, 0, top - 0.55, 0, C.gold, TAU, { rx: Math.PI / 2 + 0.2, rs: 16, ao: false });
    k.tor(0.42, 0.02, 0, top - 0.2, 0, C.goldL, TAU, { rx: Math.PI / 2 - 0.25, rs: 16, ao: false });
  }
  k.lantern(-0.5, 0.2, 0.45, 1.1); k.lantern(0.5, 0.2, 0.45, 1.1);
  if (lvl >= 2) k.banner(0, 0.2 + tiers[0][1] + tiers[1][1] * 0.95, tiers[1][0] * 0.98, 0.14, 0.32, 0);
  k.flowers(-0.68, 0.6, 0.6, 0xb58cff); k.flowers(0.7, 0.55, 0.6);
  return finish(k);
}

// ================================================================== dwellings
// d1 / u1: centaur stables
function stables(up) {
  const k = makeKit(211 + up);
  k.pad(0.9);
  const sz = -0.3, sw = up ? 1.35 : 1.25;
  k.box(sw, 0.58, 0.62, 0, 0.04, sz, C.wood, { top: 1.08, bot: 0.88 });
  k.box(sw + 0.04, 0.1, 0.66, 0, 0.04, sz, C.stone2);
  for (const x of [-sw / 2, sw / 2]) for (const z of [sz - 0.31, sz + 0.31]) k.limb([x, 0.04, z], [x, 0.66, z], 0.045, 0.04, C.bark, 5);
  k.leafGable(sw, 0.48, 0.62, 0, 0.62, sz, 0, { ridge: up ? C.gold : C.barkL });
  // three half-doors
  for (let i = -1; i <= 1; i++) {
    const x = i * 0.38;
    k.box(0.26, 0.42, 0.03, x, 0.08, sz + 0.315, 0x7a5236, { ao: false });
    k.box(0.26, 0.2, 0.04, x, 0.08, sz + 0.33, C.woodL, { ao: false });
    k.box(0.02, 0.2, 0.05, x, 0.08, sz + 0.34, C.woodD, { ao: false, rz: 0.9 });
    k.box(0.3, 0.04, 0.05, x, 0.5, sz + 0.33, C.barkD, { ao: false });
  }
  // gold horseshoe over the middle door
  k.tor(0.07, 0.018, 0, 0.75, sz + 0.34, C.gold, Math.PI * 1.3, { rz: -Math.PI * 0.15 - Math.PI, rs: 10, ts: 4, ao: false });
  // paddock fence in front
  const fp = [[-0.85, 0.15], [-0.8, 0.55], [-0.5, 0.82], [-0.1, 0.9]];
  for (const [x, z] of fp) k.limb([x, 0, z], [x, 0.3, z], 0.022, 0.02, C.bark, 4);
  for (let i = 0; i < fp.length - 1; i++) for (const h of [0.14, 0.26]) k.limb([fp[i][0], h, fp[i][1]], [fp[i + 1][0], h, fp[i + 1][1]], 0.016, 0.016, C.barkL, 4);
  // hay bales, trough, javelin rack
  k.cyl(0.11, 0.11, 0.26, 0.55, 0.15, 0.35, C.hay, 8, { rz: Math.PI / 2, top: 1.15 });
  k.cyl(0.11, 0.11, 0.26, 0.72, 0.15, 0.6, C.hay, 8, { rz: Math.PI / 2, ry: 0.6, top: 1.15 });
  k.box(0.4, 0.14, 0.16, -0.45, 0.04, 0.4, C.woodD);
  k.box(0.34, 0.02, 0.1, -0.45, 0.17, 0.4, C.water, { glow: true });
  for (let i = 0; i < 3; i++) k.limb([0.25 + i * 0.07, 0, 0.55], [0.3 + i * 0.06, 0.6, 0.48], 0.012, 0.012, C.barkL, 3, { ao: false });
  for (let i = 0; i < 3; i++) k.cone(0.02, 0.07, 0.3 + i * 0.06, 0.59, 0.48, C.steel, 4, { ao: false, rx: -0.1 });
  k.limb([0.2, 0.35, 0.53], [0.45, 0.35, 0.53], 0.015, 0.015, C.barkD, 4);
  k.lampPost(-0.9, -0.55, 0.5);
  if (!up) {
    k.tree(0.85, -0.65, 0.9); k.bush(-0.85, -0.75, 0.8);
    k.flag(0.62, 0.62 + 0.48, sz, 0.35, 0.34, 0.14, C.banner, { phase: 2 });
  } else {
    // loft tower with gold leaf dome, banners, centaur statue
    k.roundHall(0.82, -0.45, 0.26, 0.9, { roofH: 0.45, n: 7, posts: 4, door: false, roofC: C.goldLeaf, roofC2: C.goldLeafL, roofCb: C.goldD, wins: [[0, 0.75, 0.09, 0.16], [-1.0, 0.45, 0.08, 0.14]] });
    k.flag(0.82, 1.62, -0.45, 0.4, 0.38, 0.16, C.banner, { phase: 1 });
    for (const s of [-1, 1]) k.banner(s * 0.58, 0.58, sz + 0.33, 0.13, 0.3);
    k.cyl(0.2, 0.22, 0.2, -0.05, 0.04, 0.55, C.marble, 8, { top: 1.1 });
    k.tor(0.205, 0.02, -0.05, 0.24, 0.55, C.gold, TAU, { rx: Math.PI / 2, rs: 8, ao: false });
    k.horse(-0.05, 0.24, 0.55, 0.6, 0.3, C.marble, { rider: true, skin: C.marble, hair: C.gold, mane: C.goldL, rear: true });
    k.bush(-0.88, -0.78, 0.8);
  }
  return finish(k);
}

// d2 / u2: dwarf cottage and mine
function dwarfMine(up) {
  const k = makeKit(213 + up);
  k.pad(0.9, { c2: 0xe6d2a6 });
  // rocky hill at the back
  k.rock(-0.1, 0.2, -0.45, 0.78, up ? 0.85 : 0.72, 0.5, C.rock, { seed: 3 });
  k.rock(-0.55, 0.15, -0.3, 0.42, 0.5, 0.42, C.rockL, { seed: 4 });
  k.rock(0.38, 0.15, -0.55, 0.45, 0.62, 0.4, C.rock, { seed: 6 });
  k.ball(0.32, -0.15, up ? 0.92 : 0.82, -0.5, C.moss, 1, { s: [1.5, 0.45, 1.0], ao: false, top: 1.25 });
  k.ball(0.22, 0.4, 0.68, -0.6, C.mossD, 0, { s: [1.3, 0.45, 1], ao: false, top: 1.25 });
  k.tree(-0.25, -0.6, up ? 1.05 : 0.95); k.spireTree(0.35, -0.68, up ? 1.0 : 0.85);
  // mine entrance: timber frame into a warm lit tunnel
  const mz = -0.06, mx = -0.15;
  k.box(0.42, 0.5, 0.2, mx, 0.0, mz - 0.06, C.mine, { ao: false, top: 1.1 });
  k.box(0.3, 0.4, 0.02, mx, 0.04, mz + 0.045, C.emberG, { glow: true });
  for (const s of [-1, 1]) k.box(0.08, 0.56, 0.1, mx + s * 0.22, 0.0, mz + 0.06, up ? C.stone : C.bark, { top: 1.1 });
  k.box(0.6, 0.1, 0.12, mx, 0.54, mz + 0.06, up ? C.stone : C.barkL, { top: 1.1 });
  if (up) {
    // carved dwarf-hall pediment in gold over the gate
    k.cone(0.4, 0.26, mx, 0.62, mz + 0.06, C.stone, 3, { s: [1, 1, 0.25], ry: Math.PI / 6 * 0 });
    k.tor(0.17, 0.025, mx, 0.42, mz + 0.12, C.gold, Math.PI, { rs: 10, ts: 4, ao: false });
    k.disc(0.06, 0.03, mx, 0.74, mz + 0.12, C.gold, 6, { ao: false });
    for (const s of [-1, 1]) k.box(0.1, 0.05, 0.12, mx + s * 0.22, 0.56, mz + 0.07, C.gold, { ao: false });
  }
  // rails and a cart of glowing gems
  for (const s of [-1, 1]) k.box(0.02, 0.02, 0.85, mx + s * 0.08, 0.04, mz + 0.5, C.steel, { ao: false });
  for (let i = 0; i < 5; i++) k.box(0.24, 0.02, 0.04, mx, 0.03, mz + 0.15 + i * 0.17, C.barkD, { ao: false });
  k.at(mx, 0.06, mz + 0.62, 0, 1, () => {
    k.box(0.24, 0.13, 0.18, 0, 0.04, 0, C.woodD, { top: 1.1 });
    k.box(0.26, 0.025, 0.2, 0, 0.16, 0, C.goldD, { ao: false });
    for (const sx of [-0.1, 0.1]) for (const sz2 of [-0.06, 0.06]) k.disc(0.035, 0.02, sx, 0.035, sz2, C.barkD, 6, { ry: Math.PI / 2, ao: false });
    k.crystal(-0.05, 0.12, 0, 0.07, 0x7ff0a0); k.crystal(0.05, 0.12, 0.02, 0.06, C.magic, { rz: 0.4 }); k.crystal(0.0, 0.12, -0.04, 0.06, up ? C.goldL : 0xffa0e0, { rz: -0.4 });
  });
  // stout stone cottage with turf/leaf roof
  const cx = 0.48, cz = 0.25;
  k.box(0.52, 0.42, 0.5, cx, 0.04, cz, C.stone, { top: 1.08, bot: 0.86 });
  k.box(0.56, 0.08, 0.54, cx, 0.04, cz, C.stone2);
  k.leafGable(0.52, 0.32, 0.5, cx, 0.46, cz, Math.PI / 2, { wall: C.stone, lw: 0.2, ridge: up ? C.gold : C.barkL, c: up ? C.goldLeaf : C.roof, c2: up ? C.goldLeafL : C.roofL, cb: up ? C.goldD : C.roofD });
  k.door(cx - 0.08, 0.04, cz + 0.255, 0.15, 0.3);
  k.win(cx + 0.13, 0.25, cz + 0.255, 0.1, 0.14, 0, { mull: false });
  k.box(0.12, 0.4, 0.12, cx + 0.16, 0.5, cz - 0.15, C.stone2); k.ball(0.06, cx + 0.17, 0.98, cz - 0.16, 0xf4f0e8, 0, { ao: false });
  // anvil + crossed picks
  k.box(0.1, 0.1, 0.08, -0.62, 0.04, 0.35, C.stone2); k.box(0.2, 0.06, 0.1, -0.62, 0.14, 0.35, C.steel, { top: 1.2 });
  for (const s of [-1, 1]) { k.limb([-0.75 + s * 0.06, 0.02, 0.65], [-0.75 - s * 0.08, 0.38, 0.62], 0.014, 0.014, C.barkL, 4); k.box(0.16, 0.03, 0.03, -0.75 - s * 0.08, 0.36, 0.62, C.steel, { rz: s * 0.4, ao: false }); }
  k.lampPost(0.1, 0.75, 0.5);
  if (up) {
    // forge glow + stone watch tower with gold roof
    k.box(0.22, 0.2, 0.2, -0.66, 0.04, 0.05, C.stone2); k.box(0.14, 0.04, 0.12, -0.66, 0.24, 0.05, C.emberG, { glow: true });
    k.lathe([[0.22, 0], [0.2, 0.1], [0.17, 1.2], [0.2, 1.25]], 0.8, 0, -0.25, C.stone, 8, { top: 1.1, bot: 0.86 });
    k.winCyl(0.8, -0.25, 0.17, 0, 0.85, 0.08, 0.14);
    k.leafDome(0.28, 0.4, 0.8, 1.22, -0.25, { n: 7, c: C.goldLeaf, c2: C.goldLeafL, cb: C.goldD });
    k.flag(0.8, 1.84, -0.25, 0.32, 0.34, 0.14, C.banner, { phase: 2 });
  }
  return finish(k);
}

// d3 / u3: elf homestead (tree house + archery range)
function elfHome(up) {
  const k = makeKit(215 + up);
  k.pad(0.9);
  const tx = -0.12, tz = -0.38;
  const ctop = k.bigTree(tx, tz, { r: 0.17, h: up ? 1.7 : 1.45, cr: up ? 0.55 : 0.5, nb: 3, phi: 0.9, c: up ? C.leaf : C.leaf, c2: up ? C.goldLeaf : C.leafL });
  const py = 0.78;
  k.platform(tx, py, tz, 0.5, { braces: [0.8, 2.9, 5.0] });
  k.roundHall(tx + 0.12, tz + 0.12, 0.25, 0.3, { y: py, roofH: 0.34, n: 7, posts: 4, dw: 0.13, fs: 0.7, wins: [[0.9, 0.5, 0.08, 0.13], [-0.9, 0.5, 0.08, 0.13]] });
  // ladder
  for (const s of [-1, 1]) k.limb([tx + 0.32 + s * 0.08, 0, tz + 0.62], [tx + 0.3 + s * 0.08, py, tz + 0.42], 0.016, 0.016, C.barkL, 4);
  for (let i = 1; i < 6; i++) { const t = i / 6; k.limb([tx + 0.22 - t * 0.0, t * py, tz + 0.62 - t * 0.2], [tx + 0.4, t * py, tz + 0.62 - t * 0.2], 0.01, 0.01, C.barkL, 3, { ao: false }); }
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.3; k.lantern(tx + Math.sin(a) * 0.45, py - 0.2, tz + Math.cos(a) * 0.45, 0.8); }
  // archery range in front
  k.target(-0.5, 0.48, 0.25, 1.0);
  k.target(0.55, 0.15, -0.35, 0.9);
  // bow rack + quivers
  k.box(0.3, 0.04, 0.06, 0.55, 0.36, 0.7, C.barkD); for (const s of [-1, 1]) k.limb([0.55 + s * 0.14, 0, 0.7], [0.55 + s * 0.14, 0.4, 0.7], 0.018, 0.018, C.bark, 4);
  for (let i = 0; i < 2; i++) k.tor(0.13, 0.012, 0.48 + i * 0.14, 0.24, 0.73, C.goldD, Math.PI, { rz: Math.PI / 2, rs: 8, ts: 3, ao: false });
  k.cyl(0.04, 0.035, 0.22, 0.85, 0.04, 0.45, C.red, 6); for (let i = 0; i < 3; i++) k.limb([0.84 + i * 0.01, 0.2, 0.45], [0.82 + i * 0.02, 0.33, 0.43], 0.006, 0.006, C.white, 3, { ao: false });
  k.flowers(-0.85, 0.05, 0.7); k.bush(0.75, -0.7, 0.8);
  if (up) {
    // upper gold-leaf gazebo, third target, pennant
    k.platform(tx, 1.35, tz, 0.32, { posts: 8, braces: [1.5, 3.8] });
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.78; k.limb([tx + Math.sin(a) * 0.26, 1.35, tz + Math.cos(a) * 0.26], [tx + Math.sin(a) * 0.26, 1.6, tz + Math.cos(a) * 0.26], 0.02, 0.02, C.barkL, 4); }
    k.leafDome(0.4, 0.38, tx, 1.58, tz, { n: 7, c: C.goldLeaf, c2: C.goldLeafL, cb: C.goldD });
    k.lantern(tx, 1.42, tz, 1.2);
    k.target(-0.05, 0.75, 0.0, 0.85);
    k.flag(0.82, 0.04, -0.3, 1.25, 0.38, 0.16, C.banner, { phase: 2 });
    k.banner(tx + 0.12, py + 0.42, tz + 0.12 + 0.26, 0.12, 0.24, 0);
  }
  void ctop;
  return finish(k);
}

// d4 / u4: pegasus enchanted spring
function pegasusSpring(up) {
  const k = makeKit(217 + up);
  k.pad(1.0, { c2: 0xd8ecb0 });
  // cliff of mossy boulders at the back with a waterfall
  const fh = up ? 1.3 : 1.05;
  k.rock(-0.45, 0.25, -0.62, 0.5, fh * 0.55, 0.36, C.rockL, { seed: 8 });
  k.rock(0.42, 0.25, -0.62, 0.5, fh * 0.6, 0.36, C.rock, { seed: 9 });
  k.rock(0.0, fh * 0.55, -0.72, 0.38, 0.32, 0.3, C.rock, { seed: 10 });
  k.ball(0.25, -0.45, fh * 0.75, -0.62, C.moss, 1, { s: [1.5, 0.4, 1.1], ao: false, top: 1.25 });
  k.ball(0.25, 0.45, fh * 0.82, -0.62, C.mossD, 1, { s: [1.4, 0.4, 1.1], ao: false, top: 1.25 });
  k.ball(0.22, 0, fh * 0.85, -0.72, C.moss, 1, { s: [1.3, 0.45, 1.1], ao: false, top: 1.25 });
  k.sheet(3, 6, (u, v) => [(u - 0.5) * 0.24 * (1 + v * 0.3), fh * 0.8 - v * (fh * 0.8 - 0.12), -0.42 + v * 0.12 + Math.sin(v * 2.4) * 0.08], C.waterG, { glow: true, double: false, shade: (u, v) => 0.9 + 0.1 * Math.sin(u * 9 + v * 5) });
  // pool basin
  const pz = 0.12, pr = 0.62;
  k.lathe([[pr + 0.08, 0], [pr + 0.1, 0.14], [pr + 0.02, 0.16], [pr - 0.02, 0.06]], 0, 0.02, pz, up ? C.marble : C.stone2, 16, { top: 1.12 });
  if (up) k.tor(pr + 0.06, 0.025, 0, 0.18, pz, C.gold, TAU, { rx: Math.PI / 2, rs: 16, ao: false });
  k.cyl(pr, pr, 0.02, 0, 0.1, pz, C.water, 16, { top: 1.0, ao: false });
  k.tor(0.22, 0.015, 0.1, 0.125, pz + 0.1, C.waterG, TAU, { rx: Math.PI / 2, rs: 12, ts: 3, glow: true });
  k.tor(0.38, 0.012, 0.05, 0.125, pz + 0.05, C.waterG, TAU * 0.6, { rx: Math.PI / 2, rs: 12, ts: 3, glow: true });
  // rock island with the pegasus statue
  k.rock(0.0, 0.12, pz - 0.05, 0.2, 0.22, 0.18, C.rockL, { seed: 12 });
  k.cyl(0.15, 0.17, 0.18, 0, 0.2, pz - 0.05, up ? C.marble : C.stone, 8, { top: 1.1 });
  k.horse(-0.02, 0.38, pz - 0.05, up ? 0.95 : 0.85, 0.25, up ? C.silver : C.marble, { wings: true, rear: true, wingC: up ? C.goldL : C.white, mane: up ? C.goldL : C.pearl });
  // fairy sparkles and lily pads
  for (let i = 0; i < 5; i++) { const a = i * 1.3 + 0.4; k.ball(0.025, Math.sin(a) * 0.45, 0.4 + (i % 3) * 0.25, pz + Math.cos(a) * 0.35, C.fairy, 0, { glow: true }); }
  for (const [x, z] of [[-0.35, 0.35], [0.38, 0.4], [-0.42, -0.02]]) k.cyl(0.07, 0.07, 0.01, x, 0.115, pz + z, C.leafL, 7, { ao: false });
  k.flowers(-0.4, pz + 0.38, 0.28, C.pink);
  k.spireTree(-0.9, -0.3, 0.9, C.leafL); k.flowers(0.85, 0.62, 0.7); k.flowers(-0.8, 0.7, 0.6, C.gold);
  if (!up) k.tree(0.88, -0.3, 0.9);
  else {
    // rainbow arch over the spring + white marble columns with gold leaf caps
    const bands = [0xff6a5a, 0xffb84a, 0xfff06a, 0x7ce07a, 0x6ac8ff, 0xb08cff];
    bands.forEach((c, i) => k.tor(0.95 - i * 0.045, 0.024, 0, 0.12, -0.42, c, Math.PI, { rs: 16, ts: 3, ao: false, top: 1.1, bot: 1.0 }));
    for (const s of [-1, 1]) {
      k.cyl(0.07, 0.08, 1.1, s * 0.86, 0.04, -0.12, C.marble, 8, { top: 1.1 });
      k.box(0.18, 0.06, 0.18, s * 0.86, 1.14, -0.12, C.gold, { ao: false });
      k.lantern(s * 0.86, 1.2, -0.12, 1.4, C.fairy);
    }
    k.banner(-0.86, 0.95, -0.04, 0.14, 0.32, 0.2);
  }
  return finish(k);
}

// d5 / u5: dendroid arches (living tree arches)
function dendroidArches(up) {
  const k = makeKit(219 + up);
  k.pad(1.0, { c2: 0xd6e6a8 });
  const arch = (cx, cz, ry, span, h, rr, face, o = {}) => k.at(cx, 0, cz, ry, 1, () => {
    for (const s of [-1, 1]) {
      const x0 = s * span / 2;
      k.tube([[x0 + s * 0.06, 0, 0], [x0, h * 0.35, 0.02], [x0 * 0.85, h * 0.75, -0.02], [x0 * 0.45, h * 0.97, 0.0], [0, h, 0]], rr, rr * 0.55, C.bark, { n: 8, rs: 6 });
      for (const a of [-0.9, 0.9, s * 2.6]) k.tube([[x0, 0.18, 0], [x0 + Math.sin(a) * rr * 2, 0.06, Math.cos(a) * rr * 2], [x0 + Math.sin(a) * rr * 3.4, 0, Math.cos(a) * rr * 3.4]], rr * 0.5, rr * 0.15, C.bark, { n: 3, rs: 4 });
      k.canopy(s * span * 0.32, h * 1.02, 0, rr * 2.5, { c: o.gold ? C.goldLeaf : C.leaf, seed: Math.round(cx * 10 + s * 3) });
      // knot runes
      k.disc(0.5, 0.02, x0 * 0.98, h * 0.42, rr * 0.95, C.fairy, 4, { s: [0.05, 0.1, 1], glow: true });
      // hanging vines
      k.tube([[x0 * 0.5, h * 0.98, 0.02], [x0 * 0.5 + 0.02, h * 0.75, 0.04], [x0 * 0.48, h * 0.55, 0.03]], 0.012, 0.01, C.mossD, { n: 3, rs: 3 });
      k.lantern(x0 * 0.48, h * 0.48, 0.03, 0.75, C.fairy);
    }
    k.canopy(0, h * 1.12, 0, rr * 2.8, { c: o.gold ? C.goldLeafL : C.leafL, seed: Math.round(cx * 7 + 5) });
    if (face) {
      // gnarled face in the keystone knot: the dendroid watching over the gate
      k.ball(rr * 1.35, 0, h * 0.92, rr * 0.2, C.barkL, 1, { s: [1.2, 1, 0.8] });
      for (const s of [-1, 1]) {
        k.ball(rr * 0.32, s * rr * 0.45, h * 0.95, rr * 1.2, 0xffd54a, 0, { glow: true });
        k.box(rr * 0.8, rr * 0.18, rr * 0.3, s * rr * 0.45, h * 0.95 + rr * 0.35, rr * 1.15, C.barkD, { rz: s * 0.35 });
      }
      k.box(rr * 0.25, rr * 0.7, rr * 0.3, 0, h * 0.95 - rr * 0.65, rr * 1.2, C.bark);
      k.ball(rr * 0.6, 0, h * 0.95 - rr * 1.3, rr * 0.25, C.barkD, 0, { s: [1.2, 0.4, 0.6] });
    }
  });
  const H = up ? 1.95 : 1.6;
  arch(-0.62, -0.42, 0.55, 0.68, H * 0.78, 0.075, false, { gold: up });
  arch(0.62, -0.42, -0.55, 0.68, H * 0.78, 0.075, false, { gold: false });
  arch(0, -0.08, 0, 0.95, H, 0.1, true, { gold: up });
  // mossy path through the main arch
  for (let i = 0; i < 4; i++) k.cyl(0.1, 0.11, 0.03, (i % 2 ? 0.06 : -0.06), 0.04, 0.2 + i * 0.2, C.stone, 7, { ao: false, top: 1.1 });
  k.flowers(-0.75, 0.55, 0.7); k.flowers(0.78, 0.5, 0.6, C.gold); k.bush(-0.35, 0.75, 0.6, C.leafL);
  if (up) {
    // third, outer arch ring + glowing seed of life on a root plinth
    arch(0, -0.78, 0, 1.6, H * 1.25, 0.11, false, { gold: true });
    k.tube([[-0.2, 0, -0.08], [-0.05, 0.25, -0.08], [0, 0.42, -0.08]], 0.06, 0.03, C.bark, { n: 4, rs: 5 });
    k.tube([[0.2, 0, -0.08], [0.05, 0.25, -0.08], [0, 0.42, -0.08]], 0.06, 0.03, C.bark, { n: 4, rs: 5 });
    k.ball(0.11, 0, 0.52, -0.08, C.fairy, 1, { glow: true });
    k.tor(0.17, 0.018, 0, 0.52, -0.08, C.gold, TAU, { rx: 0.3, rs: 12, ao: false });
    k.flag(0.92, 0.04, 0.2, 1.3, 0.38, 0.16, C.banner, { phase: 1 });
  }
  return finish(k);
}

// d6 / u6: unicorn glade
function unicornGlade(up) {
  const k = makeKit(221 + up);
  k.pad(1.18, { c: 0x9fd060, c2: 0xb4e070 });
  // the glowing fairy ring on the ground
  k.tor(0.7, 0.03, 0, 0.06, 0.05, up ? C.goldL : C.pearl, TAU, { rx: Math.PI / 2, rs: 24, ts: 3, glow: true });
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; k.ball(0.035, Math.sin(a) * 0.7, 0.08, 0.05 + Math.cos(a) * 0.7, i % 2 ? C.pink : C.fairy, 0, { glow: true }); }
  // ring of white standing stones (taller at the back)
  const ns = 7;
  for (let i = 0; i < ns; i++) {
    const a = Math.PI + (i - (ns - 1) / 2) / (ns - 1) * Math.PI * 1.35;
    const x = Math.sin(a) * 0.98, z = 0.05 + Math.cos(a) * 0.98, h = 0.35 + 0.35 * Math.max(0, -Math.cos(a));
    k.box(0.16, h, 0.12, x, 0.02, z, C.marble, { ry: a, top: 1.12, bot: 0.86, j: 0.05 });
    k.cone(0.1, 0.12, x, h + 0.02, z, C.marble, 4, { ry: a + Math.PI / 4, ao: false });
    k.disc(0.5, 0.02, x + Math.sin(a + Math.PI) * 0.065, h * 0.6, z + Math.cos(a + Math.PI) * 0.065, up ? C.goldL : C.pearl, 6, { ry: a + Math.PI, s: [0.05, 0.12, 1], glow: true });
    if (up) k.ball(0.04, x, h + 0.16, z, C.gold, 0, { ao: false });
  }
  // silver-birch trees behind
  const birch = (x, z, s) => {
    k.tube([[x, 0, z], [x + 0.03 * s, 0.6 * s, z], [x - 0.02 * s, 1.15 * s, z]], 0.06 * s, 0.035 * s, C.marble, { n: 4, rs: 6 });
    for (const y of [0.3, 0.55, 0.85]) k.box(0.1 * s, 0.025, 0.1 * s, x + 0.01, y * s, z, 0x9a8a88, { ao: false });
    k.canopy(x, 1.2 * s, z, 0.32 * s, { c: C.silverLeaf, seed: Math.round(x * 9) });
    k.canopy(x + 0.12 * s, 1.0 * s, z + 0.05, 0.22 * s, { c: up ? C.goldLeafL : C.leafY, seed: Math.round(z * 9 + 2) });
  };
  birch(-0.7, -0.75, 1.3); birch(0.72, -0.72, 1.45); birch(0.05, -1.0, 1.65);
  // unicorn statue on a plinth in the ring
  k.cyl(0.24, 0.27, 0.22, 0, 0.04, 0.0, C.marble, 10, { top: 1.1 });
  k.tor(0.245, 0.02, 0, 0.26, 0.0, up ? C.gold : C.pearl, TAU, { rx: Math.PI / 2, rs: 10, ao: false });
  k.horse(-0.05, 0.26, 0.0, 1.0, 0.35, C.pearl, { horn: up ? C.gold : C.goldL, mane: up ? C.goldL : 0xd8c8ff, rear: up });
  k.flowers(-0.55, 0.55, 0.55, C.pink); k.flowers(0.55, 0.55, 0.55, 0xb58cff); k.flowers(0.0, 0.85, 0.5, C.white);
  for (let i = 0; i < 6; i++) { const a = i * 1.1 + 0.3; k.ball(0.025, Math.sin(a) * 0.55, 0.6 + (i % 3) * 0.3, Math.cos(a) * 0.35, C.fairy, 0, { glow: true }); }
  if (up) {
    // spiral horn obelisk behind the statue + crowned banners
    const hx = 0, hz = -0.55;
    k.cyl(0.22, 0.26, 0.15, hx, 0.04, hz, C.marble, 8, { top: 1.1 });
    k.lathe([[0.15, 0], [0.12, 0.6], [0.07, 1.4], [0.0, 2.05]], hx, 0.19, hz, C.pearl, 8, { top: 1.15, bot: 0.9 });
    const sp = []; for (let i = 0; i <= 12; i++) { const t = i / 12, a = t * TAU * 3; sp.push([hx + Math.sin(a) * (0.15 - t * 0.14), 0.19 + t * 1.95, hz + Math.cos(a) * (0.15 - t * 0.14)]); }
    k.tube(sp, 0.022, 0.008, C.gold, { n: 36, rs: 4 });
    k.ball(0.06, hx, 2.26, hz, C.pearl, 1, { glow: true });
    for (const s of [-1, 1]) k.flag(s * 1.0, 0.04, 0.45, 1.05, 0.34, 0.15, C.banner, { dir: -s, phase: s });
  }
  return finish(k);
}

// d7 / u7: dragon cliffs (rock spires)
function dragonCliffs(up) {
  const k = makeKit(223 + up);
  k.pad(1.35, { c: 0xcfc29a, c2: 0xe2d4a8 });
  const S = up ? 1.12 : 1.0;
  const spires = [[0.05, -0.55, 3.35 * S, 0.5], [-0.82, -0.25, 2.4 * S, 0.42], [0.88, -0.3, 2.65 * S, 0.42], [-0.5, 0.55, 1.3, 0.36], [0.62, 0.62, 1.0, 0.32]];
  const tops = spires.map(([x, z, h, r], i) => {
    const t = k.spire(x, z, h, r, { c: i % 2 ? C.rockL : C.rock, phi: i });
    k.ball(r * 0.55, x, t - h * 0.12, z, i % 2 ? C.moss : C.mossD, 1, { s: [1.2, 0.5, 1.2], ao: false, top: 1.25 });
    return t;
  });
  // ledges with nests and eggs
  const ledge = (x, y, z, ry, gold) => k.at(x, y, z, ry, 1, () => {
    k.box(0.42, 0.08, 0.3, 0, 0, 0.18, C.rockD, { top: 1.2 });
    k.tor(0.12, 0.04, 0, 0.1, 0.2, gold ? C.goldD : C.barkL, TAU, { rx: Math.PI / 2, rs: 8, ts: 4 });
    k.ball(0.06, -0.03, 0.14, 0.2, gold ? C.goldL : 0x9ae06a, 1, { s: [1, 1.3, 1], ao: false });
    k.ball(0.055, 0.05, 0.13, 0.22, gold ? C.gold : 0x6ad07a, 1, { s: [1, 1.3, 1], ao: false });
  });
  ledge(-0.82, 1.25 * S, -0.05, 0.4, up); ledge(0.88, 1.5 * S, -0.1, -0.4, up); ledge(0.05, 2.1 * S, -0.22, 0, up);
  // cave mouth at the foot of the main spire, warm lit
  k.box(0.6, 0.42, 0.1, 0.05, 0.0, -0.12, 0x9a6440, { ao: false });
  k.disc(0.3, 0.1, 0.05, 0.42, -0.12, 0x9a6440, 12, { ao: false });
  k.box(0.44, 0.4, 0.04, 0.05, 0.0, -0.06, C.emberG, { glow: true });
  k.disc(0.22, 0.04, 0.05, 0.4, -0.06, C.emberG, 12, { glow: true });
  for (const s of [-1, 1]) k.rock(0.05 + s * 0.34, 0.2, -0.05, 0.12, 0.26, 0.12, C.rockL, { seed: 40 + s });
  k.rock(0.05, 0.7, -0.08, 0.36, 0.1, 0.14, C.rockL, { seed: 44 });
  k.rock(-0.25, 0.08, 0.05, 0.16, 0.15, 0.14, C.rockL, { seed: 30 }); k.rock(0.35, 0.08, 0.05, 0.14, 0.12, 0.14, C.rock, { seed: 31 });
  // glowing crystal clusters
  const cc = up ? C.goldL : 0x8affa0;
  for (const [x, z, s, rz] of [[-0.95, 0.3, 0.13, 0.3], [-0.85, 0.42, 0.09, -0.3], [0.95, 0.22, 0.12, -0.3], [0.3, 0.95, 0.08, 0.2], [-0.15, 0.9, 0.1, -0.2]]) k.crystal(x, 0.02, z, s, cc, { rz });
  // gold-or-green dragon perched on the main spire, wings spread toward the camera
  const dc = up ? 0xf2b428 : 0x3cb850, dcL = up ? 0xffd04a : 0x6ad458, top = tops[0];
  k.at(0.05, top - 0.12, -0.55, 0, S, () => {
    k.ball(0.17, 0, 0.18, 0, dc, 1, { s: [0.9, 1.0, 1.25], top: 1.2, bot: 0.85 });
    k.tube([[0, 0.25, 0.12], [0.0, 0.48, 0.2], [0.0, 0.58, 0.32]], 0.09, 0.06, dc, { n: 4, rs: 6 });
    k.ball(0.08, 0, 0.6, 0.38, dc, 1, { s: [0.9, 0.75, 1.5] });
    for (const s of [-1, 1]) { k.cone(0.025, 0.14, s * 0.05, 0.65, 0.32, C.white, 4, { rx: -0.6 }); k.ball(0.02, s * 0.05, 0.63, 0.47, 0xfff06a, 0, { glow: true }); }
    k.tube([[0, 0.1, -0.18], [0.15, 0.02, -0.3], [0.3, 0.06, -0.25]], 0.07, 0.02, dc, { n: 4, rs: 5 });
  });
  // wings spread toward the camera
  k.at(0.05, top - 0.12, -0.55, 0, S, () => {
    for (const s of [-1, 1]) {
      k.sheet(5, 2, (u, v) => {
        const x = s * (0.1 + u * 0.75), y = 0.3 + Math.sin(u * 2.4) * 0.35 - v * (0.4 - u * 0.15) - (v === 1 ? Math.abs(Math.sin(u * Math.PI * 2.5)) * 0.08 : 0);
        return [x, y, -0.02 + u * 0.15];
      }, dcL, { ao: false, top: 1.1, bot: 0.9 });
      k.tube([[s * 0.1, 0.3, -0.02], [s * 0.45, 0.3 + Math.sin(0.54 * 2.4) * 0.35, 0.05], [s * 0.85, 0.3 + Math.sin(2.4) * 0.35 + 0.02, 0.13]], 0.035, 0.015, dc, { n: 5, rs: 4 });
      for (const f of [0.35, 0.6, 0.85]) k.limb([s * (0.1 + f * 0.75 * 0.55), 0.3 + Math.sin(f * 0.55 * 2.4) * 0.35, -0.02 + f * 0.08], [s * (0.1 + f * 0.75), 0.3 + Math.sin(f * 2.4) * 0.35 - (0.4 - f * 0.15), -0.02 + f * 0.15], 0.014, 0.01, dc, 3);
    }
  });
  k.tree(-0.95, 0.85, 0.85); k.spireTree(1.05, 0.75, 0.8); k.bush(0.15, 1.12, 0.7);
  if (up) {
    for (const [x, z, i] of [[-0.82, -0.25, 1], [0.88, -0.3, 2]]) k.flag(x, tops[i] - 0.1, z, 0.4, 0.42, 0.17, C.banner, { dir: x > 0 ? 1 : -1, phase: i });
    // gold veins
    for (const [x, y, z, ry] of [[-0.62, 0.8, 0.0, 0.5], [0.66, 1.0, 0.0, -0.5], [0.2, 1.5, -0.14, 0.1]]) k.disc(0.5, 0.02, x, y, z, C.goldL, 4, { ry, s: [0.06, 0.32, 1], glow: true });
  }
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
  d1: () => stables(0), u1: () => stables(1),
  d2: () => dwarfMine(0), u2: () => dwarfMine(1),
  d3: () => elfHome(0), u3: () => elfHome(1),
  d4: () => pegasusSpring(0), u4: () => pegasusSpring(1),
  d5: () => dendroidArches(0), u5: () => dendroidArches(1),
  d6: () => unicornGlade(0), u6: () => unicornGlade(1),
  d7: () => dragonCliffs(0), u7: () => dragonCliffs(1),
};
export const SYLVAN_TOWN_IDS = Object.keys(BUILDERS);
const cache = new Map();
// Returns { body, glow } for a Sylvan town building id, or null for an unknown id.
// Results are cached and shared: clone before mutating.
export function sylvanTownBuilding(id) {
  if (!BUILDERS[id]) return null;
  if (!cache.has(id)) cache.set(id, BUILDERS[id]());
  return cache.get(id);
}
