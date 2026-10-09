import * as THREE from 'three';

// =====================================================================
// HEX REALMS: Inferno town-interior buildings (town view).
//   infernoTownBuilding(id) -> { body, glow }   (cached; unknown id -> null)
//   INFERNO_TOWN_IDS: every supported id
// ids: village, hall2, hall3, fort, market, tavern, mage1..mage3, d1..d7, u1..u7.
// Town-view units (1 unit ~ a small house). Base at y = 0, front faces +Z.
// body: position, normal, color, uv (world-scaled) + aBone/aPivot (rig.js:
//   banners/pennants = FLAG, brazier flames = CLOTH rising -> flicker).
// glow: lava channels, fire, windows (also rig-tagged where they move).
// Palette: warm red/orange basalt, crimson horned roofs, ivory horns, gold
// trims, glowing lava. Kept BRIGHT: dark basalt only as small accents.
// =====================================================================

const TAU = Math.PI * 2;
const BONE_FLAG = 15, BONE_CLOTH = 12;
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

// ------------------------------------------------------------------ palette (bright inferno)
const C = {
  stone: 0xd8705a, stone2: 0xc25e4a, stoneL: 0xe8876a, dark: 0x8e4250, darkL: 0xa8505a,
  trim: 0xf2ac6a, roof: 0xb8282e, roof2: 0x962234, roofL: 0xe0442e,
  gold: 0xffc23a, goldD: 0xe39a2a, horn: 0xf6e4c0, hornD: 0xd2b08a, iron: 0xa8705e,
  win: 0xffa83a, lava: 0xff5a14, lavaH: 0xffb43a, fire: 0xff8a1e, fireC: 0xffe07a, ember: 0xff6a1a,
  banner: 0xe0302a, banner2: 0xff7a1a, pave: 0xb27462, path: 0xd49a72, brim: 0xffe050,
  pink: 0xff6ab4, pinkS: 0xe8709e, plum: 0xb04a78, bone: 0xf4e6c8, wood: 0xb06a44, woodD: 0x8a4a34, white: 0xffffff,
};

// ------------------------------------------------------------------ modelling kit
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
    const M = stack[stack.length - 1];
    ng.applyMatrix4(M);
    const part = { g: ng, c, o };
    if (o.bone) { part.bone = o.bone; part.piv = new THREE.Vector3(...(o.pivot || [0, 0, 0])).applyMatrix4(M); }
    (o.glow ? G : B).push(part);
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
    cone(rad, h, x, y, z, c, seg = 6, o = {}) { return add(tf(new THREE.ConeGeometry(rad, h, seg).translate(0, h / 2, 0), o).translate(x, y, z), c, o); },
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
    // flat horizontal ellipse (lava pools); y = top
    pool(rx, rz, x, y, z, c, seg = 12, o = {}) { return add(new THREE.CylinderGeometry(1, 1, 0.02, seg).scale(rx, 1, rz).translate(x, y - 0.01, z), c, { glow: true, ...o }); },
    // gable roof, ridge along local x
    gable(w, h, d, x, y, z, roofC, wallC, ry = 0, ov = 0.06) {
      const W = w / 2, D = d / 2 + ov, Wo = W + ov;
      const sl = [-Wo, 0, D, Wo, 0, D, Wo, h, 0, -Wo, 0, D, Wo, h, 0, -Wo, h, 0,
        Wo, 0, -D, -Wo, 0, -D, -Wo, h, 0, Wo, 0, -D, -Wo, h, 0, Wo, h, 0,
        Wo, 0, D, -Wo, 0, D, Wo, h, 0, -Wo, 0, D, -Wo, h, 0, Wo, h, 0,
        -Wo, 0, -D, Wo, 0, -D, -Wo, h, 0, Wo, 0, -D, Wo, h, 0, -Wo, h, 0];
      const ge = [W, 0, d / 2, W, 0, -d / 2, W, h * (d / 2) / D, 0, -W, 0, -d / 2, -W, 0, d / 2, -W, h * (d / 2) / D, 0];
      const g1 = new THREE.BufferGeometry(); g1.setAttribute('position', new THREE.Float32BufferAttribute(sl, 3));
      const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(ge, 3));
      add(g1.rotateY(ry).translate(x, y, z), roofC, { top: 1.22, bot: 0.84, ao: false });
      add(g2.rotateY(ry).translate(x, y, z), wallC, { top: 1.04, bot: 0.95 });
      k.box(w + ov * 2.2, h * 0.07, h * 0.09, x, y + h * 0.97, z, C.goldD, { ry, ao: false });
      // ridge spikes
      const n = Math.max(2, Math.round(w / 0.3));
      for (let i = 0; i < n; i++) {
        const t = ((i + 0.5) / n - 0.5) * w;
        k.cone(0.04, 0.16, x + Math.cos(ry) * t, y + h, z - Math.sin(ry) * t, C.horn, 4, { ao: false });
      }
    },
    hip(w, h, d, x, y, z, c, o = {}) {
      const g = new THREE.ConeGeometry(1, h, 4, 1).rotateY(Math.PI / 4).translate(0, h / 2, 0).scale(w / 2 / Math.SQRT1_2, 1, d / 2 / Math.SQRT1_2);
      return add(tf(g, o).translate(x, y, z), c, { top: 1.28, bot: 0.84, ao: false, ...o });
    },
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
    // curved demon horn: from base, sweeping out along (ox, oz) then up; curl > 1 hooks the tip inward
    horn(x, y, z, ox, oz, len, rad, c = C.horn, o = {}) {
      const n = o.seg || 5, curl = o.curl ?? 1, up = o.up ?? 1;
      let prev = [x, y, z];
      for (let i = 1; i <= n; i++) {
        const t = i / n, a = t * Math.PI / 2;
        const out = len * 0.62 * Math.sin(a) - len * 0.2 * (curl - 1) * t * t * t;
        const p = [x + ox * out, y + up * len * 0.95 * (1 - Math.cos(a)) + len * 0.12 * t, z + oz * out];
        const r0 = rad * (1 - (i - 1) / n) + 0.006, r1 = rad * (1 - t) + 0.006;
        k.limb(prev, p, r0, r1, i > n - 2 ? c : (o.c2 ?? c), 5, { ao: false, top: 1.12, bot: 0.92 });
        prev = p;
      }
    },
    // pair of horns on a frame point, splaying sideways
    horns(x, y, z, len, rad, c = C.horn, o = {}) { for (const s of [-1, 1]) k.horn(x + s * (o.gap ?? 0.05), y, z, s * Math.cos(o.yaw ?? 0), s * Math.sin(o.yaw ?? 0) + (o.fwd ?? 0), len, rad, c, o); },
    // ring of outward spikes
    spikeRing(rad, y, x, z, n, h, c = C.horn, o = {}) {
      for (let i = 0; i < n; i++) { const a = (i / n) * TAU + (o.ph || 0); k.cone(o.r || 0.045, h, x + Math.sin(a) * rad, y, z + Math.cos(a) * rad, c, 4, { rx: o.tilt ?? 0.45, ry: a, ao: false }); }
    },
    // spiky merlons along a rectangle top
    spikes(w, d, y, x, z, c, o = {}) {
      const step = o.step || 0.26, h = o.h || 0.2, sides = o.sides || 'nsew';
      const run = (len, f) => { const n = Math.max(2, Math.round(len / step)); for (let i = 0; i < n; i++) f(((i + 0.5) / n - 0.5) * len); };
      const sp = (xx, zz) => { k.box(0.11, 0.07, 0.11, xx, y, zz, c, { top: 1.1 }); k.cone(0.06, h, xx, y + 0.07, zz, c, 4, { ao: false, ry: Math.PI / 4 }); };
      if (sides.includes('s')) run(w, (t) => sp(x + t, z + d / 2 - 0.05));
      if (sides.includes('n')) run(w, (t) => sp(x + t, z - d / 2 + 0.05));
      if (sides.includes('e')) run(d, (t) => sp(x + w / 2 - 0.05, z + t));
      if (sides.includes('w')) run(d, (t) => sp(x - w / 2 + 0.05, z + t));
    },
    // pointed-arch window, glowing
    win(x, y, z, w, h, ry = 0, o = {}) {
      k.at(x, 0, z, ry, 1, () => {
        const fr = o.frame ?? C.trim;
        if (fr !== false) {
          k.box(w + 0.07, h + 0.03, 0.03, 0, y - 0.03, 0.008, fr, { ao: false });
          k.cone(w / 2 + 0.05, w * 1.0 + 0.05, 0, y + h - 0.01, 0.008, fr, 4, { s: [1, 1, 0.18], ry: Math.PI / 4, ao: false });
        }
        k.box(w, h, 0.03, 0, y, 0.022, o.c || C.win, { glow: true });
        k.cone(w / 2 + 0.003, w * 0.95, 0, y + h - 0.005, 0.024, o.c || C.win, 4, { glow: true, s: [1, 1, 0.12], ry: Math.PI / 4 });
      });
    },
    winCyl(cx, cz, rad, a, y, w, h, o = {}) { k.win(cx + Math.sin(a) * rad, y, cz + Math.cos(a) * rad, w, h, a, o); },
    // banner with swallow tail + gold horned sigil; FLAG-rigged
    banner(x, ytop, z, w, h, ry = 0, c = C.banner, o = {}) {
      k.at(x, 0, z, ry, 1, () => {
        const F = { bone: BONE_FLAG, pivot: [0, ytop, 0.03] };
        k.sheet(2, 5, (u, v) => {
          const yy = ytop - v * h + (v === 1 ? (1 - Math.abs(u - 0.5) * 2) * h * 0.25 : 0);
          return [(u - 0.5) * w, yy, 0.03 + Math.sin(v * 3.5 + x) * 0.025 * v];
        }, c, { top: 1.12, bot: 0.86, ao: false, j: 0.02, ...F });
        k.limb([-w * 0.62, ytop + 0.01, 0.035], [w * 0.62, ytop + 0.01, 0.035], 0.018, 0.018, C.gold, 5, { ao: false });
        for (const s of [-1, 1]) k.cone(0.02, 0.06, s * w * 0.62, ytop + 0.01, 0.035, C.gold, 4, { rz: -s * Math.PI / 2, ao: false });
        if (o.emblem !== false) {
          const ey = ytop - h * 0.45;
          k.disc(w * 0.2, 0.02, 0, ey, 0.05, C.gold, 8, { ao: false, ...F });
          for (const s of [-1, 1]) k.cone(w * 0.07, w * 0.32, s * w * 0.13, ey + w * 0.1, 0.055, C.gold, 3, { rz: -s * 0.5, ao: false, ...F });
        }
        k.box(w * 0.98, 0.03, 0.02, 0, ytop - h * 0.12, 0.05, C.gold, { ao: false, ...F });
      });
    },
    // pole with a waving pennant; FLAG-rigged
    flag(x, y, z, hp, len, hgt, c = C.banner2, o = {}) {
      k.limb([x, y, z], [x, y + hp, z], 0.025, 0.02, o.pole ?? C.dark, 5);
      k.cone(0.035, 0.12, x, y + hp, z, C.gold, 4, { ao: false });
      const dir = o.dir ?? 1, ph = o.phase ?? 0;
      k.sheet(6, 3, (u, v) => {
        const taper = 1 - u * 0.5;
        const along = u * len - Math.max(0, 1 - Math.abs(v - 0.5) * 4) * 0.3 * len * smooth(0.55, 1, u);
        return [x + dir * along, y + hp - 0.05 - hgt / 2 + (v - 0.5) * hgt * taper - u * u * hgt * 0.2, z + Math.sin(u * 9 + ph) * 0.05 * u];
      }, c, { shade: (u) => 0.92 + 0.18 * Math.cos(u * 9 + ph), ao: false, j: 0.02, bone: BONE_FLAG, pivot: [x, y + hp - 0.05 - hgt / 2, z] });
    },
    // flame tongue (glow), flickers via CLOTH rising above its pivot
    flame(x, y, z, s = 1) {
      const F = { bone: BONE_CLOTH, pivot: [x, y, z], glow: true };
      k.cone(0.1 * s, 0.34 * s, x, y, z, C.fire, 5, F);
      k.cone(0.06 * s, 0.24 * s, x + 0.02 * s, y + 0.02 * s, z + 0.03 * s, C.fireC, 5, F);
      k.cone(0.045 * s, 0.18 * s, x - 0.06 * s, y, z - 0.02 * s, C.ember, 4, { ...F, rz: 0.4 });
    },
    // brazier on a tripod with a flame
    brazier(x, y, z, s = 1, o = {}) {
      if (o.tall !== false) {
        k.lathe([[0.1 * s, 0], [0.06 * s, 0.05 * s], [0.035 * s, 0.1 * s], [0.035 * s, 0.38 * s]], x, y, z, C.dark, 6);
        y += 0.38 * s;
      }
      k.lathe([[0.04 * s, 0], [0.16 * s, 0.05 * s], [0.19 * s, 0.13 * s], [0.17 * s, 0.13 * s]], x, y, z, C.gold, 8, { ao: false, top: 1.15 });
      k.spikeRing(0.18 * s, y + 0.1 * s, x, z, 5, 0.09 * s, C.goldD, { r: 0.02 * s, tilt: 0.6 });
      k.cyl(0.15 * s, 0.15 * s, 0.01, x, y + 0.11 * s, z, C.lavaH, 8, { glow: true });
      k.flame(x, y + 0.1 * s, z, s * (o.f || 1));
    },
    // spiky basalt tower: hex shaft, dark band, spike crown, tall crimson spire
    tower(x, z, o) {
      const { r: rr, h } = o, y = o.y || 0, seg = o.seg || 6, c = o.c || C.stone;
      const ph = Math.PI / seg;
      k.lathe([[rr * 1.22, 0], [rr * 1.12, Math.min(0.25, h * 0.12)], [rr, Math.min(0.34, h * 0.17)], [rr * 0.9, h]], x, y, z, c, seg, { top: 1.08, bot: 0.84, phi: ph });
      k.lathe([[rr * 1.24, 0], [rr * 1.24, 0.08]], x, y + 0.02, z, C.dark, seg, { phi: ph, ao: false });
      k.tor(rr * 0.97, 0.03, x, y + h * 0.55, z, C.gold, TAU, { rx: Math.PI / 2, rs: seg, ry: ph });
      let top = y + h;
      if (o.crown !== false) {
        k.lathe([[rr * 0.9, 0], [rr * 1.25, 0.16], [rr * 1.25, 0.24], [rr * 1.1, 0.24]], x, top, z, C.stone2, seg, { top: 1.1, bot: 0.8, ao: false, phi: ph });
        k.spikeRing(rr * 1.25, top + 0.2, x, z, seg, 0.2, C.horn, { ph, tilt: 0.55 });
        top += 0.24;
      }
      if (o.roofH) {
        const rad = rr * (o.roofR || 1.15);
        k.lathe([[rad, 0], [rad * 0.62, o.roofH * 0.3], [rad * 0.3, o.roofH * 0.62], [0, o.roofH]], x, top, z, o.roofC || C.roof, seg, { top: 1.32, bot: 0.8, ao: false, phi: ph });
        if (o.horns !== false) k.horns(x, top + o.roofH * 0.08, z + rad * 0.55, o.roofH * 0.45, rad * 0.18, C.horn, { gap: rad * 0.45, fwd: 0.25 });
        top += o.roofH;
        k.cone(0.03, 0.22, x, top - 0.02, z, C.gold, 4, { ao: false });
        top += 0.2;
      }
      if (o.flag) k.flag(x, top - 0.05, z, o.flagH ?? 0.45, 0.5 * (o.flagH ?? 0.45) / 0.45, 0.2, o.flag === true ? C.banner2 : o.flag, { dir: o.flagDir ?? 1, phase: x });
      for (const [a, f, ww, wh] of (o.wins || [[0, 0.62, 0.1, 0.2]])) k.winCyl(x, z, rr * 0.93, a, y + h * f, ww, wh);
      return top;
    },
    block(w, h, d, x, y, z, c = C.stone, o = {}) {
      k.box(w, h, d, x, y, z, c, { top: 1.08, bot: 0.84, ...o });
      k.box(w + 0.07, 0.13, d + 0.07, x, y, z, C.dark, { top: 1.05, bot: 0.9 });
      if (o.cornice !== false) k.box(w + 0.08, 0.07, d + 0.08, x, y + h - 0.05, z, C.trim, { ao: false });
      if (o.spikes) k.spikes(w + 0.04, d + 0.04, y + h, x, z, c, o.spikes === true ? {} : o.spikes);
    },
    // scorched pad with glowing lava cracks
    pad(w, d, o = {}) {
      k.box(w, 0.04, d, o.x || 0, 0, o.z || 0, C.pave, { top: 1.0, bot: 0.9, j: 0.05, ao: false });
      k.box(w - 0.12, 0.012, d - 0.12, o.x || 0, 0.04, o.z || 0, C.path, { j: 0.08, ao: false });
      const n = o.cracks ?? 3;
      for (let i = 0; i < n; i++) {
        const a = k.r() * TAU, cx = (k.r() - 0.5) * w * 0.7, cz = d * 0.3 + k.r() * d * 0.15;
        k.box(0.025, 0.012, 0.22 + k.r() * 0.2, cx, 0.045, cz, C.lava, { glow: true, ry: a });
      }
    },
    // fiery arched doorway (lit interior)
    door(x, y, z, w, h, ry = 0, o = {}) {
      k.at(x, 0, z, ry, 1, () => {
        k.box(w + 0.12, h + 0.04, 0.05, 0, y, 0.0, C.dark, { ao: false });
        k.cone(w / 2 + 0.08, w * 0.9 + 0.08, 0, y + h, 0.0, C.dark, 4, { s: [1, 1, 0.3], ry: Math.PI / 4, ao: false });
        k.box(w, h, 0.03, 0, y, 0.025, o.c || C.lava, { glow: !o.solid });
        k.cone(w / 2, w * 0.85, 0, y + h - 0.005, 0.026, o.c || C.lava, 4, { glow: !o.solid, s: [1, 1, 0.12], ry: Math.PI / 4 });
        if (o.bars !== false) for (let i = -1; i <= 1; i++) k.box(0.022, h + w * 0.5, 0.02, i * w * 0.3, y, 0.05, C.goldD, { ao: false });
        k.box(w * 1.02, 0.03, 0.02, 0, y + h * 0.55, 0.05, C.goldD, { ao: false });
      });
    },
    // horned demon skull ornament facing +Z of frame
    skull(x, y, z, s = 1, ry = 0, o = {}) {
      k.at(x, y, z, ry, s, () => {
        k.ball(0.12, 0, 0.1, 0, C.bone, 1, { s: [1, 0.95, 0.9], ao: false });
        k.box(0.13, 0.08, 0.1, 0, -0.02, 0.03, C.bone, { ao: false });
        for (const sx of [-1, 1]) k.ball(0.032, sx * 0.045, 0.1, 0.095, o.eye || C.lavaH, 0, { glow: true });
        k.horns(0, 0.16, 0, 0.26, 0.035, C.horn, { gap: 0.08 });
      });
    },
    // lava fall / channel (glow strip with dark rims)
    channel(x1, z1, x2, z2, w, y = 0.04) {
      const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz), a = Math.atan2(dx, dz);
      k.box(w + 0.1, 0.06, len, (x1 + x2) / 2, y - 0.02, (z1 + z2) / 2, C.dark, { ry: a, ao: false });
      k.box(w, 0.02, len - 0.02, (x1 + x2) / 2, y + 0.03, (z1 + z2) / 2, C.lava, { ry: a, glow: true });
      k.box(w * 0.35, 0.02, len - 0.06, (x1 + x2) / 2, y + 0.035, (z1 + z2) / 2, C.lavaH, { ry: a, glow: true });
    },
    rock(x, z, s = 1, c = C.dark) { k.ball(0.18 * s, x, 0.08 * s, z, c, 0, { s: [1.2, 0.8, 1], top: 1.25, bot: 0.85 }); },
    crystal(x, z, s = 1, c = C.stoneL) { for (let i = 0; i < 3; i++) k.cone(0.06 * s, (0.4 - i * 0.08) * s, x + (i - 1) * 0.07 * s, 0.02, z + (i % 2) * 0.05 * s, c, 4, { rz: (i - 1) * 0.35, ao: false, top: 1.3 }); },
  };
  return k;
}

// ------------------------------------------------------------------ bake: vertex colours, warm soft AO, rig attributes
const tmpC = new THREE.Color();
function bake(parts, r, glow, uv) {
  let n = 0, rig = false;
  for (const p of parts) { n += p.g.attributes.position.count; if (p.bone) rig = true; }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), uvs = uv ? new Float32Array(n * 2) : null;
  const bon = rig ? new Float32Array(n) : null, piv = rig ? new Float32Array(n * 3) : null;
  let o = 0;
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), fn = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (const p of parts) {
    const P = p.g.attributes.position.array, cnt = P.length / 3;
    let ymin = Infinity, ymax = -Infinity;
    for (let i = 1; i < P.length; i += 3) { ymin = Math.min(ymin, P[i]); ymax = Math.max(ymax, P[i]); }
    const span = Math.max(1e-4, ymax - ymin);
    const top = p.o.top ?? 1.05, bot = p.o.bot ?? 0.93, jit = p.o.j ?? (glow ? 0.0 : 0.035);
    const base = new THREE.Color(p.c);
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
          // warm ember-tinted contact shade near the ground, never black
          const s = smooth(0.0, 0.45, y);
          tmpC.r *= 0.86 + 0.14 * s; tmpC.g *= 0.8 + 0.2 * s; tmpC.b *= 0.84 + 0.16 * s;
        }
        col.set([Math.min(1, tmpC.r), Math.min(1, tmpC.g), Math.min(1, tmpC.b)], o * 3);
        if (uvs) {
          const ax = Math.abs(fn.x), ay = Math.abs(fn.y), az = Math.abs(fn.z);
          if (ay >= ax && ay >= az) uvs.set([x, z], o * 2); else if (ax >= az) uvs.set([z, y], o * 2); else uvs.set([x, y], o * 2);
        }
        if (rig && p.bone) { bon[o] = p.bone; piv.set([p.piv.x, p.piv.y, p.piv.z], o * 3); }
        o++;
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (uvs) g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  if (rig) { g.setAttribute('aBone', new THREE.BufferAttribute(bon, 1)); g.setAttribute('aPivot', new THREE.BufferAttribute(piv, 3)); }
  g.computeBoundingSphere(); g.computeBoundingBox();
  return g;
}
const finish = (k) => ({ body: bake(k.B, k.r, false, true), glow: k.G.length ? bake(k.G, k.r, true, false) : null });

// ================================================================== civic buildings
function village() {
  const k = makeKit(201);
  k.pad(2.2, 2.2);
  // central spiky keep
  k.tower(0, -0.35, { r: 0.42, h: 1.3, roofH: 0.8, flag: true, flagH: 0.35, wins: [[0, 0.58, 0.13, 0.22], [0.95, 0.35, 0.1, 0.16], [-0.95, 0.35, 0.1, 0.16]] });
  k.door(0, 0.04, 0.06, 0.2, 0.26);
  // basalt longhouse with horned gable (left)
  k.box(0.95, 0.62, 0.72, -0.62, 0.04, 0.38, C.stone2, { top: 1.08, bot: 0.86 });
  k.box(0.98, 0.12, 0.75, -0.62, 0.04, 0.38, C.dark);
  k.gable(0.95, 0.5, 0.72, -0.62, 0.66, 0.38, C.roof, C.stone2);
  k.horns(-1.1, 0.9, 0.6, 0.32, 0.04, C.horn, { gap: 0, yaw: 0.3 });
  k.win(-0.82, 0.36, 0.745, 0.12, 0.16);
  k.door(-0.42, 0.04, 0.745, 0.18, 0.26);
  // round hut (right) with spiked cone roof
  k.cyl(0.32, 0.36, 0.55, 0.62, 0.04, 0.45, C.stone, 7, { top: 1.08, bot: 0.86 });
  k.cone(0.44, 0.55, 0.62, 0.59, 0.45, C.roofL, 7, { top: 1.3, bot: 0.85, ao: false });
  k.cone(0.025, 0.18, 0.62, 1.12, 0.45, C.gold, 4);
  k.win(0.62, 0.26, 0.8, 0.12, 0.14);
  // back wall with spikes, lava pit with brazier
  k.box(2.0, 0.32, 0.14, 0, 0.04, -0.98, C.stone2, { top: 1.1 });
  k.spikes(2.0, 0.14, 0.36, 0, -0.98, C.stone2, { sides: 's', h: 0.18 });
  k.lathe([[0.26, 0], [0.26, 0.08], [0.2, 0.1]], 0.05, 0.04, 0.82, C.dark, 9);
  k.pool(0.21, 0.21, 0.05, 0.13, 0.82, C.lava, 9);
  k.ball(0.07, 0.05, 0.13, 0.82, C.lavaH, 0, { glow: true });
  k.brazier(-1.0, 0.04, 0.95, 0.75);
  k.rock(0.95, -0.6, 1.1); k.crystal(0.82, -0.78, 1); k.rock(-0.95, -0.55, 0.9);
  k.banner(0, 1.18, -0.35 + 0.4, 0.22, 0.42);
  return finish(k);
}

function townHall(grand) {
  const k = makeKit(grand ? 203 : 202);
  k.pad(2.4, 2.4);
  for (let i = 0; i < 3; i++) k.box(1.2 - i * 0.1, 0.08, 0.2, 0, 0.04 + i * 0.08, 1.05 - i * 0.12, C.stone2, { ao: false });
  const bw = grand ? 2.0 : 1.75, bh = grand ? 1.05 : 0.95, bd = grand ? 1.25 : 1.1, bz = -0.25;
  k.block(bw, bh, bd, 0, 0.04, bz, C.stone);
  const fz = bz + bd / 2;
  for (const x of [-0.72, -0.42, 0.42, 0.72].map((v) => v * bw / 1.75)) k.win(x, 0.4, fz, 0.14, 0.3);
  for (const x of [-0.88, -0.57, 0.57, 0.88].map((v) => v * bw / 1.75)) { k.box(0.08, bh - 0.12, 0.06, x, 0.16, fz + 0.02, C.dark); k.cone(0.05, 0.2, x, bh + 0.02, fz + 0.02, C.horn, 4, { ao: false }); }
  for (const s of [-1, 1]) for (const z of [-0.25, 0.15]) k.win(s * bw / 2, 0.42, bz + z, 0.13, 0.26, s * Math.PI / 2);
  k.hip(bw + 0.14, 0.55, bd + 0.14, 0, 0.04 + bh, bz, C.roof);
  // horned portico: two thick pillars carrying a fanged lintel
  const pw = grand ? 1.15 : 1.0, ph = grand ? 0.95 : 0.85;
  for (const s of [-1, 1]) {
    k.box(0.18, ph, 0.18, s * pw / 2, 0.28, fz + 0.3, C.stone2, { top: 1.12 });
    k.box(0.24, 0.1, 0.24, s * pw / 2, 0.28 + ph, fz + 0.3, C.gold, { ao: false });
    k.brazier(s * pw / 2, 0.38 + ph, fz + 0.3, 0.6, { tall: false });
  }
  k.box(pw + 0.1, 0.06, 0.6, 0, 0.28, fz + 0.25, C.dark);
  k.box(pw - 0.1, 0.18, 0.2, 0, 0.12 + ph, fz + 0.3, C.dark, { top: 1.2 });
  for (let i = -3; i <= 3; i++) k.cone(0.035, 0.12, i * (pw - 0.2) / 6, 0.14 + ph, fz + 0.38, C.horn, 4, { rx: Math.PI, ao: false });
  k.door(0, 0.34, fz + 0.01, 0.3, 0.42);
  k.skull(0, 0.44 + ph, fz + 0.38, 1.0);
  // lava channels flanking the stairs
  for (const s of [-1, 1]) k.channel(s * 0.78, 1.15, s * 0.78, 0.45, 0.1);
  if (!grand) {
    // central spire tower
    const tz = bz - 0.05;
    k.tower(0, tz, { r: 0.34, y: 0.9, h: 1.0, roofH: 0.85, flag: true, flagH: 0.35, wins: [[0, 0.5, 0.12, 0.26], [1.1, 0.5, 0.1, 0.2], [-1.1, 0.5, 0.1, 0.2]] });
    for (const s of [-1, 1]) k.banner(s * 0.58, 0.9, fz + 0.01, 0.2, 0.48);
    k.horns(0, 0.04 + bh + 0.3, fz - 0.05, 0.6, 0.06, C.horn, { gap: 0.55 });
  } else {
    // flanking spiky towers
    for (const s of [-1, 1]) {
      k.tower(s * (bw / 2 - 0.12), bz + bd / 2 - 0.12, { r: 0.3, h: 1.75, roofH: 0.85, flag: true, flagH: 0.32, flagDir: s, wins: [[0, 0.75, 0.1, 0.2], [s * 1.2, 0.75, 0.1, 0.2], [0, 0.42, 0.1, 0.2]] });
      k.banner(s * 0.6, 0.98, fz + 0.01, 0.2, 0.55);
    }
    // central horned crown keep with lava-gold dome
    const dz = bz - 0.05;
    k.cyl(0.48, 0.52, 0.6, 0, 1.0, dz, C.stone, 6, { top: 1.1, bot: 0.88 });
    for (let i = -1; i <= 1; i++) k.winCyl(0, dz, 0.47, i * 0.9, 1.1, 0.1, 0.24);
    k.lathe([[0.5, 0], [0.6, 0.12], [0.6, 0.18], [0.5, 0.18]], 0, 1.6, dz, C.gold, 6, { ao: false });
    k.spikeRing(0.6, 1.76, 0, dz, 8, 0.24, C.horn, { tilt: 0.4 });
    k.lathe([[0.5, 0], [0.42, 0.32], [0.24, 0.62], [0, 1.05]], 0, 1.78, dz, C.roofL, 6, { top: 1.35, bot: 0.8, ao: false });
    k.horns(0, 1.92, dz + 0.3, 0.75, 0.08, C.horn, { gap: 0.18, fwd: 0.2 });
    k.cone(0.04, 0.3, 0, 2.8, dz, C.gold, 4);
    k.ball(0.09, 0, 2.86, dz, C.lavaH, 1, { glow: true });
    k.flag(0, 3.05, dz, 0.4, 0.55, 0.22, C.banner);
    for (const s of [-1, 1]) k.brazier(s * 0.98, 0.04, 0.98, 0.8);
  }
  return finish(k);
}

function fort() {
  const k = makeKit(204);
  const wh = 1.25, th = 0.55;
  // lava moat strip in front
  k.channel(-4.3, 0.62, -0.85, 0.62, 0.16); k.channel(0.85, 0.62, 4.3, 0.62, 0.16);
  const segs = [[-4.2, -2.3], [-2.0, -0.75], [0.75, 2.0], [2.3, 4.2]];
  for (const [a, b] of segs) {
    const w = b - a, x = (a + b) / 2;
    k.box(w, wh, th, x, 0, 0, C.stone, { top: 1.08, bot: 0.84 });
    k.box(w + 0.02, 0.16, th + 0.1, x, 0, 0, C.dark);
    k.box(w + 0.02, 0.06, th + 0.08, x, wh - 0.06, 0, C.trim, { ao: false });
    k.spikes(w, th + 0.04, wh, x, 0, C.stone2, { sides: 's', step: 0.3, h: 0.24 });
    const nb = Math.round(w / 0.6);
    for (let i = 0; i < nb; i++) {
      const xx = a + (i + 0.5) * w / nb;
      k.box(0.05, 0.22, 0.02, xx, 0.72, th / 2 + 0.005, C.win, { glow: true });
      k.box(0.15, 0.55, 0.12, xx + w / nb / 2 - 0.02, 0, th / 2 + 0.05, C.stone2, { top: 1.0 });
      k.cone(0.06, 0.16, xx + w / nb / 2 - 0.02, 0.55, th / 2 + 0.05, C.horn, 4, { ao: false, ry: Math.PI / 4 });
    }
  }
  for (const s of [-1, 1]) {
    k.tower(s * 4.2, 0.05, { r: 0.42, h: 1.35, roofH: 0.7, flag: true, flagH: 0.3, flagDir: s, wins: [[0, 0.6, 0.1, 0.22], [s * 1.1, 0.6, 0.1, 0.2]] });
    k.tower(s * 2.15, 0.05, { r: 0.36, h: 1.3, roofH: 0.65, horns: false, wins: [[0, 0.58, 0.1, 0.2]] });
    k.banner(s * 3.2, 1.08, th / 2 + 0.01, 0.26, 0.58);
    k.brazier(s * 1.05, 0.04, 0.72, 0.75);
  }
  // gatehouse: a demon maw
  k.block(1.55, 1.45, 0.85, 0, 0, 0.05, C.stone);
  k.spikes(1.6, 0.9, 1.45, 0, 0.05, C.stone2, { step: 0.26, h: 0.24 });
  const gz = 0.05 + 0.425;
  k.box(0.72, 0.72, 0.04, 0, 0.0, gz, C.lava, { glow: true });
  k.disc(0.36, 0.04, 0, 0.72, gz, C.lava, 12, { glow: true });
  k.disc(0.22, 0.04, 0, 0.5, gz + 0.005, C.lavaH, 10, { glow: true });
  k.tor(0.42, 0.07, 0, 0.72, gz + 0.02, C.dark, Math.PI, { rs: 8, ts: 4 });
  for (const s of [-1, 1]) k.box(0.12, 0.74, 0.12, s * 0.42, 0, gz, C.dark);
  for (let i = -3; i <= 3; i++) k.cone(0.045, 0.2, i * 0.1, 0.88 + 0.16 - Math.abs(i) * 0.03, gz + 0.06, C.horn, 4, { rx: Math.PI, ao: false });
  for (let i = -2; i <= 2; i++) k.cone(0.04, 0.16, i * 0.12, 0.0, gz + 0.06, C.horn, 4, { ao: false });
  k.skull(0, 1.12, gz + 0.02, 1.3);
  for (const s of [-1, 1]) {
    k.tower(s * 0.82, 0.38, { r: 0.28, h: 1.5, roofH: 0.6, flag: true, flagH: 0.3, flagDir: s, wins: [[0, 0.62, 0.09, 0.18], [s * 1.2, 0.4, 0.08, 0.16]] });
  }
  return finish(k);
}

function market() {
  const k = makeKit(205);
  k.pad(2.0, 2.0);
  const hz = -0.45;
  k.box(1.7, 0.8, 0.8, 0, 0.04, hz, C.stone, { top: 1.06, bot: 0.88 });
  k.box(1.73, 0.12, 0.83, 0, 0.04, hz, C.dark);
  for (let i = 0; i < 4; i++) k.door(-0.6 + i * 0.4, 0.04, hz + 0.4, 0.2, 0.3, 0, { c: C.win, bars: false });
  k.box(1.72, 0.06, 0.06, 0, 0.6, hz + 0.41, C.trim, { ao: false });
  k.gable(1.7, 0.5, 0.8, 0, 0.84, hz, C.roof, C.stone);
  k.horns(0.88, 1.0, hz + 0.35, 0.3, 0.04, C.horn, { gap: 0, yaw: 0 }); k.horns(-0.88, 1.0, hz + 0.35, 0.3, 0.04, C.horn, { gap: 0, yaw: 0 });
  // gold coin emblem
  k.disc(0.15, 0.03, 0, 1.06, hz + 0.33, C.gold, 10, { ao: false, rx: -0.55 });
  k.disc(0.07, 0.035, 0, 1.06, hz + 0.34, C.lavaH, 8, { glow: true, rx: -0.55 });
  // stalls with crimson/gold awnings
  const stall = (x, z, ry, c1, ware) => k.at(x, 0, z, ry, 1, () => {
    k.box(0.62, 0.3, 0.3, 0, 0.04, 0, C.wood, { top: 1.05 });
    for (const sx of [-0.29, 0.29]) for (const sz of [-0.13, 0.13]) k.box(0.04, sz < 0 ? 0.8 : 0.62, 0.04, sx, 0.04, sz, C.dark);
    for (let i = 0; i < 6; i++) k.box(0.115, 0.025, 0.42, -0.29 + 0.0575 + i * 0.1166, 0.75, 0.0, i % 2 ? C.gold : c1, { rx: 0.4, ao: false });
    if (ware === 'brim') for (const [dx, dz] of [[-0.15, 0.04], [0.0, 0.05], [0.15, 0.03]]) k.cone(0.09, 0.12, dx, 0.34, dz, C.brim, 6, { top: 1.2 });
    else { for (let i = 0; i < 3; i++) k.ball(0.055, -0.15 + i * 0.13, 0.4, 0.04, i === 1 ? C.lavaH : C.pink, 0, { glow: true }); }
  });
  stall(-0.55, 0.42, 0.35, C.roof, 'brim');
  stall(0.55, 0.42, -0.35, C.roof2, 'gems');
  // fire pit in the middle front
  k.lathe([[0.28, 0], [0.3, 0.12], [0.24, 0.14], [0.22, 0.1]], 0, 0.04, 0.72, C.dark, 9);
  k.pool(0.22, 0.22, 0, 0.16, 0.72, C.lava, 9);
  k.flame(0, 0.14, 0.72, 1.0);
  // crates, brimstone heaps, iron pots
  for (const [x, z, s] of [[0.85, -0.05, 1], [0.83, 0.22, 0.8]]) k.box(0.22 * s, 0.2 * s, 0.22 * s, x, 0.04, z, C.wood, { ry: 0.3, j: 0.1 });
  k.cone(0.2, 0.22, -0.82, 0.04, 0.0, C.brim, 7, { top: 1.2, bot: 0.85 });
  k.cone(0.14, 0.15, -0.88, 0.04, 0.28, C.brim, 6, { top: 1.2, bot: 0.85 });
  return finish(k);
}

function tavern() {
  const k = makeKit(206);
  k.pad(1.8, 1.8);
  const z0 = -0.15;
  k.block(1.3, 0.62, 0.95, 0, 0.04, z0, C.stone2, { cornice: false });
  k.box(1.42, 0.6, 1.05, 0, 0.66, z0, C.stoneL, { top: 1.04, bot: 0.92 });
  for (const x of [-0.69, -0.35, 0, 0.35, 0.69]) k.box(0.05, 0.6, 1.07, x, 0.66, z0, C.dark);
  k.box(1.46, 0.06, 1.09, 0, 0.64, z0, C.dark); k.box(1.46, 0.05, 1.09, 0, 1.24, z0, C.dark);
  k.gable(1.46, 0.6, 1.07, 0, 1.26, z0, C.roof, C.stoneL);
  for (const s of [-1, 1]) k.horn(s * 0.76, 1.3, z0 + 0.55, s, 0.25, 0.32, 0.045);
  // fiery chimney
  k.box(0.2, 0.55, 0.2, -0.42, 1.35, z0 - 0.2, C.dark, { top: 1.2 }); k.box(0.26, 0.06, 0.26, -0.42, 1.88, z0 - 0.2, C.gold);
  k.flame(-0.42, 1.92, z0 - 0.2, 0.8);
  const fz = z0 + 0.53;
  for (const x of [-0.52, 0.52]) k.win(x, 0.8, fz, 0.16, 0.2, 0, { frame: false });
  k.win(0, 0.84, fz, 0.13, 0.18, 0, { frame: false });
  for (const x of [-0.42, 0.42]) k.win(x, 0.2, fz - 0.05, 0.18, 0.2);
  k.door(0, 0.04, fz - 0.05, 0.22, 0.34, 0, { c: C.win, bars: false });
  for (const z of [-0.2, 0.15]) { k.win(0.71, 0.82, z0 + z, 0.12, 0.18, Math.PI / 2, { frame: false }); k.win(-0.71, 0.82, z0 + z, 0.12, 0.18, -Math.PI / 2, { frame: false }); }
  // hanging sign: horned goblet
  k.limb([0.66, 1.06, fz], [0.66, 1.06, fz + 0.35], 0.018, 0.018, C.dark, 4);
  k.box(0.03, 0.26, 0.24, 0.66, 0.72, fz + 0.3, C.banner, { ao: false });
  k.lathe([[0.0, 0], [0.04, 0.0], [0.015, 0.04], [0.015, 0.08], [0.06, 0.13]], 0.67, 0.76, fz + 0.3, C.gold, 6, { ao: false });
  for (const x of [-0.18, 0.18]) k.box(0.06, 0.1, 0.06, x, 0.46, fz, C.win, { glow: true });
  // barrels + fire bowl
  for (const [x, y, z, s] of [[-0.72, 0.04, 0.68, 1], [-0.5, 0.04, 0.72, 0.9], [-0.62, 0.27, 0.68, 0.8]]) {
    k.lathe([[0.1 * s, 0], [0.125 * s, 0.13 * s], [0.1 * s, 0.26 * s]], x, y, z, C.wood, 8);
    k.tor(0.118 * s, 0.012, x, y + 0.13 * s, z, C.gold, TAU, { rx: Math.PI / 2, rs: 8, ts: 3 });
  }
  k.brazier(0.6, 0.04, 0.68, 0.7);
  return finish(k);
}

function mageGuild(lvl) {
  const k = makeKit(206 + lvl);
  k.pad(1.6, 1.6, { cracks: 2 });
  k.block(1.15, 0.2, 1.15, 0, 0.04, 0, C.dark, { cornice: false });
  for (let i = 0; i < 3; i++) k.box(0.5 - i * 0.04, 0.07, 0.14, 0, 0.04 + i * 0.07, 0.66 - i * 0.1, C.stone2, { ao: false });
  let y = 0.24, rr = 0.46;
  const hs = [1.05, 0.62, 0.62];
  for (let t = 0; t < lvl; t++) {
    const h = hs[t];
    k.lathe([[rr * 1.1, 0], [rr, 0.12], [rr * 0.88, h]], 0, y, 0, t % 2 ? C.stoneL : C.stone, 6, { top: 1.08, bot: 0.88, phi: Math.PI / 6 });
    const n = t === 0 ? 3 : 3;
    for (let i = 0; i < n; i++) {
      const a = t === 0 ? (i - 1) * 1.0 : (i - 1) * 1.0 + 0.0;
      k.winCyl(0, 0, rr * 0.92, a, y + h * 0.28, t === 0 ? 0.13 : 0.1, h * 0.42, { c: C.lavaH });
    }
    if (t === 0) k.door(0, y, rr * 1.0, 0.22, 0.3);
    y += h;
    k.lathe([[rr * 0.86, 0], [rr * 1.22, 0.1], [rr * 1.22, 0.16], [rr * 0.85, 0.16]], 0, y, 0, C.trim, 6, { ao: false, phi: Math.PI / 6 });
    k.spikeRing(rr * 1.22, y + 0.1, 0, 0, 6, 0.2, C.horn, { tilt: 0.7, ph: Math.PI / 6 });
    y += 0.16;
    rr *= 0.8;
  }
  const rh = 0.8;
  const rad = rr / 0.8 * 1.15;
  k.lathe([[rad, 0], [rad * 0.62, rh * 0.28], [rad * 0.3, rh * 0.62], [0, rh]], 0, y - 0.04, 0, C.roof, 6, { top: 1.35, bot: 0.8, ao: false, phi: Math.PI / 6 });
  k.horns(0, y + 0.02, rad * 0.5, 0.42, 0.05, C.horn, { gap: rad * 0.4, fwd: 0.3 });
  y += rh - 0.04;
  // floating fire orb held by gold claws
  const orb = 0.08 + lvl * 0.03;
  for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; k.limb([0, y - 0.05, 0], [Math.sin(a) * orb * 1.1, y + 0.1 + orb, Math.cos(a) * orb * 1.1], 0.02, 0.01, C.gold, 4, { ao: false }); }
  k.ball(orb, 0, y + 0.12 + orb, 0, C.lavaH, 1, { glow: true });
  k.ball(orb * 0.6, 0, y + 0.12 + orb, 0, C.fireC, 1, { glow: true });
  if (lvl >= 2) k.tor(orb * 1.6, 0.014, 0, y + 0.12 + orb, 0, C.gold, TAU, { rx: Math.PI / 2 - 0.4, ao: false, rs: 14 });
  if (lvl >= 3) {
    k.tor(orb * 1.6, 0.014, 0, y + 0.12 + orb, 0, C.gold, TAU, { rx: 0.5, ry: 0.8, ao: false, rs: 14 });
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.4; k.ball(0.06, Math.sin(a) * 0.6, 2.5 + (i % 2) * 0.45, Math.cos(a) * 0.6, i % 2 ? C.lavaH : C.pink, 0, { glow: true, s: [0.7, 1.4, 0.7] }); }
  }
  for (const s of [-1, 1]) { const a = s * 0.55; k.banner(Math.sin(a) * 0.42, 1.08, Math.cos(a) * 0.42, 0.13, 0.4, a, C.banner); }
  for (const s of [-1, 1]) k.brazier(s * 0.6, 0.04, 0.6, 0.55);
  return finish(k);
}

// ================================================================== dwellings
// d1/u1: imp crucible / familiar forge
function crucible(up) {
  const k = makeKit(210 + up);
  k.pad(1.8, 1.8);
  // stepped basalt plinth
  k.block(1.2, 0.22, 1.0, 0, 0.04, -0.15, C.dark, { cornice: false });
  const cz = -0.15, cy = 0.26, cr = up ? 0.5 : 0.44;
  // the crucible: big iron-gold cauldron on clawed feet
  for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + 0.5; k.horn(Math.sin(a) * cr * 0.6, cy + 0.2, cz + Math.cos(a) * cr * 0.6, Math.sin(a), Math.cos(a), 0.3, 0.06, C.goldD, { up: -0.4, curl: 1 }); }
  k.lathe([[0.15, 0], [cr * 0.85, 0.12], [cr, 0.32], [cr * 0.98, 0.5], [cr * 1.1, 0.56], [cr * 0.9, 0.56]], 0, cy + 0.06, cz, C.iron, 10, { top: 1.2, bot: 0.8 });
  k.tor(cr * 1.03, 0.04, 0, cy + 0.42, cz, C.gold, TAU, { rx: Math.PI / 2, rs: 10, ao: false });
  k.cyl(cr * 0.9, cr * 0.9, 0.02, 0, cy + 0.6, cz, C.lava, 10, { glow: true });
  k.ball(cr * 0.35, 0.1, cy + 0.6, cz, C.lavaH, 1, { glow: true, s: [1, 0.35, 1] });
  // bubbles + flames from the melt
  k.flame(-0.12, cy + 0.6, cz + 0.08, up ? 1.3 : 1.0);
  k.flame(0.18, cy + 0.6, cz - 0.1, up ? 1.0 : 0.8);
  // pouring spout + lava stream into a mould channel
  k.limb([cr * 0.85, cy + 0.5, cz + 0.1], [cr + 0.22, cy + 0.46, cz + 0.2], 0.05, 0.035, C.iron, 6);
  k.box(0.05, cy + 0.42, 0.05, cr + 0.24, 0.04, cz + 0.2, C.lava, { glow: true });
  k.channel(cr + 0.24, cz + 0.2, cr + 0.24, 0.85, 0.1);
  // tall spiky chimney/tower at the back
  k.tower(-0.55, -0.6, { r: 0.22, h: up ? 1.4 : 1.15, roofH: 0.5, horns: up, flag: up, flagDir: -1, wins: [[0, 0.5, 0.08, 0.16]] });
  // bat-wing ornaments (imp wings) on the plinth corners
  for (const s of [-1, 1]) k.sheet(4, 1, (u, v) => [s * (0.5 + u * 0.35), 0.3 + Math.sin(u * 3.0) * 0.25 - v * (0.3 - u * 0.15) + (u > 0.5 ? Math.sin(u * 18) * 0.03 : 0), cz + 0.48], up ? C.gold : C.roof, { ao: false, top: 1.15 });
  // anvil + tools
  k.box(0.26, 0.12, 0.12, -0.45, 0.04, 0.55, C.dark); k.box(0.34, 0.08, 0.14, -0.45, 0.16, 0.55, C.iron, { top: 1.3 });
  k.cone(0.06, 0.14, -0.66, 0.2, 0.55, C.iron, 4, { rz: Math.PI / 2 });
  if (up) {
    k.tower(0.6, -0.62, { r: 0.2, h: 1.25, roofH: 0.48, horns: false, wins: [[0, 0.5, 0.08, 0.16]] });
    k.banner(0, 0.6, cz + 0.52, 0.2, 0.32, 0, C.banner2);
    k.brazier(-0.72, 0.04, 0.2, 0.6);
  }
  return finish(k);
}

// d2/u2: hell hound kennels / cerberus kennels
function kennels(up) {
  const k = makeKit(220 + up);
  k.pad(1.8, 1.8);
  const w = up ? 1.5 : 1.35, h = 0.6, z0 = -0.25, d = 0.85;
  k.block(w, h, d, 0, 0.04, z0, C.stone2, { cornice: true });
  k.gable(w, 0.45, d, 0, 0.04 + h, z0, C.roof, C.stone2);
  const fz = z0 + d / 2;
  const n = up ? 3 : 2;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1) - 0.5) * w * 0.62;
    // dark kennel mouth with two glowing eyes
    k.box(0.32, 0.3, 0.03, x, 0.04, fz + 0.005, C.dark, { ao: false });
    k.disc(0.16, 0.03, x, 0.34, fz + 0.005, C.dark, 10, { ao: false });
    k.box(0.26, 0.26, 0.02, x, 0.04, fz + 0.02, 0x6a2a38, { ao: false });
    k.disc(0.13, 0.02, x, 0.3, fz + 0.02, 0x6a2a38, 10, { ao: false });
    for (const s of [-1, 1]) k.ball(0.028, x + s * 0.05, 0.22, fz + 0.04, C.lavaH, 0, { glow: true, s: [1.4, 0.8, 1] });
    k.tor(0.17, 0.035, x, 0.34, fz + 0.03, C.trim, Math.PI, { rs: 8 });
    // hound head keystone
    k.at(x, 0.52, fz + 0.04, 0, 1, () => {
      k.box(0.14, 0.1, 0.14, 0, 0, 0, C.stone, { top: 1.2 });
      k.box(0.08, 0.06, 0.1, 0, 0.0, 0.1, C.stone, { top: 1.2 });
      for (const s of [-1, 1]) { k.cone(0.03, 0.1, s * 0.05, 0.08, -0.02, C.stone, 4, { rz: -s * 0.4 }); k.ball(0.018, s * 0.035, 0.06, 0.07, C.lavaH, 0, { glow: true }); }
    });
  }
  // spiked chain posts and bones in a pen
  for (const s of [-1, 1]) {
    k.cyl(0.05, 0.06, 0.45, s * 0.75, 0.04, 0.55, C.dark, 6);
    k.cone(0.055, 0.15, s * 0.75, 0.49, 0.55, C.horn, 4);
    for (let i = 0; i < 4; i++) k.tor(0.03, 0.01, s * (0.75 - i * 0.06), 0.4 - i * 0.07, 0.55 + i * 0.02, C.iron, TAU, { ry: i * 1.3 });
  }
  for (const [x, z, a] of [[-0.2, 0.62, 0.4], [0.15, 0.7, -0.8], [0.35, 0.5, 1.4]]) {
    k.limb([x - Math.cos(a) * 0.1, 0.07, z + Math.sin(a) * 0.1], [x + Math.cos(a) * 0.1, 0.07, z - Math.sin(a) * 0.1], 0.018, 0.018, C.bone, 4);
    for (const e of [-1, 1]) k.ball(0.03, x + e * Math.cos(a) * 0.1, 0.07, z - e * Math.sin(a) * 0.1, C.bone, 0);
  }
  k.brazier(0, 0.04, 0.42, 0.55);
  // side watchtower
  k.tower(w / 2 + 0.12, z0 - 0.15, { r: 0.22, h: up ? 1.35 : 1.1, roofH: 0.5, flag: up, horns: up, wins: [[0, 0.55, 0.08, 0.16]] });
  if (up) {
    // three hound heads on the ridge (cerberus)
    for (let i = -1; i <= 1; i++) k.at(i * 0.24, 1.0 - Math.abs(i) * 0.04, z0 + 0.15, i * 0.35, 1.2, () => {
      k.box(0.14, 0.12, 0.16, 0, 0, 0, C.dark, { top: 1.3 });
      k.box(0.09, 0.07, 0.12, 0, 0.0, 0.12, C.darkL, { top: 1.2 });
      for (const s of [-1, 1]) { k.cone(0.035, 0.12, s * 0.055, 0.1, -0.02, C.darkL, 4, { rz: -s * 0.35 }); k.ball(0.02, s * 0.04, 0.08, 0.08, C.lavaH, 0, { glow: true }); }
      k.flame(0, 0.02, 0.2, 0.35);
    });
    k.banner(-w / 2 + 0.05, 0.6, fz, 0.16, 0.36, 0, C.banner2);
  }
  return finish(k);
}

// d3/u3: demon gate / horned demon gate
function demonGate(up) {
  const k = makeKit(230 + up);
  k.pad(1.8, 1.8);
  const gz = -0.15, gw = up ? 1.1 : 1.0, gh = up ? 1.55 : 1.4;
  // dais steps with lava trenches
  for (let i = 0; i < 2; i++) k.box(1.5 - i * 0.2, 0.08, 0.9 - i * 0.15, 0, 0.04 + i * 0.08, gz, C.dark, { top: 1.15 });
  for (const s of [-1, 1]) k.channel(s * 0.62, 0.85, s * 0.62, 0.32, 0.08);
  // massive pylons
  for (const s of [-1, 1]) {
    const x = s * (gw / 2 + 0.15);
    k.box(0.3, gh, 0.38, x, 0.2, gz, C.stone, { top: 1.1, bot: 0.86 });
    k.box(0.36, 0.1, 0.44, x, 0.2, gz, C.stone2);
    for (const f of [0.35, 0.7]) k.box(0.32, 0.05, 0.4, x, 0.2 + gh * f, gz, C.gold, { ao: false });
    k.cone(0.15, 0.45, x, 0.2 + gh, gz, C.stoneL, 4, { ry: Math.PI / 4, top: 1.2 });
    k.horn(x, 0.2 + gh * 0.85, gz + 0.1, s, 0.2, 0.45, 0.06);
    k.win(x, 0.55, gz + 0.19, 0.09, 0.2);
  }
  // lintel with demon skull
  k.box(gw + 0.65, 0.22, 0.44, 0, 0.2 + gh, gz, C.stone2, { top: 1.15 });
  k.skull(0, 0.36 + gh, gz + 0.12, 1.4);
  // the portal: rippling fire-plane
  const cy = 0.2, pz = gz;
  k.box(gw, gh, 0.04, 0, cy, pz, C.lava, { glow: true });
  k.box(gw * 0.72, gh * 0.82, 0.04, 0, cy, pz + 0.012, C.fire, { glow: true });
  k.box(gw * 0.4, gh * 0.62, 0.04, 0, cy, pz + 0.024, C.lavaH, { glow: true });
  k.ball(0.12, 0, cy + gh * 0.4, pz + 0.04, C.fireC, 1, { glow: true, s: [1, 1.6, 0.3] });
  // spikes on the dais front
  for (let i = -2; i <= 2; i++) k.cone(0.05, 0.22, i * 0.28, 0.12, gz + 0.48, C.horn, 4, { rx: 0.3, ao: false });
  if (up) {
    k.horns(0, 0.42 + gh, gz - 0.05, 0.95, 0.09, C.horn, { gap: 0.32 });
    for (const s of [-1, 1]) { k.brazier(s * 0.75, 0.04, 0.65, 0.75); k.banner(s * (gw / 2 + 0.15), 0.2 + gh - 0.1, gz + 0.19, 0.22, 0.6, 0, C.banner); }
    k.tor(gw * 0.62, 0.04, 0, cy + gh * 0.55, pz + 0.04, C.gold, TAU, { rs: 16, s: [1, 1.15, 1] });
  } else {
    k.brazier(0.75, 0.04, 0.6, 0.7);
    k.rock(-0.75, 0.6, 1);
  }
  return finish(k);
}

// d4/u4: hall of sins (succubus)
function hallOfSins(up) {
  const k = makeKit(240 + up);
  k.pad(2.0, 2.0);
  const z0 = -0.25, w = up ? 1.5 : 1.3, h = up ? 0.95 : 0.85, d = 0.95;
  k.block(w, h, d, 0, 0.04, z0, C.pinkS);
  const fz = z0 + d / 2;
  // crescent-arched colonnade
  const nc = up ? 6 : 4;
  for (let i = 0; i < nc; i++) {
    const x = (i / (nc - 1) - 0.5) * (w - 0.1);
    k.cyl(0.05, 0.06, h - 0.1, x, 0.14, fz + 0.12, C.horn, 8, { top: 1.1 });
    k.box(0.12, 0.05, 0.12, x, h + 0.02, fz + 0.12, C.gold, { ao: false });
  }
  k.box(w + 0.1, 0.1, 0.3, 0, h + 0.06, fz + 0.06, C.plum, { top: 1.2 });
  for (let i = 0; i < nc - 1; i++) { const x = ((i + 0.5) / (nc - 1) - 0.5) * (w - 0.1); k.win(x, 0.3, fz, 0.13, 0.36, 0, { c: C.pink, frame: C.gold }); }
  // onion-ish dome roof in plum with gold ribs and horn spike
  const dome = [];
  for (let i = 0; i <= 7; i++) { const t = i / 7; dome.push([(w * 0.42) * Math.sin(Math.PI * (0.15 + t * 0.85)) * (1 - t * 0.35), t * 0.85]); }
  dome.push([0, 0.95]);
  k.lathe([[w * 0.36, 0], [w * 0.36, 0.2]], 0, 0.04 + h + 0.12, z0, C.pinkS, 8);
  k.lathe(dome, 0, 0.04 + h + 0.32, z0, C.plum, 8, { top: 1.35, bot: 0.85, ao: false });
  k.cone(0.03, 0.35, 0, 0.04 + h + 1.22, z0, C.gold, 4);
  k.horns(0, 0.04 + h + 0.95, z0 + 0.12, 0.38, 0.05, C.gold, { gap: 0.08, fwd: 0.3 });
  for (let i = -1; i <= 1; i++) k.winCyl(0, z0, w * 0.36, i * 0.8, h + 0.18, 0.08, 0.12, { c: C.pink, frame: false });
  // heart-shaped sigil (two balls + cone) over the door
  k.at(0, h + 0.35, fz + 0.21, 0, 1, () => {
    for (const s of [-1, 1]) k.ball(0.07, s * 0.05, 0.03, 0, C.pink, 1, { glow: true, s: [1, 1, 0.4] });
    k.cone(0.1, 0.14, 0, -0.1, 0, C.pink, 4, { rx: Math.PI, glow: true, s: [1, 1, 0.4] });
  });
  k.door(0, 0.04, fz + 0.005, 0.24, 0.34, 0, { c: C.pink, bars: false });
  // pink-flame braziers and a reflecting pool
  for (const s of [-1, 1]) k.brazier(s * 0.7, 0.04, 0.68, 0.65);
  k.lathe([[0.32, 0], [0.32, 0.06], [0.28, 0.07]], 0, 0.04, 0.72, C.horn, 10);
  k.pool(0.28, 0.2, 0, 0.1, 0.72, C.pink, 10);
  if (up) {
    for (const s of [-1, 1]) {
      k.tower(s * (w / 2 + 0.05), z0 - 0.2, { r: 0.22, h: 1.55, roofH: 0.6, roofC: C.plum, flag: C.pink, flagDir: s, wins: [[0, 0.6, 0.08, 0.2]] });
      k.banner(s * (w / 2 - 0.25), h - 0.05, fz + 0.01, 0.16, 0.42, 0, C.plum);
    }
  } else {
    k.banner(-w / 2 + 0.15, h - 0.05, fz + 0.01, 0.16, 0.4, 0, C.plum);
  }
  return finish(k);
}

// d5/u5: efreet fire lake + brass lamp / sultan's palace
function fireLake(up) {
  const k = makeKit(250 + up);
  k.pad(2.0, 2.0, { cracks: 2 });
  // lava lake with basalt rim
  k.lathe([[0.85, 0], [0.87, 0.08], [0.78, 0.11], [0.74, 0.07]], 0, 0.04, 0.05, C.dark, 14, { s: [1, 1, 0.82] });
  k.pool(0.76, 0.62, 0, 0.1, 0.05, C.lava, 14);
  k.pool(0.45, 0.35, 0.1, 0.105, 0.0, C.fire, 10);
  for (const [x, z] of [[-0.45, 0.25], [0.4, 0.35], [-0.2, -0.3]]) k.ball(0.05, x, 0.11, z, C.fireC, 0, { glow: true, s: [1, 0.4, 1] });
  // island with the great brass lamp
  const ly = 0.1, lz = -0.15;
  k.cyl(0.28, 0.34, 0.12, 0, ly, lz, C.stone2, 8);
  const s = up ? 1.25 : 1.0;
  k.at(0, ly + 0.12, lz, -0.5, s, () => {
    k.lathe([[0.1, 0], [0.16, 0.02], [0.08, 0.06], [0.05, 0.08]], 0, 0, 0, C.gold, 8, { ao: false });
    k.ball(0.22, 0, 0.22, 0, C.gold, 1, { s: [1.4, 0.65, 1], top: 1.3, bot: 0.8, ao: false });
    k.limb([0.25, 0.24, 0], [0.48, 0.38, 0], 0.06, 0.025, C.goldD, 6, { ao: false });
    k.tor(0.1, 0.025, -0.32, 0.25, 0, C.goldD, Math.PI * 1.4, { rz: 1.2, ao: false });
    k.lathe([[0.08, 0], [0.06, 0.05], [0.02, 0.1], [0, 0.14]], 0, 0.34, 0, C.gold, 6, { ao: false });
    // fire spout: a twisting column of flame rising from the lamp spout (efreet)
    k.flame(0.5, 0.4, 0, 1.5);
    for (let i = 0; i < 4; i++) k.ball(0.11 - i * 0.015, 0.5 + Math.sin(i * 1.4) * 0.08, 0.6 + i * 0.22, Math.cos(i * 1.4) * 0.05, i % 2 ? C.fire : C.lavaH, 1, { glow: true, s: [1, 1.3, 1] });
    k.cone(0.09, 0.3, 0.5, 1.4, 0, C.fireC, 5, { glow: true, bone: BONE_CLOTH, pivot: [0.5, 1.4, 0] });
  });
  // brass pavilion arch behind
  const pz = -0.75;
  for (const sx of [-1, 1]) { k.cyl(0.06, 0.07, 1.1, sx * 0.55, 0.04, pz, C.gold, 8, { ao: false }); k.cone(0.09, 0.2, sx * 0.55, 1.14, pz, C.goldD, 6); }
  k.tor(0.55, 0.06, 0, 1.14, pz, C.goldD, Math.PI, { rs: 12, ao: false });
  k.cone(0.06, 0.3, 0, 1.68, pz, C.gold, 4);
  for (const sx of [-1, 1]) k.flame(sx * 0.55, 1.33, pz, 0.6);
  if (up) {
    // sultan's onion domes on two kiosks
    for (const sx of [-1, 1]) {
      const x = sx * 0.78, z = -0.55;
      k.cyl(0.22, 0.24, 0.85, x, 0.04, z, C.stoneL, 8, { top: 1.08 });
      k.win(x, 0.35, z + 0.22, 0.1, 0.22);
      k.lathe([[0.25, 0], [0.32, 0.15], [0.28, 0.32], [0.12, 0.5], [0, 0.68]], x, 0.89, z, C.roofL, 8, { top: 1.3, ao: false });
      k.cone(0.025, 0.25, x, 1.55, z, C.gold, 4);
      k.flag(x, 1.6, z, 0.4, 0.42, 0.18, C.banner2, { dir: sx, phase: x });
    }
    k.ball(0.12, 0, 1.9, pz, C.fireC, 1, { glow: true });
    for (const sx of [-1, 1]) k.brazier(sx * 0.82, 0.04, 0.8, 0.6);
  } else {
    k.crystal(0.82, -0.3, 0.9); k.rock(-0.85, -0.2, 0.9);
  }
  return finish(k);
}

// d6/u6: nightmare stables / hell charger stables
function stables(up) {
  const k = makeKit(260 + up);
  k.pad(2.4, 2.4);
  const z0 = -0.35, w = up ? 2.0 : 1.85, h = 0.75, d = 1.0;
  k.block(w, h, d, 0, 0.04, z0, C.stone);
  k.gable(w, 0.55, d, 0, 0.04 + h, z0, C.roof, C.stone);
  const fz = z0 + d / 2;
  // stall doors with fire-maned horse heads looking out
  const ns = up ? 4 : 3;
  for (let i = 0; i < ns; i++) {
    const x = (i / (ns - 1) - 0.5) * (w - 0.45);
    k.box(0.32, 0.5, 0.03, x, 0.04, fz + 0.005, C.dark, { ao: false });
    k.box(0.32, 0.22, 0.04, x, 0.04, fz + 0.02, C.woodD, { ao: false });
    k.box(0.36, 0.04, 0.05, x, 0.54, fz + 0.02, C.gold, { ao: false });
    // horse head (dark violet) with flaming mane and eyes
    k.at(x, 0.3, fz + 0.05, 0, 1, () => {
      k.limb([0, 0, 0], [0, 0.12, 0.06], 0.06, 0.055, 0x6e3a5a, 6);
      k.box(0.09, 0.08, 0.2, 0, 0.1, 0.13, 0x6e3a5a, { rx: 0.5, top: 1.3 });
      for (const s of [-1, 1]) { k.ball(0.016, s * 0.045, 0.16, 0.1, C.lavaH, 0, { glow: true }); k.cone(0.02, 0.07, s * 0.03, 0.19, 0.02, 0x6e3a5a, 4); }
      k.flame(0, 0.12, -0.02, 0.45);
    });
  }
  // hayloft gable with horseshoe emblem
  k.tor(0.13, 0.035, 0, 1.04, fz + 0.02, C.gold, Math.PI * 1.4, { rz: -0.7 * Math.PI + Math.PI, ao: false });
  k.disc(0.07, 0.02, 0, 1.0, fz + 0.01, C.lava, 8, { glow: true });
  // fiery paddock fence with spikes
  for (let i = 0; i < 7; i++) {
    const x = -1.05 + i * 0.35;
    k.box(0.06, 0.32, 0.06, x, 0.04, 0.95, C.dark);
    k.cone(0.04, 0.12, x, 0.36, 0.95, C.horn, 4);
  }
  for (const y of [0.14, 0.28]) k.box(2.1, 0.04, 0.03, 0, y, 0.95, C.iron);
  k.channel(-0.9, 0.55, 0.9, 0.55, 0.08);
  // water/fire trough
  k.box(0.5, 0.14, 0.18, 0.6, 0.04, 0.3, C.dark); k.box(0.44, 0.01, 0.12, 0.6, 0.18, 0.3, C.lava, { glow: true });
  for (const s of [-1, 1]) k.tower(s * (w / 2 + 0.05), z0 - 0.3, { r: up ? 0.26 : 0.22, h: up ? 1.75 : 1.4, roofH: 0.6, flag: up || s > 0, flagDir: s, horns: up, wins: [[0, 0.6, 0.08, 0.18]] });
  if (up) {
    // rearing nightmare statue on a plinth by the entrance
    k.box(0.36, 0.3, 0.36, -0.7, 0.04, 0.3, C.stone2, { top: 1.1 });
    k.at(-0.7, 0.34, 0.3, 0.6, 1.1, () => {
      k.ball(0.14, 0, 0.28, 0, 0x6e3a5a, 1, { s: [0.8, 1.4, 1] });
      k.box(0.09, 0.1, 0.2, 0, 0.55, 0.12, 0x6e3a5a, { rx: 0.7, top: 1.3 });
      for (const s of [-1, 1]) { k.limb([s * 0.05, 0.05, -0.05], [s * 0.06, 0.0, -0.12], 0.035, 0.03, 0x6e3a5a, 5); k.limb([s * 0.05, 0.32, 0.1], [s * 0.06, 0.22, 0.26], 0.03, 0.025, 0x6e3a5a, 5); }
      k.flame(0, 0.42, -0.04, 0.6);
    });
    k.banner(0, 0.72, fz + 0.01, 0.2, 0.4, 0, C.banner);
  } else {
    k.rock(-0.75, 0.3, 1);
  }
  return finish(k);
}

// d7/u7: pit lord forsaken palace / grand forsaken palace
function palace(up) {
  const k = makeKit(270 + up);
  k.pad(2.8, 2.8);
  // stepped approach with lava falls
  for (let i = 0; i < 3; i++) k.box(1.0 - i * 0.12, 0.09, 0.22, 0, 0.04 + i * 0.09, 1.25 - i * 0.14, C.stone2, { ao: false });
  const bw = up ? 2.2 : 2.0, bh = 1.05, bd = 1.3, bz = -0.35;
  k.block(bw, bh, bd, 0, 0.04, bz, C.stone, { spikes: { sides: 's', step: 0.3, h: 0.2 } });
  const fz = bz + bd / 2;
  for (const s of [-1, 1]) { k.channel(s * 0.66, 1.35, s * 0.66, fz + 0.1, 0.12); k.box(0.1, bh - 0.1, 0.02, s * 0.66, 0.04, fz + 0.012, C.lava, { glow: true }); }
  for (const x of [-0.9, -0.4, 0.4, 0.9].map((v) => v * bw / 2.0)) k.win(x, 0.45, fz, 0.14, 0.3);
  // great maw gate
  k.door(0, 0.04, fz + 0.01, 0.42, 0.55);
  k.skull(0, 0.85, fz + 0.12, 1.5);
  // central keep with huge horns
  const kz = bz - 0.05, kh = up ? 1.65 : 1.5;
  k.lathe([[0.62, 0], [0.55, 0.2], [0.5, kh]], 0, 0.04 + bh, kz, C.stoneL, 6, { top: 1.1, bot: 0.86, phi: Math.PI / 6 });
  for (let i = -1; i <= 1; i++) k.winCyl(0, kz, 0.52, i * 1.0, bh + kh * 0.4, 0.13, 0.32);
  const ky = 0.04 + bh + kh;
  k.lathe([[0.5, 0], [0.66, 0.15], [0.66, 0.24], [0.56, 0.24]], 0, ky, kz, C.gold, 6, { ao: false, phi: Math.PI / 6 });
  k.spikeRing(0.66, ky + 0.2, 0, kz, 10, 0.3, C.horn, { tilt: 0.45 });
  k.lathe([[0.56, 0], [0.4, 0.35], [0.18, 0.75], [0, 1.15]], 0, ky + 0.24, kz, C.roof, 6, { top: 1.35, bot: 0.8, ao: false, phi: Math.PI / 6 });
  k.horns(0, ky + 0.3, kz + 0.3, up ? 1.1 : 0.95, 0.11, C.horn, { gap: 0.25, fwd: 0.15 });
  const topY = ky + 1.39;
  k.cone(0.04, 0.3, 0, topY - 0.02, kz, C.gold, 4);
  k.flag(0, topY + 0.2, kz, 0.4, 0.6, 0.24, C.banner);
  // flanking spires
  for (const s of [-1, 1]) {
    k.tower(s * (bw / 2 - 0.1), bz + bd / 2 - 0.15, { r: 0.3, h: up ? 2.0 : 1.8, roofH: 0.95, flag: true, flagDir: s, wins: [[0, 0.75, 0.1, 0.22], [s * 1.2, 0.75, 0.1, 0.2], [0, 0.4, 0.1, 0.2]] });
    k.tower(s * (bw / 2 - 0.15), bz - bd / 2 + 0.1, { r: 0.24, h: up ? 1.65 : 1.45, roofH: 0.75, horns: false, wins: [[s * 0.8, 0.6, 0.08, 0.18]] });
    k.banner(s * 0.4, 0.98, fz + 0.01, 0.22, 0.58, 0, C.banner);
    k.brazier(s * 1.15, 0.04, 1.15, 0.85);
  }
  if (up) {
    // floating crown of fire above the keep and burning lava moats along the sides
    k.tor(0.3, 0.04, 0, topY + 0.85, kz, C.gold, TAU, { rx: Math.PI / 2 - 0.25, rs: 14, ao: false });
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; k.cone(0.05, 0.18, Math.sin(a) * 0.3, topY + 0.85, kz + Math.cos(a) * 0.3, C.gold, 4, { ao: false }); }
    k.ball(0.12, 0, topY + 0.9, kz, C.fireC, 1, { glow: true });
    for (const s of [-1, 1]) {
      k.channel(s * 1.28, -1.2, s * 1.28, 0.9, 0.12);
      k.horn(s * (bw / 2 + 0.05), 0.04 + bh, fz - 0.05, s, 0.3, 0.6, 0.08);
    }
    // pit lord statue with whip-like flame in front-left
    k.at(-0.95, 0.04, 0.55, 0.4, 1, () => {
      k.box(0.3, 0.25, 0.3, 0, 0, 0, C.dark, { top: 1.2 });
      k.lathe([[0.13, 0], [0.11, 0.3], [0.14, 0.45], [0.08, 0.55], [0, 0.56]], 0, 0.25, 0, C.stoneL, 6, { ao: false });
      k.ball(0.07, 0, 0.88, 0, C.stoneL, 1, { ao: false });
      k.horns(0, 0.9, 0, 0.18, 0.025, C.horn, { gap: 0.04 });
      for (const s of [-1, 1]) k.sheet(3, 1, (u, v) => [s * (0.08 + u * 0.3), 0.68 + u * 0.22 - v * (0.35 - u * 0.2), -0.07], C.roof, { ao: false });
      k.flame(0.15, 0.75, 0.05, 0.5);
    });
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
  d1: () => crucible(0), u1: () => crucible(1),
  d2: () => kennels(0), u2: () => kennels(1),
  d3: () => demonGate(0), u3: () => demonGate(1),
  d4: () => hallOfSins(0), u4: () => hallOfSins(1),
  d5: () => fireLake(0), u5: () => fireLake(1),
  d6: () => stables(0), u6: () => stables(1),
  d7: () => palace(0), u7: () => palace(1),
};
export const INFERNO_TOWN_IDS = Object.keys(BUILDERS);
const cache = new Map();
// Returns { body, glow } for an Inferno town building id, or null for an unknown id.
// Results are cached and shared: clone before mutating.
export function infernoTownBuilding(id) {
  if (!BUILDERS[id]) return null;
  if (!cache.has(id)) cache.set(id, BUILDERS[id]());
  return cache.get(id);
}
