import * as THREE from 'three';
import { BONE as RIG, tagRange, ensureRig } from './rig.js?v=1.8';

// =====================================================================
// HEX REALMS: faction towns, mounted heroes and ownership flags.
// Every model returns { body, glow }: body is a merged, vertex-coloured
// BufferGeometry (position, normal, color, uv); glow holds the emissive
// bits (windows, eyes, magic). Base at y = 0, front faces +Z.
//   townModel(fac)          fac: 'haven' | 'necro' | 'sylvan' | 'inferno' | 'dungeon' (~1.3 wide; unknown -> haven)
//   heroModel(fac, color)   rider on a horse, ~1.7 tall with the banner
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
  // shader rig: parts added inside k.bone(b, pivot, fn) carry that bone + pivot (model space)
  let rig = null;
  const add = (g, c, o = {}) => { const ng = g.index ? g.toNonIndexed() : g; (o.glow ? G : B).push({ g: ng, c, o, rig }); return ng; };
  const k = {
    r, add,
    bone(b, pivot, fn) { const old = rig; rig = { b, p: pivot }; fn(); rig = old; },
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
        if (o.spikes) k.cone(o.sw ?? 0.022, (o.sh ?? 0.07) + r() * 0.05, px, h, pz, o.spikes, 4, { top: 1.2 });
        else {
          k.box(len / n * 0.55, 0.05, 0.03, px + nx * th * 0.4, h, pz + nz * th * 0.4, c, { ry, top: 1.15 });
          k.box(len / n * 0.55, 0.05, 0.03, px - nx * th * 0.4, h, pz - nz * th * 0.4, c, { ry, top: 1.15 });
        }
      }
    },
    // a glowing window on the face of a cylinder at angle a (direction cos a, sin a)
    // a crystal: an octahedron, stretched with o.s (e.g. [1, 2.4, 1])
    gem(rad, x, y, z, c, o = {}) { return add(tf(new THREE.OctahedronGeometry(rad, 0), o).translate(x, y, z), c, o); },
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
  const ranges = [];
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), fn = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (const p of parts) {
    const P = p.g.attributes.position.array, cnt = P.length / 3;
    if (p.rig) ranges.push([o, cnt, p.rig]);
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
        const o3 = o * 3, o2 = o * 2;
        pos[o3] = x; pos[o3 + 1] = y; pos[o3 + 2] = z; nor[o3] = fn.x; nor[o3 + 1] = fn.y; nor[o3 + 2] = fn.z;
        let m = jf * (bot + (top - bot) * ((y - ymin) / span));
        if (p.o.cols) m *= p.o.cols[vi];
        if (!glow && p.o.ao !== false) m *= 0.84 + 0.16 * smooth(-0.01, 0.14, y);
        tmpC.copy(base).multiplyScalar(m);
        col[o3] = tmpC.r; col[o3 + 1] = tmpC.g; col[o3 + 2] = tmpC.b;
        if (uvs) {
          const ax = Math.abs(fn.x), ay = Math.abs(fn.y), az = Math.abs(fn.z);
          if (ay >= ax && ay >= az) { uvs[o2] = x; uvs[o2 + 1] = z; } else if (ax >= az) { uvs[o2] = z; uvs[o2 + 1] = y; } else { uvs[o2] = x; uvs[o2 + 1] = y; }
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
  ensureRig(THREE, g); // every geometry drawn with the shared rig-aware materials carries aBone/aPivot
  for (const [start, count, rg] of ranges) tagRange(THREE, g, start, count, rg.b, rg.p);
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
  k.bone(RIG.FLAG, [x0, y0 + hgt * 0.5, z0], () => k.sheet(o.nu || 8, 4, (u, v) => {
    const taper = 1 - u * (o.taper ?? 0.45);
    let yy = (v - 0.5) * hgt * taper;
    let along = u * len;
    if (tail > 0) along -= Math.max(0, 1 - Math.abs(v - 0.5) * 4) * tail * len * smooth(0.5, 1, u);
    const w = Math.sin(u * waves * TAU + ph) * amp * u;
    const droop = -u * u * hgt * (o.droop ?? 0.25);
    if (o.ang !== undefined) { const ux = Math.sin(o.ang), uz = Math.cos(o.ang); return [x0 + ux * along + uz * w, y0 + yy + droop, z0 + uz * along - ux * w]; }
    return axis === 'x' ? [x0 + dir * along, y0 + yy + droop, z0 + w] : [x0 + w, y0 + yy + droop, z0 + dir * along];
  }, c, { shade: (u, v) => 0.9 + 0.22 * Math.cos(u * waves * TAU + ph), top: 1.05, bot: 0.95, ao: false, j: 0.02 }));
}

// ------------------------------------------------------------------ towns
const HV = { stone: 0xf6f0e2, stoneD: 0xd6c9ac, roof: 0x3a78f2, roofD: 0x2e60d0, gold: 0xffcf4a, win: 0xffd070, banner: 0x2f6af0, wood: 0x9a6a42, red: 0xe0583a, plaster: 0xfbf2da, grass: 0x86c64e, apron: 0x968a78, kerb: 0x6a6054, path: 0xe6d3a0, door: 0x7a4a2a, iron: 0x9a948a };
function havenTown() {
  const k = makeKit(11);
  // ground (R3): a warm grey stone apron with a darker kerb instead of a lime grass disc, so the
  // town sits on any terrain without a neon halo; the walls and blue roofs carry the colour
  k.lathe([[0.69, 0], [0.68, 0.025], [0.62, 0.05], [0, 0.05]], 0, 0, 0, HV.apron, 14, { top: 1.08, bot: 0.7 });
  k.tor(0.665, 0.014, 0, 0.03, 0, HV.kerb, TAU, { rx: Math.PI / 2, rs: 28, ts: 3 });
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
    // R4: big, steep blue cones with a thick gold collar: the town's silhouette at map zoom
    const rh = front ? 0.4 : 0.32;
    k.cone(rr * 1.5, rh, x, Y + h + 0.03, z, HV.roof, 8, { top: 1.4, bot: 0.75 });
    k.tor(rr * 1.42, 0.016, x, Y + h + 0.035, z, HV.gold, TAU, { rx: Math.PI / 2, rs: 8, ts: 3 });
    const th = Y + h + 0.03 + rh;
    k.ball(0.026, x, th, z, HV.gold, 0);
    k.winCyl(x, z, rr * 1.01, a, Y + h * 0.55, 0.04, 0.09, HV.win);
    if (front) { k.limb([x, th, z], [x, th + 0.16, z], 0.008, 0.007, HV.wood, 4); pennant(k, x, th + 0.12, z, 0.2, 0.08, HV.banner, { dir: i === 1 ? 1 : -1, amp: 0.025, tail: 0.3 }); }
  }
  // gatehouse with arch, portcullis, side turrets and a hanging banner
  const gz = 0.485;
  k.box(0.3, 0.36, 0.16, 0, Y, gz, HV.stone, { top: 1.1, bot: 0.75 });
  k.box(0.32, 0.03, 0.18, 0, Y + 0.34, gz, HV.stoneD);
  for (let i = 0; i < 5; i++) { const x = -0.13 + i * 0.065; k.box(0.035, 0.05, 0.03, x, Y + 0.37, gz + 0.075, HV.stone, { top: 1.2 }); k.box(0.035, 0.05, 0.03, x, Y + 0.37, gz - 0.075, HV.stone, { top: 1.2 }); }
  k.box(0.1, 0.13, 0.02, 0, Y, gz + 0.072, HV.door, { ao: false });
  k.tor(0.05, 0.012, 0, Y + 0.13, gz + 0.082, HV.stoneD, Math.PI, { rs: 8 });
  k.cyl(0.05, 0.05, 0.02, 0, Y + 0.12, gz + 0.072, HV.door, 8, { rx: Math.PI / 2, s: [1, 1, 1], ao: false });
  for (const sx of [-1, 1]) {
    const x = sx * 0.15;
    k.cyl(0.045, 0.05, 0.46, x, Y, gz + 0.06, HV.stone, 8, { top: 1.1, bot: 0.8 });
    k.cone(0.075, 0.24, x, Y + 0.46, gz + 0.06, HV.roof, 8, { top: 1.35, bot: 0.7 });
    k.ball(0.02, x, Y + 0.7, gz + 0.06, HV.gold, 0);
  }
  k.bone(RIG.FLAG, [0, Y + 0.335, gz + 0.085], () => k.sheet(2, 4, (u, v) => [(u - 0.5) * 0.09, Y + 0.33 - v * 0.17 - (Math.abs(u - 0.5) < 0.01 ? 0 : 0) + (v === 1 ? (Math.abs(u - 0.5) < 0.1 ? 0.035 : 0) : 0), gz + 0.083 + Math.sin(v * 3) * 0.006], HV.banner, { top: 1.1, bot: 0.85, ao: false }));
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
    k.cone(0.08, 0.28, x, Y + kh + 0.2, z, HV.roof, 8, { top: 1.35, bot: 0.7 });
    k.ball(0.02, x, Y + kh + 0.48, z, HV.gold, 0);
  }
  // big windows on the keep front and sides
  for (const x of [-0.075, 0.075]) k.box(0.055, 0.11, 0.012, kx + x, Y + 0.2, kz + kw / 2, HV.win, { glow: true });
  for (const s of [-1, 1]) k.box(0.012, 0.11, 0.055, kx + s * kw / 2, Y + 0.24, kz, HV.win, { glow: true });
  // rose window over the keep door, door, and hanging banners
  k.cyl(0.035, 0.035, 0.012, kx, Y + 0.41, kz + kw / 2 + 0.002, HV.win, 8, { rx: Math.PI / 2, glow: true });
  k.box(0.08, 0.1, 0.02, kx, Y, kz + kw / 2, HV.door);
  k.tor(0.04, 0.01, kx, Y + 0.1, kz + kw / 2 + 0.008, HV.stoneD, Math.PI, { rs: 6 });
  for (const s of [-1, 1]) {
    const bx = kx + s * 0.135;
    k.bone(RIG.FLAG, [bx, Y + kh - 0.02, kz + kw / 2 + 0.012], () => k.sheet(1, 5, (u, v) => {
      const yy = Y + kh - 0.02 - v * 0.27, xx = bx + (u - 0.5) * 0.055;
      const tip = v === 1 ? (u === 0.5 ? 0 : 0.03) : 0;
      return [xx, yy + (v === 1 ? (Math.abs(u - 0.5) > 0.4 ? 0 : 0) : 0) + tip * 0, kz + kw / 2 + 0.012 + Math.sin(v * 4 + s) * 0.006];
    }, HV.banner, { top: 1.12, bot: 0.8, ao: false }));
  }
  // central spire tower rising from the keep
  const sh = 0.44;
  k.lathe([[0.09, 0], [0.085, sh], [0.105, sh + 0.02], [0.105, sh + 0.045], [0.08, sh + 0.045]], kx, Y + kh, kz, HV.stone, 10, { top: 1.12, bot: 0.85 });
  for (let i = 0; i < 4; i++) k.winCyl(kx, kz, 0.087, i * Math.PI / 2 + Math.PI / 2, Y + kh + 0.2, 0.04, 0.11, HV.win);
  k.cone(0.16, 0.56, kx, Y + kh + sh + 0.045, kz, HV.roof, 10, { top: 1.45, bot: 0.75 });
  k.tor(0.15, 0.02, kx, Y + kh + sh + 0.05, kz, HV.gold, TAU, { rx: Math.PI / 2, rs: 10, ts: 3 });
  const tipY = Y + kh + sh + 0.045 + 0.56;
  k.ball(0.03, kx, tipY, kz, HV.gold, 1);
  k.limb([kx, tipY, kz], [kx, tipY + 0.22, kz], 0.009, 0.008, HV.gold, 4);
  pennant(k, kx, tipY + 0.18, kz, 0.34, 0.13, HV.banner, { dir: 1, amp: 0.035, tail: 0.35 });
  // great hall in front-left: gabled blue roof
  k.box(0.16, 0.16, 0.26, -0.28, Y, 0.04, HV.plaster, { top: 1.08, bot: 0.75 });
  k.gable(0.26, 0.11, 0.16, -0.28, Y + 0.16, 0.04, HV.roof, HV.plaster, Math.PI / 2);
  k.box(0.012, 0.06, 0.12, -0.28 + 0.081, Y + 0.06, 0.04, HV.win, { glow: true });
  k.box(0.04, 0.24, 0.04, -0.28, Y, 0.18, HV.stone, {});
  k.cone(0.04, 0.12, -0.28, Y + 0.24, 0.18, HV.roof, 4, { ry: Math.PI / 4 });
  // little houses in the courtyard
  // R4: four bigger red-roofed houses (bold colour blocks), no tiny windows, doors or chimneys
  const houses = [[0.28, 0.12, 0.6], [0.2, 0.3, -0.3], [-0.15, 0.31, 0.3], [0.31, -0.15, 1.4]];
  for (const [x, z, ry] of houses) {
    const w = 0.15, d = 0.1, h = 0.09;
    k.box(w, h, d, x, Y, z, HV.plaster, { ry, top: 1.05, bot: 0.75 });
    k.gable(w, 0.08, d, x, Y + h, z, HV.red, HV.plaster, ry, 0.018);
  }
  // a couple of round trees and a well in the courtyard
  for (const [x, z] of [[0.06, 0.22], [-0.3, 0.3]]) k.ball(0.055, x, Y + 0.05, z, 0x5aa83a, 1, { top: 1.3, bot: 0.8, s: [1, 1.1, 1] });
  return finish(k);
}

const NC = { stone: 0x9c8fb4, stoneD: 0x76689a, stoneL: 0xc2b6d6, spike: 0x5c4898, bone: 0xf6eed4, boneD: 0xd2c4a0, green: 0x7affa8, greenD: 0x34e078, red: 0xd8283c, ash: 0x8c877e, kerb: 0x5a5460, pave: 0x8a809a, wood: 0x7a6656, purple: 0x7a4aa0 };
function necroTown() {
  const k = makeKit(13);
  // R3: a neutral ash-grey apron with a dark kerb (no green cast) under the violet town
  k.lathe([[0.69, 0], [0.68, 0.025], [0.62, 0.05], [0, 0.05]], 0, 0, 0, NC.ash, 14, { top: 1.05, bot: 0.75 });
  k.tor(0.665, 0.014, 0, 0.03, 0, NC.kerb, TAU, { rx: Math.PI / 2, rs: 28, ts: 3 });
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
      k.wall(ax, az, 0.15, 0.485, 0.26, 0.07, NC.stone, { trim: NC.stoneL, spikes: NC.boneD, step: 0.09, sw: 0.034, sh: 0.11 });
      k.wall(-0.15, 0.485, bx, bz, 0.26, 0.07, NC.stone, { trim: NC.stoneL, spikes: NC.boneD, step: 0.09, sw: 0.034, sh: 0.11 });
    } else k.wall(ax, az, bx, bz, 0.26, 0.07, NC.stone, { trim: NC.stoneL, spikes: NC.boneD, step: 0.1, sw: 0.034, sh: 0.11 });
  }
  // towers: tapering hexagonal shafts with black needle spires and green slits
  for (let i = 0; i < 6; i++) {
    const [x, z, a] = tw[i];
    const front = i === 1 || i === 2, h = front ? 0.5 : 0.42, rr = 0.085;
    k.lathe([[rr * 1.3, 0], [rr, 0.1], [rr * 0.85, h], [rr * 1.25, h + 0.02], [rr * 1.25, h + 0.05], [rr * 0.7, h + 0.05]], x, Y, z, NC.stone, 6, { top: 1.15, bot: 0.7 });
    // R4: one tall violet needle per tower with a big green orb: the silhouette at map zoom
    const sp = front ? 0.52 : 0.42;
    k.cone(rr * 1.25, sp, x, Y + h + 0.05, z, NC.spike, 6, { top: 1.5, bot: 0.9 });
    k.ball(0.03, x, Y + h + 0.05 + sp + 0.03, z, NC.green, 1, { glow: true });
    k.winCyl(x, z, rr * 0.93, a, Y + h * 0.55, 0.03, 0.11, NC.green);
    if (front) { const ty = Y + h * 0.88; const dx = Math.cos(a), dz = Math.sin(a);
      k.bone(RIG.FLAG, [x + dx * rr * 1.3, ty, z + dz * rr * 1.3], () => k.sheet(1, 3, (u, v) => [x + dx * rr * 1.3 + (u - 0.5) * 0.09 * dz, ty - v * 0.26 - (v === 1 && Math.abs(u - 0.5) > 0.4 ? -0.04 : 0), z + dz * rr * 1.3 - (u - 0.5) * 0.09 * dx], NC.red, { top: 1.15, bot: 0.75, ao: false })); }
  }
  // gate: a dark portal framed by a ribcage of bone arches, with a skull above
  const gz = 0.49;
  k.box(0.3, 0.3, 0.14, 0, Y, gz - 0.01, NC.stone, { top: 1.1, bot: 0.7 });
  k.cone(0.17, 0.16, 0, Y + 0.3, gz - 0.01, NC.spike, 4, { ry: Math.PI / 4, s: [1, 1, 0.5], top: 1.3 });
  k.box(0.11, 0.15, 0.02, 0, Y, gz + 0.06, NC.purple, { ao: false });
  k.box(0.09, 0.13, 0.01, 0, Y, gz + 0.065, NC.greenD, { glow: true });
  for (let i = 0; i < 2; i++) {
    const rr = 0.09 + i * 0.03, zz = gz + 0.075 + i * 0.035;
    k.tor(rr, 0.018, 0, Y + 0.12 - i * 0.01, zz, i ? NC.boneD : NC.bone, Math.PI, { rs: 8, ts: 4, top: 1.15 });
    for (const s of [-1, 1]) k.cyl(0.018, 0.02, 0.12 - i * 0.01, s * rr, Y, zz, NC.bone, 5);
  }
  // skull
  k.ball(0.06, 0, Y + 0.27, gz + 0.09, NC.bone, 1, { s: [1, 0.95, 0.9], top: 1.15, bot: 0.8 });
  k.box(0.064, 0.03, 0.05, 0, Y + 0.2, gz + 0.1, NC.boneD);
  for (const s of [-1, 1]) k.ball(0.017, s * 0.023, Y + 0.272, gz + 0.135, NC.green, 0, { glow: true });
  // the necropolis cathedral: a central needle spire with flanking spires
  const cz = -0.13;
  k.box(0.36, 0.34, 0.3, 0, Y, cz, NC.stone, { top: 1.12, bot: 0.65 });
  k.box(0.38, 0.03, 0.32, 0, Y + 0.33, cz, NC.stoneL);
  k.gable(0.36, 0.14, 0.3, 0, Y + 0.36, cz, NC.spike, NC.stone, Math.PI / 2, 0.02);
  // pointed lancet windows and a big green rose window
  for (const x of [-0.11, 0.11]) { k.box(0.035, 0.12, 0.012, x, Y + 0.12, cz + 0.152, NC.green, { glow: true }); k.cone(0.025, 0.04, x, Y + 0.24, cz + 0.152, NC.green, 4, { glow: true, s: [0.7, 1, 0.25] }); }
  k.cyl(0.05, 0.05, 0.012, 0, Y + 0.25, cz + 0.152, NC.green, 8, { rx: Math.PI / 2, glow: true });
  k.tor(0.058, 0.014, 0, Y + 0.25, cz + 0.16, NC.bone, TAU, { rs: 10, ts: 3 });
  k.box(0.08, 0.12, 0.02, 0, Y, cz + 0.155, NC.purple);
  k.box(0.064, 0.1, 0.01, 0, Y, cz + 0.162, NC.greenD, { glow: true });
  // flanking needle spires
  for (const [sx, sz, hh] of [[-1, 1, 0.62], [1, 1, 0.62], [-1, -1, 0.5], [1, -1, 0.5]]) {
    const x = sx * 0.17, z = cz + sz * 0.14;
    k.lathe([[0.055, 0], [0.048, hh], [0.062, hh + 0.02], [0.03, hh + 0.02]], x, Y, z, NC.stone, 6, { top: 1.15, bot: 0.7 });
    k.cone(0.07, 0.34, x, Y + hh + 0.02, z, NC.spike, 6, { top: 1.5 });
    k.winCyl(x, z, 0.05, Math.atan2(sz, sx), Y + hh - 0.14, 0.026, 0.1, NC.green);
    k.ball(0.022, x, Y + hh + 0.38, z, NC.green, 0, { glow: true });
  }
  // the great spire
  const st = Y + 0.36;
  k.lathe([[0.1, 0], [0.085, 0.42], [0.11, 0.44], [0.11, 0.48], [0.06, 0.48]], 0, st, cz, NC.stone, 8, { top: 1.18, bot: 0.75 });
  for (let i = 0; i < 4; i++) k.winCyl(0, cz, 0.092, i * Math.PI / 2 + Math.PI / 2, st + 0.24, 0.022, 0.1, NC.green);
  for (let s = 0; s < 4; s++) { const b = s / 4 * TAU + Math.PI / 4; k.cone(0.03, 0.14, Math.cos(b) * 0.1, st + 0.48, cz + Math.sin(b) * 0.1, NC.boneD, 4, { rz: Math.cos(b) * -0.3, rx: Math.sin(b) * 0.3 }); }
  k.cone(0.12, 0.62, 0, st + 0.48, cz, NC.spike, 8, { top: 1.6, bot: 0.9 });
  k.ball(0.05, 0, st + 1.14, cz, NC.green, 1, { glow: true });
  k.tor(0.08, 0.012, 0, st + 1.14, cz, NC.greenD, TAU, { glow: true, rx: 0.4, rs: 12, ts: 3 });
  // flying bone buttresses from spire to the front spires
  for (const sx of [-1, 1]) {
    const pts = []; for (let i = 0; i <= 4; i++) { const t = i / 4; pts.push([sx * (0.1 + t * 0.07), st + 0.38 - Math.sin(t * Math.PI * 0.5) * 0.0 - t * t * 0.08, cz + t * 0.14]); }
    for (let i = 0; i < 4; i++) k.limb(pts[i], pts[i + 1], 0.018, 0.018, NC.bone, 5);
  }
  // red banners on the cathedral front
  for (const s of [-1, 1]) {
    const bx = s * 0.06;
    k.bone(RIG.FLAG, [bx, Y + 0.33, cz + 0.163], () => k.sheet(1, 4, (u, v) => [bx + (u - 0.5) * 0.045, Y + 0.33 - v * 0.2 + (v === 1 && Math.abs(u - 0.5) > 0.4 ? 0.025 : 0), cz + 0.163 + Math.sin(v * 3 + s) * 0.005], NC.red, { top: 1.2, bot: 0.75, ao: false }));
  }
  // crypts and mausoleums
  const crypts = [[-0.3, 0.12, 0.5], [0.33, -0.08, -0.9], [-0.15, 0.32, 0.2], [0.34, 0.27, -0.4]];
  for (const [x, z, ry] of crypts) {
    const w = 0.1, d = 0.11, h = 0.08;
    k.box(w + 0.02, 0.015, d + 0.02, x, Y, z, NC.stoneL, { ry });
    k.box(w, h, d, x, Y + 0.015, z, NC.stone, { ry, top: 1.15, bot: 0.75 });
    k.cone(w * 0.78, 0.09, x, Y + h + 0.015, z, NC.spike, 4, { ry: ry + Math.PI / 4, top: 1.4 });
    const fx = Math.sin(ry), fz = Math.cos(ry), sx = Math.cos(ry), sz = -Math.sin(ry);
    k.box(0.05, 0.06, 0.006, x + fx * (d / 2 + 0.002), Y + 0.015, z + fz * (d / 2 + 0.002), NC.green, { ry, glow: true });
  }
  // tombstones
  for (let i = 0; i < 4; i++) {
    const a = 1.95 + i * 0.5, rr = 0.4, x = Math.cos(a) * rr, z = Math.sin(a) * rr * 0.9;
    if (z > 0.3) continue;
    k.box(0.05, 0.07, 0.02, x, Y, z, NC.stoneL, { ry: (k.r() - 0.5) * 0.6, rz: (k.r() - 0.5) * 0.3, top: 1.25 });
  }
  // a giant ribcage in the courtyard
  for (let i = 0; i < 3; i++) {
    const z = 0.0 + i * 0.07, rr = 0.085 - Math.abs(i - 1) * 0.012;
    k.tor(rr, 0.016, 0.3, Y, z + 0.0, NC.bone, Math.PI * 0.85, { rs: 7, ts: 3, ry: 0, rz: 0.25 });
  }
  k.limb([0.3, Y + 0.01, -0.03], [0.3, Y + 0.02, 0.17], 0.02, 0.016, NC.boneD, 5);
  return finish(k);
}

// ---- R6: shared bits for the new towns
// the stone apron pad every town stands on (same footprint as haven / necro)
function apron(k, c, kerb, pave) {
  k.lathe([[0.69, 0], [0.68, 0.025], [0.62, 0.05], [0, 0.05]], 0, 0, 0, c, 14, { top: 1.06, bot: 0.72 });
  k.tor(0.665, 0.014, 0, 0.03, 0, kerb, TAU, { rx: Math.PI / 2, rs: 28, ts: 3 });
  k.cyl(0.5, 0.52, 0.012, 0, 0.05, -0.02, pave, 12, { j: 0.08 });
  k.box(0.12, 0.012, 0.28, 0, 0.05, 0.5, pave, { j: 0.08 });
}
const hexRing = (R) => { const t = []; for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; t.push([Math.cos(a) * R, Math.sin(a) * R, a]); } return t; };
// a banner hanging flat against a wall face (z = const), swallow-tailed hem; FLAG-rigged
function wallBanner(k, x, y, z, w, h, c, ph = 0) {
  k.bone(RIG.FLAG, [x, y, z], () => k.sheet(1, 4, (u, v) => [x + (u - 0.5) * w, y - v * h + (v === 1 && Math.abs(u - 0.5) > 0.4 ? h * 0.16 : 0), z + Math.sin(v * 3 + ph) * 0.006], c, { top: 1.15, bot: 0.78, ao: false }));
}

// ------------------------------------------------------------------ R6: Sylvan
// a giant tree rising from the middle of the town (the map-zoom silhouette), elven halls
// with green and gold leaf roofs, pale-wood towers with leaf-dome caps, a living hedge wall
const SY = { apron: 0x948e74, kerb: 0x645e4a, pave: 0xd2c294, wood: 0xd6a466, woodD: 0xa87444, bark: 0x9a6a40, barkL: 0xc08a54, hedge: 0x3e9e3a, leaf: 0x3ca834, leafL: 0x66c43a, leafD: 0x2e8a34, gold: 0xffcf4a, goldLeaf: 0xf0c030, win: 0xffe08a, banner: 0x22b84a, plaster: 0xf6eccc };
function sylvanTown() {
  const k = makeKit(31);
  apron(k, SY.apron, SY.kerb, SY.pave);
  const Y = 0.055, R = 0.56, tw = hexRing(R);
  // living hedge wall: a green band with a row of round leaf tufts on top
  const hedge = (ax, az, bx, bz) => {
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz), ry = Math.atan2(-dz, dx);
    k.box(len, 0.17, 0.08, (ax + bx) / 2, Y - 0.005, (az + bz) / 2, SY.hedge, { ry, top: 1.12, bot: 0.78 });
    const n = Math.max(2, Math.round(len / 0.085));
    for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; k.ball(0.052, ax + dx * t, Y + 0.17, az + dz * t, i % 2 ? SY.leaf : SY.leafL, 0, { s: [1, 0.8, 1], top: 1.25, bot: 0.85 }); }
  };
  for (let i = 0; i < 6; i++) {
    const [ax, az] = tw[i], [bx, bz] = tw[(i + 1) % 6];
    if (i === 1) { hedge(ax, az, 0.15, 0.485); hedge(-0.15, 0.485, bx, bz); } else hedge(ax, az, bx, bz);
  }
  // pale-wood towers with big elven leaf domes (gold on the front pair, green behind)
  for (let i = 0; i < 6; i++) {
    const [x, z, a] = tw[i];
    const front = i === 1 || i === 2, h = front ? 0.44 : 0.36, rr = 0.075;
    k.lathe([[rr * 1.5, 0], [rr * 1.08, 0.07], [rr, 0.14], [rr * 0.92, h - 0.03], [rr * 1.25, h], [rr * 1.25, h + 0.025], [rr * 0.9, h + 0.025]], x, Y, z, SY.wood, 8, { top: 1.12, bot: 0.72 });
    const dh = front ? 0.36 : 0.3;
    k.lathe([[rr * 1.75, 0], [rr * 1.85, 0.05], [rr * 1.5, dh * 0.42], [rr * 0.7, dh * 0.78], [0.001, dh]], x, Y + h + 0.025, z, front ? SY.goldLeaf : SY.leaf, 8, { top: 1.35, bot: 0.78 });
    k.cone(0.018, 0.1, x, Y + h + 0.025 + dh - 0.01, z, SY.gold, 4);
    k.winCyl(x, z, rr * 0.95, a, Y + h * 0.5, 0.035, 0.08, SY.win);
    if (front) { const th = Y + h + dh + 0.06; k.limb([x, th - 0.04, z], [x, th + 0.14, z], 0.008, 0.007, SY.woodD, 4); pennant(k, x, th + 0.1, z, 0.2, 0.08, SY.banner, { dir: i === 1 ? 1 : -1, amp: 0.025, tail: 0.3 }); }
  }
  // the gate: two wooden posts under a leafy arch, doors and a green banner
  const gz = 0.49;
  for (const s of [-1, 1]) k.cyl(0.042, 0.055, 0.32, s * 0.12, Y, gz, SY.woodD, 7, { top: 1.15, bot: 0.75 });
  k.tor(0.12, 0.045, 0, Y + 0.3, gz, SY.leaf, Math.PI, { rs: 8, ts: 5, top: 1.3, bot: 0.85 });
  for (const [x, y] of [[0, 0.44], [-0.09, 0.39], [0.09, 0.39]]) k.ball(0.05, x, Y + y, gz, SY.leafL, 0, { top: 1.3 });
  k.box(0.17, 0.2, 0.025, 0, Y, gz - 0.01, SY.woodD, { ao: false });
  k.tor(0.085, 0.012, 0, Y + 0.2, gz + 0.004, SY.gold, Math.PI, { rs: 8 });
  wallBanner(k, 0, Y + 0.3, gz + 0.05, 0.08, 0.15, SY.banner);
  // the great tree: flared trunk with roots, a tree-house balcony and a huge leaf crown
  const tx = 0, tz = -0.1;
  k.lathe([[0.2, 0], [0.15, 0.05], [0.115, 0.15], [0.1, 0.4], [0.1, 0.58], [0.13, 0.72], [0.07, 0.82]], tx, Y, tz, SY.bark, 10, { top: 1.15, bot: 0.8 });
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.3; k.limb([tx + Math.cos(a) * 0.1, Y + 0.08, tz + Math.sin(a) * 0.1], [tx + Math.cos(a) * 0.27, Y + 0.005, tz + Math.sin(a) * 0.27], 0.045, 0.02, SY.bark, 5); }
  // a door and lit windows in the trunk
  k.box(0.07, 0.11, 0.012, tx, Y + 0.02, tz + 0.142, SY.win, { glow: true });
  k.tor(0.035, 0.01, tx, Y + 0.13, tz + 0.145, SY.gold, Math.PI, { rs: 6, glow: true });
  for (const a of [Math.PI / 2 - 0.7, Math.PI / 2 + 0.7]) k.winCyl(tx, tz, 0.102, a, Y + 0.3, 0.035, 0.06, SY.win);
  // balcony ring with a gold rail
  k.cyl(0.21, 0.19, 0.035, tx, Y + 0.44, tz, SY.woodD, 10, { top: 1.2 });
  k.tor(0.205, 0.011, tx, Y + 0.51, tz, SY.gold, TAU, { rx: Math.PI / 2, rs: 12, ts: 3 });
  for (const s of [-1, 1]) wallBanner(k, tx + s * 0.11, Y + 0.44, tz + 0.18, 0.06, 0.2, SY.banner, s);
  // branches to the crown
  for (const [bx, by, bz] of [[-0.22, 0.86, -0.04], [0.22, 0.88, -0.08], [0.02, 0.84, 0.1], [-0.08, 0.95, -0.26]]) k.limb([tx, Y + 0.7, tz], [tx + bx * 0.85, Y + by, tz + bz * 0.85], 0.045, 0.025, SY.barkL, 5);
  const crown = [[0, 1.0, -0.06, 0.27, SY.leaf], [-0.21, 0.9, 0.0, 0.19, SY.leafL], [0.22, 0.92, -0.04, 0.2, SY.leaf], [0.04, 0.86, 0.15, 0.18, SY.leafL], [-0.12, 0.98, -0.24, 0.19, SY.leafD], [0.15, 1.1, -0.18, 0.16, SY.leafL], [0.0, 1.22, -0.06, 0.16, SY.goldLeaf], [-0.17, 1.12, -0.06, 0.13, SY.goldLeaf]];
  for (const [x, y, z, r0, c] of crown) k.ball(r0, tx + x, Y + y, tz + z, c, 1, { s: [1, 0.86, 1], top: 1.2, bot: 0.68 });
  // fairy lanterns hanging under the crown
  for (const [x, y, z] of [[-0.2, 0.72, 0.08], [0.2, 0.74, 0.06], [0.08, 0.7, 0.22], [-0.06, 0.73, 0.2]]) k.ball(0.022, tx + x, Y + y, tz + z, SY.win, 0, { glow: true });
  // elven halls: tall cream halls with steep green / gold leaf roofs and a gold ridge
  const halls = [[-0.31, 0.08, Math.PI / 2, SY.leaf, 0.26], [0.31, 0.06, Math.PI / 2, SY.goldLeaf, 0.24]];
  for (const [x, z, ry, rc, d] of halls) {
    k.box(0.14, 0.14, d, x, Y, z, SY.plaster, { top: 1.08, bot: 0.75 });
    k.gable(d, 0.17, 0.14, x, Y + 0.14, z, rc, SY.plaster, ry, 0.03);
    k.limb([x, Y + 0.312, z - d / 2 - 0.03], [x, Y + 0.312, z + d / 2 + 0.03], 0.012, 0.012, SY.gold, 4);
    k.box(0.012, 0.07, d * 0.55, x + Math.sign(-x) * 0.072, Y + 0.04, z, SY.win, { glow: true });
  }
  // round elven cottages with leaf domes
  for (const [x, z, c] of [[-0.16, 0.32, SY.leafL], [0.17, 0.31, SY.goldLeaf], [0.3, -0.24, SY.leaf]]) {
    k.cyl(0.06, 0.065, 0.09, x, Y, z, SY.plaster, 8, { top: 1.08, bot: 0.78 });
    k.lathe([[0.085, 0], [0.088, 0.02], [0.065, 0.07], [0.025, 0.12], [0.001, 0.15]], x, Y + 0.09, z, c, 8, { top: 1.3, bot: 0.8 });
    k.box(0.03, 0.045, 0.01, x, Y + 0.015, z + 0.062, SY.win, { glow: true });
  }
  return finish(k);
}

// ------------------------------------------------------------------ R6: Inferno
// a red-orange basalt citadel: stepped ziggurat with a jagged central spire crowned in fire,
// huge ivory horns, spiky towers with braziers, lava falls and glowing cracks
const IN = { apron: 0x94766a, kerb: 0x644a46, pave: 0xa88270, rock: 0xc84a30, rockD: 0x9a3626, rockL: 0xec7a44, spike: 0x7c2c36, horn: 0xf6e2b8, gold: 0xffc23a, lava: 0xff8a1a, lavaY: 0xffd04a, banner: 0xe0261e, iron: 0x8a6a74 };
function infernoTown() {
  const k = makeKit(33);
  apron(k, IN.apron, IN.kerb, IN.pave);
  const Y = 0.055, R = 0.56, tw = hexRing(R);
  // glowing lava cracks in the paving and a lava pool
  for (const [x, z, l, a] of [[-0.32, 0.22, 0.14, 0.4], [0.36, 0.08, 0.12, -0.7], [-0.2, 0.36, 0.1, 1.2], [0.26, -0.32, 0.12, 0.2], [-0.36, -0.2, 0.12, -0.3]]) k.box(0.016, 0.004, l, x, Y + 0.002, z, IN.lava, { glow: true, ry: a });
  k.cyl(0.1, 0.1, 0.004, 0.24, Y + 0.004, 0.24, IN.lava, 10, { glow: true });
  k.cyl(0.06, 0.06, 0.004, 0.24, Y + 0.006, 0.24, IN.lavaY, 8, { glow: true });
  k.lathe([[0.105, 0], [0.12, 0.025], [0.1, 0.025]], 0.24, Y, 0.24, IN.rockD, 10);
  // basalt curtain wall with a row of spikes
  for (let i = 0; i < 6; i++) {
    const [ax, az] = tw[i], [bx, bz] = tw[(i + 1) % 6];
    const o = { trim: IN.rockL, spikes: IN.spike, step: 0.09, sw: 0.034, sh: 0.1 };
    if (i === 1) { k.wall(ax, az, 0.15, 0.485, 0.25, 0.07, IN.rock, o); k.wall(-0.15, 0.485, bx, bz, 0.25, 0.07, IN.rock, o); } else k.wall(ax, az, bx, bz, 0.25, 0.07, IN.rock, o);
  }
  // spiky towers: tapered hexagonal shafts, a crown of outward spikes, a fire brazier
  for (let i = 0; i < 6; i++) {
    const [x, z, a] = tw[i];
    const front = i === 1 || i === 2, h = front ? 0.5 : 0.42, rr = 0.085;
    k.lathe([[rr * 1.45, 0], [rr * 1.1, 0.1], [rr * 0.85, h], [rr * 1.3, h + 0.02], [rr * 1.3, h + 0.06], [rr * 0.6, h + 0.06]], x, Y, z, IN.rock, 6, { top: 1.15, bot: 0.7 });
    for (let s = 0; s < 4; s++) { const b = s / 4 * TAU + 0.4; k.cone(0.03, 0.15, x + Math.cos(b) * rr * 1.1, Y + h + 0.05, z + Math.sin(b) * rr * 1.1, IN.spike, 4, { rz: -Math.cos(b) * 0.55, rx: Math.sin(b) * 0.55, top: 1.4 }); }
    k.cone(0.05, front ? 0.22 : 0.17, x, Y + h + 0.06, z, IN.lava, 5, { glow: true });
    k.cone(0.028, front ? 0.14 : 0.1, x, Y + h + 0.06, z, IN.lavaY, 4, { glow: true });
    k.winCyl(x, z, rr * 0.93, a, Y + h * 0.55, 0.03, 0.11, IN.lava);
    if (front) { const ty = Y + h * 0.9, dx = Math.cos(a), dz = Math.sin(a);
      k.bone(RIG.FLAG, [x + dx * rr * 1.3, ty, z + dz * rr * 1.3], () => k.sheet(1, 3, (u, v) => [x + dx * rr * 1.3 + (u - 0.5) * 0.09 * dz, ty - v * 0.26 - (v === 1 && Math.abs(u - 0.5) > 0.4 ? -0.04 : 0), z + dz * rr * 1.3 - (u - 0.5) * 0.09 * dx], IN.banner, { top: 1.15, bot: 0.75, ao: false })); }
  }
  // horn chain helper: a tapered curve through pts
  const horn = (pts, r0, r1, c) => { for (let i = 0; i < pts.length - 1; i++) { const t0 = i / (pts.length - 1), t1 = (i + 1) / (pts.length - 1); k.limb(pts[i], pts[i + 1], r0 + (r1 - r0) * t0, r0 + (r1 - r0) * t1, c, 5, { top: 1.2 }); } };
  // the gate: a basalt block with a lava portal and two huge horns
  const gz = 0.49;
  k.box(0.3, 0.28, 0.14, 0, Y, gz - 0.01, IN.rock, { top: 1.12, bot: 0.7 });
  k.box(0.32, 0.03, 0.16, 0, Y + 0.27, gz - 0.01, IN.rockL);
  k.box(0.12, 0.16, 0.02, 0, Y, gz + 0.06, IN.spike, { ao: false });
  k.box(0.095, 0.14, 0.01, 0, Y, gz + 0.066, IN.lava, { glow: true });
  k.cone(0.06, 0.05, 0, Y + 0.14, gz + 0.066, IN.lava, 4, { glow: true, s: [1, 1, 0.15] });
  for (const s of [-1, 1]) horn([[s * 0.12, Y + 0.28, gz], [s * 0.21, Y + 0.33, gz + 0.02], [s * 0.25, Y + 0.43, gz + 0.03], [s * 0.21, Y + 0.53, gz + 0.04]], 0.035, 0.006, IN.horn);
  // the citadel: a three-step ziggurat
  const cz = -0.12;
  const tiers = [[0.44, 0.2, 0.36], [0.32, 0.17, 0.27], [0.22, 0.15, 0.19]];
  let ty = Y;
  for (const [w, h, d] of tiers) {
    k.box(w, h, d, 0, ty, cz, IN.rock, { top: 1.15, bot: 0.72 });
    k.box(w + 0.02, 0.025, d + 0.02, 0, ty + h - 0.01, cz, IN.rockL, { top: 1.1 });
    ty += h;
  }
  // corner spikes on the lower tiers
  for (const [w, , d, y0] of [[0.44, 0, 0.36, Y + 0.2], [0.32, 0, 0.27, Y + 0.37]]) for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.cone(0.04, 0.22, sx * w / 2, y0, cz + sz * d / 2, IN.spike, 5, { rz: -sx * 0.18, rx: sz * 0.18, top: 1.45 });
  // lava falls pouring down the front steps, windows
  for (const [w, h, d, y0] of [[0.06, 0.17, 0.27, Y + 0.2], [0.07, 0.2, 0.36, Y]]) k.box(w, h, 0.012, 0, y0, cz + d / 2 + 0.004, IN.lava, { glow: true });
  for (const x of [-0.13, 0.13]) { k.box(0.04, 0.09, 0.012, x, Y + 0.06, cz + 0.184, IN.lava, { glow: true }); k.cone(0.028, 0.04, x, Y + 0.15, cz + 0.184, IN.lava, 4, { glow: true, s: [0.7, 1, 0.25] }); }
  // jagged central spire with lava veins and a crown of fire
  const st = ty;
  k.lathe([[0.12, 0], [0.1, 0.12], [0.075, 0.36], [0.045, 0.52], [0.001, 0.62]], 0, st, cz, IN.rockD, 5, { top: 1.5, bot: 0.85 });
  for (let i = 0; i < 3; i++) { const b = i / 3 * TAU + Math.PI / 2; k.box(0.016, 0.3, 0.012, Math.cos(b) * 0.08, st + 0.04, cz + Math.sin(b) * 0.08, IN.lava, { glow: true, ry: face(Math.cos(b), Math.sin(b)), rx: 0 }); }
  for (let s = 0; s < 4; s++) { const b = s / 4 * TAU + Math.PI / 4; k.cone(0.03, 0.16, Math.cos(b) * 0.09, st + 0.22, cz + Math.sin(b) * 0.09, IN.spike, 4, { rz: -Math.cos(b) * 0.6, rx: Math.sin(b) * 0.6 }); }
  k.cone(0.08, 0.3, 0, st + 0.56, cz, IN.lava, 6, { glow: true });
  k.cone(0.05, 0.2, 0, st + 0.58, cz, IN.lavaY, 5, { glow: true });
  for (const s of [-1, 1]) k.cone(0.04, 0.16, s * 0.06, st + 0.54, cz, IN.lava, 4, { glow: true, rz: -s * 0.35 });
  // giant gold-tipped horns sweeping up from the top step
  for (const s of [-1, 1]) {
    horn([[s * 0.1, st - 0.06, cz + 0.02], [s * 0.22, st + 0.0, cz + 0.04], [s * 0.3, st + 0.14, cz + 0.05], [s * 0.28, st + 0.3, cz + 0.06], [s * 0.2, st + 0.42, cz + 0.06]], 0.05, 0.008, IN.horn);
  }
  // crimson banners on the lower tier
  for (const s of [-1, 1]) wallBanner(k, s * 0.12, Y + 0.18, cz + 0.186, 0.06, 0.16, IN.banner, s);
  // small basalt shrines with braziers
  for (const [x, z] of [[-0.3, 0.12], [0.33, -0.1], [-0.14, 0.33]]) {
    k.cyl(0.05, 0.065, 0.1, x, Y, z, IN.rockD, 6, { top: 1.2, bot: 0.75 });
    k.cyl(0.06, 0.045, 0.03, x, Y + 0.1, z, IN.iron, 6);
    k.cone(0.04, 0.12, x, Y + 0.12, z, IN.lava, 5, { glow: true });
  }
  return finish(k);
}

// ------------------------------------------------------------------ R6: Dungeon
// violet stone towers capped with teal crystals, a cavern-mouth gate in a rocky mound,
// a central warlock tower with a giant floating crystal, crags and glowing crystal clusters
const DG = { apron: 0x8a8298, kerb: 0x5a5268, pave: 0xa298b2, stone: 0x845ac8, stoneD: 0x6440a8, stoneL: 0xb898ea, rock: 0x8c74b0, rockL: 0xae98cc, teal: 0x46f4e0, tealD: 0x22c0b8, mouth: 0x40305a, banner: 0xd23ab4, gold: 0xf0c450, cap: 0x2eb8b0 };
function dungeonTown() {
  const k = makeKit(35);
  apron(k, DG.apron, DG.kerb, DG.pave);
  const Y = 0.055, R = 0.56, tw = hexRing(R);
  // crags and stalagmites behind the town: the underworld rock it is carved from
  for (const [x, z, h, rr] of [[-0.3, -0.4, 0.5, 0.09], [-0.18, -0.48, 0.66, 0.1], [0.24, -0.44, 0.56, 0.09], [0.38, -0.32, 0.4, 0.08], [0.05, -0.5, 0.42, 0.08]]) {
    k.cone(rr, h, x, Y, z, DG.rock, 5, { top: 1.35, bot: 0.78, ry: x * 7 });
  }
  // violet stone wall
  for (let i = 0; i < 6; i++) {
    const [ax, az] = tw[i], [bx, bz] = tw[(i + 1) % 6];
    if (i === 1) { k.wall(ax, az, 0.17, 0.485, 0.25, 0.07, DG.stone, { trim: DG.stoneL, step: 0.08 }); k.wall(-0.17, 0.485, bx, bz, 0.25, 0.07, DG.stone, { trim: DG.stoneL, step: 0.08 }); } else k.wall(ax, az, bx, bz, 0.25, 0.07, DG.stone, { trim: DG.stoneL });
  }
  // slender round towers, each capped with a big tall teal crystal
  for (let i = 0; i < 6; i++) {
    const [x, z, a] = tw[i];
    const front = i === 1 || i === 2, h = front ? 0.52 : 0.44, rr = 0.075;
    k.lathe([[rr * 1.35, 0], [rr * 1.02, 0.1], [rr * 0.9, h], [rr * 1.35, h + 0.02], [rr * 1.35, h + 0.05], [rr * 0.8, h + 0.05]], x, Y, z, DG.stone, 8, { top: 1.18, bot: 0.7 });
    for (let s = 0; s < 3; s++) { const b = s / 3 * TAU + a; k.cone(0.022, 0.07, x + Math.cos(b) * rr * 1.25, Y + h + 0.05, z + Math.sin(b) * rr * 1.25, DG.stoneL, 4, { top: 1.3 }); }
    const ch = front ? 0.17 : 0.14; // crystal half-height
    k.gem(0.068, x, Y + h + 0.06 + ch, z, DG.teal, { glow: true, s: [1, ch / 0.068, 1], ry: a });
    k.winCyl(x, z, rr * 0.92, a, Y + h * 0.55, 0.03, 0.1, DG.teal);
    if (front) { const ty = Y + h * 0.88, dx = Math.cos(a), dz = Math.sin(a);
      k.bone(RIG.FLAG, [x + dx * rr * 1.2, ty, z + dz * rr * 1.2], () => k.sheet(1, 3, (u, v) => [x + dx * rr * 1.2 + (u - 0.5) * 0.085 * dz, ty - v * 0.25 - (v === 1 && Math.abs(u - 0.5) > 0.4 ? -0.04 : 0), z + dz * rr * 1.2 - (u - 0.5) * 0.085 * dx], DG.banner, { top: 1.15, bot: 0.75, ao: false })); }
  }
  // the cavern gate: a rocky mound with a dark mouth, teal glow inside, stalactite teeth
  const gz = 0.48;
  k.ball(1, 0, Y + 0.1, gz - 0.03, DG.rock, 1, { s: [0.24, 0.24, 0.14], top: 1.35, bot: 0.8 });
  for (const s of [-1, 1]) k.ball(1, s * 0.17, Y + 0.06, gz + 0.01, DG.rockL, 0, { s: [0.09, 0.15, 0.09], top: 1.25, bot: 0.8, rz: s * 0.3 });
  k.cone(0.07, 0.16, 0.06, Y + 0.24, gz - 0.06, DG.rockL, 5, { top: 1.3, rz: -0.25 });
  k.cone(0.06, 0.12, -0.08, Y + 0.24, gz - 0.07, DG.rock, 5, { top: 1.3, rz: 0.3 });
  k.cyl(0.14, 0.14, 0.02, 0, Y + 0.02, gz + 0.1, DG.mouth, 12, { rx: Math.PI / 2 - 0.25, ao: false, top: 1, bot: 1 });
  k.cyl(0.085, 0.085, 0.01, 0, Y + 0.025, gz + 0.114, DG.tealD, 10, { rx: Math.PI / 2 - 0.25, glow: true });
  for (let i = 0; i < 5; i++) { const b = Math.PI * (0.2 + i * 0.15); k.cone(0.024, 0.06, Math.cos(b) * 0.13, Y + Math.sin(b) * 0.125 + 0.03, gz + 0.13, DG.rockL, 4, { rx: Math.PI }); }
  for (const s of [-1, 1]) for (const [dx, hh, t] of [[0, 0.16, 0], [0.04, 0.1, 0.4], [-0.035, 0.09, -0.4]]) k.gem(0.03, s * (0.25 + dx), Y + hh * 0.5, gz + 0.04, DG.teal, { glow: true, s: [1, hh / 0.06, 1], rz: t * s });
  // the warlock hall and its tower with a giant floating crystal
  const cz = -0.12;
  k.box(0.4, 0.22, 0.3, 0, Y, cz, DG.stone, { top: 1.15, bot: 0.7 });
  k.box(0.42, 0.03, 0.32, 0, Y + 0.21, cz, DG.stoneL);
  for (let i = 0; i < 5; i++) { const x = -0.17 + i * 0.085; k.box(0.04, 0.045, 0.04, x, Y + 0.24, cz + 0.15, DG.stone, { top: 1.2 }); }
  k.box(0.09, 0.13, 0.02, 0, Y, cz + 0.152, DG.mouth, { ao: false });
  k.box(0.07, 0.11, 0.01, 0, Y, cz + 0.16, DG.tealD, { glow: true });
  for (const x of [-0.12, 0.12]) k.box(0.04, 0.08, 0.012, x, Y + 0.08, cz + 0.153, DG.teal, { glow: true });
  for (const s of [-1, 1]) wallBanner(k, s * 0.065, Y + 0.2, cz + 0.164, 0.05, 0.15, DG.banner, s);
  const tY = Y + 0.24;
  k.lathe([[0.13, 0], [0.11, 0.1], [0.095, 0.44], [0.14, 0.48], [0.14, 0.53], [0.09, 0.53]], 0, tY, cz - 0.02, DG.stone, 10, { top: 1.2, bot: 0.78 });
  for (let i = 0; i < 4; i++) k.winCyl(0, cz - 0.02, 0.1, i * Math.PI / 2 + Math.PI / 2, tY + 0.28, 0.03, 0.11, DG.teal);
  for (let s = 0; s < 4; s++) { const b = s / 4 * TAU + Math.PI / 4; k.cone(0.03, 0.12, Math.cos(b) * 0.125, tY + 0.53, cz - 0.02 + Math.sin(b) * 0.125, DG.stoneL, 4, { rz: -Math.cos(b) * 0.3, rx: Math.sin(b) * 0.3 }); }
  const gy = tY + 0.53 + 0.28;
  k.gem(0.12, 0, gy, cz - 0.02, DG.teal, { glow: true, s: [1, 2.1, 1], ry: 0.4 });
  k.tor(0.17, 0.014, 0, gy - 0.02, cz - 0.02, DG.gold, TAU, { rx: Math.PI / 2 - 0.35, rs: 14, ts: 3 });
  for (let s = 0; s < 3; s++) { const b = s / 3 * TAU + 0.5; k.gem(0.03, Math.cos(b) * 0.17, gy + 0.08 * Math.sin(b * 2), cz - 0.02 + Math.sin(b) * 0.17, DG.teal, { glow: true, s: [1, 1.6, 1] }); }
  // flanking spires with violet cone roofs and crystal finials
  for (const sx of [-1, 1]) {
    const x = sx * 0.2, z = cz + 0.06, hh = 0.5;
    k.lathe([[0.055, 0], [0.048, hh], [0.064, hh + 0.02], [0.03, hh + 0.02]], x, Y, z, DG.stone, 8, { top: 1.18, bot: 0.72 });
    k.cone(0.075, 0.26, x, Y + hh + 0.02, z, DG.stoneD, 8, { top: 1.5, bot: 0.85 });
    k.gem(0.028, x, Y + hh + 0.31, z, DG.teal, { glow: true, s: [1, 1.8, 1] });
    k.winCyl(x, z, 0.05, Math.atan2(1, sx * 0.6), Y + hh - 0.14, 0.026, 0.09, DG.teal);
  }
  // glowing crystal clusters and giant cave mushrooms in the courtyard
  for (const [x, z] of [[0.3, 0.18], [-0.32, 0.16], [0.18, 0.33]]) for (const [dx, dz, hh, t] of [[0, 0, 0.14, 0], [0.035, 0.02, 0.09, 0.45], [-0.03, 0.025, 0.08, -0.45]]) k.gem(0.028, x + dx, Y + hh * 0.5, z + dz, DG.teal, { glow: true, s: [1, hh / 0.056, 1], rz: t });
  for (const [x, z, h] of [[-0.18, 0.32, 0.17], [0.34, -0.12, 0.2], [-0.34, -0.06, 0.15]]) {
    k.limb([x, Y, z], [x + 0.01, Y + h, z], 0.026, 0.02, DG.stoneL, 6);
    k.lathe([[0.001, 0], [0.085, 0.0], [0.08, 0.03], [0.05, 0.065], [0.001, 0.08]], x + 0.01, Y + h - 0.01, z, DG.cap, 8, { top: 1.35, bot: 0.7 });
    k.cyl(0.07, 0.07, 0.006, x + 0.01, Y + h - 0.016, z, DG.teal, 8, { glow: true });
  }
  return finish(k);
}

const TOWNS = { haven: havenTown, necro: necroTown, sylvan: sylvanTown, inferno: infernoTown, dungeon: dungeonTown };
export function townModel(fac) {
  return (TOWNS[fac] || havenTown)();
}

// ------------------------------------------------------------------ mounted heroes
// R4 (mobile read): a hero is ~30-40 px on the map, so it is built from a few big blocks:
// a chunky horse (thick legs, big head and neck), an oversized rider head and plume, a wide
// cape and a big banner in the player colour.
// R7 (close-up detail, silhouette unchanged): faces, layered armour with trims, belts and buckles,
// saddles with pommel / cantle / stirrups, bridles + reins, breast collars, mane locks and tail
// strands, fetlock tufts and hoof rims, shoulder / haunch muscle masses, weapon fullers / guards /
// grips, and the FACTION SIGIL (cross, skull, leaf, flame, eye) on the banner and saddle cloth.
//   Haven: white horse, gold mane, steel + gold rider, white plume.
//   Necro: pale-lilac horse with a green flame mane and tail, violet robe, bone, green flame crest.
// rig pivots shared by both heroes (model space, before heroModel's scale)
const HORSE_BODY = [0, 0.47, 0], HORSE_NECK = [0, 0.56, 0.17], HORSE_TAIL = [0, 0.56, -0.29], SADDLE = [0, 0.62, -0.02];
const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

// ---- faction sigils: flat 2D shapes in a unit square (-0.5..0.5), +y up
const SIGILS = {
  haven() { // a cross with a longer foot
    const w = 0.12, L = 0.42, T = 0.3, F = 0.5;
    const s = new THREE.Shape();
    [[-w, T], [w, T], [w, w], [L, w], [L, -w], [w, -w], [w, -F], [-w, -F], [-w, -w], [-L, -w], [-L, w], [-w, w]].forEach(([x, y], i) => (i ? s.lineTo(x, y + 0.05) : s.moveTo(x, y + 0.05)));
    return [s];
  },
  necro() { // a skull: cranium with eye and nose holes, a jaw with teeth notches
    const c = new THREE.Shape(); c.absarc(0, 0.1, 0.34, 0, TAU, false);
    for (const s of [-1, 1]) { const h = new THREE.Path(); h.absarc(s * 0.13, 0.06, 0.09, 0, TAU, true); c.holes.push(h); }
    const n = new THREE.Path(); n.moveTo(0, -0.04); n.lineTo(0.04, -0.13); n.lineTo(-0.04, -0.13); n.lineTo(0, -0.04); c.holes.push(n);
    const j = new THREE.Shape();
    [[-0.18, -0.16], [0.18, -0.16], [0.18, -0.42], [0.09, -0.42], [0.09, -0.34], [0.03, -0.34], [0.03, -0.42], [-0.03, -0.42], [-0.03, -0.34], [-0.09, -0.34], [-0.09, -0.42], [-0.18, -0.42]].forEach(([x, y], i) => (i ? j.lineTo(x, y) : j.moveTo(x, y)));
    return [c, j];
  },
  sylvan() { // a leaf with a stem and a cut vein
    const s = new THREE.Shape(); s.moveTo(0, -0.38); s.quadraticCurveTo(0.44, -0.06, 0, 0.5); s.quadraticCurveTo(-0.44, -0.06, 0, -0.38);
    const v = new THREE.Path(); v.moveTo(0.015, -0.2); v.lineTo(0.015, 0.3); v.lineTo(-0.015, 0.3); v.lineTo(-0.015, -0.2); v.lineTo(0.015, -0.2); s.holes.push(v);
    const st = new THREE.Shape(); [[0.03, -0.34], [0.03, -0.5], [-0.03, -0.5], [-0.03, -0.34]].forEach(([x, y], i) => (i ? st.lineTo(x, y) : st.moveTo(x, y)));
    return [s, st];
  },
  inferno() { // a three-tongued flame
    const s = new THREE.Shape();
    [[0, -0.48], [0.28, -0.38], [0.4, -0.08], [0.32, 0.32], [0.2, 0.06], [0.04, 0.5], [-0.1, 0.12], [-0.32, 0.36], [-0.38, -0.05], [-0.28, -0.38]].forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
    const h = new THREE.Path(); h.moveTo(0, -0.3); h.lineTo(0.12, -0.12); h.lineTo(0, 0.08); h.lineTo(-0.12, -0.12); h.lineTo(0, -0.3); s.holes.push(h);
    return [s];
  },
  dungeon() { // an eye: a lens with a round pupil hole and a slit
    const s = new THREE.Shape(); s.moveTo(-0.5, 0); s.quadraticCurveTo(0, 0.44, 0.5, 0); s.quadraticCurveTo(0, -0.44, -0.5, 0);
    const h = new THREE.Path(); h.absarc(0, 0, 0.14, 0, TAU, true); s.holes.push(h);
    const p = new THREE.Shape(); p.absellipse(0, 0, 0.035, 0.11, 0, TAU, false);
    return [s, p];
  },
};
const sigilTris = (fac) => new THREE.ShapeGeometry((SIGILS[fac] || SIGILS.haven)(), 5).toNonIndexed().attributes.position.array;
// add triangles (flat array of points) as one part, each wound to face `out(p)`
function addFaced(k, pts, out, c, o) {
  const P = [], e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  for (let i = 0; i < pts.length; i += 3) {
    let [a, b, d] = [pts[i], pts[i + 1], pts[i + 2]];
    const n = e1.subVectors(b, a).cross(e2.subVectors(d, a));
    if (n.dot(out(a.clone().add(b).add(d).multiplyScalar(1 / 3), i / 3)) < 0) [b, d] = [d, b];
    P.push(a.x, a.y, a.z, b.x, b.y, b.z, d.x, d.y, d.z);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  return k.add(g, c, o);
}
// R7 cloth decals: a sheet's coarse grid (the same facets k.sheet builds) so a decal lies exactly on the cloth
function gridMap(F, nu, nv) {
  const P = [];
  for (let i = 0; i <= nu; i++) { P.push([]); for (let j = 0; j <= nv; j++) P[i].push(V3(F(i / nu, j / nv))); }
  return (u, v) => {
    const x = Math.min(nu - 1e-6, Math.max(0, u * nu)), y = Math.min(nv - 1e-6, Math.max(0, v * nv)), i = Math.floor(x), j = Math.floor(y), fu = x - i, fv = y - j;
    const p00 = P[i][j], p10 = P[i + 1][j], p11 = P[i + 1][j + 1], p01 = P[i][j + 1];
    if (fu >= fv) return [p00.clone().addScaledVector(p10.clone().sub(p00), fu).addScaledVector(p11.clone().sub(p10), fv), p10.clone().sub(p00).cross(p11.clone().sub(p00)).normalize()];
    return [p00.clone().addScaledVector(p01.clone().sub(p00), fv).addScaledVector(p11.clone().sub(p01), fu), p11.clone().sub(p00).cross(p01.clone().sub(p00)).normalize()];
  };
}
// uv triangles (flat [[u, v], ...]) laid on both faces of a k.sheet cloth, subdivided so they follow its folds
function decalUV(k, G, nu, nv, uv, c, thick = 0.006, sides = [1, -1]) {
  const tris = [];
  // bisect the longest edge until every edge spans under ~0.7 grid cells
  const e = (p, q) => Math.hypot((p[0] - q[0]) * nu, (p[1] - q[1]) * nv);
  const split = (a, b, d, depth) => {
    const l = [e(a, b), e(b, d), e(d, a)], mx = Math.max(...l);
    if (depth > 8 || mx < 0.7) { tris.push(a, b, d); return; }
    const m = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    if (mx === l[0]) { const x = m(a, b); split(a, x, d, depth + 1); split(x, b, d, depth + 1); }
    else if (mx === l[1]) { const x = m(b, d); split(a, b, x, depth + 1); split(a, x, d, depth + 1); }
    else { const x = m(d, a); split(a, b, x, depth + 1); split(x, b, d, depth + 1); }
  };
  for (let i = 0; i < uv.length; i += 3) split(uv[i], uv[i + 1], uv[i + 2], 0);
  for (const side of sides) {
    const pts = [], outs = [];
    for (const [u, v] of tris) { const [p, n] = G(u, v); pts.push(p.addScaledVector(n, side > 0 ? 0.004 : -(thick + 0.004))); outs.push(n.multiplyScalar(side)); }
    addFaced(k, pts, (m, t) => outs[t * 3], c, { ao: false, top: 1.08, bot: 1, j: 0 });
  }
}
// the faction sigil centred at (cu, cv) of a cloth, su / sv = its size in u / v
function sheetSigil(k, G, nu, nv, fac, c, cu, cv, su, sv, thick, sides) {
  const T = sigilTris(fac), uv = [];
  for (let i = 0; i < T.length; i += 3) uv.push([cu + T[i] * su, cv - T[i + 1] * sv]);
  decalUV(k, G, nu, nv, uv, c, thick, sides);
}
// a uv rectangle strip (trim bands, hems)
const uvRect = (u0, v0, u1, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v0], [u1, v1], [u0, v1]];
// the sigil on a flat surface at p, facing n, with `up` as its +y, `size` across
function flatSigil(k, fac, c, p, n, up, size) {
  const T = sigilTris(fac), N = V3(n).normalize(), X = new THREE.Vector3().crossVectors(V3(up), N).normalize(), Y = new THREE.Vector3().crossVectors(N, X);
  const pts = [];
  for (let i = 0; i < T.length; i += 3) pts.push(V3(p).addScaledVector(X, T[i] * size).addScaledVector(Y, T[i + 1] * size));
  return addFaced(k, pts, () => N, c, { ao: false, top: 1.08, bot: 1, j: 0 });
}

// the horse. o: eyes (glow colour), flameMane, mane:false, feather (fetlock tuft colour), cloven,
// earIn (inner ear colour), tack: { strap, metal } bridle / breast collar / reins
function horse(k, coat, mane, hoof, o = {}) {
  const coatD = shadeOf(coat, 0.8), coatL = shadeOf(coat, 1.1);
  // barrel, chest and rump: one big, smooth mass, with shoulder + haunch muscle masses
  k.ball(1, 0, 0.48, 0.0, coat, 2, { s: [0.155, 0.15, 0.29], top: 1.12, bot: 0.72 });
  k.ball(1, 0, 0.5, 0.17, coatL, 1, { s: [0.145, 0.155, 0.12], top: 1.1, bot: 0.8 });
  k.ball(1, 0, 0.51, -0.19, coat, 1, { s: [0.155, 0.15, 0.13], top: 1.15, bot: 0.78 });
  for (const s of [-1, 1]) {
    k.ball(1, s * 0.098, 0.49, 0.15, coatL, 1, { s: [0.06, 0.1, 0.075], top: 1.2, bot: 0.82 });
    k.ball(1, s * 0.094, 0.5, -0.2, coat, 1, { s: [0.068, 0.11, 0.1], top: 1.22, bot: 0.8 });
  }
  const T = o.tack;
  k.bone(RIG.HEAD, HORSE_NECK, () => {
    // thick arched neck and a big head (identity: the horse head must read at 30 px)
    k.limb([0, 0.54, 0.17], [0, 0.8, 0.31], 0.095, 0.07, coat, 8, { top: 1.12 });
    k.limb([0, 0.83, 0.3], [0, 0.7, 0.5], 0.068, 0.05, coat, 8, { top: 1.12, bot: 0.9 });
    k.ball(0.058, 0, 0.69, 0.5, coatD, 1, { s: [0.9, 0.85, 1] });
    for (const s of [-1, 1]) {
      k.ball(1, s * 0.034, 0.765, 0.36, coat, 0, { s: [0.034, 0.05, 0.065], top: 1.15 }); // cheek
      k.cone(0.026, 0.085, s * 0.035, 0.85, 0.29, coat, 5, { rx: -0.25, rz: -s * 0.25 });
      k.cone(0.014, 0.06, s * 0.036, 0.852, 0.302, o.earIn ?? 0xd8a0a0, 4, { rx: -0.25, rz: -s * 0.25, ao: false });
      k.ball(0.011, s * 0.025, 0.695, 0.553, shadeOf(coat, 0.5), 0, { ao: false }); // nostril
      if (o.eyes) k.ball(0.017, s * 0.052, 0.79, 0.4, o.eyes, 0, { glow: true });
      else { k.ball(0.018, s * 0.052, 0.79, 0.4, 0x3a2a34, 1, { ao: false, s: [0.8, 1, 1] }); k.ball(0.006, s * 0.058, 0.797, 0.412, 0xffffff, 0, { ao: false }); }
    }
    k.box(0.07, 0.008, 0.03, 0, 0.652, 0.52, shadeOf(coat, 0.6), { ao: false }); // mouth line
    // mane: three bold blocks along the crest + hanging locks + a forelock (or flames for the undead steed)
    if (!o.flameMane && o.mane !== false) {
      for (let i = 0; i < 3; i++) { const t = i / 2; k.box(0.05, 0.1, 0.1, 0, 0.58 + t * 0.22, 0.12 + t * 0.15, mane, { rx: -0.6, top: 1.15 }); }
      for (let i = 0; i < 6; i++) { const t = i / 5, s = i % 2 ? 1 : -1, y = 0.6 + t * 0.24, z = 0.11 + t * 0.17; k.limb([s * 0.02, y, z], [s * 0.07, y - 0.11, z - 0.05], 0.026, 0.006, i % 2 ? mane : shadeOf(mane, 0.88), 5, { top: 1.15 }); }
      k.cone(0.032, 0.09, 0, 0.865, 0.31, mane, 5, { rx: 2.0, top: 1.1 });
    }
    if (T) {
      // bridle: browband, noseband, cheek straps, bit rings
      k.tor(0.07, 0.009, 0, 0.81, 0.33, T.strap, TAU, { rx: 0.576, rs: 12, ts: 3 });
      k.tor(0.058, 0.01, 0, 0.72, 0.47, T.strap, TAU, { rx: 0.576, rs: 12, ts: 3 });
      for (const s of [-1, 1]) {
        k.limb([s * 0.062, 0.79, 0.35], [s * 0.052, 0.71, 0.46], 0.008, 0.008, T.strap, 4);
        k.tor(0.016, 0.005, s * 0.052, 0.69, 0.49, T.metal, TAU, { ry: Math.PI / 2, rs: 8, ts: 3, ao: false });
        k.ball(0.012, s * 0.066, 0.81, 0.34, T.metal, 0, { ao: false }); // rosette
      }
    }
  });
  if (T) {
    // reins to the rider's hand, breast collar with a medallion, crupper
    for (const s of [-1, 1]) k.limb([s * 0.052, 0.69, 0.49], [0.07, 0.69, 0.18], 0.006, 0.006, T.strap, 3);
    const bc = []; for (let i = 0; i <= 6; i++) { const a = (i / 6 - 0.5) * 2.4; bc.push([0.135 * Math.sin(a), 0.47 - 0.03 * Math.cos(a), 0.17 + 0.128 * Math.cos(a)]); }
    curve(k, bc, 0.012, 0.012, T.strap, 4);
    for (const s of [-1, 1]) k.limb(bc[s > 0 ? 6 : 0], [s * 0.14, 0.6, 0.06], 0.011, 0.011, T.strap, 4);
    k.ball(1, 0, 0.44, 0.3, T.metal, 1, { s: [0.03, 0.03, 0.012], ao: false, top: 1.2 });
    k.limb([0, 0.64, -0.14], [0, 0.63, -0.27], 0.011, 0.011, T.strap, 4);
  }
  // legs: thick upper legs, knees, sturdy shins, fetlock tufts and big rimmed hooves
  const legs = [[-0.082, 0.16, 0.08, 0.07], [0.082, 0.17, -0.02, 0.15], [-0.082, -0.19, -0.02, -0.08], [0.082, -0.18, 0.02, -0.2]];
  for (const [x, z, kn, ft] of legs) {
    const hip = [x, 0.47, z], knee = [x, 0.24, z + kn * 0.5], foot = [x, 0.05, z + ft * 0.6];
    // the horse faces +Z, so +x is its left side
    const bone = z > 0 ? (x > 0 ? RIG.LEG_FL : RIG.LEG_FR) : (x > 0 ? RIG.LEG_BL : RIG.LEG_BR);
    k.bone(bone, hip, () => {
      k.limb(hip, knee, 0.068, 0.045, coat, 8);
      k.ball(0.046, knee[0], knee[1], knee[2], coat, 0, { s: [0.95, 1, 1.05] });
      k.limb(knee, foot, 0.04, 0.034, coatD, 6);
      if (o.feather !== false) k.cyl(0.036, 0.054, 0.06, foot[0], 0.045, foot[2] - 0.004, o.feather ?? coatL, 7, { top: 1.12, bot: 0.85 });
      k.cyl(0.042, 0.048, 0.06, foot[0], 0, foot[2], hoof, 8, { top: 1.1 });
      k.cyl(0.05, 0.05, 0.012, foot[0], 0, foot[2], shadeOf(hoof, 0.75), 8, { ao: false });
      if (o.cloven) k.box(0.008, 0.05, 0.03, foot[0], 0.004, foot[2] + 0.034, shadeOf(hoof, 0.5), { ao: false });
    });
  }
  // a thick tail of three strands with a lighter tuft
  if (!o.flameMane && o.mane !== false) k.bone(RIG.TAIL, HORSE_TAIL, () => {
    k.limb([0, 0.56, -0.29], [0, 0.42, -0.4], 0.04, 0.05, mane, 6);
    k.limb([0, 0.42, -0.4], [0, 0.2, -0.42], 0.05, 0.018, mane, 6);
    for (const s of [-1, 1]) k.limb([s * 0.01, 0.44, -0.4], [s * 0.04, 0.22, -0.46], 0.03, 0.008, shadeOf(mane, 0.88), 5);
    k.cone(0.035, 0.08, 0, 0.21, -0.43, shadeOf(mane, 1.1), 5, { rx: Math.PI, ao: false });
  });
}
// a saddle: seat, raised pommel + cantle, side flaps, stirrup leathers and irons
function saddle(k, seat, trim, strap) {
  k.box(0.2, 0.035, 0.2, 0, 0.6, -0.02, seat);
  k.box(0.1, 0.05, 0.04, 0, 0.615, 0.08, seat, { rx: -0.35, top: 1.2 });
  k.box(0.16, 0.07, 0.035, 0, 0.615, -0.12, seat, { rx: 0.35, top: 1.2 });
  k.box(0.17, 0.014, 0.04, 0, 0.678, -0.135, trim, { rx: 0.35, ao: false });
  for (const s of [-1, 1]) {
    k.box(0.016, 0.08, 0.09, s * 0.182, 0.53, 0.02, seat, { top: 1.15, bot: 0.85 });
    k.limb([s * 0.186, 0.6, 0.03], [s * 0.186, 0.41, 0.05], 0.007, 0.007, strap, 4);
    k.tor(0.024, 0.006, s * 0.186, 0.39, 0.05, trim, TAU, { ry: Math.PI / 2, rs: 8, ts: 3, ao: false });
  }
}
// a saddle blanket in the player colour (a short, bold block on each flank) with a trim band + sigil
function blanket(k, col, trim, fac) {
  for (const side of [-1, 1]) {
    const F = (u, v) => [side * (0.152 + v * 0.02 + Math.sin(u * Math.PI) * 0.012), 0.62 - v * 0.2, -0.17 + u * 0.32];
    k.sheet(3, 1, F, col, { shade: (u, v) => 1.12 - v * 0.3, top: 1, bot: 1, ao: false });
    k.box(0.02, 0.025, 0.33, side * 0.172, 0.405, -0.01, trim, { ao: false, top: 1.2 });
    const G = gridMap(F, 3, 1);
    decalUV(k, G, 3, 1, uvRect(0, 0.72, 1, 0.8), trim, 0.006, [side]); // embroidered band above the hem
    if (fac) sheetSigil(k, G, 3, 1, fac, trim, 0.2, 0.42, 0.22, 0.36, 0.006, [side]);
  }
}
// a wide cape in the player colour, draped from the shoulders over the horse's rump:
// from the map camera it is the biggest colour block on the hero (R7: a trim band at the hem)
function cape(k, col, x0, y0, z0, w, len, ragged = false, trim = null) {
  const F = (u, v) => {
    const x = (u - 0.5) * (w + v * 0.1);
    // the undead cape ends in big ragged points
    const rag = ragged && v === 1 ? (Math.round(u * 4) % 2 ? -0.07 : 0.03) : 0;
    const y = y0 - v * len * 0.62 - rag + Math.sin(u * Math.PI) * 0.03 * v, z = z0 - v * len * 0.72 - Math.sin(u * Math.PI * 2) * 0.02 * v;
    return [x0 + x, y + Math.sin(u * Math.PI) * 0.015, z];
  };
  k.bone(RIG.CLOTH, [x0, y0, z0], () => {
    k.sheet(4, 4, F, col, { shade: (u, v) => 1.12 - v * 0.22 + 0.1 * Math.sin(u * Math.PI), top: 1, bot: 1, ao: false, thick: 0.01 });
    // a trim band along the hem
    if (!ragged && trim) decalUV(k, gridMap(F, 4, 4), 4, 4, uvRect(0, 0.88, 1, 0.97), trim, 0.01);
  });
  // clasp
  if (trim) for (const s of [-1, 1]) k.ball(0.02, x0 + s * 0.09, y0 - 0.01, z0 + 0.05, trim, 0, { ao: false, top: 1.2 });
}
// the hero's standard: a big swallow-tailed flag streaming back and outward from the pole.
// The cloth is tilted ~30 degrees off vertical so it still shows a broad face from the
// high map camera whichever way the hero faces. R7: the faction sigil on both faces.
function heroBanner(k, px, py, pz, col, trim, fac) {
  const c = shadeOf(col, 1).lerp(new THREE.Color(1, 1, 1), 0.06);
  const ang = -2.25, ux = Math.sin(ang), uz = Math.cos(ang);
  const ox = uz, oz = -ux; // horizontal, perpendicular to the streaming direction (pointing away from the horse)
  const tilt = 0.7, cu = Math.cos(tilt), su = Math.sin(tilt);
  const len = 0.6, hgt = 0.4, tail = 0.28;
  const F = (u, v) => {
    const taper = 1 - u * 0.2;
    const yy = (0.5 - v) * hgt * taper;
    const along = u * len - Math.max(0, 1 - Math.abs(v - 0.5) * 4) * tail * len * smooth(0.5, 1, u);
    const w = Math.sin(u * 1.4 * TAU) * 0.05 * u;
    const droop = -u * u * 0.06;
    const up = yy + droop, tl = Math.min(1, u * 2.5), ct = 1 - (1 - cu) * tl, st = su * tl;
    return [px + ux * along + ox * ((up + hgt * 0.5) * st + w), py + (up + hgt * 0.5) * ct - hgt, pz + uz * along + oz * ((up + hgt * 0.5) * st + w)];
  };
  k.bone(RIG.FLAG, [px, py, pz], () => {
    k.sheet(6, 3, F, c, { shade: (u, v) => (v < 0.34 ? 1.12 : 0.98) + 0.12 * Math.cos(u * 1.4 * TAU), top: 1, bot: 1, ao: false, j: 0.02, thick: 0.01 });
    // a fringe band along the top edge and the sigil on the field
    const G = gridMap(F, 6, 3);
    decalUV(k, G, 6, 3, uvRect(0, 0.0, 0.84, 0.07), trim, 0.01);
    if (fac) sheetSigil(k, G, 6, 3, fac, trim, 0.27, 0.5, 0.34, 0.62, 0.01);
  });
  // a bold trim band along the hoist (no bone of its own: it stays with the pole)
  k.limb([px, py - hgt * 1.02, pz], [px, py + 0.01, pz], 0.024, 0.024, trim, 6, { ao: false, top: 1.2 });
}
// a sheathed sword hanging at the rider's left hip (on the RIDER bone)
function hipSword(k, sheath, metal, grip, gem = null) {
  k.limb([-0.125, 0.66, -0.01], [-0.17, 0.44, -0.17], 0.017, 0.013, sheath, 6);
  k.limb([-0.17, 0.44, -0.17], [-0.173, 0.43, -0.178], 0.018, 0.01, metal, 6); // chape
  k.box(0.012, 0.012, 0.08, -0.12, 0.668, 0.0, metal, { rx: 0.62, ry: 0.2 }); // cross guard
  k.limb([-0.12, 0.672, 0.0], [-0.11, 0.72, 0.035], 0.009, 0.009, grip, 5);
  k.ball(0.014, -0.108, 0.726, 0.04, gem ?? metal, 0, gem ? { glow: true } : { ao: false });
}

function havenHero(k, col) {
  const STEEL = 0xeef0f6, STEELD = 0xb8c0d0, GOLD = 0xffc83a, WOOD = 0x8a5a36, LEATHER = 0x8a5434;
  horse(k, 0xfffcf4, 0xf4c25a, 0x9a7048, { feather: 0xfff4dc, tack: { strap: 0x8a4a2a, metal: GOLD } });
  // steel chanfron with a gold ridge and a short white crest on the horse's face
  k.bone(RIG.HEAD, HORSE_NECK, () => {
    k.ball(1, 0, 0.775, 0.41, STEEL, 1, { s: [0.052, 0.03, 0.1], rx: 0.6, top: 1.2 });
    k.box(0.012, 0.012, 0.15, 0, 0.79, 0.405, GOLD, { rx: 0.58, ao: false });
    k.cone(0.02, 0.07, 0, 0.83, 0.33, 0xffffff, 4, { rx: -0.6 });
  });
  blanket(k, col, GOLD, 'haven');
  saddle(k, 0xa8683a, GOLD, LEATHER);
  k.bone(RIG.RIDER, SADDLE, () => {
    // legs of the rider: thick steel greaves with gold knee cops
    for (const s of [-1, 1]) {
      k.limb([s * 0.08, 0.66, -0.02], [s * 0.16, 0.54, 0.09], 0.045, 0.038, STEEL, 8);
      k.limb([s * 0.16, 0.54, 0.09], [s * 0.165, 0.38, 0.04], 0.034, 0.03, STEELD, 8);
      k.ball(0.03, s * 0.163, 0.545, 0.105, GOLD, 1, { s: [1, 1, 0.7], top: 1.3 });
      k.box(0.045, 0.03, 0.08, s * 0.166, 0.37, 0.065, STEELD, { top: 1.2 }); // sabaton
    }
    // torso: steel with a broad tabard in the player colour, gold cross, belt + faulds
    k.lathe([[0.09, 0], [0.11, 0.06], [0.115, 0.14], [0.1, 0.21], [0.05, 0.26]], 0, 0.62, -0.02, STEEL, 10, { top: 1.3, bot: 0.75 });
    k.cyl(0.118, 0.12, 0.13, 0, 0.62, -0.02, col, 10, { top: 1.15, bot: 0.85 });
    k.tor(0.119, 0.008, 0, 0.75, -0.02, GOLD, TAU, { rx: Math.PI / 2, rs: 12, ts: 3, ao: false }); // tabard trim
    flatSigil(k, 'haven', GOLD, [0, 0.69, 0.102], [0, 0, 1], [0, 1, 0], 0.09);
    k.tor(0.122, 0.013, 0, 0.645, -0.02, LEATHER, TAU, { rx: Math.PI / 2, rs: 12, ts: 3 }); // sword belt
    k.box(0.03, 0.026, 0.012, 0, 0.632, 0.104, GOLD, { ao: false });
    k.tor(0.085, 0.014, 0, 0.865, -0.02, STEELD, TAU, { rx: Math.PI / 2, rs: 10, ts: 3 }); // gorget
    for (const s of [-1, 1]) {
      // layered pauldrons: a big gold cop over a steel lame, with a rim
      k.ball(0.065, s * 0.115, 0.83, -0.02, GOLD, 1, { s: [1, 0.75, 1], top: 1.3 });
      k.ball(0.058, s * 0.13, 0.795, -0.02, STEEL, 1, { s: [1, 0.55, 1], top: 1.25 });
      k.ball(0.01, s * 0.1, 0.87, 0.04, STEEL, 0, { ao: false }); // rivet
    }
    // arms: right on the reins, left raising the standard; steel gauntlets
    k.limb([0.12, 0.82, -0.02], [0.15, 0.7, 0.08], 0.036, 0.03, STEEL, 6);
    k.limb([0.15, 0.7, 0.08], [0.06, 0.67, 0.17], 0.03, 0.028, STEELD, 6);
    k.ball(0.028, 0.06, 0.67, 0.175, STEEL, 1, { s: [1, 0.9, 1.1] });
    k.limb([-0.12, 0.82, -0.02], [-0.18, 0.74, 0.07], 0.036, 0.03, STEEL, 6);
    k.limb([-0.18, 0.74, 0.07], [-0.18, 0.79, 0.14], 0.03, 0.028, STEELD, 6);
    k.ball(0.028, -0.18, 0.79, 0.14, STEEL, 1, { s: [1.1, 1, 1] });
    // a big kite shield in the player colour with a thick gold rim, boss and a gold cross
    k.lathe([[0.0, 0], [0.105, 0.006], [0.11, 0.022]], 0.2, 0.62, 0.02, col, 10, { rz: -Math.PI / 2 - 0.1, top: 1, bot: 1 });
    k.tor(0.104, 0.017, 0.21, 0.62, 0.02, GOLD, TAU, { ry: Math.PI / 2, rs: 12, ts: 4 });
    flatSigil(k, 'haven', GOLD, [0.224, 0.62, 0.02], [Math.cos(0.1), -Math.sin(0.1), 0], [Math.sin(0.1), Math.cos(0.1), 0], 0.15);
    k.ball(0.026, 0.226, 0.625, 0.02, GOLD, 1, { top: 1.3 });
    hipSword(k, 0x2a4ab0, GOLD, LEATHER);
    // oversized head: a gold great helm with a visor slit, breaths, rivets, a crest ridge and a big white plume
    const hy = 0.86;
    k.lathe([[0.078, 0], [0.084, 0.07], [0.078, 0.115], [0.048, 0.148], [0.0, 0.155]], 0, hy, -0.02, GOLD, 10, { top: 1.35, bot: 0.78 });
    k.box(0.09, 0.024, 0.03, 0, hy + 0.06, 0.05, 0x6a4628, { ao: false }); // visor slit: one bold dark bar
    k.box(0.012, 0.11, 0.02, 0, hy + 0.0, 0.06, 0xffe08a, { ao: false }); // nasal ridge
    for (const s of [-1, 1]) for (let i = 0; i < 2; i++) k.box(0.006, 0.022, 0.012, s * (0.02 + i * 0.016), hy + 0.022, 0.058, 0x7a5430, { ao: false }); // breaths
    for (let i = 0; i < 5; i++) { const a = -1.2 + i * 0.6; k.ball(0.007, Math.sin(a) * 0.083, hy + 0.1, -0.02 + Math.cos(a) * 0.075, STEEL, 0, { ao: false }); }
    k.box(0.016, 0.03, 0.15, 0, hy + 0.145, -0.02, 0xffe08a, { top: 1.2 }); // crest ridge
    k.ball(1, 0, hy + 0.2, -0.07, 0xffffff, 1, { s: [0.05, 0.075, 0.1], rx: 0.5, top: 1.1, bot: 0.85 });
    k.ball(1, 0, hy + 0.15, -0.17, 0xf4f4ff, 1, { s: [0.045, 0.06, 0.09], rx: 0.9, top: 1.05, bot: 0.8 });
    for (const s of [-1, 1]) k.ball(1, s * 0.03, hy + 0.17, -0.12, 0xeef2ff, 1, { s: [0.025, 0.05, 0.09], rx: 0.7, top: 1.05, bot: 0.8 });
    k.ball(1, 0, hy + 0.11, -0.24, col, 1, { s: [0.03, 0.04, 0.06], rx: 1.1, top: 1.1, bot: 0.85 }); // plume tip in player colour
  });
  // the wide cape
  cape(k, col, 0, 0.86, -0.09, 0.26, 0.4, false, GOLD);
  // banner pole, gold finial (BODY, so the FLAG cloth stays on its pole) and the big flag
  k.limb([-0.18, 0.4, 0.12], [-0.18, 1.36, 0.15], 0.016, 0.013, WOOD, 6);
  for (const y of [0.62, 0.98]) k.limb([-0.18, y, 0.135], [-0.18, y + 0.03, 0.136], 0.019, 0.019, GOLD, 6, { ao: false });
  k.ball(0.04, -0.18, 1.37, 0.15, GOLD, 1, { ao: false });
  k.cone(0.024, 0.09, -0.18, 1.39, 0.15, GOLD, 4, { ao: false });
  heroBanner(k, -0.18, 1.34, 0.15, col, GOLD, 'haven');
}
function necroHero(k, col) {
  const ROBE = 0x7444b0, ROBED = 0x52307e, BONE = 0xf6eed4, IRON = 0xa49cbc, GREEN = 0x7affa8, SOCKET = 0x3a2a5a;
  horse(k, 0xb8a0e8, 0x3ab06a, 0x5a4a7a, { eyes: GREEN, flameMane: true, feather: false, earIn: 0x8a6ab8, tack: { strap: 0x4a3a6a, metal: BONE } });
  // green flame mane and tail: the undead steed's signature
  k.bone(RIG.HEAD, HORSE_NECK, () => { for (let i = 0; i < 4; i++) { const t = i / 3; k.cone(0.055, 0.2 - t * 0.03, 0, 0.6 + t * 0.24, 0.08 + t * 0.17, GREEN, 4, { glow: true, rx: -0.85 }); } });
  k.bone(RIG.TAIL, HORSE_TAIL, () => {
    k.cone(0.05, 0.26, 0, 0.5, -0.3, GREEN, 4, { glow: true, rx: -2.2 });
    k.cone(0.035, 0.18, 0, 0.42, -0.38, 0x40e088, 4, { glow: true, rx: -2.6 });
  });
  // ghostly green wisps at the fetlocks (glow, following each leg)
  const legs = [[-0.082, 0.16, 0.07], [0.082, 0.17, 0.15], [-0.082, -0.19, -0.08], [0.082, -0.18, -0.2]];
  for (const [x, z, ft] of legs) {
    const bone = z > 0 ? (x > 0 ? RIG.LEG_FL : RIG.LEG_FR) : (x > 0 ? RIG.LEG_BL : RIG.LEG_BR);
    k.bone(bone, [x, 0.47, z], () => k.cone(0.03, 0.07, x, 0.06, z + ft * 0.6 - 0.03, 0x60f0a0, 4, { glow: true, rx: -0.9 }));
  }
  // exposed bone ribs along the flanks + spine knobs
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) k.tor(0.13, 0.011, s * 0.035, 0.47, 0.11 - i * 0.07, BONE, 1.0, { ry: s > 0 ? 0 : Math.PI, rz: s > 0 ? -0.5 : -0.5, rs: 6, ts: 3, ao: false });
  blanket(k, col, BONE, 'necro');
  saddle(k, 0x9a3048, BONE, 0x4a3a6a);
  // a bone skull plate on the horse's face, with eye sockets and teeth
  k.bone(RIG.HEAD, HORSE_NECK, () => {
    k.ball(1, 0, 0.765, 0.42, BONE, 1, { s: [0.05, 0.03, 0.09], rx: 0.6, top: 1.15 });
    for (const s of [-1, 1]) k.tor(0.022, 0.007, s * 0.052, 0.79, 0.4, SOCKET, TAU, { ry: Math.PI / 2 * s, rs: 8, ts: 3, ao: false });
    for (let i = 0; i < 4; i++) k.box(0.012, 0.018, 0.01, -0.027 + i * 0.018, 0.655, 0.535, BONE, { ao: false });
  });
  k.bone(RIG.RIDER, SADDLE, () => {
    for (const s of [-1, 1]) {
      k.limb([s * 0.08, 0.66, -0.02], [s * 0.16, 0.54, 0.09], 0.045, 0.038, ROBE, 8);
      k.limb([s * 0.16, 0.54, 0.09], [s * 0.165, 0.38, 0.04], 0.034, 0.03, IRON, 8);
      k.ball(0.028, s * 0.163, 0.545, 0.105, BONE, 1, { s: [1, 1, 0.7], top: 1.2 }); // bone knee
      k.box(0.045, 0.03, 0.08, s * 0.166, 0.37, 0.065, IRON, { top: 1.2 });
    }
    // violet robe flaring over the saddle with a bone hem, a ribcage plate, a skull-buckled belt, spiked pauldrons
    k.lathe([[0.15, 0], [0.12, 0.06], [0.105, 0.14], [0.1, 0.21], [0.05, 0.27]], 0, 0.6, -0.02, ROBE, 10, { top: 1.3, bot: 0.7 });
    k.tor(0.148, 0.01, 0, 0.605, -0.02, BONE, TAU, { rx: Math.PI / 2, rs: 12, ts: 3, ao: false });
    k.box(0.07, 0.18, 0.02, 0, 0.63, 0.085, col, { rx: -0.1 });
    for (let i = 0; i < 3; i++) k.tor(0.07 - i * 0.008, 0.009, 0, 0.8 - i * 0.04, 0.035, BONE, Math.PI * 0.9, { rx: 0.15, rz: Math.PI * 0.05 + Math.PI, rs: 7, ts: 3, ao: false });
    k.box(0.012, 0.13, 0.012, 0, 0.71, 0.1, BONE, { ao: false }); // sternum
    k.tor(0.108, 0.012, 0, 0.665, -0.02, 0x4a3a6a, TAU, { rx: Math.PI / 2, rs: 12, ts: 3 });
    k.ball(0.022, 0, 0.665, 0.092, BONE, 1, { s: [1, 1.05, 0.7], ao: false });
    for (const s of [-1, 1]) k.ball(0.006, s * 0.008, 0.668, 0.106, SOCKET, 0, { ao: false });
    for (const s of [-1, 1]) {
      k.ball(0.066, s * 0.115, 0.83, -0.02, IRON, 1, { s: [1, 0.72, 1], top: 1.4 });
      k.ball(0.058, s * 0.13, 0.795, -0.02, ROBED, 1, { s: [1, 0.5, 1], top: 1.2 });
      k.cone(0.026, 0.1, s * 0.13, 0.86, -0.03, BONE, 5, { rz: -s * 0.55 });
      k.cone(0.018, 0.07, s * 0.12, 0.86, -0.08, BONE, 4, { rz: -s * 0.4, rx: -0.4 });
    }
    k.limb([0.12, 0.82, -0.02], [0.15, 0.7, 0.08], 0.036, 0.03, ROBE, 6);
    k.limb([0.15, 0.7, 0.08], [0.06, 0.67, 0.17], 0.03, 0.028, ROBED, 6);
    k.ball(0.026, 0.06, 0.67, 0.175, IRON, 1);
    k.limb([-0.12, 0.82, -0.02], [-0.18, 0.74, 0.07], 0.036, 0.03, ROBE, 6);
    k.limb([-0.18, 0.74, 0.07], [-0.18, 0.79, 0.14], 0.03, 0.028, ROBED, 6);
    k.ball(0.026, -0.18, 0.79, 0.14, IRON, 1);
    hipSword(k, 0x4a3a6a, IRON, BONE, GREEN);
    // oversized head: a bone skull in a deep violet hood with a jagged iron crown, glowing eyes in dark
    // sockets, cheekbones, a nasal hole, a jaw with teeth and a green flame crest
    const hy = 0.86;
    k.lathe([[0.1, 0], [0.095, 0.08], [0.075, 0.13], [0.03, 0.19], [0.0, 0.205]], 0, hy - 0.005, -0.035, ROBED, 10, { top: 1.35, bot: 0.8, rx: -0.25 });
    k.ball(0.066, 0, hy + 0.065, 0.0, BONE, 1, { s: [0.95, 1.05, 0.9], top: 1.2, bot: 0.85 });
    for (const s of [-1, 1]) {
      k.ball(0.022, s * 0.026, hy + 0.075, 0.046, SOCKET, 1, { ao: false, s: [1, 1, 0.6] });
      k.ball(0.019, s * 0.026, hy + 0.075, 0.055, GREEN, 0, { glow: true });
      k.ball(0.014, s * 0.045, hy + 0.045, 0.045, BONE, 0, { s: [1.3, 0.8, 1] }); // cheekbone
    }
    k.cone(0.01, 0.018, 0, hy + 0.04, 0.06, SOCKET, 3, { rx: Math.PI, ao: false }); // nasal hole
    k.box(0.07, 0.03, 0.04, 0, hy + 0.0, 0.03, BONE, { top: 1.1 }); // jaw
    for (let i = 0; i < 5; i++) k.box(0.009, 0.014, 0.006, -0.024 + i * 0.012, hy + 0.024, 0.05, i % 2 ? 0xe8dcb8 : BONE, { ao: false });
    for (let i = 0; i < 5; i++) { const a = -1.0 + i * 0.5; k.cone(0.012, 0.05 - Math.abs(i - 2) * 0.008, Math.sin(a) * 0.085, hy + 0.105, -0.03 + Math.cos(a) * 0.075, IRON, 4, { ao: false, top: 1.3 }); }
    k.tor(0.088, 0.01, 0, hy + 0.105, -0.03, IRON, TAU, { rx: Math.PI / 2 - 0.25, rs: 12, ts: 3, ao: false });
    k.cone(0.05, 0.2, 0, hy + 0.15, -0.07, GREEN, 4, { glow: true, rx: -0.55 });
    k.cone(0.035, 0.14, 0, hy + 0.12, -0.15, 0x40e088, 4, { glow: true, rx: -1.0 });
  });
  cape(k, col, 0, 0.86, -0.09, 0.27, 0.42, true, BONE);
  // a bone staff that bears the banner, topped by a big skull with green eyes
  k.limb([-0.18, 0.4, 0.12], [-0.18, 1.33, 0.15], 0.016, 0.013, 0x8a7a6a, 6);
  for (const y of [0.6, 0.9, 1.15]) k.ball(0.022, -0.18, y, 0.13 + (y - 0.4) * 0.03, BONE, 0, { s: [1, 0.6, 1], ao: false }); // vertebra knobs
  k.ball(0.055, -0.18, 1.38, 0.15, BONE, 1, { s: [1, 1.05, 1.05], ao: false });
  k.box(0.06, 0.03, 0.05, -0.18, 1.315, 0.17, BONE, { ao: false });
  for (const s of [-1, 1]) k.ball(0.015, -0.18 + s * 0.021, 1.385, 0.2, GREEN, 0, { glow: true });
  for (const s of [-1, 1]) k.cone(0.014, 0.08, -0.18 + s * 0.032, 1.41, 0.13, BONE, 4, { rz: -s * 0.5, ao: false });
  heroBanner(k, -0.18, 1.32, 0.15, col, BONE, 'necro');
}
// ---- R6 heroes. Shared rider pieces (same pose / pivots as the haven and necro riders).
function riderLegs(k, c, cD, boot = null) {
  for (const s of [-1, 1]) {
    k.limb([s * 0.08, 0.66, -0.02], [s * 0.16, 0.54, 0.09], 0.045, 0.038, c, 8);
    k.limb([s * 0.16, 0.54, 0.09], [s * 0.165, 0.38, 0.04], 0.034, 0.03, cD, 8);
    if (boot) { k.cyl(0.04, 0.036, 0.03, s * 0.163, 0.5, 0.075, boot, 8, { top: 1.2 }); k.box(0.045, 0.03, 0.08, s * 0.166, 0.37, 0.065, boot, { top: 1.2 }); }
  }
}
// right arm forward on the reins / weapon, left arm raised to the standard
function riderArms(k, c, cD, hand = null, cuff = null) {
  k.limb([0.12, 0.82, -0.02], [0.15, 0.7, 0.08], 0.036, 0.03, c, 6);
  k.limb([0.15, 0.7, 0.08], [0.1, 0.7, 0.17], 0.03, 0.028, cD, 6);
  k.limb([-0.12, 0.82, -0.02], [-0.18, 0.74, 0.07], 0.036, 0.03, c, 6);
  k.limb([-0.18, 0.74, 0.07], [-0.18, 0.79, 0.14], 0.03, 0.028, cD, 6);
  if (cuff) { k.limb([0.135, 0.7, 0.12], [0.115, 0.7, 0.155], 0.034, 0.032, cuff, 7); k.limb([-0.18, 0.76, 0.1], [-0.18, 0.775, 0.125], 0.034, 0.032, cuff, 7); }
  if (hand) { k.ball(0.025, 0.1, 0.7, 0.175, hand, 1); k.ball(0.025, -0.18, 0.79, 0.145, hand, 1); }
}
// a tapered curve through pts (horns, antlers, tails); o.alt: second colour for alternate segments (ridges)
function curve(k, pts, r0, r1, c, seg = 5, o = {}) {
  for (let i = 0; i < pts.length - 1; i++) { const t0 = i / (pts.length - 1), t1 = (i + 1) / (pts.length - 1); k.limb(pts[i], pts[i + 1], r0 + (r1 - r0) * t0, r0 + (r1 - r0) * t1, o.alt && i % 2 ? o.alt : c, seg, o); }
}
// a smooth curve resampled through control points (for ridged horns)
function spline(pts, n) { const c = new THREE.CatmullRomCurve3(pts.map(V3)); const out = []; for (let i = 0; i <= n; i++) out.push(c.getPoint(i / n).toArray()); return out; }
// a face for the bare-headed riders: eye whites + iris, brows, nose, mouth (all facing +Z at the head)
function heroFace(k, hx, hy, hz, r, iris, brow, skin, lips) {
  for (const s of [-1, 1]) {
    k.ball(1, hx + s * r * 0.38, hy + r * 0.12, hz + r * 0.86, 0xfffbf0, 1, { s: [r * 0.2, r * 0.15, r * 0.1], ao: false });
    k.ball(r * 0.1, hx + s * r * 0.38, hy + r * 0.12, hz + r * 0.95, iris, 0, { ao: false });
    k.box(r * 0.42, r * 0.09, r * 0.12, hx + s * r * 0.38, hy + r * 0.3, hz + r * 0.84, brow, { rz: -s * 0.18, ao: false });
  }
  k.cone(r * 0.12, r * 0.3, hx, hy - r * 0.2, hz + r * 0.92, skin, 4, { rx: 0.35, ao: false });
  k.box(r * 0.36, r * 0.06, r * 0.08, hx, hy - r * 0.42, hz + r * 0.84, lips, { ao: false });
}

//   Sylvan: elf ranger in a green hood with a big longbow, riding a white stag with golden antlers.
function sylvanHero(k, col) {
  const TUNIC = 0x3cae4c, TUNICD = 0x2a8a3c, LEATHER = 0xb27a44, SKIN = 0xf6d0a8, HAIR = 0xffd860, GOLD = 0xffc83a, BOW = 0xc8843a, ANTLER = 0xf2d49a, LEAF = 0x6ad84a;
  horse(k, 0xfaf6ea, 0xffffff, 0x9a7a54, { mane: false, feather: false, cloven: true, earIn: 0xe8b8a0, tack: { strap: 0x8a5a34, metal: GOLD } });
  // the stag's identity: big branching ridged antlers (on the head bone), a chest ruff, a leaf garland
  k.bone(RIG.HEAD, HORSE_NECK, () => {
    for (const s of [-1, 1]) {
      curve(k, spline([[s * 0.035, 0.85, 0.3], [s * 0.1, 0.96, 0.27], [s * 0.17, 1.05, 0.2], [s * 0.2, 1.16, 0.12]], 6), 0.022, 0.012, ANTLER, 5, { top: 1.2, alt: 0xe2c080 });
      k.ball(0.026, s * 0.035, 0.85, 0.3, 0xd8b880, 0, {}); // burr
      k.limb([s * 0.1, 0.96, 0.27], [s * 0.1, 1.07, 0.33], 0.016, 0.008, ANTLER, 5);
      k.limb([s * 0.17, 1.05, 0.2], [s * 0.24, 1.12, 0.26], 0.014, 0.007, ANTLER, 5);
      k.limb([s * 0.2, 1.16, 0.12], [s * 0.14, 1.22, 0.05], 0.012, 0.006, ANTLER, 5);
      k.limb([s * 0.2, 1.16, 0.12], [s * 0.26, 1.24, 0.1], 0.012, 0.005, ANTLER, 5);
      k.limb([s * 0.06, 0.9, 0.29], [s * 0.07, 0.95, 0.36], 0.012, 0.005, ANTLER, 4); // brow tine
    }
    for (let i = 0; i < 6; i++) { const a = -1.1 + i * 0.44; k.cone(0.02, 0.06, Math.sin(a) * 0.085, 0.6 + Math.cos(a) * 0.02, 0.24 + Math.cos(a) * 0.03, i % 2 ? LEAF : 0x48b83a, 4, { rx: 1.6, rz: -Math.sin(a) * 0.8, s: [1, 1, 0.4], ao: false }); }
    k.tor(0.085, 0.01, 0, 0.6, 0.22, 0x5a8a3a, TAU, { rx: Math.PI / 2 - 0.6, rs: 12, ts: 3, ao: false });
  });
  for (let i = 0; i < 5; i++) { const a = -0.9 + i * 0.45; k.cone(0.035, 0.08, Math.sin(a) * 0.09, 0.42, 0.25, i % 2 ? 0xffffff : 0xf2ead8, 4, { rx: 2.6, rz: Math.sin(a) * 0.4 }); }
  // white dapples on the flanks and rump
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) k.ball(0.02, s * (0.15 - (i % 2) * 0.01), 0.53 - (i % 3) * 0.04, -0.16 - i * 0.035, 0xffffff, 0, { s: [0.4, 1, 1], ao: false });
  k.bone(RIG.TAIL, HORSE_TAIL, () => { k.ball(0.055, 0, 0.55, -0.31, 0xffffff, 1, { s: [0.8, 1.1, 0.8] }); k.ball(0.035, 0, 0.53, -0.35, 0xf6ead8, 0, {}); });
  blanket(k, col, GOLD, 'sylvan');
  saddle(k, 0x8a5a34, GOLD, 0x6a4024);
  k.bone(RIG.RIDER, SADDLE, () => {
    riderLegs(k, LEATHER, 0x8a5a34, 0x6a4a2a);
    // green tunic with a gold belt + buckle, leaf embroidery band, leather shoulder guards, pouch
    k.lathe([[0.1, 0], [0.11, 0.06], [0.11, 0.14], [0.095, 0.21], [0.05, 0.26]], 0, 0.62, -0.02, TUNIC, 10, { top: 1.3, bot: 0.78 });
    k.tor(0.108, 0.016, 0, 0.66, -0.02, GOLD, TAU, { rx: Math.PI / 2, rs: 12, ts: 3 });
    k.box(0.03, 0.03, 0.014, 0, 0.645, 0.092, 0xffe890, { ao: false });
    for (let i = 0; i < 3; i++) k.cone(0.012, 0.03, 0.0, 0.7 + i * 0.04, 0.098 - i * 0.004, GOLD, 4, { s: [1, 1, 0.4], ao: false, rz: i % 2 ? 0.5 : -0.5 });
    k.box(0.05, 0.05, 0.03, 0.09, 0.625, 0.05, LEATHER, { ry: 0.6 });
    for (const s of [-1, 1]) k.ball(0.055, s * 0.105, 0.83, -0.02, LEATHER, 1, { s: [1, 0.7, 1], top: 1.3 });
    riderArms(k, TUNIC, TUNICD, SKIN, LEATHER);
    // quiver strap across the chest, quiver with bands and four fletched arrows
    k.limb([-0.09, 0.84, 0.05], [0.08, 0.66, 0.08], 0.008, 0.008, 0x6a4024, 4);
    k.cyl(0.035, 0.03, 0.2, 0.06, 0.7, -0.12, LEATHER, 8, { rz: -0.35, rx: -0.25 });
    k.cyl(0.037, 0.037, 0.02, 0.105, 0.82, -0.155, GOLD, 8, { rz: -0.35, rx: -0.25, ao: false });
    for (const [dx, dz, c] of [[-0.018, 0, 0xffffff], [0.012, 0.01, 0xffe060], [0.0, -0.016, 0xffffff], [0.024, -0.008, 0xe8f0ff]]) k.cone(0.017, 0.055, 0.12 + dx, 0.87, -0.17 + dz, c, 3, { rz: -0.35, rx: -0.25, s: [1, 1, 0.5] });
    // a big longbow held out on the right with curled tips, a grip wrap and a nocked arrow
    const bowPts = []; for (let i = 0; i <= 8; i++) { const th = (i / 8 - 0.5) * 2.5; bowPts.push([0.2, 0.74 + 0.21 * Math.sin(th), 0.07 + 0.11 * Math.cos(th)]); }
    curve(k, bowPts, 0.02, 0.02, BOW, 6, { top: 1.15 });
    k.limb([0.2, 0.71, 0.178], [0.2, 0.77, 0.178], 0.024, 0.024, 0x7a4a24, 6); // grip
    for (const e of [0, 8]) k.ball(0.016, 0.2, bowPts[e][1], bowPts[e][2], GOLD, 0, { ao: false });
    k.limb(bowPts[0], bowPts[8], 0.005, 0.005, 0xfff4d8, 3, { ao: false });
    k.limb([0.2, 0.74, 0.0], [0.2, 0.74, 0.24], 0.006, 0.006, 0xd8a868, 3);
    k.cone(0.012, 0.035, 0.2, 0.74, 0.24, 0xe8eef6, 3, { rx: Math.PI / 2, ao: false });
    // oversized head: green hood with leaf trim, fair face with eyes and brows, golden hair + braids, pointed ears
    const hy = 0.86;
    k.lathe([[0.1, 0], [0.095, 0.08], [0.075, 0.13], [0.03, 0.2], [0.0, 0.24]], 0, hy - 0.005, -0.03, TUNICD, 10, { top: 1.35, bot: 0.82, rx: -0.3 });
    for (let i = 0; i < 7; i++) { const a = -1.5 + i * 0.5; k.cone(0.014, 0.04, Math.sin(a) * 0.094, hy + 0.02 + Math.cos(a) * 0.1, -0.005 + Math.cos(a) * 0.035, i % 2 ? LEAF : GOLD, 3, { s: [1, 1, 0.4], rz: -Math.sin(a) * 1.4, ao: false }); }
    k.ball(0.064, 0, hy + 0.07, 0.01, SKIN, 1, { s: [0.95, 1.05, 0.9], top: 1.15, bot: 0.9 });
    heroFace(k, 0, hy + 0.07, 0.01, 0.06, 0x2a9a4a, 0xe8b840, 0xf0c098, 0xd88878);
    k.box(0.09, 0.03, 0.02, 0, hy + 0.11, 0.06, HAIR, { ao: false, top: 1.1 });
    k.box(0.12, 0.16, 0.05, 0, hy - 0.06, -0.09, HAIR, { rx: 0.25, top: 1.15, bot: 0.85 });
    for (const s of [-1, 1]) {
      curve(k, [[s * 0.055, hy + 0.06, 0.03], [s * 0.065, hy - 0.01, 0.05], [s * 0.06, hy - 0.08, 0.06]], 0.014, 0.009, HAIR, 5, { alt: 0xf0c840 });
      k.ball(0.009, s * 0.06, hy - 0.085, 0.06, GOLD, 0, { ao: false });
      k.cone(0.018, 0.08, s * 0.07, hy + 0.08, 0.0, SKIN, 4, { rz: -s * 1.15 });
    }
  });
  cape(k, col, 0, 0.86, -0.1, 0.26, 0.4, false, GOLD);
  // a pale-wood pole wound with ivy and a golden leaf finial
  k.limb([-0.18, 0.4, 0.12], [-0.18, 1.36, 0.15], 0.016, 0.013, 0xa87444, 6);
  for (let i = 0; i < 6; i++) { const y = 0.55 + i * 0.13, a = i * 2.2; k.cone(0.016, 0.04, -0.18 + Math.cos(a) * 0.018, y, 0.12 + (y - 0.4) * 0.03 + Math.sin(a) * 0.018, LEAF, 3, { s: [1, 1, 0.4], rz: Math.cos(a) * 1.2, rx: Math.sin(a) * 1.2, ao: false }); }
  k.cone(0.045, 0.13, -0.18, 1.36, 0.15, GOLD, 4, { ao: false, s: [1, 1, 0.45] });
  k.ball(0.022, -0.18, 1.36, 0.15, 0x5acc4a, 0, { ao: false });
  heroBanner(k, -0.18, 1.34, 0.15, col, GOLD, 'sylvan');
}

//   Inferno: horned crimson demon lord in dark iron and gold, a flaming sword, riding a
//   black-plum hellsteed with an orange fire mane, tail and hooves.
function infernoHero(k, col) {
  const IRON = 0x84606e, IROND = 0x644452, GOLD = 0xffc23a, SKIN = 0xe0442a, HORN = 0xf6e2b8, FIRE = 0xff8a1a, FIREY = 0xffd04a;
  horse(k, 0x5a3a44, 0x000000, 0x4a3038, { eyes: FIREY, flameMane: true, feather: false, earIn: 0xc84a3a, tack: { strap: 0x3a2a30, metal: GOLD } });
  k.bone(RIG.HEAD, HORSE_NECK, () => {
    for (let i = 0; i < 4; i++) { const t = i / 3; k.cone(0.068, 0.27 - t * 0.04, 0, 0.6 + t * 0.24, 0.08 + t * 0.17, i % 2 ? FIRE : FIREY, 4, { glow: true, rx: -0.75 }); }
    // iron chanfron with a gold-banded horn
    k.ball(1, 0, 0.775, 0.41, IRON, 1, { s: [0.054, 0.032, 0.1], rx: 0.6, top: 1.3 });
    k.cone(0.022, 0.13, 0, 0.82, 0.36, HORN, 5, { rx: 0.7, top: 1.2 });
    k.tor(0.022, 0.006, 0, 0.83, 0.37, GOLD, TAU, { rx: Math.PI / 2 + 0.7, rs: 8, ts: 3, ao: false });
    // crinet: iron plates down the neck
    for (let i = 0; i < 3; i++) { const t = i / 2; k.box(0.12, 0.022, 0.08, 0, 0.58 + t * 0.18, 0.18 + t * 0.1, i % 2 ? IROND : IRON, { rx: -0.9, top: 1.25 }); }
  });
  k.bone(RIG.TAIL, HORSE_TAIL, () => {
    k.cone(0.055, 0.28, 0, 0.5, -0.3, FIRE, 4, { glow: true, rx: -2.2 });
    k.cone(0.035, 0.18, 0, 0.42, -0.38, FIREY, 4, { glow: true, rx: -2.6 });
  });
  // burning hooves (glow rings that follow each leg)
  const legs = [[-0.082, 0.16, 0.07], [0.082, 0.17, 0.15], [-0.082, -0.19, -0.08], [0.082, -0.18, -0.2]];
  for (const [x, z, ft] of legs) {
    const bone = z > 0 ? (x > 0 ? RIG.LEG_FL : RIG.LEG_FR) : (x > 0 ? RIG.LEG_BL : RIG.LEG_BR);
    k.bone(bone, [x, 0.47, z], () => {
      k.cyl(0.05, 0.056, 0.03, x, 0.0, z + ft * 0.6, FIRE, 6, { glow: true });
      k.cone(0.026, 0.07, x, 0.05, z + ft * 0.6 - 0.02, FIREY, 4, { glow: true, rx: -0.7 });
    });
  }
  // glowing lava cracks over the shoulders and haunches
  for (const s of [-1, 1]) for (const [y, z, r] of [[0.52, 0.16, 0.5], [0.46, 0.12, -0.6], [0.54, -0.2, -0.4], [0.47, -0.16, 0.7]]) k.box(0.006, 0.012, 0.07, s * 0.155, y, z, FIRE, { glow: true, rx: r, ry: s * 0.15 });
  blanket(k, col, GOLD, 'inferno');
  saddle(k, 0x8a2a2a, GOLD, 0x3a2a30);
  k.bone(RIG.RIDER, SADDLE, () => {
    riderLegs(k, IRON, IROND, IROND);
    // dark iron cuirass with ridged plates, a gold collar, tassets, a skull belt, big spiked gold pauldrons
    k.lathe([[0.1, 0], [0.12, 0.06], [0.125, 0.14], [0.11, 0.21], [0.05, 0.26]], 0, 0.62, -0.02, IRON, 10, { top: 1.35, bot: 0.75 });
    k.cyl(0.12, 0.12, 0.1, 0, 0.62, -0.02, col, 10, { top: 1.15, bot: 0.85 });
    for (const y of [0.76, 0.8]) k.tor(0.122 - (y - 0.76) * 0.4, 0.008, 0, y, -0.02, y > 0.78 ? GOLD : IROND, TAU, { rx: Math.PI / 2, rs: 12, ts: 3, ao: false });
    k.box(0.016, 0.1, 0.02, 0, 0.77, 0.1, GOLD, { rx: -0.25, ao: false }); // breast ridge
    k.tor(0.125, 0.014, 0, 0.72, -0.02, 0x3a2a30, TAU, { rx: Math.PI / 2, rs: 12, ts: 3 });
    k.ball(0.024, 0, 0.72, 0.105, HORN, 1, { s: [1, 1, 0.6], ao: false });
    for (const s of [-1, 1]) k.ball(0.006, s * 0.009, 0.724, 0.118, 0x9a2a2a, 0, { ao: false });
    for (const s of [-1, 1]) {
      k.box(0.07, 0.08, 0.014, s * 0.07, 0.6, 0.1, IROND, { rx: -0.3, ry: s * 0.4, top: 1.2 }); // tasset
      k.box(0.072, 0.012, 0.016, s * 0.07, 0.565, 0.112, GOLD, { rx: -0.3, ry: s * 0.4, ao: false });
      k.ball(0.07, s * 0.12, 0.83, -0.02, GOLD, 1, { s: [1, 0.72, 1], top: 1.3 });
      k.ball(0.06, s * 0.135, 0.795, -0.02, IROND, 1, { s: [1, 0.5, 1], top: 1.2 });
      k.cone(0.026, 0.11, s * 0.14, 0.86, -0.02, IROND, 5, { rz: -s * 0.6 });
      k.cone(0.02, 0.08, s * 0.12, 0.86, -0.07, IROND, 4, { rz: -s * 0.45, rx: -0.4 });
    }
    riderArms(k, SKIN, SKIN, 0xc83a24, IROND);
    // a flaming sword raised forward: gold guard with horns, leather grip, gold pommel, fuller and flame tongues
    k.box(0.07, 0.02, 0.02, 0.1, 0.7, 0.18, GOLD);
    for (const s of [-1, 1]) k.cone(0.01, 0.04, 0.1 + s * 0.035, 0.705, 0.18, GOLD, 4, { rz: -s * 0.9, ao: false });
    k.limb([0.1, 0.7, 0.18], [0.1, 0.66, 0.16], 0.012, 0.012, 0x3a2a30, 5);
    k.ball(0.016, 0.1, 0.655, 0.155, GOLD, 0, { ao: false });
    k.box(0.03, 0.3, 0.012, 0.1, 0.71, 0.18, FIREY, { glow: true, rx: 0.5 });
    k.box(0.008, 0.26, 0.016, 0.1, 0.73, 0.18, 0xfff4c0, { glow: true, rx: 0.5 }); // fuller
    k.cone(0.045, 0.34, 0.1, 0.71, 0.18, FIRE, 4, { glow: true, rx: 0.5, s: [1, 1, 0.4] });
    for (const s of [-1, 1]) k.cone(0.018, 0.09, 0.1 + s * 0.03, 0.82, 0.25, FIRE, 3, { glow: true, rx: 0.3, rz: -s * 0.4 });
    // oversized horned head: crimson skin, brow ridge, glowing eyes, fangs, goatee, pointed ears, gold circlet,
    // big ivory horns with ridges
    const hy = 0.86;
    k.ball(0.072, 0, hy + 0.07, -0.01, SKIN, 1, { s: [1, 1.05, 0.95], top: 1.2, bot: 0.85 });
    k.box(0.1, 0.03, 0.06, 0, hy + 0.0, 0.03, 0x9a2a2a, { ao: false }); // jaw / beard
    k.cone(0.02, 0.06, 0, hy - 0.005, 0.05, 0x8a2222, 4, { rx: Math.PI - 0.3, ao: false }); // goatee point
    for (const s of [-1, 1]) {
      k.ball(0.017, s * 0.028, hy + 0.08, 0.055, FIREY, 0, { glow: true });
      k.box(0.05, 0.016, 0.03, s * 0.03, hy + 0.105, 0.05, 0xb02a20, { rz: s * 0.35, ao: false }); // brow ridge
      k.cone(0.007, 0.022, s * 0.016, hy + 0.035, 0.06, 0xfffaea, 3, { rx: Math.PI, ao: false }); // fang
      k.cone(0.016, 0.06, s * 0.07, hy + 0.08, 0.0, SKIN, 4, { rz: -s * 1.2, rx: -0.3 }); // pointed ear
      const hp = spline([[s * 0.05, hy + 0.12, -0.01], [s * 0.13, hy + 0.17, -0.03], [s * 0.17, hy + 0.27, -0.01], [s * 0.14, hy + 0.36, 0.04]], 7);
      curve(k, hp, 0.03, 0.006, HORN, 6, { top: 1.2, alt: 0xdcc092 });
    }
    k.cone(0.012, 0.025, 0, hy + 0.06, 0.06, 0xc83a24, 3, { rx: 0.3, ao: false }); // nose
    k.tor(0.07, 0.014, 0, hy + 0.12, -0.01, GOLD, TAU, { rx: Math.PI / 2, rs: 12, ts: 3 }); // circlet
    k.gem(0.014, 0, hy + 0.125, 0.06, FIRE, { glow: true, s: [1, 1.4, 0.6] });
  });
  cape(k, col, 0, 0.86, -0.1, 0.28, 0.42, true, GOLD);
  // an iron pole with a gold trident head
  k.limb([-0.18, 0.4, 0.12], [-0.18, 1.36, 0.15], 0.016, 0.013, 0x6a4a52, 6);
  for (const y of [0.62, 0.98]) k.limb([-0.18, y, 0.135], [-0.18, y + 0.03, 0.136], 0.019, 0.019, GOLD, 6, { ao: false });
  k.box(0.13, 0.02, 0.02, -0.18, 1.36, 0.15, GOLD, { ao: false });
  for (const dx of [-0.06, 0, 0.06]) k.cone(0.018, dx ? 0.09 : 0.13, -0.18 + dx, 1.38, 0.15, GOLD, 4, { ao: false });
  heroBanner(k, -0.18, 1.34, 0.15, col, GOLD, 'inferno');
}

//   Dungeon: warlock in violet robes and a tall pointed hood with teal eyes and a crystal staff,
//   riding a slate-blue raptor-lizard with teal crest spines and a long tail.
const LZ_NECK = [0, 0.56, 0.2], LZ_TAIL = [0, 0.5, -0.28];
function lizard(k, coat, belly, glowC, tack = null) {
  const coatL = shadeOf(coat, 1.15), coatD = shadeOf(coat, 0.85), CLAW = 0xf2ead8, TOOTH = 0xfffaea;
  k.ball(1, 0, 0.47, -0.02, coat, 2, { s: [0.16, 0.145, 0.31], top: 1.2, bot: 0.75 });
  k.ball(1, 0, 0.42, 0.02, belly, 1, { s: [0.135, 0.09, 0.25], top: 1.0, bot: 0.88 });
  k.ball(1, 0, 0.5, 0.17, coatL, 2, { s: [0.13, 0.13, 0.12], top: 1.15, bot: 0.8 });
  // scale bands: darker stripes across the back, belly plates
  for (let i = 0; i < 5; i++) k.tor(0.15 - Math.abs(i - 2) * 0.01, 0.012, 0, 0.47, 0.14 - i * 0.075, coatD, Math.PI * 0.7, { rz: Math.PI * 0.15, rs: 7, ts: 3, ao: false });
  for (let i = 0; i < 4; i++) k.box(0.13, 0.008, 0.03, 0, 0.335, 0.12 - i * 0.07, shadeOf(belly, 0.88), { ao: false });
  k.bone(RIG.HEAD, LZ_NECK, () => {
    k.limb([0, 0.5, 0.2], [0, 0.72, 0.36], 0.09, 0.062, coat, 8, { top: 1.15 });
    k.ball(1, 0, 0.76, 0.42, coat, 1, { s: [0.08, 0.072, 0.1], top: 1.2, bot: 0.8 });
    k.limb([0, 0.77, 0.46], [0, 0.74, 0.62], 0.058, 0.036, coatL, 8, { top: 1.15 });
    k.limb([0, 0.7, 0.42], [0, 0.68, 0.58], 0.042, 0.026, belly, 6);
    for (const s of [-1, 1]) {
      k.ball(0.026, s * 0.052, 0.8, 0.465, coatD, 0, { ao: false });
      k.ball(0.02, s * 0.055, 0.8, 0.47, glowC, 0, { glow: true });
      k.box(0.06, 0.016, 0.03, s * 0.052, 0.826, 0.47, coatD, { rz: s * 0.3, ao: false }); // brow ridge
      k.ball(0.008, s * 0.02, 0.765, 0.615, 0x2a3044, 0, { ao: false }); // nostril
      // rows of teeth along both jaws
      for (let i = 0; i < 4; i++) { const z = 0.48 + i * 0.03; k.cone(0.007, 0.025, s * (0.035 - i * 0.003), 0.725 - i * 0.003, z, TOOTH, 3, { rx: Math.PI, ao: false }); k.cone(0.006, 0.02, s * (0.03 - i * 0.003), 0.69 - i * 0.002, z, TOOTH, 3, { ao: false }); }
    }
    // crest of glowing fins down the head and neck
    for (let i = 0; i < 4; i++) { const t = i / 3; k.cone(0.03, 0.11 - t * 0.03, 0, 0.82 - t * 0.24, 0.4 - t * 0.2, glowC, 4, { glow: true, rx: -0.7, s: [0.5, 1, 1] }); }
    if (tack) {
      k.tor(0.05, 0.009, 0, 0.75, 0.53, tack.strap, TAU, { rx: 0.1, rs: 12, ts: 3 });
      for (const s of [-1, 1]) { k.limb([s * 0.06, 0.8, 0.42], [s * 0.048, 0.75, 0.52], 0.008, 0.008, tack.strap, 4); k.tor(0.015, 0.005, s * 0.05, 0.73, 0.53, tack.metal, TAU, { ry: Math.PI / 2, rs: 8, ts: 3, ao: false }); }
      k.tor(0.075, 0.009, 0, 0.79, 0.4, tack.strap, TAU, { rx: 0.4, rs: 12, ts: 3 });
    }
  });
  if (tack) for (const s of [-1, 1]) k.limb([s * 0.05, 0.73, 0.53], [0.07, 0.7, 0.18], 0.006, 0.006, tack.strap, 3);
  // four splayed lizard legs, three forward claws + a sickle claw
  const legs = [[0.1, 0.15, 0.06, 0.1], [-0.1, 0.16, -0.04, 0.16], [0.1, -0.17, -0.02, -0.06], [-0.1, -0.16, 0.03, -0.18]];
  for (const [x, z, kn, ft] of legs) {
    const s = Math.sign(x), hip = [x, 0.44, z], knee = [x + s * 0.1, 0.3, z + kn], foot = [x + s * 0.09, 0.04, z + ft * 0.6];
    const bone = z > 0 ? (x > 0 ? RIG.LEG_FL : RIG.LEG_FR) : (x > 0 ? RIG.LEG_BL : RIG.LEG_BR);
    k.bone(bone, hip, () => {
      k.limb(hip, knee, 0.068, 0.048, coat, 8);
      k.ball(0.05, knee[0], knee[1], knee[2], coatL, 1, {});
      k.limb(knee, foot, 0.044, 0.034, coat, 6);
      k.box(0.08, 0.04, 0.11, foot[0], 0, foot[2] + 0.02, belly, { top: 1.1 });
      for (let i = 0; i < 3; i++) k.cone(0.011, 0.04, foot[0] + (i - 1) * 0.026, 0.012, foot[2] + 0.08, CLAW, 3, { rx: Math.PI / 2 + 0.3, ao: false });
      k.cone(0.012, 0.05, foot[0] - s * 0.04, 0.03, foot[2] + 0.03, CLAW, 3, { rx: 0.9, ao: false });
    });
  }
  // a long, thick banded tail with glowing spines
  k.bone(RIG.TAIL, LZ_TAIL, () => {
    curve(k, spline([[0, 0.5, -0.26], [0, 0.42, -0.46], [0, 0.28, -0.64], [0, 0.12, -0.8]], 7), 0.095, 0.014, coat, 8, { top: 1.15, alt: coatD });
    for (let i = 0; i < 3; i++) { const t = i / 2; k.cone(0.026, 0.08 - t * 0.02, 0, 0.53 - t * 0.2, -0.36 - t * 0.28, glowC, 4, { glow: true, rx: -0.9, s: [0.5, 1, 1] }); }
  });
}
function dungeonHero(k, col) {
  const ROBE = 0x9a4ae0, ROBED = 0x6a30b0, GOLD = 0xf0c450, TEAL = 0x46f4e0, SKIN = 0xb8a8d8, FACE = 0x3a2a58, LEATHER = 0x5a3a5a;
  lizard(k, 0x4a6488, 0x9cbcc4, TEAL, { strap: LEATHER, metal: GOLD });
  blanket(k, col, GOLD, 'dungeon');
  saddle(k, 0x5a3a7a, GOLD, LEATHER);
  k.bone(RIG.RIDER, SADDLE, () => {
    riderLegs(k, ROBE, ROBED, 0x4a2a6a);
    // flaring violet robe with gold trim + rune band, high pointed collar, a belt with pouch + spellbook
    k.lathe([[0.16, 0], [0.125, 0.06], [0.105, 0.14], [0.1, 0.21], [0.05, 0.27]], 0, 0.6, -0.02, ROBE, 10, { top: 1.3, bot: 0.72 });
    k.tor(0.15, 0.014, 0, 0.605, -0.02, GOLD, TAU, { rx: Math.PI / 2, rs: 12, ts: 3 });
    k.box(0.05, 0.2, 0.02, 0, 0.62, 0.095, GOLD, { rx: -0.12 });
    for (let i = 0; i < 3; i++) k.gem(0.012, 0, 0.65 + i * 0.05, 0.11 - i * 0.006, TEAL, { glow: true, s: [1, 1.3, 0.5] }); // glowing runes
    k.tor(0.108, 0.012, 0, 0.7, -0.02, LEATHER, TAU, { rx: Math.PI / 2, rs: 12, ts: 3 });
    k.box(0.05, 0.06, 0.03, 0.1, 0.65, 0.04, LEATHER, { ry: 0.6 });
    k.box(0.07, 0.085, 0.03, -0.11, 0.62, 0.02, 0x3a7a8a, { ry: -0.7, top: 1.2 }); // spellbook
    k.box(0.072, 0.012, 0.032, -0.11, 0.68, 0.02, GOLD, { ry: -0.7, ao: false });
    k.gem(0.012, -0.096, 0.665, 0.045, TEAL, { glow: true });
    for (const s of [-1, 1]) {
      k.ball(0.064, s * 0.11, 0.83, -0.02, ROBED, 1, { s: [1, 0.72, 1], top: 1.4 });
      k.tor(0.058, 0.007, s * 0.11, 0.825, -0.02, GOLD, TAU, { rx: Math.PI / 2, rs: 10, ts: 3, ao: false });
      k.cone(0.05, 0.15, s * 0.07, 0.82, -0.06, ROBED, 4, { rz: -s * 0.25, s: [1, 1, 0.4] }); // collar wings
    }
    riderArms(k, ROBE, ROBED, SKIN, GOLD);
    // a crystal staff in the right hand: wrapped shaft, gold claw, a big teal crystal with a ring
    k.limb([0.1, 0.5, 0.17], [0.1, 1.0, 0.2], 0.012, 0.012, 0x6a4a8a, 5);
    for (const y of [0.62, 0.8]) k.limb([0.1, y, 0.177], [0.1, y + 0.03, 0.179], 0.016, 0.016, GOLD, 6, { ao: false });
    for (let s = 0; s < 3; s++) { const b = s / 3 * TAU; k.cone(0.008, 0.05, 0.1 + Math.cos(b) * 0.022, 1.0, 0.2 + Math.sin(b) * 0.022, GOLD, 4, { rz: -Math.cos(b) * 0.35, rx: Math.sin(b) * 0.35, ao: false }); }
    k.gem(0.05, 0.1, 1.06, 0.2, TEAL, { glow: true, s: [1, 1.7, 1] });
    k.tor(0.05, 0.008, 0.1, 1.02, 0.2, GOLD, TAU, { rx: Math.PI / 2, rs: 10, ts: 3 });
    k.tor(0.07, 0.005, 0.1, 1.07, 0.2, TEAL, TAU, { rx: Math.PI / 2 - 0.4, rs: 12, ts: 3, glow: true });
    // oversized head: a tall pointed violet hood with a gold rim, shadowed face, glowing teal eyes
    const hy = 0.86;
    k.lathe([[0.1, 0], [0.098, 0.08], [0.08, 0.14], [0.045, 0.24], [0.0, 0.34]], 0, hy - 0.005, -0.04, ROBE, 10, { top: 1.4, bot: 0.8, rx: -0.3 });
    k.tor(0.092, 0.009, 0, hy + 0.06, -0.01, GOLD, TAU, { rx: Math.PI / 2 - 0.9, rs: 12, ts: 3, ao: false });
    k.ball(0.06, 0, hy + 0.065, 0.01, FACE, 1, { s: [0.95, 1.0, 0.8], top: 1.1, bot: 0.9 });
    k.box(0.05, 0.04, 0.03, 0, hy + 0.0, 0.05, SKIN, { ao: false }); // pale chin
    k.box(0.024, 0.006, 0.01, 0, hy + 0.012, 0.066, 0x6a4a8a, { ao: false }); // mouth
    for (const s of [-1, 1]) k.ball(0.019, s * 0.026, hy + 0.075, 0.055, TEAL, 0, { glow: true });
    k.gem(0.02, 0, hy + 0.15, 0.055, TEAL, { glow: true, s: [1, 1.5, 0.6] }); // brow gem
    k.cone(0.006, 0.03, 0, hy + 0.12, 0.06, GOLD, 3, { rx: Math.PI, ao: false });
  });
  cape(k, col, 0, 0.86, -0.1, 0.27, 0.42, false, GOLD);
  // a dark pole topped with a teal crystal in a gold claw
  k.limb([-0.18, 0.4, 0.12], [-0.18, 1.36, 0.15], 0.016, 0.013, 0x5a4472, 6);
  for (const y of [0.62, 0.98]) k.limb([-0.18, y, 0.135], [-0.18, y + 0.03, 0.136], 0.019, 0.019, GOLD, 6, { ao: false });
  for (let s = 0; s < 3; s++) { const b = s / 3 * TAU; k.cone(0.012, 0.07, -0.18 + Math.cos(b) * 0.03, 1.35, 0.15 + Math.sin(b) * 0.03, GOLD, 4, { rz: -Math.cos(b) * 0.4, rx: Math.sin(b) * 0.4, ao: false }); }
  k.gem(0.045, -0.18, 1.42, 0.15, TEAL, { glow: true, s: [1, 1.6, 1] });
  heroBanner(k, -0.18, 1.34, 0.15, col, GOLD, 'dungeon');
}

// fac -> [builder, kit seed, default player colour]; unknown factions fall back to haven
const HEROES = { haven: [havenHero, 21, 0x3a7aff], necro: [necroHero, 23, 0xd83a3a], sylvan: [sylvanHero, 25, 0x3ac84a], inferno: [infernoHero, 27, 0xff7a1a], dungeon: [dungeonHero, 29, 0xa84ad8] };
export function heroModel(fac, color) {
  const [build, seed, defCol] = HEROES[fac] || HEROES.haven;
  const k = makeKit(seed);
  // rig: anything not given its own bone (mount barrel, blanket, saddle, banner pole) is BODY
  k.bone(RIG.BODY, HORSE_BODY, () => build(k, color ?? defCol));
  const m = finish(k), S = 1.22; // R4: a touch bigger than before (1.12) so the rider reads at map zoom
  // pivots scale with the positions
  const scalePivots = (g) => { const a = g.attributes.aPivot; if (a) { for (let i = 0; i < a.array.length; i++) a.array[i] *= S; a.needsUpdate = true; } };
  m.body.scale(S, S, S); scalePivots(m.body); m.body.computeBoundingSphere(); m.body.computeBoundingBox();
  if (m.glow) { m.glow.scale(S, S, S); scalePivots(m.glow); m.glow.computeBoundingSphere(); }
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
