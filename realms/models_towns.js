import * as THREE from 'three';

// =====================================================================
// HEX REALMS: faction towns, mounted heroes and ownership flags.
// Every model returns { body, glow }: body is a merged, vertex-coloured
// BufferGeometry (position, normal, color, uv); glow holds the emissive
// bits (windows, eyes, magic). Base at y = 0, front faces +Z.
//   townModel(fac)          fac: 'haven' | 'necro'   (~1.3 wide)
//   heroModel(fac, color)   rider on a horse, ~1.15 tall with the banner
//   flagModel(color)        pole with a waving pennant, ~1 tall
// =====================================================================

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
const TAU = Math.PI * 2;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// rotation that turns a +Z-facing part to face direction (dx, dz)
const face = (dx, dz) => Math.atan2(dx, dz);

// ------------------------------------------------------------------ a richer modelling kit
function makeKit(seed) {
  const r = rand(seed);
  const B = [], G = [];
  const tf = (g, o = {}) => {
    if (o.s !== undefined) { const s = o.s; Array.isArray(s) ? g.scale(s[0], s[1], s[2]) : g.scale(s, s, s); }
    if (o.rx) g.rotateX(o.rx);
    if (o.rz) g.rotateZ(o.rz);
    if (o.ry) g.rotateY(o.ry);
    return g;
  };
  // o: glow, top/bot (gradient multipliers within the part), j (per-face jitter), ao (false to skip ground darkening), cols (per-vertex multipliers)
  const add = (g, c, o = {}) => { const ng = g.index ? g.toNonIndexed() : g; (o.glow ? G : B).push({ g: ng, c, o }); return ng; };
  const k = {
    r, add,
    box(w, h, d, x, y, z, c, o = {}) { return add(tf(new THREE.BoxGeometry(w, h, d), o).translate(x, y + h / 2, z), c, o); },
    cyl(rt, rb, h, x, y, z, c, seg = 8, o = {}) { return add(tf(new THREE.CylinderGeometry(rt, rb, h, seg, 1, !!o.open), o).translate(x, y + h / 2, z), c, o); },
    cone(rad, h, x, y, z, c, seg = 8, o = {}) { return add(tf(new THREE.ConeGeometry(rad, h, seg).translate(0, h / 2, 0), o).translate(x, y, z), c, o); },
    ball(rad, x, y, z, c, det = 1, o = {}) { return add(tf(new THREE.IcosahedronGeometry(rad, det), o).translate(x, y, z), c, o); },
    // pts: [[radius, y], ...] bottom to top
    lathe(pts, x, y, z, c, seg = 8, o = {}) {
      const g = new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(Math.max(a, 0.0001), b)), seg, o.phi || 0);
      return add(tf(g, o).translate(x, y, z), c, o);
    },
    limb(a, b, r1, r2, c, seg = 6, o = {}) {
      const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), len = va.distanceTo(vb);
      const g = new THREE.CylinderGeometry(r2, r1, len, seg, 1, false);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize()));
      g.translate((va.x + vb.x) / 2, (va.y + vb.y) / 2, (va.z + vb.z) / 2);
      return add(g, c, o);
    },
    tor(rad, tube, x, y, z, c, arc = TAU, o = {}) { return add(tf(new THREE.TorusGeometry(rad, tube, o.ts || 4, o.rs || 10, arc), o).translate(x, y, z), c, o); },
    // a gable roof, ridge along local x; slopes in roof colour, gable ends in wall colour
    gable(w, h, d, x, y, z, roofC, wallC, ry = 0, ov = 0.025) {
      const W = w / 2, D = d / 2 + ov, Wo = W + ov;
      const sl = [-Wo, 0, D, Wo, 0, D, Wo, h, 0, -Wo, 0, D, Wo, h, 0, -Wo, h, 0,
        Wo, 0, -D, -Wo, 0, -D, -Wo, h, 0, Wo, 0, -D, -Wo, h, 0, Wo, h, 0];
      const ge = [W, 0, d / 2, W, 0, -d / 2, W, h * (d / 2) / D, 0, -W, 0, -d / 2, -W, 0, d / 2, -W, h * (d / 2) / D, 0];
      const g1 = new THREE.BufferGeometry(); g1.setAttribute('position', new THREE.Float32BufferAttribute(sl, 3));
      const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(ge, 3));
      add(g1.rotateY(ry).translate(x, y, z), roofC, { top: 1.2, bot: 0.8 });
      add(g2.rotateY(ry).translate(x, y, z), wallC, {});
    },
    // a grid sheet: f(u, v) -> [x, y, z]; double-sided; shade(u, v) -> colour multiplier
    sheet(nu, nv, f, c, o = {}) {
      const P = [], S = [];
      const pt = (i, j) => f(i / nu, j / nv), sh = (i, j) => (o.shade ? o.shade(i / nu, j / nv) : 1);
      for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
        const q = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
        const tris = [[0, 1, 2], [0, 2, 3]];
        for (const t of tris) {
          const A = t.map((n) => new THREE.Vector3(...pt(...q[n])));
          for (let m = 0; m < 3; m++) { P.push(A[m].x, A[m].y, A[m].z); S.push(sh(...q[t[m]])); }
          if (o.double !== false) {
            // the back side sits a hair behind the front so shadows do not fight
            const nn = new THREE.Vector3().subVectors(A[1], A[0]).cross(new THREE.Vector3().subVectors(A[2], A[0])).normalize().multiplyScalar(-(o.thick ?? 0.006));
            for (const m of [0, 2, 1]) { P.push(A[m].x + nn.x, A[m].y + nn.y, A[m].z + nn.z); S.push(sh(...q[t[m]]) * 0.82); }
          }
        }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      return add(g, c, { ...o, cols: S });
    },
    // a crenellated wall from (ax, az) to (bx, bz)
    wall(ax, az, bx, bz, h, th, c, o = {}) {
      const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz), ry = Math.atan2(-dz, dx), cx = (ax + bx) / 2, cz = (az + bz) / 2;
      k.box(len, h, th, cx, 0, cz, c, { ry, top: 1.08, bot: 0.78 });
      k.box(len, 0.025, th + 0.025, cx, h - 0.02, cz, o.trim ?? c, { ry, top: 1.15 });
      const n = Math.max(2, Math.round(len / (o.step || 0.075)));
      const ux = dx / len, uz = dz / len, nx = -uz, nz = ux;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n - 0.5, px = cx + ux * t * len, pz = cz + uz * t * len;
        if (o.spikes) k.cone(0.022, 0.07 + r() * 0.05, px, h, pz, o.spikes, 4, { top: 1.2 });
        else {
          k.box(len / n * 0.55, 0.05, 0.03, px + nx * th * 0.4, h, pz + nz * th * 0.4, c, { ry, top: 1.15 });
          k.box(len / n * 0.55, 0.05, 0.03, px - nx * th * 0.4, h, pz - nz * th * 0.4, c, { ry, top: 1.15 });
        }
      }
    },
    // a glowing window on the face of a cylinder at angle a (direction cos a, sin a)
    winCyl(cx, cz, rad, a, y, w, h, c) {
      const dx = Math.cos(a), dz = Math.sin(a);
      k.box(w, h, 0.012, cx + dx * rad, y, cz + dz * rad, c, { glow: true, ry: face(dx, dz) });
    },
  };
  k.B = B; k.G = G;
  return k;
}

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
    const top = p.o.top ?? 1.06, bot = p.o.bot ?? 0.92, jit = p.o.j ?? (glow ? 0.0 : 0.04);
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
        if (!glow && p.o.ao !== false) m *= 0.84 + 0.16 * smooth(-0.01, 0.14, y);
        tmpC.copy(base).multiplyScalar(m);
        col.set([tmpC.r, tmpC.g, tmpC.b], o * 3);
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
function finish(k) {
  return { body: bake(k.B, k.r, false, true), glow: k.G.length ? bake(k.G, k.r, true, false) : null };
}
const shadeOf = (c, m) => new THREE.Color(c).multiplyScalar(m);

// a pennant: a tapered, swallow-tailed cloth waving in -X from a pole at x0 (or along dir)
function pennant(k, x0, y0, z0, len, hgt, c, o = {}) {
  const amp = o.amp ?? 0.05, waves = o.waves ?? 1.6, tail = o.tail ?? 0.35, dir = o.dir ?? -1, axis = o.axis || 'x', ph = o.phase ?? 0;
  k.sheet(o.nu || 8, 4, (u, v) => {
    const taper = 1 - u * (o.taper ?? 0.45);
    let yy = (v - 0.5) * hgt * taper;
    let along = u * len;
    if (tail > 0) along -= Math.max(0, 1 - Math.abs(v - 0.5) * 4) * tail * len * smooth(0.5, 1, u);
    const w = Math.sin(u * waves * TAU + ph) * amp * u;
    const droop = -u * u * hgt * (o.droop ?? 0.25);
    return axis === 'x' ? [x0 + dir * along, y0 + yy + droop, z0 + w] : [x0 + w, y0 + yy + droop, z0 + dir * along];
  }, c, { shade: (u, v) => 0.9 + 0.22 * Math.cos(u * waves * TAU + ph), top: 1.05, bot: 0.95, ao: false, j: 0.02 });
}

// ------------------------------------------------------------------ towns
const HV = { stone: 0xf6f0e2, stoneD: 0xd6c9ac, roof: 0x3a78f2, roofD: 0x2e60d0, gold: 0xffcf4a, win: 0xffd070, banner: 0x2f6af0, wood: 0x9a6a42, red: 0xe0583a, plaster: 0xfbf2da, grass: 0x86c64e, path: 0xe6d3a0, door: 0x7a4a2a, iron: 0x9a948a };
function havenTown() {
  const k = makeKit(11);
  // ground: a grassy mound with a paved courtyard
  k.lathe([[0.69, 0], [0.68, 0.025], [0.62, 0.05], [0, 0.05]], 0, 0, 0, HV.grass, 14, { top: 1.1, bot: 0.75 });
  k.cyl(0.5, 0.52, 0.012, 0, 0.05, -0.02, HV.path, 12, { j: 0.08 });
  k.box(0.12, 0.012, 0.28, 0, 0.05, 0.5, HV.path, { j: 0.08 }); // road out of the gate
  const Y = 0.055;
  // curtain wall: six towers on a hexagon, gate on the +Z side
  const R = 0.56, tw = [];
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; tw.push([Math.cos(a) * R, Math.sin(a) * R, a]); }
  for (let i = 0; i < 6; i++) {
    const [ax, az] = tw[i], [bx, bz] = tw[(i + 1) % 6];
    if (i === 1) { // front: split around the gatehouse
      const gx = 0.14;
      k.wall(ax, az, gx, 0.485, 0.27, 0.07, HV.stone, { trim: HV.stoneD, step: 0.07 });
      k.wall(-gx, 0.485, bx, bz, 0.27, 0.07, HV.stone, { trim: HV.stoneD, step: 0.07 });
    } else k.wall(ax, az, bx, bz, 0.27, 0.07, HV.stone, { trim: HV.stoneD });
  }
  for (let i = 0; i < 6; i++) {
    const [x, z, a] = tw[i];
    const front = i === 1 || i === 2, h = front ? 0.5 : 0.42, rr = 0.088;
    k.lathe([[rr * 1.25, 0], [rr * 1.08, 0.08], [rr, 0.12], [rr, h - 0.04], [rr * 1.22, h], [rr * 1.22, h + 0.03], [rr * 0.95, h + 0.03]], x, Y, z, HV.stone, 10, { top: 1.1, bot: 0.75 });
    k.cone(rr * 1.35, front ? 0.34 : 0.27, x, Y + h + 0.03, z, HV.roof, 10, { top: 1.4, bot: 0.75 });
    k.tor(rr * 1.3, 0.009, x, Y + h + 0.035, z, HV.gold, TAU, { rx: Math.PI / 2, rs: 10, ts: 3 });
    const th = Y + h + 0.03 + (front ? 0.34 : 0.27);
    k.ball(0.018, x, th, z, HV.gold, 0); k.cone(0.008, 0.06, x, th + 0.01, z, HV.gold, 4);
    k.winCyl(x, z, rr * 1.01, a, Y + h * 0.62, 0.025, 0.055, HV.win);
    k.winCyl(x, z, rr * 1.01, a + 0.9, Y + h * 0.35, 0.02, 0.045, HV.win);
    k.winCyl(x, z, rr * 1.01, a - 0.9, Y + h * 0.35, 0.02, 0.045, HV.win);
    if (front) { k.limb([x, th, z], [x, th + 0.14, z], 0.005, 0.004, HV.wood, 4); pennant(k, x, th + 0.11, z, 0.14, 0.05, HV.banner, { dir: i === 1 ? 1 : -1, amp: 0.02, tail: 0.3 }); }
  }
  // gatehouse with arch, portcullis, side turrets and a hanging banner
  const gz = 0.485;
  k.box(0.3, 0.36, 0.16, 0, Y, gz, HV.stone, { top: 1.1, bot: 0.75 });
  k.box(0.32, 0.03, 0.18, 0, Y + 0.34, gz, HV.stoneD);
  for (let i = 0; i < 5; i++) { const x = -0.13 + i * 0.065; k.box(0.035, 0.05, 0.03, x, Y + 0.37, gz + 0.075, HV.stone, { top: 1.2 }); k.box(0.035, 0.05, 0.03, x, Y + 0.37, gz - 0.075, HV.stone, { top: 1.2 }); }
  k.box(0.1, 0.13, 0.02, 0, Y, gz + 0.072, HV.door, { ao: false });
  k.tor(0.05, 0.012, 0, Y + 0.13, gz + 0.082, HV.stoneD, Math.PI, { rs: 8 });
  k.cyl(0.05, 0.05, 0.02, 0, Y + 0.12, gz + 0.072, HV.door, 8, { rx: Math.PI / 2, s: [1, 1, 1], ao: false });
  for (let i = 0; i < 4; i++) k.box(0.008, 0.12, 0.008, -0.03 + i * 0.02, Y + 0.02, gz + 0.085, HV.iron);
  for (const sx of [-1, 1]) {
    const x = sx * 0.15;
    k.cyl(0.045, 0.05, 0.46, x, Y, gz + 0.06, HV.stone, 8, { top: 1.1, bot: 0.8 });
    k.cone(0.065, 0.2, x, Y + 0.46, gz + 0.06, HV.roof, 8, { top: 1.35, bot: 0.7 });
    k.ball(0.014, x, Y + 0.66, gz + 0.06, HV.gold, 0);
    k.box(0.016, 0.04, 0.01, x, Y + 0.3, gz + 0.11, HV.win, { glow: true });
  }
  k.sheet(2, 4, (u, v) => [(u - 0.5) * 0.09, Y + 0.33 - v * 0.17 - (Math.abs(u - 0.5) < 0.01 ? 0 : 0) + (v === 1 ? (Math.abs(u - 0.5) < 0.1 ? 0.035 : 0) : 0), gz + 0.083 + Math.sin(v * 3) * 0.006], HV.banner, { top: 1.1, bot: 0.85, ao: false });
  k.box(0.012, 0.11, 0.004, 0, Y + 0.19, gz + 0.09, HV.gold, { ao: false });
  k.box(0.05, 0.012, 0.004, 0, Y + 0.27, gz + 0.09, HV.gold, { ao: false });
  k.limb([-0.06, Y + 0.335, gz + 0.085], [0.06, Y + 0.335, gz + 0.085], 0.006, 0.006, HV.gold, 4);

  // the keep: square block, four corner turrets, tall central spire
  const kx = 0, kz = -0.12, kw = 0.34, kh = 0.46;
  k.box(kw, kh, kw, kx, Y, kz, HV.stone, { top: 1.12, bot: 0.72 });
  k.box(kw + 0.02, 0.025, kw + 0.02, kx, Y + kh - 0.01, kz, HV.stoneD);
  for (let i = 0; i < 4; i++) {
    const t = -0.13 + i * 0.087;
    for (const [mx, mz] of [[t, kw / 2 + 0.002], [t, -kw / 2 - 0.002], [kw / 2 + 0.002, t], [-kw / 2 - 0.002, t]]) k.box(0.035, 0.045, 0.035, kx + mx, Y + kh + 0.01, kz + mz, HV.stone, { top: 1.2 });
  }
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = kx + sx * kw / 2, z = kz + sz * kw / 2;
    k.cyl(0.05, 0.055, kh + 0.17, x, Y, z, HV.stone, 8, { top: 1.12, bot: 0.75 });
    k.cyl(0.062, 0.05, 0.03, x, Y + kh + 0.17, z, HV.stoneD, 8);
    k.cone(0.07, 0.24, x, Y + kh + 0.2, z, HV.roof, 8, { top: 1.35, bot: 0.7 });
    k.ball(0.013, x, Y + kh + 0.44, z, HV.gold, 0);
    k.winCyl(x, z, 0.051, Math.atan2(sz, sx), Y + kh + 0.06, 0.016, 0.04, HV.win);
  }
  // big windows on the keep front and sides
  for (const [x, y] of [[-0.08, 0.3], [0.08, 0.3], [-0.08, 0.16], [0.08, 0.16]]) {
    k.box(0.04, 0.07, 0.012, kx + x, Y + y, kz + kw / 2, HV.win, { glow: true });
    k.tor(0.02, 0.006, kx + x, Y + y + 0.07, kz + kw / 2 + 0.006, HV.stoneD, Math.PI, { rs: 6, ts: 3 });
  }
  for (const s of [-1, 1]) for (const z of [-0.06, 0.06]) k.box(0.012, 0.07, 0.035, kx + s * kw / 2, Y + 0.28, kz + z, HV.win, { glow: true });
  // rose window over the keep door, door, and hanging banners
  k.cyl(0.035, 0.035, 0.012, kx, Y + 0.41, kz + kw / 2 + 0.002, HV.win, 8, { rx: Math.PI / 2, glow: true });
  k.box(0.08, 0.1, 0.02, kx, Y, kz + kw / 2, HV.door);
  k.tor(0.04, 0.01, kx, Y + 0.1, kz + kw / 2 + 0.008, HV.stoneD, Math.PI, { rs: 6 });
  for (const s of [-1, 1]) {
    const bx = kx + s * 0.135;
    k.sheet(1, 5, (u, v) => {
      const yy = Y + kh - 0.02 - v * 0.27, xx = bx + (u - 0.5) * 0.055;
      const tip = v === 1 ? (u === 0.5 ? 0 : 0.03) : 0;
      return [xx, yy + (v === 1 ? (Math.abs(u - 0.5) > 0.4 ? 0 : 0) : 0) + tip * 0, kz + kw / 2 + 0.012 + Math.sin(v * 4 + s) * 0.006];
    }, HV.banner, { top: 1.12, bot: 0.8, ao: false });
    k.box(0.01, 0.17, 0.004, bx, Y + kh - 0.22, kz + kw / 2 + 0.02, HV.gold, { ao: false });
    k.ball(0.014, bx, Y + kh - 0.08, kz + kw / 2 + 0.02, HV.gold, 0, { ao: false });
  }
  // central spire tower rising from the keep
  const sh = 0.44;
  k.lathe([[0.09, 0], [0.085, sh], [0.105, sh + 0.02], [0.105, sh + 0.045], [0.08, sh + 0.045]], kx, Y + kh, kz, HV.stone, 10, { top: 1.12, bot: 0.85 });
  for (let i = 0; i < 4; i++) k.winCyl(kx, kz, 0.087, i * Math.PI / 2 + Math.PI / 2, Y + kh + 0.18, 0.025, 0.07, HV.win);
  k.cone(0.14, 0.5, kx, Y + kh + sh + 0.045, kz, HV.roof, 12, { top: 1.45, bot: 0.75 });
  k.tor(0.13, 0.011, kx, Y + kh + sh + 0.05, kz, HV.gold, TAU, { rx: Math.PI / 2, rs: 12, ts: 3 });
  const tipY = Y + kh + sh + 0.045 + 0.5;
  k.ball(0.022, kx, tipY, kz, HV.gold, 1); k.cone(0.01, 0.08, kx, tipY + 0.01, kz, HV.gold, 4);
  k.limb([kx, tipY, kz], [kx, tipY + 0.2, kz], 0.006, 0.005, HV.gold, 4);
  pennant(k, kx, tipY + 0.165, kz, 0.3, 0.1, HV.banner, { dir: 1, amp: 0.035, tail: 0.35 });
  // great hall in front-left: gabled blue roof
  k.box(0.16, 0.16, 0.26, -0.28, Y, 0.04, HV.plaster, { top: 1.08, bot: 0.75 });
  k.gable(0.26, 0.11, 0.16, -0.28, Y + 0.16, 0.04, HV.roof, HV.plaster, Math.PI / 2);
  for (const z of [-0.04, 0.04, 0.12]) k.box(0.012, 0.045, 0.026, -0.28 + 0.081, Y + 0.07, z, HV.win, { glow: true });
  k.box(0.04, 0.24, 0.04, -0.28, Y, 0.18, HV.stone, {});
  k.cone(0.04, 0.12, -0.28, Y + 0.24, 0.18, HV.roof, 4, { ry: Math.PI / 4 });
  // little houses in the courtyard
  const houses = [[0.27, 0.08, 0.6, HV.red], [0.33, 0.24, 0.2, HV.roof], [0.16, 0.28, -0.3, HV.red], [-0.14, 0.3, 0.3, HV.red], [0.3, -0.12, 1.4, HV.roofD], [-0.32, -0.2, 1.2, HV.red]];
  for (const [x, z, ry, rc] of houses) {
    const w = 0.11 + k.r() * 0.03, d = 0.08, h = 0.075 + k.r() * 0.03;
    k.box(w, h, d, x, Y, z, HV.plaster, { ry, top: 1.05, bot: 0.75 });
    k.box(w * 0.98, 0.012, d * 1.01, x, Y + h * 0.55, z, HV.wood, { ry }); // half-timber band
    k.gable(w, 0.06, d, x, Y + h, z, rc, HV.plaster, ry, 0.012);
    const fx = Math.sin(ry), fz = Math.cos(ry);
    k.box(0.018, 0.024, 0.006, x + fx * (d / 2 + 0.002) - Math.cos(ry) * 0.025, Y + h * 0.6, z + fz * (d / 2 + 0.002) + Math.sin(ry) * 0.025, HV.win, { glow: true, ry });
    k.box(0.018, 0.035, 0.006, x + fx * (d / 2 + 0.002) + Math.cos(ry) * 0.02, Y, z + fz * (d / 2 + 0.002) - Math.sin(ry) * 0.02, HV.wood, { ry });
    k.box(0.015, 0.05, 0.015, x - Math.cos(ry) * w * 0.3, Y + h + 0.02, z + Math.sin(ry) * w * 0.3, HV.stoneD, { ry });
  }
  // a couple of round trees and a well in the courtyard
  for (const [x, z] of [[0.08, 0.22], [-0.18, 0.4]]) { k.cyl(0.008, 0.012, 0.05, x, Y, z, HV.wood, 5); k.ball(0.04, x, Y + 0.08, z, 0x5aa83a, 1, { top: 1.3, bot: 0.8, s: [1, 1.1, 1] }); }
  k.cyl(0.03, 0.03, 0.03, 0.15, Y, 0.38, HV.stoneD, 8); k.cyl(0.024, 0.024, 0.005, 0.15, Y + 0.028, 0.38, 0x6ac8ff, 8, { glow: true });
  return finish(k);
}

const NC = { stone: 0x9c8fb4, stoneD: 0x76689a, stoneL: 0xc2b6d6, spike: 0x6a54a0, bone: 0xf6eed4, boneD: 0xd2c4a0, green: 0x7affa8, greenD: 0x34e078, red: 0xd8283c, ash: 0x9a9a80, pave: 0x8a809a, wood: 0x7a6656, purple: 0x7a4aa0 };
function necroTown() {
  const k = makeKit(13);
  k.lathe([[0.69, 0], [0.68, 0.025], [0.62, 0.05], [0, 0.05]], 0, 0, 0, NC.ash, 14, { top: 1.05, bot: 0.8 });
  k.cyl(0.5, 0.52, 0.01, 0, 0.05, -0.02, NC.pave, 12, { j: 0.08 });
  k.box(0.12, 0.01, 0.28, 0, 0.05, 0.5, NC.pave, { j: 0.08 });
  const Y = 0.055;
  // ghostly pool in the courtyard
  k.cyl(0.13, 0.13, 0.004, 0.18, Y + 0.004, 0.16, NC.greenD, 10, { glow: true });
  k.lathe([[0.135, 0], [0.145, 0.02], [0.13, 0.02]], 0.18, Y, 0.16, NC.stoneL, 10);
  // jagged curtain wall with spikes
  const R = 0.56, tw = [];
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; tw.push([Math.cos(a) * R, Math.sin(a) * R, a]); }
  for (let i = 0; i < 6; i++) {
    const [ax, az] = tw[i], [bx, bz] = tw[(i + 1) % 6];
    if (i === 1) {
      k.wall(ax, az, 0.15, 0.485, 0.26, 0.07, NC.stone, { trim: NC.stoneL, spikes: NC.spike, step: 0.05 });
      k.wall(-0.15, 0.485, bx, bz, 0.26, 0.07, NC.stone, { trim: NC.stoneL, spikes: NC.spike, step: 0.05 });
    } else k.wall(ax, az, bx, bz, 0.26, 0.07, NC.stone, { trim: NC.stoneL, spikes: NC.spike, step: 0.06 });
  }
  // towers: tapering hexagonal shafts with black needle spires and green slits
  for (let i = 0; i < 6; i++) {
    const [x, z, a] = tw[i];
    const front = i === 1 || i === 2, h = front ? 0.5 : 0.42, rr = 0.085;
    k.lathe([[rr * 1.3, 0], [rr, 0.1], [rr * 0.85, h], [rr * 1.25, h + 0.02], [rr * 1.25, h + 0.05], [rr * 0.7, h + 0.05]], x, Y, z, NC.stone, 6, { top: 1.15, bot: 0.7 });
    for (let s = 0; s < 6; s++) { const b = s / 6 * TAU + 0.5; k.cone(0.014, 0.07, x + Math.cos(b) * rr * 1.2, Y + h + 0.05, z + Math.sin(b) * rr * 1.2, NC.spike, 4, { rz: Math.cos(b) * -0.35, rx: Math.sin(b) * 0.35 }); }
    const sp = front ? 0.46 : 0.36;
    k.cone(rr * 0.95, sp, x, Y + h + 0.05, z, NC.spike, 6, { top: 1.5, bot: 0.9 });
    k.ball(0.022, x, Y + h + 0.05 + sp + 0.03, z, NC.green, 1, { glow: true });
    k.winCyl(x, z, rr * 0.93, a, Y + h * 0.6, 0.016, 0.07, NC.green);
    k.winCyl(x, z, rr * 0.93, a + 1.0, Y + h * 0.35, 0.014, 0.05, NC.green);
    k.winCyl(x, z, rr * 0.93, a - 1.0, Y + h * 0.35, 0.014, 0.05, NC.green);
    if (front) { const ty = Y + h * 0.88; const dx = Math.cos(a), dz = Math.sin(a);
      k.sheet(1, 4, (u, v) => [x + dx * rr * 1.25 + (u - 0.5) * 0.06 * dz, ty - v * 0.2 - (v === 1 && Math.abs(u - 0.5) > 0.4 ? -0.03 : 0), z + dz * rr * 1.25 - (u - 0.5) * 0.06 * dx], NC.red, { top: 1.15, bot: 0.7, ao: false }); }
  }
  // gate: a dark portal framed by a ribcage of bone arches, with a skull above
  const gz = 0.49;
  k.box(0.3, 0.3, 0.14, 0, Y, gz - 0.01, NC.stone, { top: 1.1, bot: 0.7 });
  k.cone(0.17, 0.16, 0, Y + 0.3, gz - 0.01, NC.spike, 4, { ry: Math.PI / 4, s: [1, 1, 0.5], top: 1.3 });
  k.box(0.11, 0.15, 0.02, 0, Y, gz + 0.06, NC.purple, { ao: false });
  k.box(0.09, 0.13, 0.01, 0, Y, gz + 0.065, NC.greenD, { glow: true });
  for (let i = 0; i < 3; i++) {
    const rr = 0.085 + i * 0.022, zz = gz + 0.075 + i * 0.03;
    k.tor(rr, 0.012 - i * 0.002, 0, Y + 0.12 - i * 0.01, zz, i === 1 ? NC.boneD : NC.bone, Math.PI, { rs: 9, ts: 4, top: 1.15 });
    for (const s of [-1, 1]) k.cyl(0.013, 0.016, 0.12 - i * 0.01, s * rr, Y, zz, NC.bone, 5);
  }
  // skull
  k.ball(0.045, 0, Y + 0.26, gz + 0.09, NC.bone, 1, { s: [1, 0.95, 0.9], top: 1.15, bot: 0.8 });
  k.box(0.05, 0.025, 0.04, 0, Y + 0.205, gz + 0.1, NC.boneD);
  for (const s of [-1, 1]) { k.ball(0.012, s * 0.017, Y + 0.262, gz + 0.128, NC.green, 0, { glow: true }); k.cone(0.012, 0.06, s * 0.045, Y + 0.28, gz + 0.08, NC.bone, 4, { rz: -s * 0.9 }); }
  // the necropolis cathedral: a central needle spire with flanking spires
  const cz = -0.13;
  k.box(0.36, 0.34, 0.3, 0, Y, cz, NC.stone, { top: 1.12, bot: 0.65 });
  k.box(0.38, 0.03, 0.32, 0, Y + 0.33, cz, NC.stoneL);
  k.gable(0.36, 0.14, 0.3, 0, Y + 0.36, cz, NC.spike, NC.stone, Math.PI / 2, 0.02);
  // pointed lancet windows and a big green rose window
  for (const x of [-0.11, 0.11]) { k.box(0.035, 0.12, 0.012, x, Y + 0.12, cz + 0.152, NC.green, { glow: true }); k.cone(0.025, 0.04, x, Y + 0.24, cz + 0.152, NC.green, 4, { glow: true, s: [0.7, 1, 0.25] }); }
  k.cyl(0.05, 0.05, 0.012, 0, Y + 0.25, cz + 0.152, NC.green, 8, { rx: Math.PI / 2, glow: true });
  k.tor(0.055, 0.008, 0, Y + 0.25, cz + 0.16, NC.bone, TAU, { rs: 10 });
  k.box(0.08, 0.12, 0.02, 0, Y, cz + 0.155, NC.purple);
  k.box(0.064, 0.1, 0.01, 0, Y, cz + 0.162, NC.greenD, { glow: true });
  // flanking needle spires
  for (const [sx, sz, hh] of [[-1, 1, 0.62], [1, 1, 0.62], [-1, -1, 0.5], [1, -1, 0.5]]) {
    const x = sx * 0.17, z = cz + sz * 0.14;
    k.lathe([[0.055, 0], [0.048, hh], [0.062, hh + 0.02], [0.03, hh + 0.02]], x, Y, z, NC.stone, 6, { top: 1.15, bot: 0.7 });
    k.cone(0.05, 0.3, x, Y + hh + 0.02, z, NC.spike, 6, { top: 1.5 });
    k.winCyl(x, z, 0.05, Math.atan2(sz, sx), Y + hh - 0.1, 0.014, 0.06, NC.green);
    k.ball(0.014, x, Y + hh + 0.34, z, NC.green, 0, { glow: true });
  }
  // the great spire
  const st = Y + 0.36;
  k.lathe([[0.1, 0], [0.085, 0.42], [0.11, 0.44], [0.11, 0.48], [0.06, 0.48]], 0, st, cz, NC.stone, 8, { top: 1.18, bot: 0.75 });
  for (let i = 0; i < 4; i++) k.winCyl(0, cz, 0.092, i * Math.PI / 2 + Math.PI / 2, st + 0.24, 0.022, 0.1, NC.green);
  for (let s = 0; s < 8; s++) { const b = s / 8 * TAU; k.cone(0.016, 0.09, Math.cos(b) * 0.1, st + 0.48, cz + Math.sin(b) * 0.1, NC.spike, 4, { rz: Math.cos(b) * -0.3, rx: Math.sin(b) * 0.3 }); }
  k.cone(0.095, 0.6, 0, st + 0.48, cz, NC.spike, 8, { top: 1.6, bot: 0.9 });
  k.ball(0.04, 0, st + 1.12, cz, NC.green, 1, { glow: true });
  k.tor(0.06, 0.006, 0, st + 1.12, cz, NC.greenD, TAU, { glow: true, rx: 0.4, rs: 12 });
  // flying bone buttresses from spire to the front spires
  for (const sx of [-1, 1]) {
    const pts = []; for (let i = 0; i <= 4; i++) { const t = i / 4; pts.push([sx * (0.1 + t * 0.07), st + 0.38 - Math.sin(t * Math.PI * 0.5) * 0.0 - t * t * 0.08, cz + t * 0.14]); }
    for (let i = 0; i < 4; i++) k.limb(pts[i], pts[i + 1], 0.012, 0.012, NC.bone, 5);
  }
  // red banners on the cathedral front
  for (const s of [-1, 1]) {
    const bx = s * 0.06;
    k.sheet(1, 4, (u, v) => [bx + (u - 0.5) * 0.045, Y + 0.33 - v * 0.2 + (v === 1 && Math.abs(u - 0.5) > 0.4 ? 0.025 : 0), cz + 0.163 + Math.sin(v * 3 + s) * 0.005], NC.red, { top: 1.2, bot: 0.75, ao: false });
    k.box(0.006, 0.08, 0.003, bx, Y + 0.22, cz + 0.17, NC.bone, { ao: false });
  }
  // crypts and mausoleums
  const crypts = [[-0.3, 0.12, 0.5], [0.33, -0.08, -0.9], [-0.15, 0.32, 0.2], [0.34, 0.27, -0.4]];
  for (const [x, z, ry] of crypts) {
    const w = 0.1, d = 0.11, h = 0.08;
    k.box(w + 0.02, 0.015, d + 0.02, x, Y, z, NC.stoneL, { ry });
    k.box(w, h, d, x, Y + 0.015, z, NC.stone, { ry, top: 1.15, bot: 0.75 });
    k.cone(w * 0.78, 0.09, x, Y + h + 0.015, z, NC.spike, 4, { ry: ry + Math.PI / 4, top: 1.4 });
    const fx = Math.sin(ry), fz = Math.cos(ry), sx = Math.cos(ry), sz = -Math.sin(ry);
    k.box(0.035, 0.05, 0.006, x + fx * (d / 2 + 0.002), Y + 0.015, z + fz * (d / 2 + 0.002), NC.green, { ry, glow: true });
    for (const s of [-1, 1]) k.cyl(0.008, 0.008, h, x + fx * (d / 2 + 0.01) + sx * s * 0.035, Y + 0.015, z + fz * (d / 2 + 0.01) + sz * s * 0.035, NC.bone, 5);
  }
  // tombstones
  for (let i = 0; i < 7; i++) {
    const a = 1.9 + i * 0.32, rr = 0.36 + (i % 2) * 0.06, x = Math.cos(a) * rr, z = Math.sin(a) * rr * 0.9;
    if (z > 0.3) continue;
    k.box(0.03, 0.04 + k.r() * 0.02, 0.012, x, Y, z, NC.stoneL, { ry: (k.r() - 0.5) * 0.6, rz: (k.r() - 0.5) * 0.3, top: 1.25 });
  }
  // a giant ribcage in the courtyard
  for (let i = 0; i < 4; i++) {
    const z = 0.02 + i * 0.045, rr = 0.07 - Math.abs(i - 1.5) * 0.008;
    k.tor(rr, 0.008, 0.3, Y, z + 0.0, NC.bone, Math.PI * 0.85, { rs: 7, ts: 3, ry: 0, rz: 0.25 });
  }
  k.limb([0.3, Y + 0.01, 0.0], [0.3, Y + 0.02, 0.17], 0.012, 0.01, NC.boneD, 5);
  // dead trees
  for (const [x, z] of [[-0.42, 0.22], [0.1, 0.35]]) {
    k.limb([x, Y, z], [x + 0.01, Y + 0.13, z], 0.012, 0.006, NC.wood, 4);
    k.limb([x + 0.005, Y + 0.08, z], [x - 0.04, Y + 0.14, z + 0.01], 0.006, 0.003, NC.wood, 4);
    k.limb([x + 0.008, Y + 0.1, z], [x + 0.05, Y + 0.16, z - 0.01], 0.005, 0.003, NC.wood, 4);
  }
  // drifting ghost lights
  for (const [x, y, z] of [[-0.2, 0.42, 0.22], [0.2, 0.5, 0.05], [-0.05, 0.3, 0.35], [0.42, 0.62, -0.2]]) k.ball(0.014, x, y, z, NC.green, 0, { glow: true });
  return finish(k);
}

export function townModel(fac) {
  return fac === 'necro' ? necroTown() : havenTown();
}

// ------------------------------------------------------------------ mounted heroes
function horse(k, coat, mane, hoof, glowEyes) {
  const coatD = shadeOf(coat, 0.78), coatL = shadeOf(coat, 1.12);
  // barrel, chest and rump
  k.ball(1, 0, 0.47, 0.0, coat, 2, { s: [0.13, 0.13, 0.27], top: 1.15, bot: 0.75 });
  k.ball(1, 0, 0.49, 0.17, coatL, 1, { s: [0.12, 0.13, 0.1] });
  k.ball(1, 0, 0.5, -0.18, coat, 1, { s: [0.13, 0.13, 0.12], top: 1.15 });
  // neck and head
  k.limb([0, 0.52, 0.18], [0, 0.73, 0.31], 0.075, 0.052, coat, 7, { top: 1.12 });
  k.limb([0, 0.75, 0.3], [0, 0.65, 0.45], 0.05, 0.03, coat, 7, { top: 1.1 });
  k.ball(0.035, 0, 0.635, 0.45, coatD, 1);
  for (const s of [-1, 1]) {
    k.cone(0.016, 0.06, s * 0.025, 0.76, 0.29, coat, 4, { rx: -0.2, rz: -s * 0.2 });
    if (glowEyes) k.ball(0.011, s * 0.038, 0.72, 0.37, glowEyes, 0, { glow: true });
    else k.ball(0.009, s * 0.04, 0.72, 0.37, 0x1a1210, 0);
  }
  // mane along the neck
  for (let i = 0; i < 5; i++) { const t = i / 4; k.box(0.025, 0.06, 0.06, 0, 0.56 + t * 0.2, 0.15 + t * 0.14, mane, { rx: -0.6 }); }
  // legs: front pair mid-stride, rear planted
  const legs = [[-0.075, 0.15, 0.08, 0.06], [0.075, 0.17, -0.02, 0.14], [-0.075, -0.18, -0.02, -0.08], [0.075, -0.17, 0.02, -0.2]];
  for (const [x, z, kn, ft] of legs) {
    const hip = [x, 0.45, z], knee = [x, 0.24, z + kn * 0.5], foot = [x, 0.035, z + ft * 0.6];
    k.limb(hip, knee, 0.05, 0.03, coat, 6);
    k.limb(knee, foot, 0.022, 0.02, coatD, 5);
    k.cyl(0.026, 0.03, 0.04, foot[0], 0, foot[2], hoof, 6);
  }
  // tail
  k.limb([0, 0.55, -0.28], [0, 0.42, -0.38], 0.03, 0.035, mane, 5);
  k.limb([0, 0.42, -0.38], [0, 0.22, -0.4], 0.035, 0.012, mane, 5);
}
// a cloth sheet hanging down one side of the horse
function caparison(k, col, trim, side) {
  const c = shadeOf(col, 1);
  k.sheet(6, 2, (u, v) => {
    const z = -0.24 + u * 0.46;
    const yTop = 0.55 + Math.sin(u * Math.PI) * 0.02, yBot = 0.33 + Math.sin(u * TAU * 2.5) * 0.012;
    const y = yTop + (yBot - yTop) * v;
    return [side * (0.118 + v * 0.025 + Math.sin(u * 12) * 0.006 * v + Math.sin(u * Math.PI) * 0.02), y, z];
  }, c, { shade: (u, v) => 1.12 - v * 0.35 + 0.1 * Math.sin(u * 12), top: 1, bot: 1, ao: false });
  k.limb([side * 0.145, 0.33, -0.24], [side * 0.145, 0.33, 0.22], 0.008, 0.008, trim, 4, { ao: false });
}
function cape(k, col, x0, y0, z0, w, len) {
  k.sheet(4, 5, (u, v) => {
    const x = (u - 0.5) * (w + v * 0.1) + Math.sin(v * 5 + u * 3) * 0.008;
    const y = y0 - v * len * 0.7, z = z0 - v * len * 0.65 - Math.sin(u * Math.PI * 3) * 0.015 * v;
    return [x0 + x, y + Math.sin(u * Math.PI) * 0.01, z];
  }, col, { shade: (u, v) => 1.08 - v * 0.25 + 0.14 * Math.sin(u * Math.PI * 3), top: 1, bot: 1, ao: false });
}
// the hero's standard: crossbar, a big bright swallow-tailed banner streaming back and a trim stripe
function heroBanner(k, col, trim) {
  const c = shadeOf(col, 1).lerp(new THREE.Color(1, 1, 1), 0.08);
  k.limb([-0.16, 1.27, 0.155], [-0.16, 1.27, -0.2], 0.006, 0.006, trim, 4, { ao: false });
  pennant(k, -0.16, 1.15, 0.15, 0.46, 0.25, c, { axis: 'z', dir: -1, amp: 0.05, tail: 0.32, taper: 0.22, droop: 0.12, nu: 9 });
  pennant(k, -0.16, 1.035, 0.15, 0.4, 0.03, trim, { axis: 'z', dir: -1, amp: 0.05, tail: 0, taper: 0.1, droop: 0.2, nu: 9 });
}
function havenHero(k, col) {
  const STEEL = 0xe8ecf4, STEELD = 0xb4bccb, GOLD = 0xffcf4a, WOOD = 0x9a6a42;
  horse(k, 0xfbf8f0, 0xf0cc78, 0x8a6a48, null);
  caparison(k, col, GOLD, -1); caparison(k, col, GOLD, 1);
  k.box(0.2, 0.03, 0.18, 0, 0.6, -0.02, 0xa8683a); // saddle
  // bridle and reins
  k.limb([0, 0.66, 0.45], [0, 0.82, 0.12], 0.004, 0.004, 0x7a4a2a, 3);
  // rider
  for (const s of [-1, 1]) {
    k.limb([s * 0.07, 0.65, -0.02], [s * 0.14, 0.53, 0.09], 0.035, 0.03, STEEL, 6);
    k.limb([s * 0.14, 0.53, 0.09], [s * 0.145, 0.37, 0.04], 0.026, 0.024, STEELD, 6);
    k.box(0.04, 0.03, 0.08, s * 0.145, 0.34, 0.06, 0x8a5a36);
  }
  k.lathe([[0.075, 0], [0.095, 0.06], [0.1, 0.13], [0.085, 0.2], [0.04, 0.24]], 0, 0.62, -0.02, STEEL, 9, { top: 1.3, bot: 0.7 });
  k.cyl(0.098, 0.1, 0.035, 0, 0.66, -0.02, col, 9, { top: 1.1 }); // tabard band
  k.box(0.07, 0.11, 0.01, 0, 0.66, 0.075, col, { rx: -0.08 });
  k.box(0.012, 0.07, 0.004, 0, 0.68, 0.082, GOLD, { ao: false }); k.box(0.04, 0.012, 0.004, 0, 0.73, 0.082, GOLD, { ao: false });
  for (const s of [-1, 1]) k.ball(0.048, s * 0.1, 0.82, -0.02, STEEL, 1, { s: [1, 0.75, 1], top: 1.3 });
  // arms: right holds reins, left holds the banner pole
  k.limb([0.1, 0.81, -0.02], [0.13, 0.7, 0.08], 0.028, 0.024, STEEL, 6);
  k.limb([0.13, 0.7, 0.08], [0.05, 0.66, 0.16], 0.022, 0.02, STEELD, 6);
  k.limb([-0.1, 0.81, -0.02], [-0.16, 0.72, 0.07], 0.028, 0.024, STEEL, 6);
  k.limb([-0.16, 0.72, 0.07], [-0.16, 0.76, 0.14], 0.022, 0.02, STEELD, 6);
  // shield on the right side
  k.lathe([[0.0, 0], [0.07, 0.005], [0.075, 0.015]], 0.18, 0.62, 0.02, col, 8, { rz: -Math.PI / 2 - 0.1, top: 1, bot: 1 });
  k.tor(0.072, 0.008, 0.188, 0.62, 0.02, GOLD, TAU, { ry: Math.PI / 2, rs: 12 });
  k.ball(0.018, 0.195, 0.62, 0.02, GOLD, 0);
  // head and gold great helm with plume
  k.ball(0.05, 0, 0.9, -0.02, 0xe8b890, 1);
  k.lathe([[0.058, 0], [0.062, 0.05], [0.058, 0.085], [0.035, 0.11], [0.0, 0.115]], 0, 0.86, -0.02, GOLD, 9, { top: 1.35, bot: 0.75 });
  k.box(0.08, 0.008, 0.02, 0, 0.905, 0.035, 0x5a3e22, { ao: false }); // visor slit
  k.box(0.012, 0.05, 0.02, 0, 0.88, 0.04, GOLD, { ao: false });
  for (let i = 0; i < 4; i++) k.ball(0.025 - i * 0.003, 0, 0.99 + i * 0.012 - i * i * 0.004, -0.03 - i * 0.03, 0xffffff, 1, { s: [0.6, 1, 1.2] });
  // cape
  cape(k, col, 0, 0.83, -0.08, 0.17, 0.42);
  // banner pole and pennant
  k.limb([-0.16, 0.42, 0.11], [-0.16, 1.32, 0.15], 0.011, 0.009, WOOD, 5);
  k.ball(0.026, -0.16, 1.33, 0.15, GOLD, 1, { ao: false });
  k.cone(0.016, 0.07, -0.16, 1.35, 0.15, GOLD, 4, { ao: false });
  heroBanner(k, col, GOLD);
}
function necroHero(k, col) {
  const ROBE = 0x7a54a6, ROBED = 0x5c3e86, BONE = 0xf6eed4, IRON = 0x9a92ae, GREEN = 0x7affa8;
  horse(k, 0x9a8cb8, 0x3ab06a, 0x5a4a70, GREEN);
  // ghostly mane flames
  for (let i = 0; i < 5; i++) { const t = i / 4; k.cone(0.02, 0.07, 0, 0.6 + t * 0.18, 0.15 + t * 0.14, GREEN, 4, { glow: true, rx: -0.9 }); }
  caparison(k, col, BONE, -1); caparison(k, col, BONE, 1);
  k.box(0.2, 0.03, 0.18, 0, 0.6, -0.02, 0x9a3048);
  // skull-like horse armour plate
  k.ball(1, 0, 0.715, 0.4, BONE, 1, { s: [0.03, 0.02, 0.055], rx: 0.6 });
  for (const s of [-1, 1]) k.cone(0.012, 0.07, s * 0.03, 0.76, 0.3, BONE, 4, { rx: -0.5, rz: -s * 0.4 });
  for (const s of [-1, 1]) {
    k.limb([s * 0.07, 0.65, -0.02], [s * 0.14, 0.53, 0.09], 0.035, 0.03, ROBE, 6);
    k.limb([s * 0.14, 0.53, 0.09], [s * 0.145, 0.37, 0.04], 0.026, 0.024, ROBED, 6);
    k.box(0.04, 0.03, 0.08, s * 0.145, 0.34, 0.06, 0x5a4a70);
  }
  // robed torso with flared skirt over the saddle
  k.lathe([[0.13, 0], [0.1, 0.06], [0.09, 0.14], [0.085, 0.2], [0.04, 0.25]], 0, 0.6, -0.02, ROBE, 9, { top: 1.3, bot: 0.65 });
  k.box(0.05, 0.16, 0.01, 0, 0.62, 0.08, col, { rx: -0.1 });
  for (const s of [-1, 1]) {
    k.ball(0.05, s * 0.1, 0.82, -0.02, IRON, 1, { s: [1, 0.7, 1], top: 1.4 });
    for (let i = 0; i < 2; i++) k.cone(0.012, 0.07, s * (0.1 + i * 0.03), 0.84, -0.03 - i * 0.03, BONE, 4, { rz: -s * 0.5 });
  }
  k.limb([0.1, 0.81, -0.02], [0.13, 0.7, 0.08], 0.028, 0.024, ROBE, 6);
  k.limb([0.13, 0.7, 0.08], [0.06, 0.67, 0.16], 0.022, 0.02, ROBED, 6);
  k.ball(0.018, 0.06, 0.67, 0.17, BONE, 0);
  k.limb([-0.1, 0.81, -0.02], [-0.16, 0.72, 0.07], 0.028, 0.024, ROBE, 6);
  k.limb([-0.16, 0.72, 0.07], [-0.16, 0.76, 0.14], 0.022, 0.02, ROBED, 6);
  // skull face in a deep hood
  k.ball(0.048, 0, 0.9, -0.01, BONE, 1, { s: [0.95, 1.05, 1], top: 1.2 });
  k.lathe([[0.075, 0], [0.07, 0.06], [0.055, 0.1], [0.02, 0.15], [0.0, 0.17]], 0, 0.855, -0.03, ROBED, 8, { top: 1.3, bot: 0.8, rx: -0.25 });
  k.ball(0.044, 0, 0.9, 0.0, 0x4a3468, 1, { s: [1, 1.05, 0.6], ao: false });
  for (const s of [-1, 1]) k.ball(0.011, s * 0.018, 0.905, 0.03, GREEN, 0, { glow: true });
  cape(k, col, 0, 0.83, -0.08, 0.18, 0.44);
  // a bone-topped staff that bears the banner
  k.limb([-0.16, 0.42, 0.11], [-0.16, 1.3, 0.15], 0.011, 0.009, 0x8a7a6a, 5);
  k.ball(0.036, -0.16, 1.33, 0.15, BONE, 1, { s: [1, 1.05, 1.05], ao: false });
  for (const s of [-1, 1]) k.ball(0.01, -0.16 + s * 0.014, 1.335, 0.182, GREEN, 0, { glow: true });
  for (const s of [-1, 1]) k.cone(0.009, 0.06, -0.16 + s * 0.022, 1.345, 0.14, BONE, 4, { rz: -s * 0.5, ao: false });
  heroBanner(k, col, BONE);
}
export function heroModel(fac, color) {
  const k = makeKit(fac === 'necro' ? 23 : 21);
  (fac === 'necro' ? necroHero : havenHero)(k, color ?? (fac === 'necro' ? 0xd83a3a : 0x3a7aff));
  const m = finish(k);
  m.body.scale(1.12, 1.12, 1.12); m.body.computeBoundingSphere(); m.body.computeBoundingBox();
  if (m.glow) { m.glow.scale(1.12, 1.12, 1.12); m.glow.computeBoundingSphere(); }
  return m;
}

// ------------------------------------------------------------------ ownership flag
export function flagModel(color = 0xffffff) {
  const k = makeKit(9);
  k.cyl(0.07, 0.09, 0.05, 0, 0, 0, 0x6a6460, 6, { top: 1.1, bot: 0.7 });
  k.limb([0, 0.03, 0], [0, 1.0, 0], 0.022, 0.016, 0x6a4a32, 6, { top: 1.2, bot: 0.8 });
  k.ball(0.035, 0, 1.02, 0, 0xf2c24a, 1, { ao: false });
  pennant(k, 0, 0.82, 0, 0.55, 0.3, color, { dir: 1, amp: 0.11, waves: 1.4, tail: 0.32, taper: 0.35, droop: 0.12, nu: 10 });
  return finish(k);
}
