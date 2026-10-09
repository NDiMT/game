import * as THREE from 'three';
import { BONE } from './rig.js?v=1.5';

// =====================================================================
// HEX REALMS: Dungeon town-interior buildings (HoMM3 "Dungeon" style).
//   dungeonTownBuilding(id) -> { body, glow }   (cached; clone before mutating)
//   DUNGEON_TOWN_IDS
// ids: village, hall2, hall3, fort, market, tavern, mage1..mage3, d1..d7, u1..u7.
// A violet & teal crystal-lit underground city: BRIGHT lilac/violet stone,
// pointed (ogee) arches, teal/cyan crystal glows, giant mushrooms.
// Town-view units (1 unit is about a small house). Base at y = 0, front faces +Z.
// body: position, normal, color, uv (world-scaled), aBone/aPivot (rig.js; banners
// and pennants are tagged BONE.FLAG, everything else static). glow: emissive bits.
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
// deterministic 3D hash noise in [-1, 1] (shared vertices of a rock move together)
const hash3 = (x, y, z, s) => { const v = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + s * 4.137) * 43758.5453; return (v - Math.floor(v)) * 2 - 1; };

// ------------------------------------------------------------------ palette (bright lilac / violet / teal; no murk)
const C = {
  stone: 0xcdbcf0, stone2: 0xb6a2e2, trim: 0xf0e8ff, deep: 0x9474d4,
  roof: 0x8a56ea, roof2: 0x7848d8, roofL: 0x9c6cf2,
  teal: 0x2fc8be, tealD: 0x1fa49e, tealL: 0x7ae8de,
  cyan: 0x8ffcf2, vglow: 0xe6a8ff, pglow: 0xff9ae0,
  gold: 0xffc63a, goldD: 0xe0a428,
  rock: 0x8e96e2, rockL: 0xaeb6f4, rockD: 0x7c80d6,
  door: 0x7656b4, wood: 0x9a7aa8, woodD: 0x7a5c94,
  banner: 0xa84ad8, banner2: 0x2fb8b0,
  cap: 0xe85cb6, cap2: 0x36c6c0, cap3: 0x9a6af0, stem: 0xf4eadc,
  pave: 0xb9acd6, path: 0xd0c4e8,
  sclera: 0xfff6ea, iris: 0x5cf0a8, pupil: 0x4a2a6a,
  statue: 0xd2ccd8, statueD: 0xb4aec0, snake: 0x4cc890,
  bone: 0xf6ecd6, lava: 0xff8a3a, ember: 0xffd27a, red: 0xe04848, white: 0xffffff, water: 0x7ff0f0,
};

// ------------------------------------------------------------------ modelling kit
// Every add() is transformed by the current frame (k.at pushes a local frame).
function makeKit(seed) {
  const r = rand(seed);
  const B = [], G = [];
  const stack = [new THREE.Matrix4()];
  let rig = null;
  const tf = (g, o = {}) => {
    if (o.s !== undefined) { const s = o.s; Array.isArray(s) ? g.scale(s[0], s[1], s[2]) : g.scale(s, s, s); }
    if (o.rx) g.rotateX(o.rx);
    if (o.rz) g.rotateZ(o.rz);
    if (o.ry) g.rotateY(o.ry);
    return g;
  };
  const add = (g, c, o = {}) => {
    const ng = g.index ? g.toNonIndexed() : g;
    for (const a of Object.keys(ng.attributes)) if (a !== 'position') ng.deleteAttribute(a);
    ng.applyMatrix4(stack[stack.length - 1]);
    (o.glow ? G : B).push({ g: ng, c, o, rig });
    return ng;
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // pointed (ogee-ish) arch outline: base at y = 0, springing at h, apex at h + w * 0.8
  const archShape = (w, h) => {
    const s = new THREE.Shape(), W = w / 2;
    s.moveTo(-W, 0); s.lineTo(W, 0); s.lineTo(W, h);
    s.quadraticCurveTo(W, h + w * 0.48, 0, h + w * 0.8);
    s.quadraticCurveTo(-W, h + w * 0.48, -W, h);
    s.lineTo(-W, 0);
    return s;
  };
  const k = {
    r, add, B, G,
    at(x, y, z, ry, s, fn) {
      const m = new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), ry || 0), V(s || 1, s || 1, s || 1));
      stack.push(stack[stack.length - 1].clone().multiply(m)); fn(); stack.pop();
    },
    // parts added inside fn carry rig bone b with pivot p (given in the current local frame)
    bone(b, p, fn) {
      const old = rig; const pv = V(...p).applyMatrix4(stack[stack.length - 1]);
      rig = { b, p: [pv.x, pv.y, pv.z] }; fn(); rig = old;
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
    disc(rad, th, x, y, z, c, seg = 10, o = {}) { return add(tf(new THREE.CylinderGeometry(rad, rad, th, seg).rotateX(Math.PI / 2), o).translate(x, y, z), c, o); },
    // lumpy rock: a jittered icosahedron
    rock(rad, x, y, z, c, o = {}) {
      const g = new THREE.IcosahedronGeometry(rad, o.det ?? 1), P = g.attributes.position, sd = o.seed ?? (x * 7 + z * 3);
      for (let i = 0; i < P.count; i++) {
        const px = P.getX(i), py = P.getY(i), pz = P.getZ(i);
        const n = 1 + hash3(px / rad, py / rad, pz / rad, sd) * (o.amp ?? 0.22);
        P.setXYZ(i, px * n, o.flat ? Math.max(py * n, 0) : py * n, pz * n);
      }
      return add(tf(g, o).translate(x, y, z), c, { top: 1.25, bot: 0.86, j: 0.06, ...o });
    },
    // crystal: hexagonal prism with a pointed tip, base at (x, y, z), tilted by rx/rz
    crystal(x, y, z, h, rad, c, o = {}) {
      const g1 = new THREE.CylinderGeometry(rad, rad * 0.75, h * 0.62, 5, 1).translate(0, h * 0.31, 0);
      const g2 = new THREE.ConeGeometry(rad, h * 0.38, 5).translate(0, h * 0.62 + h * 0.19, 0);
      add(tf(g1, o).translate(x, y, z), c, { top: 1.25, bot: 0.8, ao: false, ...o });
      add(tf(g2, o).translate(x, y, z), c, { top: 1.45, bot: 1.05, ao: false, ...o });
    },
    // a cluster of crystals; glowing cores (glow) unless o.dull
    cluster(x, y, z, s, c = C.teal, o = {}) {
      const n = o.n || 5;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + r() * 0.6, t = i === 0 ? 0 : 0.35 + r() * 0.35;
        const h = (i === 0 ? 1 : 0.5 + r() * 0.35) * s, rad = h * 0.16;
        k.crystal(x + Math.sin(a) * 0.12 * s * (i ? 1 : 0), y, z + Math.cos(a) * 0.12 * s * (i ? 1 : 0), h, rad, c, { rx: Math.cos(a) * t, rz: -Math.sin(a) * t, glow: !o.dull && i % 2 === 0 });
      }
    },
    // giant mushroom: stem + domed cap + glowing spots
    mushroom(x, y, z, s, cap = C.cap, o = {}) {
      const lean = o.lean || 0;
      k.at(x, y, z, o.ry || 0, s, () => {
        k.lathe([[0.1, 0], [0.075, 0.2], [0.065, 0.5], [0.08, 0.6]], 0, 0, 0, C.stem, 7, { top: 1.08, bot: 0.86, rz: lean });
        const cx = Math.sin(-lean) * 0.6, cy = 0.58;
        k.lathe([[0.36, 0], [0.38, 0.05], [0.32, 0.17], [0.2, 0.26], [0, 0.3]], cx, cy, 0, cap, 10, { top: 1.3, bot: 0.78, ao: false, rz: lean * 0.6 });
        k.lathe([[0.06, 0], [0.36, 0]], cx, cy + 0.005, 0, 0xf8d8ec, 10, { rx: Math.PI, ao: false }); // gills
        if (o.spots !== false) for (let i = 0; i < 5; i++) {
          const a = i / 5 * TAU + 0.5, rr = i % 2 ? 0.25 : 0.16;
          k.ball(0.035, cx + Math.sin(a) * rr, cy + 0.29 - rr * 0.55, Math.cos(a) * rr, o.spot || C.cyan, 0, { glow: true });
        }
      });
    },
    stalag(x, z, h, rad, c = C.rock, y = 0) { k.cone(rad, h, x, y, z, c, 5, { top: 1.25, bot: 0.85, ry: x * 3 + z }); },
    // pointed-arch window facing +Z of frame ry; (x, z) on the wall face, y = sill
    win(x, y, z, w, h, ry = 0, o = {}) {
      k.at(x, y, z, ry, 1, () => {
        const fr = o.frame ?? C.trim;
        if (fr !== false) {
          const g = new THREE.ExtrudeGeometry(archShape(w + 0.07, h), { depth: 0.03, bevelEnabled: false, curveSegments: 3 });
          add(g.translate(0, -0.035, 0.0), fr, { ao: false });
          k.box(w + 0.12, 0.035, 0.07, 0, -0.05, 0.03, fr, { ao: false });
        }
        add(new THREE.ShapeGeometry(archShape(w, h), 3).translate(0, 0, 0.034), o.c || C.cyan, { glow: true });
        if (w > 0.13 && o.mull !== false) {
          k.box(0.018, h + w * 0.6, 0.012, 0, 0, 0.042, C.deep, { ao: false });
          k.box(w, 0.018, 0.012, 0, h * 0.55, 0.042, C.deep, { ao: false });
        }
      });
    },
    winCyl(cx, cz, rad, a, y, w, h, o = {}) { k.win(cx + Math.sin(a) * rad, y, cz + Math.cos(a) * rad, w, h, a, o); },
    // pointed-arch doorway (door leaf + trim + teal bands)
    door(x, y, z, w, h, ry = 0, o = {}) {
      k.at(x, y, z, ry, 1, () => {
        add(new THREE.ExtrudeGeometry(archShape(w + 0.1, h), { depth: 0.04, bevelEnabled: false, curveSegments: 3 }).translate(0, 0, 0.0), o.fr || C.trim, { ao: false });
        add(new THREE.ExtrudeGeometry(archShape(w, h), { depth: 0.04, bevelEnabled: false, curveSegments: 3 }).translate(0, 0, 0.02), o.c || C.door, { top: 1.12, bot: 0.92, ao: false });
        if (o.glowDoor) add(new THREE.ShapeGeometry(archShape(w * 0.8, h * 0.9), 3).translate(0, 0, 0.065), o.glowDoor, { glow: true });
        else for (const f of [0.3, 0.72]) k.box(w * 1.02, 0.03, 0.02, 0, h * f, 0.065, C.teal, { ao: false });
      });
    },
    // hanging banner (FLAG-tagged) with swallow tail and teal crystal emblem
    banner(x, ytop, z, w, h, ry = 0, c = C.banner, o = {}) {
      k.at(x, 0, z, ry, 1, () => {
        k.bone(BONE.FLAG, [0, ytop, 0.035], () => {
          k.sheet(2, 5, (u, v) => {
            const yy = ytop - v * h + (v === 1 ? (1 - Math.abs(u - 0.5) * 2) * h * 0.28 : 0);
            return [(u - 0.5) * w, yy, 0.03 + Math.sin(v * 3.5 + x) * 0.02 * v];
          }, c, { top: 1.12, bot: 0.86, ao: false, j: 0.02 });
          if (o.emblem !== false) {
            k.box(w * 0.3, w * 0.42, 0.02, 0, ytop - h * 0.42 - w * 0.21, 0.05, o.em || C.tealL, { rz: 0, ao: false, s: [1, 1, 1] });
            k.cone(w * 0.21, w * 0.2, 0, ytop - h * 0.42, 0.05, o.em || C.tealL, 4, { ao: false, ry: Math.PI / 4, s: [1, 1, 0.15] });
          }
          k.box(w * 0.98, 0.03, 0.02, 0, ytop - h * 0.12, 0.05, C.gold, { ao: false });
        });
        k.limb([-w * 0.62, ytop + 0.01, 0.035], [w * 0.62, ytop + 0.01, 0.035], 0.018, 0.018, C.goldD, 5, { ao: false });
      });
    },
    // pole with a waving pennant (FLAG-tagged); a teal crystal finial
    flag(x, y, z, hp, len, hgt, c = C.banner, o = {}) {
      k.limb([x, y, z], [x, y + hp, z], 0.025, 0.02, o.pole ?? C.goldD, 5);
      k.crystal(x, y + hp - 0.01, z, 0.14, 0.035, C.cyan, { glow: true });
      const dir = o.dir ?? 1, ph = o.phase ?? 0;
      k.bone(BONE.FLAG, [x, y + hp - 0.05, z], () => k.sheet(6, 3, (u, v) => {
        const taper = 1 - u * 0.5;
        const along = u * len - Math.max(0, 1 - Math.abs(v - 0.5) * 4) * 0.3 * len * smooth(0.55, 1, u);
        return [x + dir * along, y + hp - 0.05 - hgt / 2 + (v - 0.5) * hgt * taper - u * u * hgt * 0.2, z + Math.sin(u * 9 + ph) * 0.05 * u];
      }, c, { shade: (u) => 0.92 + 0.18 * Math.cos(u * 9 + ph), ao: false, j: 0.02 }));
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
    // pointed "fang" merlons around a w x d rectangle top at height y
    crenels(w, d, y, x, z, c, o = {}) {
      const m = o.m || 0.13, hgt = o.h || 0.2, step = o.step || 0.27;
      const sides = o.sides || 'nsew';
      const run = (len, f) => { const n = Math.max(2, Math.round(len / step)); for (let i = 0; i < n; i++) f(((i + 0.5) / n - 0.5) * len); };
      const fang = (px, pz) => { k.box(m, hgt * 0.45, m, px, y, pz, c, { top: 1.1 }); k.cone(m * 0.72, hgt * 0.6, px, y + hgt * 0.45, pz, c, 4, { ry: Math.PI / 4, top: 1.25, ao: false }); };
      const th = m;
      if (sides.includes('s')) run(w, (t) => fang(x + t, z + d / 2 - th / 2));
      if (sides.includes('n')) run(w, (t) => fang(x + t, z - d / 2 + th / 2));
      if (sides.includes('e')) run(d, (t) => fang(x + w / 2 - th / 2, z + t));
      if (sides.includes('w')) run(d, (t) => fang(x - w / 2 + th / 2, z + t));
    },
    crenelRing(rad, y, x, z, c, n = 8, o = {}) {
      const m = o.m || 0.12, hgt = o.h || 0.2;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU, px = x + Math.sin(a) * rad, pz = z + Math.cos(a) * rad;
        k.box(m, hgt * 0.45, m, px, y, pz, c, { ry: a, top: 1.1 });
        k.cone(m * 0.72, hgt * 0.6, px, y + hgt * 0.45, pz, c, 4, { ry: a + Math.PI / 4, top: 1.25, ao: false });
      }
    },
    // slender spire: lathe shaft, teal band, flared crown, tall pointed roof, crystal finial
    spire(x, z, o) {
      const { r: rr, h } = o, y = o.y || 0, seg = o.seg || 8, c = o.c || C.stone;
      k.lathe([[rr * 1.16, 0], [rr * 1.1, Math.min(0.22, h * 0.12)], [rr, Math.min(0.3, h * 0.16)], [rr * 0.94, h]], x, y, z, c, seg, { top: 1.08, bot: 0.86, phi: Math.PI / seg });
      k.tor(rr * 0.98, 0.03, x, y + h * 0.5, z, C.teal, TAU, { rx: Math.PI / 2, rs: seg, ao: false });
      let top = y + h;
      if (o.crown !== false) {
        k.lathe([[rr * 0.94, 0], [rr * 1.22, 0.12], [rr * 1.22, 0.2], [rr * 1.1, 0.2]], x, top, z, C.trim, seg, { top: 1.1, bot: 0.84, ao: false, phi: Math.PI / seg });
        top += 0.2;
      }
      if (o.cren) { k.crenelRing(rr * 1.1, top, x, z, c, o.cren); }
      if (o.roofH) {
        const rad = rr * (o.roofR || 1.3), rh = o.roofH;
        // concave, needle-like roof
        k.lathe([[rad, 0], [rad * 0.62, rh * 0.18], [rad * 0.32, rh * 0.5], [rad * 0.1, rh * 0.85], [0, rh]], x, top - 0.02, z, o.roofC || C.roof, seg, { top: 1.35, bot: 0.8, ao: false, phi: Math.PI / seg });
        k.tor(rad * 0.82, 0.022, x, top + rh * 0.06, z, C.gold, TAU, { rx: Math.PI / 2, rs: seg, ao: false });
        top += rh - 0.02;
        if (o.finial !== false) k.crystal(x, top - 0.04, z, 0.26, 0.05, o.finC || C.cyan, { glow: true });
        top += 0.2;
      }
      if (o.flag) k.flag(x, top, z, o.flagH ?? 0.45, 0.5 * (o.flagH ?? 0.45) / 0.45, 0.2, o.flag === true ? C.banner : o.flag, { dir: o.flagDir ?? 1, phase: x });
      for (const [a, f, ww, wh] of (o.wins || [[0, 0.55, 0.1, 0.2]])) k.winCyl(x, z, rr * 0.97, a, y + h * f, ww, wh, { mull: false, c: o.winC });
      return top;
    },
    block(w, h, d, x, y, z, c = C.stone, o = {}) {
      k.box(w, h, d, x, y, z, c, { top: 1.06, bot: 0.86, ...o });
      k.box(w + 0.06, 0.12, d + 0.06, x, y, z, C.stone2, { top: 1.0, bot: 0.86 });
      if (o.cornice !== false) k.box(w + 0.08, 0.07, d + 0.08, x, y + h - 0.05, z, C.trim, { ao: false });
      if (o.band !== false) k.box(w + 0.02, 0.04, d + 0.02, x, y + h * 0.55, z, C.teal, { ao: false });
      if (o.cren) k.crenels(w + 0.06, d + 0.06, y + h, x, z, c, o.cren === true ? {} : o.cren);
    },
    // a paved lilac pad with a few glowing floor crystals at the corners
    pad(w, d, c = C.pave, o = {}) {
      k.box(w, 0.04, d, o.x || 0, 0, o.z || 0, c, { top: 1.0, bot: 0.9, j: 0.04, ao: false });
      k.box(w - 0.12, 0.012, d - 0.12, o.x || 0, 0.04, o.z || 0, C.path, { j: 0.08, ao: false });
    },
    // pointed roof (4-sided pyramid, tall)
    hip(w, h, d, x, y, z, c, o = {}) {
      const g = new THREE.ConeGeometry(1, h, 4, 1).rotateY(Math.PI / 4).translate(0, h / 2, 0).scale(w / 2 / Math.SQRT1_2, 1, d / 2 / Math.SQRT1_2);
      return add(tf(g, o).translate(x, y, z), c, { top: 1.3, bot: 0.84, ao: false, ...o });
    },
    // steep gable roof, ridge along local x
    gable(w, h, d, x, y, z, roofC, wallC, ry = 0, ov = 0.06) {
      const W = w / 2, D = d / 2 + ov, Wo = W + ov;
      const sl = [-Wo, 0, D, Wo, 0, D, Wo, h, 0, -Wo, 0, D, Wo, h, 0, -Wo, h, 0,
        Wo, 0, -D, -Wo, 0, -D, -Wo, h, 0, Wo, 0, -D, -Wo, h, 0, Wo, h, 0,
        Wo, 0, D, -Wo, 0, D, Wo, h, 0, -Wo, 0, D, -Wo, h, 0, Wo, h, 0,
        -Wo, 0, -D, Wo, 0, -D, -Wo, h, 0, Wo, 0, -D, Wo, h, 0, -Wo, h, 0];
      const ge = [W, 0, d / 2, W, 0, -d / 2, W, h * (d / 2) / D, 0, -W, 0, -d / 2, -W, 0, d / 2, -W, h * (d / 2) / D, 0];
      const g1 = new THREE.BufferGeometry(); g1.setAttribute('position', new THREE.Float32BufferAttribute(sl, 3));
      const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(ge, 3));
      add(g1.rotateY(ry).translate(x, y, z), roofC, { top: 1.22, bot: 0.86, ao: false });
      add(g2.rotateY(ry).translate(x, y, z), wallC, { top: 1.04, bot: 0.95 });
      k.box(w + ov * 2.2, h * 0.07, h * 0.09, x, y + h * 0.97, z, C.teal, { ry, ao: false });
    },
    brazier(x, y, z, s = 1, fire = C.cyan) {
      k.lathe([[0.03 * s, 0], [0.05 * s, 0.03 * s], [0.025 * s, 0.25 * s], [0.1 * s, 0.32 * s], [0.12 * s, 0.38 * s]], x, y, z, C.goldD, 6, { ao: false });
      k.cone(0.09 * s, 0.2 * s, x, y + 0.34 * s, z, fire, 5, { glow: true });
      k.cone(0.05 * s, 0.14 * s, x + 0.02 * s, y + 0.44 * s, z, C.white, 4, { glow: true });
    },
    statue(x, y, z, s, c = C.statue, o = {}) {
      k.at(x, y, z, o.ry || 0, s, () => {
        k.box(0.32, 0.12, 0.32, 0, 0, 0, C.stone2, { top: 1.05 });
        k.lathe([[0.15, 0], [0.12, 0.3], [0.08, 0.56], [0.1, 0.64], [0.0, 0.66]], 0, 0.12, 0, c, 7, { ao: false });
        k.ball(0.075, 0, 0.86, 0, c, 1, { ao: false });
        if (o.arms) for (const sx of [-1, 1]) k.limb([sx * 0.09, 0.66, 0], [sx * 0.2, 0.86 + (o.arms === 'up' ? 0.12 : -0.15), 0.08], 0.03, 0.025, c, 5, { ao: false });
      });
    },
  };
  return k;
}

// ------------------------------------------------------------------ bake: vertex colours with soft coloured AO + rig attributes
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
          // soft, cool-violet contact shade near the ground, never black
          const s = smooth(0.0, 0.45, y);
          tmpC.r *= 0.82 + 0.18 * s; tmpC.g *= 0.84 + 0.16 * s; tmpC.b *= 0.96 + 0.04 * s;
        }
        col[o * 3] = Math.min(1, tmpC.r); col[o * 3 + 1] = Math.min(1, tmpC.g); col[o * 3 + 2] = Math.min(1, tmpC.b);
        if (uvs) {
          const ax = Math.abs(fn.x), ay = Math.abs(fn.y), az = Math.abs(fn.z);
          if (ay >= ax && ay >= az) { uvs[o * 2] = x; uvs[o * 2 + 1] = z; } else if (ax >= az) { uvs[o * 2] = z; uvs[o * 2 + 1] = y; } else { uvs[o * 2] = x; uvs[o * 2 + 1] = y; }
        }
        if (p.rig) { bone[o] = p.rig.b; piv[o * 3] = p.rig.p[0]; piv[o * 3 + 1] = p.rig.p[1]; piv[o * 3 + 2] = p.rig.p[2]; }
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
// village / hall2 / hall3: the warlock's hall, growing from a crystal-lit grotto hall to a spired citadel
function village() {
  const k = makeKit(301);
  k.pad(2.2, 2.2);
  // rock outcrop behind, into which the hall is carved
  k.rock(0.62, -0.45, 0, -0.72, C.rock, { s: [1.1, 1.5, 0.7], flat: true });
  k.rock(0.5, 0.5, 0, -0.78, C.rockD, { s: [1.1, 1.4, 0.7], flat: true });
  // main hall
  k.block(1.2, 0.85, 0.8, 0, 0.04, -0.15, C.stone);
  k.gable(1.2, 0.7, 0.8, 0, 0.89, -0.15, C.roof, C.stone);
  k.door(0, 0.04, 0.25, 0.26, 0.3);
  for (const s of [-1, 1]) k.win(s * 0.38, 0.4, 0.25, 0.12, 0.18);
  k.win(0, 1.08, 0.25, 0.12, 0.14, 0, { c: C.vglow, mull: false });
  // slim spire at the side
  k.spire(0.72, -0.2, { r: 0.22, h: 1.35, roofH: 0.85, flag: true, flagH: 0.35, wins: [[0, 0.62, 0.08, 0.18]] });
  // mushroom hut (left front)
  k.cyl(0.26, 0.3, 0.38, -0.72, 0.04, 0.48, C.stem, 8, { top: 1.04, bot: 0.86 });
  k.lathe([[0.42, 0], [0.43, 0.06], [0.34, 0.2], [0.18, 0.3], [0, 0.33]], -0.72, 0.4, 0.48, C.cap, 10, { top: 1.3, bot: 0.8, ao: false });
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + 0.3, rr = i % 2 ? 0.28 : 0.18; k.ball(0.04, -0.72 + Math.sin(a) * rr, 0.72 - rr * 0.55, 0.48 + Math.cos(a) * rr, C.cyan, 0, { glow: true }); }
  k.door(-0.72, 0.04, 0.76, 0.14, 0.15, 0, { c: C.woodD });
  // crystals + small mushrooms
  k.cluster(0.75, 0.04, 0.6, 0.55, C.teal);
  k.cluster(-0.95, 0.04, -0.2, 0.4, C.cap3);
  k.mushroom(0.35, 0.04, 0.8, 0.45, C.cap2);
  k.banner(-0.3, 0.8, 0.26, 0.16, 0.36);
  return finish(k);
}

function townHall(grand) {
  const k = makeKit(grand ? 303 : 302);
  k.pad(2.4, 2.4);
  for (let i = 0; i < 3; i++) k.box(1.0 - i * 0.1, 0.08, 0.2, 0, 0.04 + i * 0.08, 1.05 - i * 0.12, C.stone2, { ao: false });
  const bw = grand ? 1.9 : 1.7, bh = grand ? 1.15 : 1.0, bd = 1.15, bz = -0.25;
  k.block(bw, bh, bd, 0, 0.04, bz, C.stone, { cren: { step: 0.24, m: 0.12, h: 0.22 } });
  const fz = bz + bd / 2;
  for (const x of [-0.65, -0.38, 0.38, 0.65].map((v) => v * bw / 1.7)) k.win(x, 0.42, fz, 0.13, 0.3);
  for (const s of [-1, 1]) k.win(s * bw / 2, 0.42, bz, 0.13, 0.3, s * Math.PI / 2);
  // pointed portal with a gable hood
  k.box(0.7, 0.95, 0.3, 0, 0.28, fz + 0.12, C.stone2, { top: 1.08 });
  k.gable(0.3, 0.38, 0.78, 0, 1.23, fz + 0.12, C.roofL, C.stone2, Math.PI / 2, 0.04);
  k.door(0, 0.28, fz + 0.27, 0.32, 0.42, 0, { glowDoor: grand ? C.cyan : null });
  k.disc(0.07, 0.03, 0, 1.3, fz + 0.27, C.cyan, 6, { glow: true });
  if (!grand) {
    // single great central spire
    k.spire(0, bz - 0.1, { r: 0.36, h: 1.25, y: 0.6, roofH: 0.95, wins: [[0, 0.62, 0.11, 0.24], [1.1, 0.62, 0.09, 0.2], [-1.1, 0.62, 0.09, 0.2]] });
    for (const s of [-1, 1]) {
      k.banner(s * 0.55, 0.98, fz + 0.01, 0.18, 0.46);
      k.cluster(s * 0.95, 0.04, 0.9, 0.5, s < 0 ? C.teal : C.cap3);
    }
    k.mushroom(-0.95, 0.04, -0.95, 0.55, C.cap);
  } else {
    // central spire + twin side spires (citadel), crystal crown floating over the top
    k.spire(0, bz - 0.1, { r: 0.4, h: 1.7, y: 0.6, roofH: 1.0, roofC: C.roof, wins: [[0, 0.62, 0.12, 0.26], [1.1, 0.62, 0.1, 0.22], [-1.1, 0.62, 0.1, 0.22]] });
    for (const s of [-1, 1]) {
      k.spire(s * (bw / 2 - 0.12), fz - 0.12, { r: 0.24, h: 1.6, roofH: 0.85, flag: C.banner2, flagH: 0.35, flagDir: s, wins: [[0, 0.75, 0.08, 0.2], [s * 1.3, 0.5, 0.08, 0.18]] });
      k.banner(s * 0.48, 1.05, fz + 0.01, 0.18, 0.5);
      k.cluster(s * 1.0, 0.04, 0.95, 0.6, C.teal);
      k.brazier(s * 0.6, 0.04, 1.05, 1.1);
    }
    // floating crystal crown
    const cy = 3.3;
    k.tor(0.28, 0.025, 0, cy - 0.08, bz - 0.1, C.gold, TAU, { rx: Math.PI / 2, rs: 14, ao: false });
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; k.crystal(Math.sin(a) * 0.28, cy - 0.08, bz - 0.1 + Math.cos(a) * 0.28, 0.2, 0.035, C.cyan, { glow: true }); }
  }
  return finish(k);
}

function fort() {
  const k = makeKit(304);
  const wh = 1.25, th = 0.55;
  const segs = [[-4.2, -2.3], [-2.0, -0.75], [0.75, 2.0], [2.3, 4.2]];
  // jagged rock spine behind the wall (cavern rim)
  for (let i = 0; i < 9; i++) k.rock(0.55 + (i % 3) * 0.12, -4 + i, 0, -0.42, i % 2 ? C.rock : C.rockD, { s: [1.2, 1.9, 0.55], seed: i, flat: true });
  for (const [a, b] of segs) {
    const w = b - a, x = (a + b) / 2;
    k.box(w, wh, th, x, 0, 0, C.stone, { top: 1.06, bot: 0.86 });
    k.box(w + 0.02, 0.15, th + 0.1, x, 0, 0, C.stone2);
    k.box(w + 0.02, 0.06, th + 0.08, x, wh - 0.06, 0, C.trim, { ao: false });
    k.box(w + 0.02, 0.05, 0.02, x, wh * 0.45, th / 2 + 0.005, C.teal, { ao: false });
    k.crenels(w, th + 0.06, wh, x, 0, C.stone, { sides: 'sn', step: 0.3, m: 0.15, h: 0.26 });
    const n = Math.round(w / 0.6);
    for (let i = 0; i < n; i++) {
      const xx = a + (i + 0.5) * w / n;
      k.win(xx, 0.62, th / 2 + 0.002, 0.06, 0.16, 0, { frame: false, mull: false });
      k.box(0.16, 0.48, 0.12, xx + w / n / 2 - 0.02, 0, th / 2 + 0.05, C.stone2, { top: 1.0 });
    }
  }
  for (const s of [-1, 1]) {
    k.spire(s * 4.2, 0.05, { r: 0.42, h: 1.4, roofH: 0.85, flag: true, flagH: 0.32, flagDir: s, wins: [[0, 0.6, 0.1, 0.22], [s * 1.1, 0.6, 0.09, 0.2]] });
    k.spire(s * 2.15, 0.05, { r: 0.36, h: 1.36, roofH: 0.8, roofC: C.roof2, wins: [[0, 0.58, 0.1, 0.2]] });
    k.banner(s * 3.2, 1.08, th / 2 + 0.01, 0.26, 0.55);
    k.banner(s * 1.4, 1.08, th / 2 + 0.01, 0.2, 0.45, 0, C.banner2, { em: C.vglow });
    k.cluster(s * 3.2, 0.0, 0.55, 0.5, C.teal, { n: 4 });
  }
  // gatehouse with a tall pointed gate and a glowing teal ward
  k.block(1.5, 1.55, 0.85, 0, 0, 0.05, C.stone);
  k.crenels(1.56, 0.91, 1.55, 0, 0.05, C.stone, { step: 0.26, m: 0.15, h: 0.28 });
  const gz = 0.05 + 0.425;
  k.door(0, 0.0, gz - 0.02, 0.62, 0.62, 0, { c: C.door, glowDoor: 0x6ff0e6 });
  for (let i = -2; i <= 2; i++) k.box(0.025, 0.85 - Math.abs(i) * 0.06, 0.02, i * 0.11, 0.06, gz + 0.06, C.gold, { ao: false });
  k.crystal(0, 1.2, gz + 0.02, 0.28, 0.07, C.cyan, { glow: true, rx: 0.15 });
  for (const s of [-1, 1]) {
    k.spire(s * 0.82, 0.35, { r: 0.28, h: 1.55, roofH: 0.75, flag: C.banner2, flagH: 0.3, flagDir: s, wins: [[0, 0.62, 0.09, 0.18], [s * 1.2, 0.4, 0.08, 0.16]] });
  }
  return finish(k);
}

function market() {
  const k = makeKit(305);
  k.pad(2.0, 2.0);
  const hz = -0.45;
  // arcaded trade hall
  k.block(1.6, 0.8, 0.75, 0, 0.04, hz, C.stone, { cornice: true, band: false });
  for (let i = 0; i < 4; i++) k.door(-0.57 + i * 0.38, 0.04, hz + 0.375, 0.22, 0.3, 0, { c: i % 2 ? C.teal : C.cap3 });
  k.gable(1.6, 0.62, 0.75, 0, 0.84, hz, C.roof, C.stone);
  k.win(0, 0.92, hz + 0.375, 0.14, 0.12, 0, { c: C.ember, mull: false });
  // mushroom-cap stalls (giant mushrooms as awnings)
  const stall = (x, z, cap, wares) => {
    k.box(0.5, 0.28, 0.3, x, 0.04, z, C.wood, { top: 1.08 });
    k.box(0.52, 0.03, 0.32, x, 0.32, z, C.woodD);
    k.mushroom(x, 0.04, z - 0.05, 0.95, cap, { spots: true });
    for (let i = 0; i < 3; i++) k.ball(0.05, x - 0.14 + i * 0.14, 0.38, z + 0.06, wares[i % wares.length], 0);
  };
  stall(-0.55, 0.42, C.cap2, [0xffb04a, 0xff6a8a]);
  stall(0.55, 0.42, C.cap, [0x9affd8, 0xffe07a]);
  // crystal cart in front
  k.box(0.46, 0.14, 0.3, 0, 0.14, 0.78, C.wood, { top: 1.1 });
  for (const s of [-1, 1]) k.disc(0.1, 0.04, s * 0.25, 0.12, 0.78, C.woodD, 8, { ry: Math.PI / 2 });
  k.cluster(0, 0.28, 0.78, 0.38, C.teal, { n: 4 });
  k.limb([0.23, 0.2, 0.78], [0.6, 0.1, 0.9], 0.02, 0.02, C.woodD, 4);
  // sacks and gem chests
  k.box(0.24, 0.16, 0.18, 0.85, 0.04, -0.05, C.cap3, { top: 1.15 });
  k.box(0.26, 0.04, 0.2, 0.85, 0.2, -0.05, C.gold, { ao: false });
  for (const [x, z] of [[-0.85, -0.05], [-0.88, 0.18]]) k.ball(0.1, x, 0.13, z, 0xe8d8f0, 1, { s: [1, 1.1, 1] });
  return finish(k);
}

function tavern() {
  // a giant mushroom inn with lit round windows
  const k = makeKit(306);
  k.pad(1.8, 1.8);
  const z0 = -0.12;
  // stem-house
  k.lathe([[0.55, 0], [0.5, 0.2], [0.44, 0.7], [0.46, 1.0], [0.55, 1.12]], 0, 0.04, z0, C.stem, 12, { top: 1.06, bot: 0.84 });
  // cap
  k.lathe([[0.98, 0], [1.0, 0.08], [0.88, 0.32], [0.6, 0.55], [0.25, 0.7], [0, 0.73]], 0, 1.1, z0, C.cap, 14, { top: 1.3, bot: 0.8, ao: false });
  k.lathe([[0.5, 0], [0.98, 0]], 0, 1.105, z0, 0xf8d4ec, 14, { rx: Math.PI, ao: false });
  for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + 0.2, rr = i % 3 === 0 ? 0.35 : 0.68; k.ball(0.07, Math.sin(a) * rr, 1.1 + (rr > 0.5 ? 0.33 : 0.6), z0 + Math.cos(a) * rr, C.cyan, 0, { glow: true, s: [1, 0.5, 1] }); }
  // little chimney poking through the cap
  k.cyl(0.07, 0.08, 0.4, 0.35, 1.45, z0 - 0.2, C.stone2, 6);
  k.cone(0.12, 0.1, 0.35, 1.85, z0 - 0.2, C.roof, 6);
  // windows & door
  const fz = z0 + 0.48;
  k.door(0, 0.04, fz - 0.02, 0.26, 0.3, 0, { c: C.woodD });
  for (const s of [-1, 1]) { k.disc(0.08, 0.03, s * 0.3, 0.72, z0 + 0.43, C.trim, 10, { ry: s * -0.6, ao: false }); k.disc(0.06, 0.03, s * 0.31, 0.72, z0 + 0.445, C.ember, 10, { ry: s * -0.6, glow: true }); }
  k.disc(0.07, 0.03, 0, 0.86, z0 + 0.47, C.trim, 10, { ao: false }); k.disc(0.055, 0.03, 0, 0.86, z0 + 0.485, C.ember, 10, { glow: true });
  // porch awning and sign with a tankard
  k.limb([0.45, 0.62, fz - 0.04], [0.45, 0.62, fz + 0.32], 0.018, 0.018, C.woodD, 4);
  k.box(0.03, 0.24, 0.24, 0.45, 0.33, fz + 0.28, C.banner2, { ao: false });
  k.cyl(0.05, 0.05, 0.1, 0.465, 0.4, fz + 0.28, C.gold, 8, { ao: false });
  // lanterns
  for (const x of [-0.22, 0.22]) k.crystal(x, 0.42, fz + 0.02, 0.12, 0.035, C.cyan, { glow: true });
  // tables with tiny mushroom stools, barrels
  k.cyl(0.14, 0.05, 0.22, -0.6, 0.04, 0.62, C.wood, 8);
  for (const a of [0, 2.1, 4.2]) k.mushroom(-0.6 + Math.sin(a) * 0.24, 0.04, 0.62 + Math.cos(a) * 0.24, 0.22, C.cap2, { spots: false });
  for (const [x, z, s] of [[0.66, 0.58, 1], [0.78, 0.36, 0.85]]) { k.lathe([[0.1 * s, 0], [0.125 * s, 0.13 * s], [0.1 * s, 0.26 * s]], x, 0.04, z, C.wood, 8); k.tor(0.118 * s, 0.01, x, 0.04 + 0.13 * s, z, C.teal, TAU, { rx: Math.PI / 2, rs: 8, ts: 3 }); }
  k.mushroom(-0.7, 0.04, -0.6, 0.6, C.cap3);
  k.cluster(0.7, 0.04, -0.62, 0.35, C.teal, { n: 3 });
  return finish(k);
}

function mageGuild(lvl) {
  // a stacked crystal spire; each level adds a tier and more floating crystals
  const k = makeKit(306 + lvl);
  k.pad(1.6, 1.6);
  k.block(1.15, 0.22, 1.15, 0, 0.04, 0, C.stone2, { cornice: false, band: false });
  for (let i = 0; i < 3; i++) k.box(0.5 - i * 0.04, 0.07, 0.14, 0, 0.04 + i * 0.07, 0.66 - i * 0.1, C.stone2, { ao: false });
  let y = 0.26, rr = 0.44;
  const hs = [1.0, 0.62, 0.62];
  for (let t = 0; t < lvl; t++) {
    const h = hs[t];
    k.lathe([[rr * 1.08, 0], [rr, 0.1], [rr * 0.9, h]], 0, y, 0, t % 2 ? C.stone2 : C.stone, 6, { top: 1.08, bot: 0.88, phi: Math.PI / 6 });
    const n = t === 0 ? 3 : 3;
    for (let i = 0; i < n; i++) {
      const a = (i - 1) * 1.0 + (t % 2) * Math.PI / 3 * 0;
      k.winCyl(0, 0, rr * 0.88, a, y + h * 0.28, t === 0 ? 0.12 : 0.1, h * 0.38, { c: t % 2 ? C.vglow : C.cyan, mull: false });
    }
    if (t === 0) k.door(0, y, rr * 0.92, 0.2, 0.26);
    y += h;
    k.lathe([[rr * 0.9, 0], [rr * 1.18, 0.1], [rr * 1.18, 0.15], [rr * 0.82, 0.15]], 0, y, 0, C.trim, 6, { ao: false, phi: Math.PI / 6 });
    // crystal buttresses at the corners of each tier
    for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + Math.PI / 3 + t; k.crystal(Math.sin(a) * rr * 1.1, y + 0.08, Math.cos(a) * rr * 1.1, 0.3, 0.05, i % 2 ? C.teal : C.cap3, { rx: Math.cos(a) * 0.35, rz: -Math.sin(a) * 0.35, glow: i === 0 }); }
    y += 0.15;
    rr *= 0.8;
  }
  // pointed roof
  const rh = lvl === 1 ? 0.85 : 0.8, rad = rr / 0.8 * 1.25;
  k.lathe([[rad, 0], [rad * 0.6, rh * 0.2], [rad * 0.3, rh * 0.55], [0, rh]], 0, y - 0.04, 0, C.roof, 6, { top: 1.35, bot: 0.82, ao: false, phi: Math.PI / 6 });
  k.tor(rad * 0.8, 0.02, 0, y + rh * 0.06, 0, C.gold, TAU, { rx: Math.PI / 2, rs: 6, ao: false, ry: Math.PI / 6 });
  y += rh - 0.04;
  // floating crystal heart
  const orb = 0.1 + lvl * 0.03, oy = y + 0.12 + orb * 1.6;
  k.cone(orb * 0.9, orb * 1.6, 0, oy, 0, C.cyan, 6, { glow: true });
  k.cone(orb * 0.9, orb * 1.1, 0, oy, 0, 0x5ee8e0, 6, { glow: true, rx: Math.PI });
  if (lvl >= 2) k.tor(orb * 1.9, 0.014, 0, oy, 0, C.gold, TAU, { rx: Math.PI / 2 - 0.4, ao: false, rs: 14 });
  if (lvl >= 3) {
    k.tor(orb * 1.9, 0.014, 0, oy, 0, C.gold, TAU, { rx: 0.5, ry: 0.8, ao: false, rs: 14 });
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.4; k.crystal(Math.sin(a) * 0.62, 2.4 + (i % 2) * 0.45, Math.cos(a) * 0.62, 0.2, 0.05, i % 2 ? C.cyan : C.vglow, { glow: true }); }
  }
  for (const s of [-1, 1]) { const a = s * 0.55; k.banner(Math.sin(a) * 0.42, 1.08, Math.cos(a) * 0.42, 0.13, 0.36, a, C.banner); }
  k.mushroom(0.62, 0.04, 0.55, 0.32, C.cap2);
  return finish(k);
}

// ================================================================== dwellings
// d1/u1: troglodyte warren / infernal warren - a rock mound full of burrow holes
function warren(up) {
  const k = makeKit(310 + up);
  k.pad(1.8, 1.8);
  const mz = -0.2;
  k.rock(0.74, 0, 0.0, mz, C.rock, { s: [1.05, 1.45 + up * 0.1, 0.85], flat: true, seed: 3 });
  k.rock(0.42, -0.5, 0.0, mz + 0.2, C.rockL, { s: [1, 1.4, 0.9], flat: true, seed: 5 });
  k.rock(0.38, 0.52, 0.0, mz + 0.15, C.rockD, { s: [1, 1.5, 0.9], flat: true, seed: 7 });
  // burrow holes: dark-violet mouth (not black) with a teal inner glow
  const hole = (x, y, z, s, ry = 0) => k.at(x, y, z, ry, s, () => {
    k.disc(0.16, 0.06, 0, 0.12, 0, 0x5a3c8a, 10, { s: [1, 1.15, 1], ao: false });
    k.disc(0.08, 0.02, 0, 0.11, 0.035, C.tealL, 8, { glow: true });
    k.tor(0.17, 0.05, 0, 0.12, 0.005, C.rockL, TAU, { rs: 10, s: [1, 1.12, 1] });
  });
  hole(0, 0.13, mz + 0.6, 1.4);
  hole(-0.45, 0.32, mz + 0.48, 0.8, -0.4);
  hole(0.42, 0.5, mz + 0.45, 0.75, 0.35);
  hole(0.02, 0.85, mz + 0.38, 0.6, 0);
  k.rock(0.3, 0.1, 0.85, mz - 0.1, C.rockL, { s: [1, 1.6, 1], seed: 9 });
  k.stalag(0.1, mz - 0.1, 1.05, 0.14, C.rockL, 0.9);
  // wooden entrance frame (troglodytes like a solid doorpost)
  k.limb([-0.22, 0.04, mz + 0.72], [-0.2, 0.52, mz + 0.72], 0.03, 0.03, C.woodD, 4);
  k.limb([0.22, 0.04, mz + 0.72], [0.2, 0.52, mz + 0.72], 0.03, 0.03, C.woodD, 4);
  k.limb([-0.28, 0.5, mz + 0.72], [0.28, 0.5, mz + 0.72], 0.03, 0.03, C.woodD, 4);
  // stalagmites, mushrooms, crystals
  for (const [x, z, h] of [[-0.8, 0.55, 0.45], [-0.65, 0.75, 0.3], [0.82, 0.62, 0.38], [0.85, -0.6, 0.5]]) k.stalag(x, z, h, 0.09);
  k.mushroom(-0.25, 0.04, 0.75, 0.35, C.cap);
  k.mushroom(0.45, 0.04, 0.72, 0.28, C.cap2);
  k.cluster(-0.7, 0.04, -0.6, 0.45, C.teal);
  // spear rack (troglodyte spears)
  for (let i = 0; i < 3; i++) { const x = 0.65 + i * 0.07; k.limb([x, 0.04, 0.3], [x - 0.05, 0.62, 0.22], 0.012, 0.012, C.woodD, 3); k.cone(0.025, 0.09, x - 0.05, 0.62, 0.22, C.trim, 4); }
  if (up) {
    // fortified with a carved pointed facade and fire braziers
    k.box(0.72, 0.62, 0.12, 0, 0.04, mz + 0.66, C.stone, { top: 1.08 });
    k.crenels(0.72, 0.12, 0.66, 0, mz + 0.66, C.stone, { sides: 's', step: 0.18, m: 0.1 });
    k.door(0, 0.04, mz + 0.72, 0.3, 0.3, 0, { c: 0x6a4a9a, glowDoor: C.lava });
    for (const s of [-1, 1]) k.brazier(s * 0.48, 0.04, mz + 0.85, 1.0, C.lava);
    k.spire(-0.55, mz - 0.25, { r: 0.18, h: 1.2, roofH: 0.6, flag: true, flagH: 0.3, flagDir: -1, wins: [[0.3, 0.6, 0.07, 0.15]] });
  } else {
    k.flag(-0.35, 0.6, mz + 0.3, 0.55, 0.35, 0.16, C.banner);
  }
  return finish(k);
}

// d2/u2: harpy loft / hag roost - a jagged crag pillar with nests and perches
function nest(k, x, y, z, s) {
  k.tor(0.28 * s, 0.09 * s, x, y + 0.08 * s, z, 0xb08a6a, TAU, { rx: Math.PI / 2, rs: 9, ts: 4, j: 0.15 });
  k.cyl(0.28 * s, 0.2 * s, 0.1 * s, x, y, z, 0x8e6e5a, 8, { j: 0.1 });
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; k.limb([x + Math.sin(a) * 0.28 * s, y + 0.1 * s, z + Math.cos(a) * 0.28 * s], [x + Math.sin(a + 0.7) * 0.4 * s, y + 0.2 * s, z + Math.cos(a + 0.7) * 0.4 * s], 0.012 * s, 0.008 * s, 0xa07a5a, 3, { ao: false }); }
  for (const [dx, dz] of [[-0.06, 0.02], [0.07, -0.03]]) k.ball(0.065 * s, x + dx * s, y + 0.14 * s, z + dz * s, C.tealL, 1, { s: [1, 1.3, 1], ao: false });
}
function harpyLoft(up) {
  const k = makeKit(320 + up);
  k.pad(1.8, 1.8);
  const tz = -0.2, H = up ? 2.15 : 1.82;
  // the crag: stacked jittered rocks narrowing upward
  const tiers = [[0.5, 0.0], [0.42, 0.55], [0.34, 1.05], [0.3, 1.45]];
  if (up) tiers.push([0.26, 1.8]);
  tiers.forEach(([rr, y], i) => k.rock(rr, (i % 2 ? 0.05 : -0.05), y + rr * 0.4, tz, i % 2 ? C.rockL : C.rock, { s: [1, 1.1, 0.95], flat: i === 0, seed: 20 + i }));
  // carved lilac masonry loft wrapped around the crag
  k.cyl(0.4, 0.44, 0.5, 0, 0.04, tz + 0.12, C.stone, 8, { top: 1.06, bot: 0.86 });
  k.tor(0.42, 0.03, 0, 0.42, tz + 0.12, C.teal, TAU, { rx: Math.PI / 2, rs: 8, ao: false });
  k.door(0, 0.04, tz + 0.53, 0.2, 0.22);
  // roost platforms with nests
  const plat = (x, y, z, s, ry) => {
    k.box(0.5 * s, 0.06, 0.4 * s, x, y - 0.06, z, C.wood, { ry, top: 1.1 });
    k.limb([x * 0.4, y - 0.4, z], [x, y - 0.06, z], 0.025, 0.025, C.woodD, 4);
    nest(k, x, y, z, 0.7 * s);
  };
  plat(0.48, 0.95, tz + 0.05, 1, 0.3);
  plat(-0.46, 1.3, tz - 0.02, 0.9, -0.3);
  nest(k, 0, H - 0.04, tz, up ? 1.0 : 0.9);
  // dangling feather totems / chimes
  for (const [x, z] of [[0.4, tz + 0.35], [-0.38, tz + 0.3]]) { k.limb([x, 0.9, z], [x, 0.62, z], 0.006, 0.006, C.woodD, 3); k.cone(0.04, 0.16, x, 0.48, z, C.cap, 4, { glow: false }); k.ball(0.03, x, 0.64, z, C.cyan, 0, { glow: true }); }
  // feather-shaped banners
  k.banner(0, 0.88, tz + 0.41, 0.16, 0.36);
  k.mushroom(0.62, 0.04, 0.58, 0.35, C.cap3);
  k.stalag(-0.7, 0.62, 0.45, 0.1); k.stalag(-0.55, 0.78, 0.28, 0.07);
  if (up) {
    // second spike with a rope bridge and a pointed roost-hut on top
    k.rock(0.3, 0.68, 0, -0.5, C.rockD, { s: [1, 3.6, 1], seed: 41, flat: true });
    nest(k, 0.68, 1.12, -0.5, 0.6);
    k.sheet(6, 1, (u, v) => [0.1 + u * 0.55, 1.5 - Math.sin(u * Math.PI) * 0.12 - u * 0.36, tz - 0.05 - u * 0.25 + v * 0.1], C.wood, { ao: false });
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; k.limb([Math.sin(a) * 0.3, H + 0.1, tz + Math.cos(a) * 0.3], [0, H + 0.55, tz], 0.015, 0.012, C.woodD, 3); }
    k.cone(0.4, 0.42, 0, H + 0.38, tz, C.roof, 6, { top: 1.3, bot: 0.85, ao: false });
    k.flag(0, H + 0.76, tz, 0.35, 0.4, 0.16, C.banner2);
    k.cluster(-0.65, 0.04, -0.6, 0.5, C.teal);
  } else {
    k.flag(0.05, H + 0.12, tz - 0.05, 0.4, 0.4, 0.16, C.banner);
  }
  return finish(k);
}

// d3/u3: beholder pillar of eyes / evil-eye spire - a column studded with glowing eyes
function eye(k, x, y, z, s, ry = 0, o = {}) {
  k.at(x, y, z, ry, s, () => {
    k.tor(0.13, 0.035, 0, 0, 0.0, o.lid || C.cap3, TAU, { rs: 10, ts: 4, ao: false });
    k.ball(0.125, 0, 0, -0.02, C.sclera, 1, { s: [1, 1, 0.6], ao: false, glow: true });
    k.disc(0.065, 0.02, 0, 0, 0.055, o.iris || C.iris, 10, { glow: true });
    k.disc(0.03, 0.02, 0, 0, 0.068, C.pupil, 8, { ao: false });
  });
}
function eyePillar(up) {
  const k = makeKit(330 + up);
  k.pad(1.8, 1.8);
  const tz = -0.15, H = up ? 1.75 : 1.5, rr = 0.36;
  // stepped plinth
  k.cyl(0.62, 0.66, 0.14, 0, 0.04, tz, C.stone2, 8, { top: 1.05 });
  k.cyl(0.5, 0.54, 0.12, 0, 0.18, tz, C.stone, 8, { top: 1.05 });
  // bulging column
  k.lathe([[rr * 1.1, 0], [rr * 1.15, H * 0.3], [rr * 1.0, H * 0.7], [rr * 1.1, H]], 0, 0.3, tz, C.deep, 8, { top: 1.2, bot: 0.92, phi: Math.PI / 8 });
  for (const f of [0.15, 0.5, 0.85]) k.tor(rr * 1.1, 0.03, 0, 0.3 + H * f, tz, C.teal, TAU, { rx: Math.PI / 2, rs: 8, ao: false });
  // eyes around the column
  const eyes = [[0, 0.32, 1.0], [0.9, 0.62, 0.8], [-0.9, 0.62, 0.8], [0.45, 1.0, 0.75], [-0.5, 1.15, 0.7], [1.6, 0.35, 0.7], [-1.6, 0.35, 0.7]];
  for (const [a, f, s] of eyes) eye(k, Math.sin(a) * rr * 1.1, 0.3 + H * f, tz + Math.cos(a) * rr * 1.1, s, a);
  k.door(0, 0.18, tz + 0.53, 0.2, 0.08, 0, { c: C.door });
  // the great eye on top, ringed by eyestalks
  const ty = 0.3 + H + 0.32, er = up ? 0.38 : 0.32;
  k.ball(er, 0, ty, tz, 0xb56ee0, 1, { top: 1.25, bot: 0.85, ao: false });
  k.at(0, ty, tz + er * 0.62, 0, 1, () => {
    k.ball(er * 0.55, 0, 0, 0, C.sclera, 1, { s: [1, 1, 0.55], glow: true });
    k.disc(er * 0.32, 0.02, 0, 0, er * 0.28, C.iris, 12, { glow: true });
    k.disc(er * 0.14, 0.02, 0, 0, er * 0.3, C.pupil, 8, { ao: false });
  });
  k.box(er * 1.3, 0.06, 0.12, 0, ty + er * 0.42, tz + er * 0.62, 0x9a52c8, { rx: -0.3, ao: false }); // brow
  const ns = up ? 7 : 5;
  for (let i = 0; i < ns; i++) {
    const a = (i / (ns - 1) - 0.5) * 2.6, bx = Math.sin(a) * er * 0.7, bz = tz + Math.cos(a) * er * 0.3 - 0.1;
    const tx = Math.sin(a) * (er + 0.3), tyy = ty + er + 0.12 + (i % 2) * 0.1, tzz = tz - 0.05 + Math.cos(a) * 0.1;
    k.limb([bx, ty + er * 0.7, bz], [tx, tyy, tzz], 0.03, 0.02, 0xb56ee0, 4, { ao: false });
    k.ball(0.065, tx, tyy + 0.04, tzz, C.sclera, 1, { glow: true });
    k.ball(0.03, tx + Math.sin(a) * 0.02, tyy + 0.05, tzz + 0.05, C.iris, 0, { glow: true });
  }
  k.cluster(-0.65, 0.04, 0.55, 0.45, C.teal);
  k.mushroom(0.65, 0.04, 0.6, 0.32, C.cap);
  if (up) {
    // floating rune ring + flanking obelisks with single eyes
    k.tor(0.6, 0.03, 0, ty, tz, C.gold, TAU, { rx: Math.PI / 2 - 0.3, rs: 18, ao: false });
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; k.box(0.06, 0.06, 0.06, Math.sin(a) * 0.6, ty + Math.cos(a) * 0.6 * Math.sin(0.3) * -1, tz + Math.cos(a) * 0.6 * Math.cos(0.3), C.cyan, { glow: true, ry: a }); }
    for (const s of [-1, 1]) {
      k.box(0.2, 1.0, 0.2, s * 0.72, 0.04, tz - 0.25, C.stone, { top: 1.1 });
      k.cone(0.14, 0.32, s * 0.72, 1.04, tz - 0.25, C.roof, 4, { ry: Math.PI / 4, top: 1.3, ao: false });
      eye(k, s * 0.72, 0.75, tz - 0.14, 0.55, 0, { lid: C.stone2 });
      k.banner(s * 0.72, 0.55, tz - 0.14, 0.14, 0.3, 0, C.banner);
    }
  } else {
    k.flag(0.62, 0.04, tz - 0.35, 1.0, 0.4, 0.17, C.banner);
  }
  return finish(k);
}

// d4/u4: medusa chapel of stilled voices / medusa queen's temple
function medusaChapel(up) {
  const k = makeKit(340 + up);
  k.pad(2.0, 2.0);
  const nw = up ? 0.95 : 0.85, nl = up ? 1.25 : 1.1, nh = up ? 1.05 : 0.9, nx = 0, nz = -0.3;
  k.block(nw, nh, nl, nx, 0.04, nz, C.stone);
  k.gable(nl, 0.75, nw, nx, 0.04 + nh, nz, C.roof, C.stone, Math.PI / 2);
  const fz = nz + nl / 2;
  for (const z of [-0.3, 0.15]) for (const s of [-1, 1]) {
    k.box(0.12, nh * 0.85, 0.1, nx + s * (nw / 2 + 0.04), 0.04, nz + z + 0.22, C.stone2, { top: 1.0 });
    k.win(nx + s * nw / 2, 0.36, nz + z, 0.1, 0.3, s * Math.PI / 2, { c: 0x8ff8c8, mull: false });
  }
  // serpent rose window
  // great medusa mask in the gable: face, glowing eyes, a crown of snakes
  const my = nh + 0.24, mzf = fz + 0.04;
  k.disc(0.24, 0.04, nx, my, fz + 0.01, C.trim, 12, { ao: false });
  k.ball(0.13, nx, my - 0.01, mzf + 0.02, 0x7ad8a8, 1, { s: [1, 1.15, 0.5], ao: false, top: 1.2 });
  for (const s2 of [-1, 1]) k.ball(0.028, nx + s2 * 0.05, my + 0.02, mzf + 0.075, C.ember, 0, { glow: true });
  for (let i = 0; i < 7; i++) {
    const a = (i / 6 - 0.5) * 2.6, bx = nx + Math.sin(a) * 0.12, by = my + Math.cos(a) * 0.12;
    const ex = nx + Math.sin(a * 1.15) * 0.28, ey = my + Math.cos(a * 1.15) * 0.26;
    k.limb([bx, by, mzf + 0.03], [ex, ey, mzf + 0.06], 0.025, 0.016, C.snake, 4, { ao: false });
    k.ball(0.03, ex, ey, mzf + 0.07, 0x3aa878, 0, { ao: false });
  }
  k.door(nx, 0.04, fz, 0.3, 0.42, 0, { c: 0x4c9a7a });
  // serpent columns flanking the door
  for (const s of [-1, 1]) {
    const cx = nx + s * 0.3;
    k.cyl(0.05, 0.06, 0.7, cx, 0.04, fz + 0.08, C.trim, 6);
    for (let i = 0; i < 6; i++) { const a = i * 1.3 * s; k.ball(0.045, cx + Math.sin(a) * 0.06, 0.1 + i * 0.11, fz + 0.08 + Math.cos(a) * 0.06, C.snake, 0, { ao: false }); }
    k.ball(0.06, cx, 0.8, fz + 0.12, C.snake, 1, { s: [1, 0.8, 1.4], ao: false });
    k.ball(0.015, cx + 0.025, 0.82, fz + 0.18, C.ember, 0, { glow: true });
  }
  // the stilled: petrified figures in the courtyard (pale grey with lilac shade)
  const figs = up ? [[-0.72, 0.55, 0.3, 'up'], [0.72, 0.55, -0.4, true], [-0.55, 0.85, -0.2, true], [0.5, 0.88, 0.5, 'up'], [-0.8, -0.2, 0.6, true]] : [[-0.68, 0.55, 0.3, 'up'], [0.7, 0.6, -0.4, true], [0.45, 0.88, 0.5, false]];
  for (const [x, z, ry, arms] of figs) k.statue(x, 0.04, z, 0.6, C.statue, { ry, arms });
  // snake-head gargoyle finials on the roof
  k.at(nx, 0.04 + nh + 0.72, fz - 0.05, 0, 1, () => { k.ball(0.07, 0, 0.05, 0, C.snake, 1, { s: [1, 0.8, 1.3], ao: false }); k.crystal(0, 0.1, 0, 0.18, 0.04, C.cyan, { glow: true }); });
  k.banner(nx - 0.28, 0.82, fz + 0.01, 0.13, 0.34, 0, C.banner2, { em: C.vglow });
  k.banner(nx + 0.28, 0.82, fz + 0.01, 0.13, 0.34, 0, C.banner2, { em: C.vglow });
  if (up) {
    // bell-tower spire for the queen + reflecting pool
    k.spire(nx - 0.62, nz - 0.4, { r: 0.22, h: 1.5, roofH: 0.85, flag: true, flagH: 0.32, flagDir: -1, roofC: C.tealD, wins: [[0, 0.62, 0.08, 0.2], [0.9, 0.62, 0.08, 0.2]], winC: 0x8ff8c8 });
    k.cyl(0.3, 0.32, 0.08, 0.68, 0.04, -0.6, C.stone2, 10);
    k.cyl(0.26, 0.26, 0.01, 0.68, 0.12, -0.6, C.water, 10, { glow: true });
    k.cluster(0.68, 0.12, -0.6, 0.35, C.teal, { n: 3 });
  } else {
    k.mushroom(0.75, 0.04, -0.6, 0.45, C.cap2);
    k.cluster(-0.72, 0.04, -0.62, 0.42, C.teal);
  }
  return finish(k);
}

// d5/u5: minotaur labyrinth / minotaur king's maze - low maze walls around a horned gate
function labyrinth(up) {
  const k = makeKit(350 + up);
  k.pad(2.0, 2.0);
  const wh = up ? 0.42 : 0.36, wt = 0.12, c = C.stone2;
  const W = (x0, z0, x1, z1) => {
    const w = Math.abs(x1 - x0) + wt, d = Math.abs(z1 - z0) + wt;
    k.box(w, wh, d, (x0 + x1) / 2, 0.04, (z0 + z1) / 2, c, { top: 1.1, bot: 0.86 });
    k.box(w + 0.02, 0.04, d + 0.02, (x0 + x1) / 2, 0.04 + wh - 0.04, (z0 + z1) / 2, C.trim, { ao: false });
  };
  // concentric square maze with offset openings
  W(-0.85, 0.85, -0.2, 0.85); W(0.2, 0.85, 0.85, 0.85); W(-0.85, -0.85, 0.85, -0.85); W(-0.85, -0.85, -0.85, 0.85); W(0.85, -0.85, 0.85, 0.85);
  W(-0.6, 0.6, 0.35, 0.6); W(-0.6, -0.6, -0.6, 0.6); W(0.6, -0.6, 0.6, 0.25); W(-0.2, -0.6, 0.6, -0.6);
  W(-0.35, 0.35, -0.35, -0.1); W(0.35, 0.35, 0.35, -0.35);
  // central horned gate: a squat pointed hall with great bull horns
  const gz = -0.15, gh = up ? 1.05 : 0.9;
  k.block(0.58, gh, 0.5, 0, 0.04, gz, C.stone, { cornice: true });
  k.hip(0.66, 0.5, 0.58, 0, 0.04 + gh, gz, C.roof);
  k.door(0, 0.04, gz + 0.25, 0.26, 0.32, 0, { glowDoor: up ? C.ember : null, c: 0x8a5a4a });
  // the bull skull with huge horns over the door
  const sy = gh - 0.1, sz = gz + 0.28;
  k.box(0.2, 0.2, 0.08, 0, sy - 0.1, sz, C.bone, { ao: false });
  k.box(0.12, 0.1, 0.1, 0, sy - 0.2, sz + 0.02, C.bone, { ao: false });
  for (const s of [-1, 1]) {
    k.ball(0.022, s * 0.05, sy - 0.03, sz + 0.045, C.lava, 0, { glow: true });
    const hc = up ? C.gold : C.bone, L = up ? 1.25 : 1;
    k.limb([s * 0.08, sy, sz], [s * 0.3 * L, sy + 0.08 * L, sz + 0.02], 0.05, 0.04, hc, 6, { ao: false });
    k.limb([s * 0.3 * L, sy + 0.08 * L, sz + 0.02], [s * 0.42 * L, sy + 0.3 * L, sz + 0.04], 0.04, 0.025, hc, 6, { ao: false });
    k.cone(0.025, 0.12 * L, s * 0.42 * L, sy + 0.3 * L, sz + 0.04, hc, 5, { rz: -s * 0.4, ao: false });
  }
  // nose ring
  k.tor(0.035, 0.008, 0, sy - 0.25, sz + 0.07, C.gold, TAU, { rs: 8, ts: 3, ao: false });
  // battle-axe monument + braziers at the maze mouth
  k.at(0.0, 0, 0.98, 0, 1, () => {
    k.limb([0, 0.04, 0], [0, 0.8, 0], 0.025, 0.025, C.woodD, 5);
    for (const s of [-1, 1]) k.sheet(3, 1, (u, v) => [s * (0.03 + u * 0.18), 0.62 + (v - 0.5) * (0.12 + u * 0.16), 0], C.trim, { ao: false });
  });
  for (const s of [-1, 1]) k.brazier(s * 0.25, 0.04, 0.98, 0.9, up ? C.lava : C.cyan);
  for (const s of [-1, 1]) k.flag(s * 0.85, 0.04 + wh, -0.85, 0.65, 0.35, 0.15, s < 0 ? C.banner : C.banner2, { dir: -s, phase: s });
  if (up) {
    for (const s of [-1, 1]) k.spire(s * 0.38, gz - 0.2, { r: 0.13, h: 1.35, roofH: 0.5, crown: false, wins: [[0, 0.7, 0.05, 0.12]] });
    k.cluster(0.62, 0.04, 0.35, 0.3, C.teal, { n: 3 });
  }
  k.cluster(-0.62, 0.04, -0.35, 0.3, C.teal, { n: 3 });
  return finish(k);
}

// d6/u6: manticore lair / scorpicore nest - a great rocky den with a stinger tail arch
function manticoreLair(up) {
  const k = makeKit(360 + up);
  k.pad(2.4, 2.4);
  const lz = -0.3;
  // rocky den mound
  k.rock(0.95, 0, 0, lz, C.rock, { s: [1.1, 1.3, 0.85], flat: true, seed: 61 });
  k.rock(0.5, -0.72, 0, lz + 0.1, C.rockL, { s: [1, 1.4, 1], flat: true, seed: 62 });
  k.rock(0.46, 0.75, 0, lz + 0.15, C.rockD, { s: [1, 1.5, 1], flat: true, seed: 63 });
  // cave mouth: a pointed masonry arch set into the rock
  const mz = lz + 0.78;
  k.box(0.95, 0.9, 0.22, 0, 0.04, mz - 0.08, C.stone, { top: 1.1 });
  k.crenels(0.95, 0.22, 0.94, 0, mz - 0.08, C.stone, { sides: 's', step: 0.2, m: 0.12, h: 0.24 });
  k.door(0, 0.04, mz + 0.03, 0.48, 0.42, 0, { c: 0x6a4aa0, glowDoor: up ? C.lava : C.ember });
  for (const s of [-1, 1]) k.win(s * 0.38, 0.5, mz + 0.03, 0.07, 0.14, 0, { frame: false, mull: false, c: C.ember });
  // the great segmented tail arching over the den, ending in a stinger
  const tc = up ? 0xe85a3a : 0xe0a060, tc2 = up ? 0xf08a4a : 0xf0bc78, n = 8, pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const th = -0.42 * Math.PI + t * 1.2 * Math.PI, R = 0.72 + t * 0.05;
    pts.push([0.2 + Math.cos(th) * R, 1.42 + Math.sin(th) * R, lz - 0.2 + t * 0.6]);
  }
  for (let i = 0; i < n; i++) {
    const t = i / n, r1 = 0.15 - t * 0.07;
    k.limb(pts[i], pts[i + 1], r1, r1 * 0.85, i % 2 ? tc : tc2, 7, { ao: false });
    k.ball(r1 * 1.08, ...pts[i], i % 2 ? tc2 : tc, 1, { ao: false });
    if (i > 0 && i % 2 === 0) k.cone(0.05, 0.2, pts[i][0], pts[i][1] + r1 * 0.8, pts[i][2], up ? C.gold : C.bone, 4, { ao: false });
  }
  const tp = pts[n];
  k.ball(0.11, ...tp, tc, 1, { ao: false, s: [1, 1.2, 1] });
  k.cone(0.07, 0.38, tp[0], tp[1] - 0.05, tp[2] + 0.02, up ? C.gold : C.bone, 5, { rz: 3.6, ao: false });
  k.ball(0.045, tp[0] + 0.15, tp[1] - 0.38, tp[2] + 0.02, up ? C.lava : C.iris, 0, { glow: true });
  // bat-wing awnings on the arch
  for (const s of [-1, 1]) k.sheet(4, 2, (u, v) => [s * (0.42 + u * 0.55), 0.95 + Math.sin(u * 2.6) * 0.32 - v * (0.4 - u * 0.22), mz - 0.12 - u * 0.2], up ? 0xd85a4a : 0xb85a8a, { ao: false, top: 1.15, bot: 0.85 });
  // bones and skulls scattered in front
  for (const [x, z, ry] of [[-0.6, 0.85, 0.4], [0.55, 0.95, -0.8], [0.15, 1.05, 1.2]]) { k.limb([x - 0.12 * Math.cos(ry), 0.07, z - 0.12 * Math.sin(ry)], [x + 0.12 * Math.cos(ry), 0.07, z + 0.12 * Math.sin(ry)], 0.025, 0.025, C.bone, 4); }
  k.ball(0.07, -0.85, 0.1, 0.7, C.bone, 1, { s: [1, 0.9, 1.1] });
  for (const [x, z, h] of [[-1.0, -0.9, 0.6], [1.0, -0.85, 0.7], [-1.0, 0.3, 0.4], [1.05, 0.45, 0.45]]) k.stalag(x, z, h, 0.11);
  k.cluster(-0.85, 0.04, 1.0, 0.45, C.teal);
  k.mushroom(0.95, 0.04, 0.95, 0.4, C.cap);
  k.flag(-0.75, 0.8, lz + 0.2, 0.55, 0.4, 0.17, C.banner);
  if (up) {
    // scorpion pincers flanking the mouth (gilded) and twin spires
    for (const s of [-1, 1]) {
      k.at(s * 0.68, 0, mz + 0.25, 0, 1, () => {
        k.limb([0, 0.04, 0], [0, 0.35, 0.05], 0.06, 0.05, tc, 5);
        k.limb([0, 0.35, 0.05], [s * 0.05, 0.58, 0.1], 0.055, 0.03, C.gold, 5, { ao: false });
        k.limb([0, 0.35, 0.05], [-s * 0.12, 0.52, 0.12], 0.045, 0.025, C.gold, 5, { ao: false });
      });
      k.spire(s * 0.75, lz - 0.55, { r: 0.18, h: 1.3, roofH: 0.65, flag: s > 0 ? C.banner2 : false, flagH: 0.3, wins: [[0, 0.6, 0.07, 0.15]] });
    }
  }
  return finish(k);
}

// d7/u7: dragon cave / red dragon's caldera - a crystal mountain with a vast glowing maw
function dragonCave(up) {
  const k = makeKit(370 + up);
  k.pad(2.8, 2.8);
  const cz = -0.35;
  // the mountain: big jittered rock heaps, lighter toward the top
  k.rock(1.15, 0, 0, cz, C.rock, { s: [1.05, 1.75, 0.82], flat: true, seed: 71, amp: 0.18 });
  k.rock(0.62, -0.72, 0, cz + 0.2, C.rockL, { s: [1, 1.5, 1], flat: true, seed: 72 });
  k.rock(0.58, 0.75, 0, cz + 0.25, C.rockD, { s: [1, 1.6, 1], flat: true, seed: 73 });
  k.rock(0.55, 0.05, 1.75, cz - 0.15, C.rockL, { s: [0.9, 1.2, 0.8], seed: 74 });
  // peak spires
  k.cone(0.32, 1.3, -0.25, 2.1, cz - 0.2, C.rockL, 5, { top: 1.3, bot: 0.9, rz: 0.12 });
  k.cone(0.24, 0.9, 0.4, 1.9, cz - 0.1, C.rock, 5, { top: 1.3, bot: 0.9, rz: -0.18 });
  // the maw: huge pointed arch opening glowing from inside, framed by teeth
  const mz = cz + 0.92, mw = up ? 0.95 : 0.9, mh = 0.55;
  k.door(0, 0.04, mz - 0.06, mw, mh, 0, { c: up ? 0x9a3a5a : 0x5e3e9a, fr: C.stone, glowDoor: up ? C.lava : 0x7ff6ea });
  k.tor(mw * 0.62, 0.08, 0, mh + 0.04, mz - 0.04, C.stone2, Math.PI, { rs: 8, ts: 4 });
  for (let i = 0; i < 7; i++) { const t = (i / 6 - 0.5); k.cone(0.05, 0.16, t * mw * 0.85, mh + 0.38 - Math.abs(t) * 0.5, mz + 0.03, C.bone, 4, { rx: Math.PI, ao: false }); }
  // dragon skull keystone with horns
  const ky = mh + 0.75;
  k.box(0.32, 0.22, 0.2, 0, ky, mz - 0.02, C.bone, { ao: false });
  k.box(0.2, 0.12, 0.2, 0, ky - 0.08, mz + 0.12, C.bone, { ao: false });
  for (const s of [-1, 1]) {
    k.ball(0.04, s * 0.08, ky + 0.1, mz + 0.09, up ? C.lava : C.cyan, 0, { glow: true });
    k.limb([s * 0.14, ky + 0.18, mz - 0.04], [s * 0.38, ky + 0.42, mz - 0.14], 0.05, 0.02, up ? C.gold : C.bone, 5, { ao: false });
  }
  // treasure spilling out of the maw
  for (let i = 0; i < 9; i++) k.ball(0.06 + (i % 3) * 0.02, (i - 4) * 0.09, 0.06, mz + 0.18 + (i % 2) * 0.1, C.gold, 0, { ao: false });
  // crystal clusters bursting from the mountain
  const cc = up ? C.cap3 : C.teal;
  k.cluster(-0.95, 0.5, cz + 0.55, 0.65, cc);
  k.cluster(0.95, 0.7, cz + 0.55, 0.55, cc);
  k.cluster(0.2, 1.55, cz + 0.45, 0.5, C.teal);
  k.cluster(-1.15, 0.04, 1.05, 0.55, C.teal);
  k.cluster(1.15, 0.04, 1.0, 0.5, C.cap3);
  for (const [x, z, h] of [[-0.6, 1.2, 0.35], [0.7, 1.25, 0.3], [1.25, -0.2, 0.6]]) k.stalag(x, z, h, 0.1);
  k.mushroom(-1.2, 0.04, -0.75, 0.55, C.cap);
  k.flag(0.4, 2.7, cz - 0.1, 0.55, 0.55, 0.22, up ? C.red : C.banner);
  if (up) {
    // red dragon: lava rivulets, a pointed citadel spire on the shoulder, crimson & gold
    for (const s of [-1, 1]) k.sheet(1, 6, (u, v) => [s * (0.55 + v * 0.25) + (u - 0.5) * 0.08, 1.4 - v * 1.32, cz + 0.62 + v * 0.38 + Math.sin(v * 5) * 0.03], C.lava, { glow: true, double: false });
    k.spire(-0.85, cz - 0.3, { r: 0.24, h: 2.1, y: 0.5, roofH: 0.9, roofC: 0xc83a4a, flag: C.red, flagH: 0.35, flagDir: -1, finC: C.ember, wins: [[0, 0.65, 0.08, 0.2], [0.9, 0.4, 0.08, 0.18]], winC: C.ember });
    for (const s of [-1, 1]) k.brazier(s * 0.8, 0.04, 1.15, 1.2, C.lava);
    k.banner(-0.62, 0.95, mz - 0.06, 0.18, 0.5, 0, C.red, { em: C.ember });
    k.banner(0.62, 0.95, mz - 0.06, 0.18, 0.5, 0, C.red, { em: C.ember });
  } else {
    k.banner(-0.62, 0.9, mz - 0.06, 0.18, 0.45, 0, C.banner);
    k.banner(0.62, 0.9, mz - 0.06, 0.18, 0.45, 0, C.banner);
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
  d1: () => warren(0), u1: () => warren(1),
  d2: () => harpyLoft(0), u2: () => harpyLoft(1),
  d3: () => eyePillar(0), u3: () => eyePillar(1),
  d4: () => medusaChapel(0), u4: () => medusaChapel(1),
  d5: () => labyrinth(0), u5: () => labyrinth(1),
  d6: () => manticoreLair(0), u6: () => manticoreLair(1),
  d7: () => dragonCave(0), u7: () => dragonCave(1),
};
export const DUNGEON_TOWN_IDS = Object.keys(BUILDERS);
const cache = new Map();
// Returns { body, glow } for a Dungeon town building id, or null for an unknown id.
// Results are cached and shared: clone before mutating.
export function dungeonTownBuilding(id) {
  if (!BUILDERS[id]) return null;
  if (!cache.has(id)) cache.set(id, BUILDERS[id]());
  return cache.get(id);
}
