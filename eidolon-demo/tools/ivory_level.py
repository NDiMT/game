"""Builds the ivory level of Eidolon GO in Blender: marble floors on rock cut in uneven planes, flights of steps,
fluted broken columns, arches, a cypress, outcrops of rock; bakes the shade of corners and clefts (ambient occlusion)
into the vertices; writes the level (goiv/level.glb) and its way (goiv/level.json) for the game.

Everything is placed in the game's own axes (x across, y up, z toward the eye's left), in metres from the level's origin.

usage: python3.11 -I tools/ivory_level.py -- <out.glb> <out.json> [seed] [samples] [plan.json]
With a plan (made by tools/ivory/trace.py from a concept picture) the floors, flights and things stand where the
picture shows them; without one, the built-in plan below is used.
"""
import bpy, bmesh, math, random, sys, json
from mathutils import Vector, Matrix

a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = a[0] if len(a) > 0 else 'goiv/level.glb'
OUTJ = a[1] if len(a) > 1 else 'goiv/level.json'
SEED = int(a[2]) if len(a) > 2 else 7
SAMPLES = int(a[3]) if len(a) > 3 else 48
PLAN = json.load(open(a[4])) if len(a) > 4 else None
rnd = random.Random(SEED)
RSTYLE = (PLAN or {}).get('rock_style', {})      # (a level's own cut of its rock: the third level's sharper, more aslant (the owner: "more sharply cut and slanted"))

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def G(x, y, z):      # the game's axes (y up) to Blender's (z up); the glTF writer turns them back
    return Vector((x, -z, y))


# ------------------------------------------------------------------ the plan (the game's axes)
H0, H1, HL, H2, H3, HS = 0.0, 1.36, 2.04, 2.89, 3.74, -1.36
FLOORS = {      # name: x0, x1, z0, z1, height, chamfer
    'T0a': (-0.75, 0.75, 3.3, 6.05, H0, 0.25), 'T0b': (0.75, 2.15, 4.55, 6.05, H0, 0.2),
    'T1': (-0.95, 2.75, -2.0, 0.95, H1, 0.45), 'L': (-0.75, 0.95, -4.45, -3.2, HL, 0.2),
    'R': (0.95, 2.75, -5.2, -3.35, HL, 0.3), 'T2': (-4.35, -2.05, -4.75, -2.55, H2, 0.35),
    'T3': (-3.75, -0.75, -7.85, -6.1, H3, 0.5), 'S0f': (4.55, 5.45, 4.7, 5.9, HS, 0.2),
}
FLIGHTS = [      # foot (on the lower floor), head (on the upper), width
    ((4.55, HS, 5.3), (2.15, H0, 5.3), 1.1), ((0.0, H0, 3.3), (0.0, H1, 0.95), 1.15), ((0.0, H1, -2.0), (0.0, HL, -3.2), 1.1),
    ((-0.75, HL, -3.85), (-2.05, H2, -3.85), 1.05), ((-3.0, H2, -4.75), (-3.0, H3, -6.1), 1.05),
]
ROCKS = [      # rock without a floor of marble, that binds the floors into one mountain: x0, x1, z0, z1, top
    (-3.6, -0.95, -0.9, 1.7, H1 - 0.5), (-4.95, -4.0, -3.45, -2.2, H2 - 0.3), (2.75, 3.6, -1.6, 0.6, H1 - 1.2),
    (-4.6, -3.75, -6.9, -5.0, H3 - 1.1), (-1.0, 0.6, 6.05, 7.3, H0 - 1.0),
    (-2.05, -0.75, -3.2, -2.0, H1 - 0.35), (-5.3, -4.35, -5.6, -1.9, H2 - 0.9), (-4.4, -0.6, -9.0, -7.85, H3 - 0.5),
    (2.75, 3.7, -5.6, -2.9, HL - 1.0), (1.0, 2.9, 1.0, 4.4, H0 - 1.0), (-2.0, -0.75, 1.0, 3.2, H0 - 0.9),
    (-4.2, -2.1, -2.5, -0.95, H1 - 0.6),
]


# ------------------------------------------------------------------ shapes
def rect(x0, x1, z0, z1, ch=0.0):
    if ch <= 0.0: return [(x0, z0), (x1, z0), (x1, z1), (x0, z1)]
    return [(x0 + ch, z0), (x1 - ch, z0), (x1, z0 + ch), (x1, z1 - ch), (x1 - ch, z1), (x0 + ch, z1), (x0, z1 - ch), (x0, z0 + ch)]


def grow(poly, d):
    cx = sum(p[0] for p in poly) / len(poly); cz = sum(p[1] for p in poly) / len(poly)
    out = []
    for (x, z) in poly:
        dx, dz = x - cx, z - cz; l = math.hypot(dx, dz) or 1.0
        out.append((x + dx / l * d, z + dz / l * d))
    return out


def prism(bm, poly, y0, y1):
    bot = [bm.verts.new(G(x, y0, z)) for (x, z) in poly]
    top = [bm.verts.new(G(x, y1, z)) for (x, z) in poly]
    n = len(poly)
    fs = [bm.faces.new(top), bm.faces.new(list(reversed(bot)))]
    for i in range(n):
        j = (i + 1) % n
        fs.append(bm.faces.new([bot[i], bot[j], top[j], top[i]]))
    return fs


def hexa(bm, pts):      # eight corners in the game's axes: the four below, then the four above
    v = [bm.verts.new(G(*p)) for p in pts]
    for f in [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]:
        try: bm.faces.new([v[i] for i in f])
        except ValueError: pass


def box(bm, lo, hi):
    x0, y0, z0 = lo; x1, y1, z1 = hi
    hexa(bm, [(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1), (x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)])


def chisel(bm, n, depth=(0.14, 0.6), tilt=(-0.6, 0.5), keep_above=None):
    """Planes slice the outside of the stone away: so many cuts, each so deep, its face so tilted."""
    for _ in range(n):
        if len(bm.verts) < 4: return
        vs = [v.co.copy() for v in bm.verts]
        c = sum(vs, Vector()) / len(vs)
        ang = rnd.uniform(0.0, 2.0 * math.pi)
        nrm = Vector((math.cos(ang), math.sin(ang), rnd.uniform(*tilt))).normalized()
        far = max((v - c).dot(nrm) for v in vs)
        co = c + nrm * (far - rnd.uniform(*depth))
        if keep_above is not None and co.z > keep_above: co.z = keep_above
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=co, plane_no=nrm, clear_outer=True)
        bmesh.ops.holes_fill(bm, edges=bm.edges[:], sides=0)


def finish(bm, name, fine=0.7):
    """Planar faces cut finer (so the shade of the corners can lie on them softly), and an object of it."""
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    for _ in range(2):
        long_e = [e for e in bm.edges if e.calc_length() > fine]
        if not long_e: break
        bmesh.ops.subdivide_edges(bm, edges=long_e, cuts=1, use_grid_fill=False)
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); scene.collection.objects.link(ob)
    return ob


def rock_mass(name, poly, top, bottom=-14.0, cuts=14, extra=4, base_grow=0.05):
    """the rock under a floor: one body cut in planes, and lumps of rock leaning out of it, each cut its own way"""
    obs = []
    bm = bmesh.new(); prism(bm, grow(poly, base_grow), bottom, top); chisel(bm, cuts, keep_above=None)
    obs.append(finish(bm, name))
    xs = [p[0] for p in poly]; zs = [p[1] for p in poly]
    for k in range(extra):
        # a lump: about a point of the outline, out from it, its top somewhere down the face
        i = rnd.randrange(len(poly)); j = (i + 1) % len(poly); t = rnd.random()
        px = poly[i][0] + (poly[j][0] - poly[i][0]) * t; pz = poly[i][1] + (poly[j][1] - poly[i][1]) * t
        r = rnd.uniform(0.55, 1.15)
        pts = []
        for m in range(6):
            aa = 2.0 * math.pi * m / 6.0 + rnd.uniform(-0.3, 0.3)
            pts.append((px + math.cos(aa) * r * rnd.uniform(0.7, 1.1), pz + math.sin(aa) * r * rnd.uniform(0.7, 1.1)))
        lt = top - rnd.uniform(0.9, 3.0)
        bm = bmesh.new(); prism(bm, pts, lt - rnd.uniform(3.5, 9.0), lt); chisel(bm, 6, depth=(0.08, 0.4), tilt=(-0.5, 0.45))
        obs.append(finish(bm, '%s_lump%d' % (name, k)))
    return obs


# ------------------------------------------------------------------ stone as it breaks: one mountain
def ccw(poly):
    a = sum(poly[i][0] * poly[(i + 1) % len(poly)][1] - poly[(i + 1) % len(poly)][0] * poly[i][1] for i in range(len(poly)))
    return list(poly) if a > 0 else list(reversed(poly))


def densify(poly, seg):
    out = []
    for i in range(len(poly)):
        a = poly[i]; b = poly[(i + 1) % len(poly)]
        k = max(1, round(math.hypot(b[0] - a[0], b[1] - a[1]) / seg))
        for j in range(k): out.append((a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k))
    return out


def normals(pts, closed=True):
    """the outward normal at each point of a counter-clockwise outline (or the left side of an open line)"""
    n = len(pts); out = []
    for i in range(n):
        a = pts[i - 1] if (closed or i > 0) else pts[i]; b = pts[(i + 1) % n] if (closed or i < n - 1) else pts[i]
        du, dv = b[0] - a[0], b[1] - a[1]; l = math.hypot(du, dv) or 1.0
        out.append((dv / l, -du / l))
    return out


def broken(poly, seg=0.3, jit=0.045, chip=0.12):
    """an outline broken as stone breaks: cut into short lengths, each point a little in or out, here and there a
    notch; the whole smoothed once, so the edge wanders and never zigzags"""
    pts = densify(ccw(poly), seg); nr = normals(pts); n = len(pts)
    off = [rnd.uniform(-jit, jit) - (rnd.uniform(jit, 2.4 * jit) if rnd.random() < chip else 0.0) for _ in range(n)]
    off = [0.25 * off[i - 1] + 0.5 * off[i] + 0.25 * off[(i + 1) % n] for i in range(n)]
    return [(p[0] + nr[i][0] * off[i], p[1] + nr[i][1] * off[i]) for i, p in enumerate(pts)]


def loft(bm, rings, cap0=True, cap1=True):
    """faces between rings of points (the game's axes), each ring the same count; the first and last closed"""
    vs = [[bm.verts.new(G(*p)) for p in r] for r in rings]
    n = len(rings[0])
    for a, b in zip(vs, vs[1:]):
        for k in range(n):
            try: bm.faces.new([a[k], a[(k + 1) % n], b[(k + 1) % n], b[k]])
            except ValueError: pass
    if cap0:
        try: bm.faces.new(list(reversed(vs[0])))
        except ValueError: pass
    if cap1:
        try: bm.faces.new(vs[-1])
        except ValueError: pass
    return vs


def slab(name, outline, h, thick=0.6, keep=()):
    """a floor of marble: a thick slab on the broken outline, level on top, its top edge eased (a chamfer that catches
    the light, as the picture's), here and there a chip off it and a piece gone from its under edge; square and sharp
    where a flight meets it (keep, the points where flights come to it)"""
    nr = normals(outline); n = len(outline)
    hang = [0.0] * n      # (pieces of the slab hanging lower under its edge, as the picture's thick broken slabs)
    for _ in range(max(1, n // 5)):
        i0, w = rnd.randrange(n), rnd.randint(1, 3); dh = rnd.uniform(0.08, 0.22)
        for j in range(-w, w + 1): hang[(i0 + j) % n] = max(hang[(i0 + j) % n], dh * (0.5 + 0.5 * math.cos(math.pi * j / (w + 1))))
    dk = [min([math.hypot(x - k[0], z - k[1]) for k in keep] or [9.0]) for (x, z) in outline]      # (how far from where a flight comes)
    near = [d < 0.9 for d in dk]
    eh = [rnd.uniform(0.09, 0.17) for _ in range(n)]      # (the top edge cut off broadly, as by hand: its breadth wanders)
    for _ in range(2): eh = [0.25 * eh[i - 1] + 0.5 * eh[i] + 0.25 * eh[(i + 1) % n] for i in range(n)]
    eh = [max(0.004, eh[i] * min(1.0, max(0.0, (dk[i] - 0.8) / 0.8))) for i in range(n)]      # (dying away before a flight: square where it meets the floor)
    inner, top, rim, bot, und, evs = [], [], [], [], [], []
    for i, (x, z) in enumerate(outline):
        nx, nz = nr[i]
        near_flight = near[i]
        e = eh[i]; ev = e * (1.0 if near_flight else rnd.uniform(0.65, 0.95)); evs.append(ev)
        inner.append((x - nx * 0.26, h, z - nz * 0.26))
        if rnd.random() < 0.2 and dk[i] > 1.3:      # a chip: the edge a little lower and further in
            dy, dn = -rnd.uniform(0.02, 0.05), -rnd.uniform(0.01, 0.035)
        else: dy, dn = 0.0, 0.0
        top.append((x + nx * (dn - e), h, z + nz * (dn - e)))      # (the top itself dead level: a chip only takes the edge)
        rim.append((x + nx * dn, h + dy - ev, z + nz * dn))
        b = rnd.uniform(0.0, 0.05)
        yb = h - thick + rnd.uniform(-0.03, 0.03) - hang[i] + (rnd.uniform(0.04, 0.09) if (rnd.random() < 0.12 and not near_flight) else 0.0)
        bot.append((x - nx * b, yb, z - nz * b))
        und.append((x - nx * (b + 0.07), yb - 0.035, z - nz * (b + 0.07)))
    bm = bmesh.new(); vs = loft(bm, [top, rim, bot, und], cap0=False, cap1=False)
    tops = []
    for ring in (vs[0], vs[-1]):      # (each cap filled within its outline, notches and all: the L of a floor is never bridged)
        es = [bm.edges.get((ring[i], ring[(i + 1) % len(ring)])) for i in range(len(ring))]
        r = bmesh.ops.triangle_fill(bm, use_beauty=True, use_dissolve=False, edges=[e for e in es if e is not None])
        if ring is vs[0]: tops = [g for g in r['geom'] if isinstance(g, bmesh.types.BMFace)]
    poly2 = [(p[0], p[2]) for p in top]
    bad = [f for f in tops if not inside(poly2, (f.calc_center_median().x, -f.calc_center_median().y))]
    if bad or not tops: print('SLAB', name, 'cap triangles outside its outline:', len(bad), 'of', len(tops), 'at', [(round(f.calc_center_median().x, 2), round(-f.calc_center_median().y, 2)) for f in bad])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    if (PLAN or {}).get('scene') == 'moon': SNOWS.append(snow_lip(name, outline, h, nr, eh, evs, dk))
    return finish(bm, name + '_slab')


SNOWS = []
def snow_lip(name, outline, h, nr, eh, evs, dk):
    """snow lying on a floor's edge (a level in the snow): a soft roll along the edge, a little proud of the top, rolling
    over it and hanging down past the chamfer, here and there a lump hanging lower; it dies away where a flight meets
    the floor. (Its own dice, so the stone under it is cut as it was.)"""
    rs = random.Random(sum(ord(c) * (i + 1) for i, c in enumerate(name)) + 7); n = len(outline)      # (a seed of its own, the same every run)
    th = [rs.uniform(0.035, 0.09) for _ in range(n)]
    g0 = [rs.uniform(0.0, 0.06) for _ in range(n)]
    for _ in range(3):
        th = [0.25 * th[i - 1] + 0.5 * th[i] + 0.25 * th[(i + 1) % n] for i in range(n)]
        g0 = [0.25 * g0[i - 1] + 0.5 * g0[i] + 0.25 * g0[(i + 1) % n] for i in range(n)]
    for _ in range(max(1, n // 7)):      # (lumps hanging lower)
        i0, w = rs.randrange(n), rs.randint(0, 2); dh = rs.uniform(0.05, 0.13)
        for j in range(-w, w + 1): g0[(i0 + j) % n] += dh * (0.5 + 0.5 * math.cos(math.pi * j / (w + 1)))
    prof = []      # (out along the edge's normal, up from the top) for each point of the roll, outward then back under
    for i, (x, z) in enumerate(outline):
        f = min(1.0, max(0.0, (dk[i] - 0.75) / 0.6)); e = eh[i]; t_ = th[i] * f; g = (max(evs[i] * 0.95, 0.03) + g0[i]) * f
        o0 = -(e + 0.13)
        pts = [(o0, 0.0), (-(e + 0.05), 0.55 * t_), (-e * 0.45, t_), (0.03 + 0.12 * g, 0.5 * t_), (0.05 + 0.18 * g, -0.35 * g), (0.03, -g), (-0.04, -g + 0.02), (-(e + 0.06), -0.012)]
        prof.append([(o0 + (o - o0) * f, u * f) for (o, u) in pts])
    rings = []
    for k in range(len(prof[0])):
        rings.append([(outline[i][0] + nr[i][0] * prof[i][k][0], h + prof[i][k][1], outline[i][1] + nr[i][1] * prof[i][k][0]) for i in range(n)])
    bm = bmesh.new(); loft(bm, rings, cap0=False, cap1=False)
    return finish(bm, name + '_snow')


def resample(poly, seg=(0.8, 1.4)):
    """the outline's own corners kept, its long edges cut at lengths here and there"""
    out = []
    for i in range(len(poly)):
        a = poly[i]; b = poly[(i + 1) % len(poly)]
        L = math.hypot(b[0] - a[0], b[1] - a[1]); out.append(a)
        t = rnd.uniform(*seg)
        while t < L - 0.3:
            out.append((a[0] + (b[0] - a[0]) * t / L, a[1] + (b[1] - a[1]) * t / L)); t += rnd.uniform(*seg)
    return out


def mass(name, poly, top_at, inset=0.06, rough=1.0, dome=False, soft=True):
    """a body of rock under a floor, a flight or a ledge, as cut stone breaks: a few broad planes, a little in under the
    edge above, then out and in again going down, wider far down where the mist has it; a cleft down a face, a shelf;
    its upright corners eased off, each by its own breadth (the picture's broken corners). A ledge (dome) has a top of
    its own: a flat break leaning one way, its rim eased off all round."""
    pts = resample(ccw(poly)); n = len(pts); nr = normals(pts)
    lv = [0.0, rnd.uniform(0.3, 0.55), rnd.uniform(1.0, 1.7), rnd.uniform(2.6, 3.8), 16.0]
    base = [-inset, -inset, 0.06, 0.3, 1.6]      # how far out of the outline each ring lies (less than nothing: in)
    jit = [0.0, 0.13, 0.2, 0.26, 0.4]
    if dome: base = [0.0, 0.03, 0.1, 0.35, 1.6]; jit = [0.0, 0.06, 0.18, 0.26, 0.4]      # (a ledge: no lip over its own face)
    ymin = min(top_at(x, z) for (x, z) in pts)
    clefts = rnd.sample(range(n), min(n, max(1, n // 3))); cleft_d = {i: rnd.uniform(0.28, 0.48) for i in clefts}
    s0 = rnd.randrange(n); shelf = [(s0 + j) % n for j in range(min(n, 2))]
    rings = []
    for k in range(5):
        r = [rnd.uniform(-jit[k], jit[k]) * rough for _ in range(n)]
        if k == 2:
            for i in range(n):
                if rnd.random() < 0.2: r[i] -= rnd.uniform(0.1, 0.22) * rough      # (a piece of the rock gone)
            for i in shelf: r[i] += 0.16 * rough      # (a shelf, catching the light)
        if 1 <= k <= 3:
            for i in clefts: r[i] -= cleft_d[i] * rough * (0.55 if k == 1 else 1.0)      # (a cleft down the face, from just under the slab)
        if k > 2: r = [0.25 * r[i - 1] + 0.5 * r[i] + 0.25 * r[(i + 1) % n] for i in range(n)]
        ring = []
        for i, (x, z) in enumerate(pts):
            o = base[k] + r[i]
            y = (top_at(x, z) if k < 3 else ymin) - lv[k] + (rnd.uniform(-0.09, 0.09) if 0 < k < 4 else 0.0)
            ring.append((x + nr[i][0] * o, y, z + nr[i][1] * o))
        rings.append(ring)
    bm = bmesh.new()
    if dome:
        cx = sum(p[0] for p in pts) / n; cz = sum(p[1] for p in pts) / n
        tl = Vector((rnd.uniform(-1, 1), 0.0, rnd.uniform(-1, 1))).normalized() * rnd.uniform(0.08, 0.16)      # (the break leans one way)
        lean = lambda x, z: (x - cx) * tl.x + (z - cz) * tl.z
        ch = rnd.uniform(0.09, 0.15)
        cap = [(x - nr[i][0] * ch, top_at(x, z) + lean(x, z), z - nr[i][1] * ch) for i, (x, z) in enumerate(pts)]
        rings[0] = [(x, top_at(x, z) + lean(x, z) - ch * rnd.uniform(0.6, 0.9), z) for (x, z) in pts]
        vs = loft(bm, [cap] + rings, cap0=True)
    else: vs = loft(bm, rings)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    top_z = ymin - 2.2
    for _ in range(2):      # its upright corners eased off, here broadly, there hardly
        cand = [e for e in bm.edges if e.is_valid and len(e.link_faces) == 2 and e.calc_face_angle(0) > 0.45
                and abs((e.verts[1].co - e.verts[0].co).normalized().z) > 0.55 and max(v.co.z for v in e.verts) > top_z]
        rnd.shuffle(cand)
        pick = cand[:max(1, int(len(cand) * 0.6))]
        if pick:
            try: bmesh.ops.bevel(bm, geom=pick, offset=rnd.uniform(0.04, 0.12), segments=1, affect='EDGES', clamp_overlap=True)
            except Exception: pass
    ob = finish(bm, name + '_rock', fine=0.9)
    if soft: soften(ob)
    set_depth(ob, top_at)
    return ob


def soften(ob, levels=2, ratio=0.065):
    """the rock made soft and low, as the picture's: its form rounded (subdivided), then let down again into broad
    facets (collapsed), so it reads as a weathered boulder cut in few planes, not a box"""
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    m1 = ob.modifiers.new('sub', 'SUBSURF'); m1.levels = levels; m1.render_levels = levels
    bpy.ops.object.modifier_apply(modifier='sub')
    m2 = ob.modifiers.new('dec', 'DECIMATE'); m2.decimate_type = 'COLLAPSE'; m2.ratio = ratio
    bpy.ops.object.modifier_apply(modifier='dec')
    bm = bmesh.new(); bm.from_mesh(ob.data); bmesh.ops.triangulate(bm, faces=bm.faces[:]); bm.to_mesh(ob.data); bm.free()


def set_depth(ob, top_at):
    """how far each point of a rock lies under the floor (or flight, or ledge) it bears: the game lets the rock go
    into the mist by that, so every floor's rock fades a little way under it, whatever its height"""
    at = ob.data.attributes.new('dep', 'FLOAT', 'POINT')
    for v in ob.data.vertices:
        at.data[v.index].value = max(0.0, top_at(v.co.x, -v.co.y) - v.co.z)


def hull(pts):
    """the convex hull of points in the plan (monotone chain), counter-clockwise"""
    pts = sorted(set((round(p[0], 4), round(p[1], 4)) for p in pts))
    if len(pts) < 3: return pts
    cr = lambda o, a, b: (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, hi = [], []
    for p in pts:
        while len(lo) >= 2 and cr(lo[-2], lo[-1], p) <= 0: lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(hi) >= 2 and cr(hi[-2], hi[-1], p) <= 0: hi.pop()
        hi.append(p)
    return lo[:-1] + hi[:-1]


def edge_n(a, b):
    """the outward normal of an edge of a counter-clockwise outline"""
    dx, dz = b[0] - a[0], b[1] - a[1]; l = math.hypot(dx, dz) or 1.0
    return (dz / l, -dx / l)


def block(name, foot, y_top, y_bot, lean=(0.0, 0.0), ease=0.05, cut=None):
    """one block of the rock, as the picture's: a prism on its footprint, its top a flat break leaning a little one
    way, maybe a corner of its top cut off aslant (cut: the outward way of that corner), every edge eased in two
    facets, so it reads soft and low, never sharp"""
    bm = bmesh.new(); n = len(foot)
    cx = sum(p[0] for p in foot) / n; cz = sum(p[1] for p in foot) / n
    top = [bm.verts.new(G(x, y_top + (x - cx) * lean[0] + (z - cz) * lean[1], z)) for (x, z) in foot]
    bot = [bm.verts.new(G(x, y_bot, z)) for (x, z) in foot]
    bm.faces.new(top); bm.faces.new(list(reversed(bot)))
    for i in range(n):
        j = (i + 1) % n; bm.faces.new([bot[i], bot[j], top[j], top[i]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    if cut is not None:      # (the top's corner furthest that way, cut off by a plane leaning out and up)
        nrm = Vector((cut[0], -cut[1], 0.0)).normalized() + Vector((0, 0, rnd.uniform(0.6, 1.3)))
        nrm.normalize()
        far = max(v.co.dot(nrm) for v in bm.verts)
        co = nrm * (far - rnd.uniform(0.07, 0.2))
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=co, plane_no=nrm, clear_outer=True)
        bmesh.ops.holes_fill(bm, edges=bm.edges[:], sides=0)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    if ease > 0.0:
        try:
            bmesh.ops.bevel(bm, geom=[e for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0) > 0.3],
                            offset=ease, segments=2, affect='EDGES', profile=0.5, clamp_overlap=True)
        except Exception: pass
    return finish(bm, name, fine=2.5)


def offset(P, d):
    """an outline moved out by d (in, if d is less than nothing), its corners mitred"""
    n = len(P); out = []
    for i in range(n):
        n1 = edge_n(P[i - 1], P[i]); n2 = edge_n(P[i], P[(i + 1) % n])
        mx, mz = n1[0] + n2[0], n1[1] + n2[1]; ml = math.hypot(mx, mz) or 1.0; mx /= ml; mz /= ml
        k = d / max(0.35, mx * n1[0] + mz * n1[1])
        out.append((P[i][0] + mx * k, P[i][1] + mz * k))
    return out


def frame_block(name, c, th, u0, u1, v0, v1, rings, ease=0.05, chamf=(0.0, 0.0), lean=(0.0, 0.0), cut=None):
    """a block of the rock in its own frame: about c in the plan, turned so that v runs out along th and u along its
    face; at its top (u0..u1) x (v0..v1), its two outer corners cut off by chamf; rings: [(y, wider along, further
    out)] from its top down, so its face leans in or out as it goes down and breaks at each ring (never one straight
    pillar); its top a flat break leaning by lean (along, out); every edge eased in two facets (soft, as the picture's)"""
    vx, vz = math.cos(th), math.sin(th); ux, uz = -vz, vx
    P = lambda a, b: (c[0] + ux * a + vx * b, c[1] + uz * a + vz * b)
    rs = []
    for k, (y, g, o) in enumerate(rings):
        a0, a1, b1 = u0 - g, u1 + g, v1 + o
        ab = [(a0, v0), (a1, v0), (a1, b1 - chamf[1]), (a1 - chamf[1], b1), (a0 + chamf[0], b1), (a0, b1 - chamf[0])]
        ring = []
        for (a, b) in ab:
            x, z = P(a, b)
            ring.append((x, y + ((a * lean[0] + (b - b1) * lean[1]) if k == 0 else 0.0), z))
        rs.append(ring)
    bm = bmesh.new(); loft(bm, rs, cap0=True, cap1=True)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    if cut is not None:      # (a corner of its top cut off by a plane leaning out and up)
        nrm = Vector((cut[0], -cut[1], 0.0)).normalized() + Vector((0, 0, rnd.uniform(0.7, 1.4)))
        nrm.normalize()
        far = max(v.co.dot(nrm) for v in bm.verts)
        co = nrm * (far - rnd.uniform(0.07, 0.18))
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=co, plane_no=nrm, clear_outer=True)
        bmesh.ops.holes_fill(bm, edges=bm.edges[:], sides=0)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    if ease > 0.0:
        try:
            bmesh.ops.bevel(bm, geom=[e for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0) > 0.3],
                            offset=ease, segments=2, affect='EDGES', profile=0.5, clamp_overlap=True)
        except Exception: pass
    return finish(bm, name, fine=2.5)


def blocks(name, poly, top_y, keep=(), h=None):
    """the rock under a floor, as the picture shows it: a few broad blocks along each edge, each turned its own way a
    little (so each takes the light its own way), some set back right under the slab (a dark recess under it), some
    standing out a step lower (their tops catch the light: ledges), some up beside the slab nearly to its top, so the
    marble is a chunk set into the brown rock (as the picture's); a block about each corner standing out of it; a
    core of rock behind them all. keep: (point, radius) where nothing may stand out (a flight's end, the cloth)"""
    P = ccw(poly); n = len(P)
    near = lambda q, extra: any(math.hypot(q[0] - k[0], q[1] - k[1]) < r + extra for (k, r) in keep)
    obs = []
    def one(nm_, c, th, hl, led, din, back=(-0.18, -0.06)):
        if led == 'bind':      # (beside the floor, broad, its top a little under the floor's: the marble set into the rock)
            out = rnd.uniform(0.3, 0.9); yt = h - rnd.uniform(0.08, 0.3)
            lean = (rnd.uniform(-0.05, 0.05) * RSTYLE.get('lean', 1.0), -rnd.uniform(0.02, 0.08) * RSTYLE.get('lean', 1.0)); led = True
        elif led == 'flush':      # (right under the slab, its face in the slab's own plane: white above, brown below, no recess)
            out = rnd.uniform(-0.02, 0.04); yt = h - 0.56; lean = (0.0, 0.0); led = False
        elif led:
            out = rnd.uniform(0.12, 0.32); yt = top_y + 0.05 - rnd.uniform(0.3, 0.85)
            lean = (rnd.uniform(-0.08, 0.08) * RSTYLE.get('lean', 1.0), -rnd.uniform(0.04, 0.16) * RSTYLE.get('lean', 1.0))
        else:
            out = rnd.uniform(*back); yt = top_y + 0.05; lean = (0.0, 0.0)
        y1 = yt - rnd.uniform(0.5, 1.1); y2 = y1 - 0.12
        st = rnd.uniform(0.05, 0.2)      # (a step out partway down: the face breaks across, never one straight pillar)
        o0 = -rnd.uniform(0.06, 0.2) if led else 0.0      # (a ledge's face leans back above its step: it takes more light)
        rings = [(yt, 0.0, o0), (y1, rnd.uniform(0.0, 0.06), rnd.uniform(-0.05, 0.06)), (y2, rnd.uniform(0.04, 0.1), st), (yt - 16.0, rnd.uniform(0.1, 0.3), st + rnd.uniform(0.3, 0.8))]
        cr = RSTYLE.get('chamf', (0.05, 0.22))
        ch = (rnd.uniform(*cr), rnd.uniform(*cr))      # (its outer corners cut off, as the picture's)
        cut = (math.cos(th) + rnd.uniform(-0.6, 0.6) * -math.sin(th), math.sin(th) + rnd.uniform(-0.6, 0.6) * math.cos(th)) if (led and rnd.random() < RSTYLE.get('cut_p', 0.5)) else None
        obs.append(frame_block(nm_, c, th, -hl, hl, -din, out, rings, rnd.uniform(*RSTYLE.get('ease', (0.035, 0.065))), ch, lean, cut))
    for i in range(n):
        a = P[i]; b = P[(i + 1) % n]
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        if L < 0.05: continue
        e = ((b[0] - a[0]) / L, (b[1] - a[1]) / L); nm = edge_n(a, b); th = math.atan2(nm[1], nm[0])
        zones = []      # (where along this edge nothing may stand out: about a flight's end, where the cloth hangs)
        for (k, r) in keep:
            tk = (k[0] - a[0]) * e[0] + (k[1] - a[1]) * e[1]; dk_ = abs((k[0] - a[0]) * nm[0] + (k[1] - a[1]) * nm[1])
            if dk_ < r: hw = math.sqrt(r * r - dk_ * dk_); zones.append((tk - hw, tk + hw))
        t = 0.0
        while t < L - 0.2:
            l = rnd.uniform(1.6, 2.8)      # (broad: a few great masses, never a row of pillars)
            for (z0, z1) in zones:      # (a length stops where a zone begins or ends: it is never thrown away whole)
                for zb in (z0, z1):
                    if t + 0.35 < zb < t + l: l = zb - t
            if L - (t + l) < 0.6: l = L - t
            mid = (a[0] + e[0] * (t + l * 0.5), a[1] + e[1] * (t + l * 0.5))
            tm = t + l * 0.5
            nr_ = any(z0 - 0.05 < tm < z1 + 0.05 or (t < z1 and t + l > z0) for (z0, z1) in zones)
            r_ = rnd.random(); seen = nm[0] + nm[1] > 0.3      # (a side the eye sees: there the rock binds the marble more often)
            if h is not None and (nr_ or r_ < (0.3 if seen else 0.5)):      # (flush under the slab; where nothing may stand out, always)
                one('%s_fl%d_%d' % (name, i, int(t * 10)), mid, th + rnd.uniform(-0.04, 0.04), l * 0.5 - 0.02, 'flush', rnd.uniform(0.5, 0.9))
            elif not nr_ and h is not None and r_ < (0.8 if seen else 0.65): one('%s_bnd%d_%d' % (name, i, int(t * 10)), mid, th + rnd.uniform(-0.15, 0.15), l * 0.5 + 0.04, 'bind', rnd.uniform(0.5, 0.9))
            elif not nr_: one('%s_blk%d_%d' % (name, i, int(t * 10)), mid, th + rnd.uniform(-0.38, 0.38), l * 0.5 + 0.06, True, rnd.uniform(0.5, 0.9))
            else:      # (set back under the slab, its top hidden in it: it must not come out through the slab's side)
                hl = l * 0.5 - 0.1; out = rnd.uniform(-0.18, -0.06)
                dm = math.asin(max(0.0, min(1.0, (-out - 0.03) / max(hl, 0.1))))
                one('%s_blk%d_%d' % (name, i, int(t * 10)), mid, th + rnd.uniform(-dm, dm), hl, False, rnd.uniform(0.5, 0.9), back=(out, out))
            t += l
    for i in range(n):      # about each corner that stands out
        n1 = edge_n(P[i - 1], P[i]); n2 = edge_n(P[i], P[(i + 1) % n])
        if n1[0] * n2[1] - n1[1] * n2[0] < 0.2: continue
        mx, mz = n1[0] + n2[0], n1[1] + n2[1]; ml = math.hypot(mx, mz) or 1.0
        th = math.atan2(mz / ml, mx / ml) + rnd.uniform(-0.25, 0.25)
        if near(P[i], 0.4) or rnd.random() < 0.25: continue      # (a corner block: a ledge below the slab, or up beside it)
        one('%s_cor%d' % (name, i), P[i], th, rnd.uniform(0.4, 0.65), 'bind' if (h is not None and rnd.random() < 0.4) else True, rnd.uniform(0.6, 0.9))
    core = offset(P, -0.35)
    obs.append(block('%s_core' % name, core, top_y + 0.05, top_y - 16.0, ease=0.0))
    top_at = lambda x, z: top_y
    for ob in obs: set_depth(ob, top_at)
    return obs


def square_to_flights(pts, h):
    """where a flight meets this floor, the floor's edge runs straight across the flight's breadth, square to it, at
    the flight's end: nothing of the floor over its steps, no gap beside its top step"""
    for fl in (PLAN or {}).get('flights', []):
        f, hd, w = fl[0], fl[1], fl[2]
        dx, dz = hd[0] - f[0], hd[2] - f[2]; L = math.hypot(dx, dz) or 1.0; dx /= L; dz /= L
        sx, sz = -dz, dx
        for end, side in ((hd, -1.0), (f, 1.0)):      # (the upper floor: the steps lie before its edge; the lower: beyond)
            if abs(end[1] - h) > 0.05: continue
            for i, (x, z) in enumerate(pts):
                a = (x - end[0]) * sx + (z - end[2]) * sz; t = (x - end[0]) * dx + (z - end[2]) * dz
                if abs(a) < w * 0.5 + 0.04 and t * side > -0.02 and abs(t) < 1.2:
                    pts[i] = (x - dx * t, z - dz * t)
    return pts


def simplify(pts, eps=0.06):
    """an outline with its needless points taken out (Douglas-Peucker, closed): broad planes stay broad"""
    def dp(seq):
        if len(seq) < 3: return seq
        a, b = seq[0], seq[-1]
        dmax, im = 0.0, 0
        for i in range(1, len(seq) - 1):
            d = seg_dist(seq[i], a, b)
            if d > dmax: dmax, im = d, i
        if dmax <= eps: return [a, b]
        return dp(seq[:im + 1])[:-1] + dp(seq[im:])
    i0 = max(range(len(pts)), key=lambda i: math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]))
    ring1 = dp(pts[:i0 + 1]); ring2 = dp(pts[i0:] + [pts[0]])
    return ring1[:-1] + ring2[:-1]


def ray_exit(poly, p, d):
    """where a ray from p (inside the outline) along d leaves it"""
    best = None
    for i in range(len(poly)):
        (x0, z0), (x1, z1) = poly[i], poly[(i + 1) % len(poly)]
        ex, ez = x1 - x0, z1 - z0; den = d[0] * ez - d[1] * ex
        if abs(den) < 1e-9: continue
        t = ((x0 - p[0]) * ez - (z0 - p[1]) * ex) / den; u = ((x0 - p[0]) * d[1] - (z0 - p[1]) * d[0]) / den
        if t > 0 and 0 <= u <= 1 and (best is None or t < best): best = t
    return None if best is None else (p[0] + d[0] * best, p[1] + d[1] * best)


def faceted(poly, keep=(), seg=(0.5, 0.95), jit=0.06):
    """an outline cut as a mason cuts a slab: each edge in a few flat lengths, each turned a little its own way (so
    each face of the slab takes the light a little differently); left straight where a flight meets it (keep)"""
    P = ccw(poly); n = len(P); out = []
    for i in range(n):
        a_, b_ = P[i], P[(i + 1) % n]
        L = math.hypot(b_[0] - a_[0], b_[1] - a_[1])
        if L < 1e-6: continue
        en = edge_n(a_, b_)
        out.append(a_)
        t = rnd.uniform(*seg)
        while t < L - 0.3:
            q = (a_[0] + (b_[0] - a_[0]) * t / L, a_[1] + (b_[1] - a_[1]) * t / L)
            o = 0.0 if any(math.hypot(q[0] - k[0], q[1] - k[1]) < 0.95 for k in keep) else rnd.uniform(-jit, jit)
            out.append((q[0] + en[0] * o, q[1] + en[1] * o)); t += rnd.uniform(*seg)
    return out


def cut_corners(poly, keep=()):
    """every corner of a floor that stands out, cut off aslant as a mason cuts it (the picture's floors): each cut its
    own size, not quite square to the corner; not where a flight meets the floor (keep: (point, radius))"""
    P = ccw(poly); n = len(P); out = []
    for i in range(n):
        a_, b_, c_ = P[i - 1], P[i], P[(i + 1) % n]
        e0 = (b_[0] - a_[0], b_[1] - a_[1]); e1 = (c_[0] - b_[0], c_[1] - b_[1])
        L0 = math.hypot(*e0) or 1.0; L1 = math.hypot(*e1) or 1.0
        if e0[0] * e1[1] - e0[1] * e1[0] <= 1e-6 or any(math.hypot(b_[0] - k[0], b_[1] - k[1]) < r for (k, r) in keep):
            out.append(b_); continue
        d0 = min(rnd.uniform(0.14, 0.3), L0 * 0.3); d1 = min(d0 * rnd.uniform(0.7, 1.35), L1 * 0.3)
        out.append((b_[0] - e0[0] / L0 * d0, b_[1] - e0[1] / L0 * d0)); out.append((b_[0] + e1[0] / L1 * d1, b_[1] + e1[1] / L1 * d1))
    return out


def bridge_ends(h=None):
    """each bridge of the plan (a slab over a chasm: [x0, x1, z0, z1, h]): the middles of its two ends, and its breadth"""
    out = []
    for (bx0, bx1, bz0, bz1, bh) in (PLAN or {}).get('bridges', []):
        if h is not None and abs(bh - h) > 0.05: continue
        along_z = (bx1 - bx0) < (bz1 - bz0)
        ends = [((bx0 + bx1) / 2, bz0), ((bx0 + bx1) / 2, bz1)] if along_z else [(bx0, (bz0 + bz1) / 2), (bx1, (bz0 + bz1) / 2)]
        out.append((ends, min(bx1 - bx0, bz1 - bz0)))
    return out


def floor(name, x0, x1, z0, z1, h, ch, poly=None):
    """a floor of the way: its marble slab on the rock, the rock in broad blocks under its edge"""
    poly = poly or rect(x0, x1, z0, z1, ch)
    fls = (PLAN or {}).get('flights', [])
    keep = [(fl[i][0], fl[i][2]) for fl in fls for i in (0, 1) if abs(fl[i][1] - h) < 0.05]
    kp = [((fl[i][0], fl[i][2]), fl[2] * 0.5 + 0.3) for fl in fls for i in (0, 1) if abs(fl[i][1] - h) < 0.05]
    for (ends, wd) in bridge_ends(h):      # (where a bridge over a chasm comes to this floor: its edge square and sharp there)
        keep += ends; kp += [(e, wd * 0.5 + 0.3) for e in ends]
    for (wx0, wx1, wz0, wz1) in (PLAN or {}).get('waters', []):      # (open water within the island, a channel or a chasm: the rock under the floors stands flush along it, never out into it)
        nx_, nz_ = max(1, int((wx1 - wx0) / 0.4)), max(1, int((wz1 - wz0) / 0.4))
        wp = [(wx0 + (wx1 - wx0) * k / nx_, z_) for k in range(nx_ + 1) for z_ in (wz0, wz1)] + [(x_, wz0 + (wz1 - wz0) * k / nz_) for k in range(nz_ + 1) for x_ in (wx0, wx1)]
        kp += [(q, 0.45) for q in wp]
    poly = cut_corners(poly, kp)
    out = square_to_flights(broken(faceted(grow(poly, 0.05), keep), seg=0.3, jit=0.012, chip=0.06), h)
    poly = simplify(square_to_flights(densify(ccw(poly), 0.3), h))
    vol = (PLAN or {}).get('volute')
    if vol and abs(vol[1] - h) < 0.05 and inside(poly, (vol[0], vol[2])):      # (where the cloth goes over the edge)
        q = ray_exit(poly, (vol[0], vol[2]), (1.0, 0.0))
        if q: kp.append((q, 0.55))
    m = [slab(name, out, h, keep=keep)]
    r = blocks(name, poly, h - 0.57, keep=kp, h=h)
    return m, r


def seg_dist(p, a, b):
    ax, az = a; bx, bz = b; px, pz = p
    dx, dz = bx - ax, bz - az; L2 = dx * dx + dz * dz or 1e-9
    t = max(0.0, min(1.0, ((px - ax) * dx + (pz - az) * dz) / L2))
    return math.hypot(px - ax - dx * t, pz - az - dz * t)


def inside(poly, p):
    x, z = p; c = False
    for i in range(len(poly)):
        (x0, z0), (x1, z1) = poly[i], poly[(i + 1) % len(poly)]
        if (z0 > z) != (z1 > z) and x < x0 + (z - z0) * (x1 - x0) / (z1 - z0): c = not c
    return c


def on_floor(x, y, z, r):
    """the floor at this height under the point, and the point moved in until a circle of radius r about it lies on it
    (a column, an arch or a tree stands on the floor, never over its edge)"""
    best = None
    for nm, fl in (PLAN or {}).get('floors', {}).items():
        if abs(fl['h'] - y) > 0.08: continue
        poly = [tuple(q) for q in fl['xz']]
        d = 0.0 if inside(poly, (x, z)) else min(seg_dist((x, z), poly[i], poly[(i + 1) % len(poly)]) for i in range(len(poly)))
        if best is None or d < best[0]: best = (d, poly)
    if best is None: return x, z
    poly = best[1]
    cx = sum(q[0] for q in poly) / len(poly); cz = sum(q[1] for q in poly) / len(poly)
    for _ in range(60):
        if inside(poly, (x, z)) and min(seg_dist((x, z), poly[i], poly[(i + 1) % len(poly)]) for i in range(len(poly))) >= r: break
        x += (cx - x) * 0.06; z += (cz - z) * 0.06
    return x, z


def way_parts():
    """the way she walks, as level segments and points (x, y, z): the plan's own and its trial's (puzzle.json beside the
    plan), so that nothing is set where she goes"""
    import os
    segs = []
    srcs = [PLAN or {}]
    if len(a) > 4:
        pz = os.path.join(os.path.dirname(a[4]), 'puzzle.json')
        if os.path.exists(pz): srcs.append(json.load(open(pz)))
    for src in srcs:
        N = src.get('nodes') or {}
        for e in src.get('edges') or []:
            if e[0] in N and e[1] in N:
                pts = [N[e[0]]] + [list(m) for m in (e[2] or [])] + [N[e[1]]]
                for p_, q_ in zip(pts, pts[1:]): segs.append((tuple(p_), tuple(q_)))
        for v in N.values(): segs.append((tuple(v), tuple(v)))
    return segs


def clear_of_way(x, y, z, r, clear=0.48):
    """a thing that stands on a floor (a column, a tree): never where she walks. Moved off the way, square to it,
    until its edge is `clear` from the way's line (her body and a margin), staying on its floor; None if it cannot be"""
    segs = [(p_, q_) for (p_, q_) in way_parts() if min(p_[1], q_[1]) - 0.15 < y + 0.05 and max(p_[1], q_[1]) + 0.15 > y - 0.05]
    need = r + clear
    def near():
        best = None
        for (p_, q_) in segs:
            d = seg_dist((x, z), (p_[0], p_[2]), (q_[0], q_[2]))
            if best is None or d < best[0]: best = (d, p_, q_)
        return best
    for _ in range(40):
        nb = near()
        if nb is None or nb[0] >= need: break
        d, p_, q_ = nb
        dx, dz = q_[0] - p_[0], q_[2] - p_[2]; L2 = dx * dx + dz * dz
        t = 0.0 if L2 < 1e-9 else max(0.0, min(1.0, ((x - p_[0]) * dx + (z - p_[2]) * dz) / L2))
        cx_, cz_ = p_[0] + dx * t, p_[2] + dz * t
        ox, oz = x - cx_, z - cz_; ol = math.hypot(ox, oz)
        if ol < 1e-6: ox, oz = (-dz, dx) if L2 > 1e-9 else (1.0, 0.0); ol = math.hypot(ox, oz) or 1.0
        x, z = cx_ + ox / ol * (need + 0.02), cz_ + oz / ol * (need + 0.02)
        x, z = on_floor(x, y, z, r)
    nb = near()
    if nb is not None and nb[0] < need - 0.02: return None
    return x, z


def boulder(name, c, r, top, n=6, ease=0.06, tilt=(0.05, 0.16)):
    """a boulder of the rock, as the picture's: a prism of a few broad faces about c, its top a flat break leaning one
    way, its face stepping out partway down and wider far down (in the mist), every edge eased in two facets"""
    a0 = rnd.uniform(0.0, 2.0 * math.pi)
    base = []
    for k in range(n):
        aa = a0 + 2.0 * math.pi * k / n + rnd.uniform(-0.22, 0.22); rr = r * rnd.uniform(0.82, 1.1)
        base.append((math.cos(aa) * rr, math.sin(aa) * rr))
    tilt = RSTYLE.get('tilt', tilt); ease = RSTYLE.get('boulder_ease', ease)
    ta = rnd.uniform(0.0, 2.0 * math.pi); tl = rnd.uniform(*tilt)
    y1 = top - rnd.uniform(0.5, 1.1); st = rnd.uniform(0.05, 0.25)
    rings = [(top, -rnd.uniform(0.1, 0.28)), (y1, rnd.uniform(0.0, 0.05)), (y1 - 0.12, st), (top - 16.0, st + rnd.uniform(0.4, 0.9))]
    rs = []
    for k, (y, g) in enumerate(rings):
        ring = []
        for (bx, bz) in base:
            l = math.hypot(bx, bz) or 1.0
            x = c[0] + bx * (1.0 + g / l); z = c[1] + bz * (1.0 + g / l)
            ring.append((x, y + ((bx * math.cos(ta) + bz * math.sin(ta)) * tl if k == 0 else 0.0), z))
        rs.append(ring)
    bm = bmesh.new(); loft(bm, rs, cap0=True, cap1=True)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    for _ in range(rnd.choice(RSTYLE.get('side_cuts', (1, 2)))):      # (a side cut off by an upright plane: faces that are not all turned alike)
        aa = rnd.uniform(0.0, 2.0 * math.pi)
        nrm = Vector((math.cos(aa), -math.sin(aa), rnd.uniform(-0.15, 0.25))); nrm.normalize()
        far = max(v.co.dot(nrm) for v in bm.verts if v.co.z > top - 3.0)
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=nrm * (far - rnd.uniform(0.1, 0.3)), plane_no=nrm, clear_outer=True)
        bmesh.ops.holes_fill(bm, edges=bm.edges[:], sides=0)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    if rnd.random() < 0.6:      # (a corner of its top cut off aslant)
        aa = rnd.uniform(0.0, 2.0 * math.pi)
        nrm = Vector((math.cos(aa), -math.sin(aa), 0.0)) + Vector((0, 0, rnd.uniform(0.7, 1.4))); nrm.normalize()
        far = max(v.co.dot(nrm) for v in bm.verts)
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=nrm * (far - rnd.uniform(0.08, 0.22)), plane_no=nrm, clear_outer=True)
        bmesh.ops.holes_fill(bm, edges=bm.edges[:], sides=0)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    try:
        bmesh.ops.bevel(bm, geom=[e for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0) > 0.3],
                        offset=ease, segments=2, affect='EDGES', profile=0.5, clamp_overlap=True)
    except Exception: pass
    return finish(bm, name, fine=2.5)


def ledge(name, c, rad, top):
    """rock without marble, that binds the floors into one mountain: a few soft boulders, the greatest in the middle
    with its top at top, the others about it and lower"""
    obs = [boulder(name + '_b0', (c[0], c[2]), rad * 0.78, top)]
    for k in range(rnd.choice((2, 3))):
        aa = rnd.uniform(0.0, 2.0 * math.pi); d = rad * rnd.uniform(0.45, 0.8); rk = rad * rnd.uniform(0.38, 0.55); tk = top - rnd.uniform(0.15, 0.7)
        if rk < RSTYLE.get('sat_min', 0.0): continue      # (no needle of rock beside a small one: a small rock in the sea stands alone)
        obs.append(boulder('%s_b%d' % (name, k + 1), (c[0] + math.cos(aa) * d, c[2] + math.sin(aa) * d), rk, tk, n=rnd.choice((5, 6))))
    for ob in obs: set_depth(ob, lambda x, z: top)
    return obs


STAIR_GROOVE = 0.03      # (how deep the channel down the middle of a flight: the way runs in it)
STEPS = []      # (each flight's nosings as cut, in order: the game draws the way down its channel by them)


def flight(foot, head, w, n=None, step=0.12, solid=False):
    """a flight of steps as one body of marble, carved by hand: each step a little higher or lower, deeper or shallower,
    each tread a hair out of level, each nosing rounded its own way; a channel cut down its middle (through every
    nosing and riser) where the way runs; a deep stringer under the line of the nosings; its last tread flush with the
    upper floor and on under it. The flight itself straight and square. The rock under it, its top along the stringer,
    and chunks of rock up beside it."""
    fx, fy, fz = foot; hx, hy, hz = head
    d = Vector((hx - fx, 0.0, hz - fz)); L = d.length; d.normalize()
    s = Vector((-d.z, 0.0, d.x))
    n = int(n or max(1, round((hy - fy) / step))); rise = (hy - fy) / n; run = L / n
    D = 0.42      # the stringer: how deep under the line of the nosings (and under the upper floor, past the head): a chunk of marble
    under = lambda t: min(fy + rise * (1.0 + t / run), hy) - D
    if solid: under = lambda t: fy - 0.004      # (cut in the quarry's rock: the flight one block down to the bench it rises from)
    end = L + 0.34
    # carved by hand, one piece: each step its own rise and run, a little more or less (all still summing to the
    # flight, the last flush with the floor above), each tread a hair out of level, each nosing rounded its own way
    jr = [rnd.uniform(-0.012, 0.012) for _ in range(n)]; jr = [x - sum(jr) / n for x in jr]
    jt = [rnd.uniform(-0.016, 0.016) for _ in range(n)]; jt = [x - sum(jt) / n for x in jt]
    ys, ts = [], []; y_, t_ = fy, 0.0
    for k in range(n): y_ += rise + jr[k]; ys.append(y_); ts.append(t_); t_ += run + jt[k]
    ys[-1] = hy
    prof = [(-0.2, min(under(-0.2), fy - 0.25), None), (-0.2, fy - 0.004, None), (0.0, fy - 0.004, None)]
    noses = []
    for k in range(n):
        y = ys[k] - (0.004 if k == n - 1 else 0.0)
        noses.append(len(prof)); prof.append((ts[k], y, k))      # the nosing of step k
        prof.append((ts[k + 1] if k < n - 1 else L + 0.12, y, k))      # the back of its tread
    prof += [(end, hy - 0.004, None), (end, under(end), None)]
    tilt = [(0.0, 0.0) if k == n - 1 else (rnd.uniform(-0.005, 0.005), rnd.uniform(-0.005, 0.005)) for k in range(n)]
    base = Vector((fx, 0.0, fz))
    GD, g = STAIR_GROOVE, 0.07      # (the channel down its middle: how deep, how wide; the way is drawn in it)
    bm = bmesh.new()
    def P(t, v, y):
        q_ = base + d * t + s * v
        return bm.verts.new(G(q_.x, y, q_.z))
    rows = []
    for (t, y, k) in prof:      # across the flight at each point of its profile: the left tread, the channel (lower and further in), the right tread
        tl, tr = tilt[k] if k is not None else (0.0, 0.0)
        rows.append([P(t, -w * 0.5, y + tl), P(t, -g * 0.5, y + tl), P(t + GD, -g * 0.5, y - GD), P(t + GD, g * 0.5, y - GD), P(t, g * 0.5, y + tr), P(t, w * 0.5, y + tr)])
    N = len(rows)
    for i in range(N):
        a_, b_ = rows[i], rows[(i + 1) % N]
        for c in range(5): bm.faces.new([a_[c], b_[c], b_[c + 1], a_[c + 1]])
    for side in (0, 5):      # (its two sides: one face each, filled within the stepped outline)
        es = [bm.edges.get((rows[i][side], rows[(i + 1) % N][side])) for i in range(N)]
        bmesh.ops.triangle_fill(bm, use_beauty=True, use_dissolve=False, edges=[e for e in es if e is not None])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    for k, i in enumerate(noses):      # (each nosing rounded, its own way; the channel's lip only eased)
        r_ = rows[i]
        eds = [bm.edges.get((r_[0], r_[1])), bm.edges.get((r_[4], r_[5]))]
        try: bmesh.ops.bevel(bm, geom=[e for e in eds if e is not None and e.is_valid], offset=rnd.uniform(0.016, 0.03), segments=2, affect='EDGES', profile=0.5, clamp_overlap=True)
        except Exception: pass
        e2 = bm.edges.get((r_[2], r_[3]))
        if e2 is not None and e2.is_valid:
            try: bmesh.ops.bevel(bm, geom=[e2], offset=0.008, segments=1, affect='EDGES', profile=0.5, clamp_overlap=True)
            except Exception: pass
    m = [finish(bm, 'flight')]
    STEPS.append([[round(ts[k], 4), round(ys[k], 4)] for k in range(n)])
    if solid: return m, []
    # the rock under it: the blocks of the mountain go on along both its sides, flush with the ends of its steps, their
    # tops along the stringer; they meet in the middle under it
    tt = lambda x, z: under((Vector((x, 0.0, z)) - base).dot(d)) + 0.02
    foot_ = [base + d * -0.1 + s * (sd * w * 0.5) for sd in (-1.0, 1.0)]
    head_ = [base + d * end + s * (sd * w * 0.5) for sd in (1.0, -1.0)]
    r = [mass('flight', [(q.x, q.z) for q in foot_ + head_], tt, inset=0.0, rough=0.6, soft=False)]
    for sd in (-1.0, 1.0):      # (rock up beside it, under its side, a block a stretch, stepping up with it: the stair set into the rock)
        th = math.atan2(s.z * sd, s.x * sd); t = rnd.uniform(-0.05, 0.25)
        while t < L - 0.35:
            l = min(rnd.uniform(0.55, 0.85), L - 0.2 - t)
            if l < 0.3: break
            c = base + d * (t + l * 0.5) + s * (sd * w * 0.5)
            yt = under(t) + 0.02 - rnd.uniform(0.0, 0.1)
            if rnd.random() < 0.6:      # (a chunk, as broad as it is long: never a plank)
                rings = [(yt, 0.0, 0.0), (yt - rnd.uniform(0.35, 0.7), rnd.uniform(0.0, 0.05), rnd.uniform(0.04, 0.16)), (yt - 16.0, 0.2, rnd.uniform(0.5, 1.0))]
                r.append(frame_block('flank', (c.x, c.z), th + rnd.uniform(-0.12, 0.12), -l * 0.5, l * 0.5, -w * 0.45, rnd.uniform(0.12, 0.34), rings,
                                     rnd.uniform(0.035, 0.06), (rnd.uniform(0.05, 0.15), rnd.uniform(0.05, 0.15)), (0.0, -rnd.uniform(0.02, 0.08))))
            t += l + rnd.uniform(0.0, 0.08)
    for ob in r[1:]: set_depth(ob, tt)
    return m, r


def column(x, y, z, h, r=0.2, broken=True):
    bm = bmesh.new()
    box(bm, (x - r * 1.45, y, z - r * 1.45), (x + r * 1.45, y + 0.2, z + r * 1.45))      # its plinth
    box(bm, (x - r * 1.2, y + 0.2, z - r * 1.2), (x + r * 1.2, y + 0.3, z + r * 1.2))
    m = [finish(bm, 'plinth')]
    flutes = []
    for k in range(24):
        aa = 2.0 * math.pi * k / 24.0
        rr = r if k % 2 == 0 else r * 0.87
        flutes.append((x + math.cos(aa) * rr, z + math.sin(aa) * rr))
    bm = bmesh.new(); prism(bm, flutes, y + 0.3, y + h)
    if broken:      # the drum broken off aslant
        nrm = Vector((rnd.uniform(-0.6, 0.6), rnd.uniform(-0.6, 0.6), 1.0)).normalized()
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=G(x, y + h - 0.12, z), plane_no=nrm, clear_outer=True)
        bmesh.ops.holes_fill(bm, edges=bm.edges[:], sides=0)
    else:
        box(bm, (x - r * 1.25, y + h, z - r * 1.25), (x + r * 1.25, y + h + 0.16, z + r * 1.25))
    m.append(finish(bm, 'shaft', fine=0.5))
    return m


def arch(cx, y, cz, W=1.9, Hh=2.6, r=0.52, D=0.5, along_x=True):
    """a free-standing gate: a block with a round-headed opening, an impost moulding and a cornice; facing the eye's
    left (along_x) or its right"""
    hs = Hh - r - 0.55
    def P(u, v, w):      # (across, up, through) to the game's axes
        return (cx + u, y + v, cz + w) if along_x else (cx + w, y + v, cz + u)
    bm = bmesh.new()
    for sg in (-1.0, 1.0):
        lo, hi = sorted((sg * r, sg * W * 0.5))
        hexa(bm, [P(lo, 0, -D / 2), P(hi, 0, -D / 2), P(hi, 0, D / 2), P(lo, 0, D / 2), P(lo, hs, -D / 2), P(hi, hs, -D / 2), P(hi, hs, D / 2), P(lo, hs, D / 2)])
    # the head over the opening: around the half circle, out to the block's edge
    th = [math.pi * k / 10.0 for k in range(11)]
    tc = math.atan2(Hh - hs, W * 0.5)
    th += [tc, math.pi - tc]; th.sort()
    def q_of(t):
        if t <= tc + 1e-6: return (W * 0.5, hs + W * 0.5 * math.tan(t))
        if t >= math.pi - tc - 1e-6: return (-W * 0.5, hs + W * 0.5 * math.tan(math.pi - t))
        return ((Hh - hs) / math.tan(t), Hh)
    for k in range(len(th) - 1):
        p0 = (r * math.cos(th[k]), hs + r * math.sin(th[k])); p1 = (r * math.cos(th[k + 1]), hs + r * math.sin(th[k + 1]))
        q0 = q_of(th[k]); q1 = q_of(th[k + 1])
        hexa(bm, [P(p0[0], p0[1], -D / 2), P(p1[0], p1[1], -D / 2), P(q1[0], q1[1], -D / 2), P(q0[0], q0[1], -D / 2),
                  P(p0[0], p0[1], D / 2), P(p1[0], p1[1], D / 2), P(q1[0], q1[1], D / 2), P(q0[0], q0[1], D / 2)])
    m = [finish(bm, 'arch', fine=0.6)]
    bm = bmesh.new()
    for sg in (-1.0, 1.0):      # the impost mouldings
        lo, hi = sorted((sg * (r - 0.04), sg * (W * 0.5 + 0.06)))
        hexa(bm, [P(lo, hs - 0.1, -D / 2 - 0.05), P(hi, hs - 0.1, -D / 2 - 0.05), P(hi, hs - 0.1, D / 2 + 0.05), P(lo, hs - 0.1, D / 2 + 0.05),
                  P(lo, hs + 0.02, -D / 2 - 0.05), P(hi, hs + 0.02, -D / 2 - 0.05), P(hi, hs + 0.02, D / 2 + 0.05), P(lo, hs + 0.02, D / 2 + 0.05)])
    hexa(bm, [P(-W / 2 - 0.1, Hh, -D / 2 - 0.08), P(W / 2 + 0.1, Hh, -D / 2 - 0.08), P(W / 2 + 0.1, Hh, D / 2 + 0.08), P(-W / 2 - 0.1, Hh, D / 2 + 0.08),
              P(-W / 2 - 0.1, Hh + 0.2, -D / 2 - 0.08), P(W / 2 + 0.1, Hh + 0.2, -D / 2 - 0.08), P(W / 2 + 0.1, Hh + 0.2, D / 2 + 0.08), P(-W / 2 - 0.1, Hh + 0.2, D / 2 + 0.08)])
    hexa(bm, [P(-W / 2 - 0.04, -0.02, -D / 2 - 0.06), P(W / 2 + 0.04, -0.02, -D / 2 - 0.06), P(W / 2 + 0.04, -0.02, D / 2 + 0.06), P(-W / 2 - 0.04, -0.02, D / 2 + 0.06),
              P(-W / 2 - 0.04, 0.14, -D / 2 - 0.06), P(W / 2 + 0.04, 0.14, -D / 2 - 0.06), P(W / 2 + 0.04, 0.14, D / 2 + 0.06), P(-W / 2 - 0.04, 0.14, D / 2 + 0.06)])
    m.append(finish(bm, 'mould'))
    return m


def cypress(x, y, z, h=2.6):
    """a cypress as the picture has it: flames cut as if in stone, four of them one over another, each wide below and
    breaking above into a crown of points that stand up into the one over it; the last one a point; a short trunk"""
    bark = []
    bm = bmesh.new()
    hexa(bm, [(x - 0.06, y - 0.1, z - 0.05), (x + 0.06, y - 0.1, z - 0.05), (x + 0.06, y - 0.1, z + 0.06), (x - 0.06, y - 0.1, z + 0.06),
              (x - 0.045, y + 0.42, z - 0.035), (x + 0.045, y + 0.42, z - 0.035), (x + 0.045, y + 0.42, z + 0.045), (x - 0.045, y + 0.42, z + 0.045)])
    bark.append(finish(bm, 'bark'))
    y0 = y + 0.3
    tiers = [(0.0, 0.42, 0.36), (0.2, 0.42, 0.3), (0.4, 0.4, 0.23), (0.6, 0.4, 0.15)]      # (where each starts, how tall, how wide: of the whole)
    leaves = []
    for k, (t0, th, r) in enumerate(tiers):
        yb = y0 + h * t0; tt = h * th; n = 5; a0 = rnd.uniform(0.0, 2.0 * math.pi)
        r *= h / 2.6
        P = lambda ang, rr, yy: (x + math.cos(ang) * rr, yy, z + math.sin(ang) * rr)
        bm = bmesh.new()
        A = [bm.verts.new(G(*P(a0 + 2 * math.pi * i / n, r * 0.5, yb))) for i in range(n)]
        B = [bm.verts.new(G(*P(a0 + 2 * math.pi * i / n + rnd.uniform(-0.1, 0.1), r * rnd.uniform(0.92, 1.06), yb + tt * 0.32))) for i in range(n)]
        last = k == len(tiers) - 1
        T = [bm.verts.new(G(*P(a0 + 2 * math.pi * i / n + rnd.uniform(-0.12, 0.12), r * (0.3 if last else 0.42), yb + tt * rnd.uniform(0.82, 1.0) * (0.75 if last else 1.0)))) for i in range(n)]
        V = [bm.verts.new(G(*P(a0 + 2 * math.pi * (i + 0.5) / n, r * 0.6, yb + tt * 0.55))) for i in range(n)]
        C = bm.verts.new(G(x, yb + tt * (1.25 if last else 0.6), z))
        def f(*vs):
            try: bm.faces.new(vs)
            except ValueError: pass
        f(*reversed(A))
        for i in range(n):
            j = (i + 1) % n
            f(A[i], A[j], B[j], B[i])
            f(B[i], V[i], T[i]); f(B[i], B[j], V[i]); f(B[j], T[j], V[i])
            f(T[i], V[i], C); f(V[i], T[j], C)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        leaves.append(finish(bm, 'leaves%d' % k, fine=3.0))
    return leaves, bark



# ------------------------------------------------------------------ the quarry (scene 'quarry'): benches cut square
QC = 0.45      # (the lattice the quarry is cut on: every floor's edge lies on it)
def quarry_terrain(P):
    """the quarry as one field of square benches. Where the way is, its floors at their heights; about them benches
    stepping down into the pit (where two meet, none rises within a hand of the lower floor); the trench a look
    crosses cut deep; behind, the quarry's faces rising in steps; a door cut in the west face, its lintel over it.
    Each bench a block with its top edges eased; where blocks of one height meet, the joint shows as a cut."""
    rs = random.Random(11)
    def rng_(a, b): return range(int(round(a / QC)), int(round(b / QC)))
    floors = {}
    def fill(x0, x1, z0, z1, h):
        for i in rng_(x0, x1):
            for j in rng_(z0, z1):
                if (i, j) not in floors or h > floors[(i, j)]: floors[(i, j)] = h
    for (x0, x1, z0, z1, h) in P['cells'] + P['links']: fill(x0, x1, z0, z1, h)
    for fl in P['flights']:      # (under a flight: the bench it rises from; its own body stands on that)
        f, hd, w = fl[0], fl[1], fl[2]
        if abs(hd[0] - f[0]) > abs(hd[2] - f[2]): fill(min(f[0], hd[0]), max(f[0], hd[0]), f[2] - w / 2, f[2] + w / 2, f[1])
        else: fill(f[0] - w / 2, f[0] + w / 2, min(f[2], hd[2]), max(f[2], hd[2]), f[1])
    door = P.get('door'); HT = P['heights']['HT']
    if door:      # (the way on into the rock: the corridor's floor runs in under the lintel)
        fill(door[0] - 0.9, door[0] + 0.45, door[2] - 0.45, door[2] + 0.45, door[1])
    trench = set()
    for (x0, x1, z0, z1) in P.get('trench', []):
        for i in rng_(x0, x1):
            for j in rng_(z0, z1): trench.add((i, j))
    Wx, Nz, top = P['walls']['west'], P['walls']['north'], P['walls']['top']
    I0, I1, J0, J1 = int(-12.5 / QC), int(3.6 / QC), int(-12.0 / QC), int(3.6 / QC)
    T, REF = {}, {}
    near = {}
    for (fi, fj), h in floors.items():
        for di in range(-7, 8):
            for dj in range(-7, 8):
                c = (fi + di, fj + dj)
                if c in floors or c in trench: continue
                d = max(abs(di), abs(dj))
                drop = 1.0 if d <= 2 else (2.3 if d <= 4 else 3.9)
                hi, cap = near.get(c, (-1e9, 1e9))
                hi = max(hi, h - drop)
                if d <= 2: cap = min(cap, h - 0.35)
                near[c] = (hi, cap)
    for i in range(I0, I1):
        for j in range(J0, J1):
            c = (i, j); x, z = (i + 0.5) * QC, (j + 0.5) * QC
            if c in floors: T[c] = floors[c]; REF[c] = floors[c]; continue
            if c in trench: continue
            dw = max((Wx - x) / QC, (Nz - z) / QC)
            lf = P['walls'].get('low_front')
            if lf and x < Wx and x > lf[0] and z > lf[1] and z < lf[1] + 2.2 and (Nz - z) <= 0:      # (before the door the face is cut low: the door seen whole, square to her way)
                T[c] = HT - 0.35; REF[c] = HT; continue
            if dw > 0:      # (the quarry's faces behind: a step up every two cells back)
                k = int(dw // 2)
                T[c] = min(top, HT + 1.05 + 1.25 * k); REF[c] = T[c]; continue
            if c in near:
                hi, cap = near[c]; T[c] = round(min(hi, cap), 3); REF[c] = T[c] + 1.0
    # one block a run of equal benches (greedy: along j, then the same runs down i)
    runs = {}
    for i in range(I0, I1):
        j = J0
        while j < J1:
            if (i, j) not in T: j += 1; continue
            h = T[(i, j)]; j2 = j
            while j2 + 1 < J1 and T.get((i, j2 + 1)) == h and rs.random() > 0.08: j2 += 1      # (now and then a joint, as the blocks were cut)
            runs[(i, j)] = (j2, h); j = j2 + 1
    used = set(); obs = []
    for (i, j), (j2, h) in sorted(runs.items()):
        if (i, j) in used: continue
        i2 = i
        while runs.get((i2 + 1, j)) == (j2, h) and (i2 + 1, j) not in used and rs.random() > 0.06: i2 += 1; used.add((i2, j))
        used.add((i, j))
        x0, x1, z0, z1 = i * QC, (i2 + 1) * QC, j * QC, (j2 + 1) * QC
        bm = bmesh.new(); box(bm, (x0, -14.0, z0), (x1, h, z1))
        tops = [e for e in bm.edges if all(abs(v.co.z - h) < 1e-4 for v in e.verts)]
        try: bmesh.ops.bevel(bm, geom=tops, offset=rs.uniform(0.018, 0.035), segments=1, affect='EDGES', clamp_overlap=True)
        except Exception: pass
        ob = finish(bm, 'quarry_%d_%d' % (i, j), fine=1.6)
        ref = REF[(i, j)]; set_depth(ob, lambda x_, z_, r=ref: r)
        obs.append(ob)
    if door:      # (the lintel over the door, and the face of rock above it)
        bm = bmesh.new(); box(bm, (door[0] - 0.9, door[1] + 2.05, door[2] - 0.75), (door[0] + 0.45, top, door[2] + 0.75))
        e = [e for e in bm.edges]
        try: bmesh.ops.bevel(bm, geom=e, offset=0.03, segments=1, affect='EDGES', clamp_overlap=True)
        except Exception: pass
        ob = finish(bm, 'quarry_lintel', fine=1.6); set_depth(ob, lambda x_, z_: top); obs.append(ob)
    for b in P.get('blocks', []):      # (cut blocks lying about, off the way)
        x, y, z, w, h, d, rot = b
        cw = clear_of_way(x, y, z, max(w, d) * 0.55)
        if cw is None: print('BLOCK at', b[:3], 'dropped: no room off the way'); continue
        x, z = cw
        bm = bmesh.new(); box(bm, (-w / 2, y - 0.02, -d / 2), (w / 2, y + h, d / 2))
        try: bmesh.ops.bevel(bm, geom=list(bm.edges), offset=rs.uniform(0.025, 0.05), segments=1, affect='EDGES', clamp_overlap=True)
        except Exception: pass
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(rot, 3, 'Z'))
        bmesh.ops.translate(bm, verts=bm.verts, vec=(x, -z, 0.0))
        ob = finish(bm, 'quarry_block', fine=1.6); set_depth(ob, lambda x_, z_, r=y + h: r); obs.append(ob)
    print('QUARRY', len(obs), 'blocks')
    return obs

# ------------------------------------------------------------------ the level
marble, rock, olive, barks, quarries = [], [], [], [], []
RISERS = {}      # (floors that rise and sink in the game: each its own two objects, riser_<name>_marble and riser_<name>_rock)
if PLAN is None:
    for nm, (x0, x1, z0, z1, h, ch) in FLOORS.items():
        m, r = floor(nm, x0, x1, z0, z1, h, ch); marble += m; rock += r
    for (foot, head, w) in FLIGHTS:
        m, r = flight(foot, head, w); marble += m; rock += r
    for (x0, x1, z0, z1, top) in ROCKS:
        rock += rock_mass('outcrop', rect(x0, x1, z0, z1, 0.3), top, cuts=10, extra=2)
    marble += column(-3.25, H3, -7.4, 1.25)
    marble += column(-3.75, H2, -4.3, 0.95)
    marble += column(-0.5, H1, -1.65, 0.75)
    marble += column(1.95, HL, -3.75, 1.05)
    marble += arch(-1.6, H3, -7.55, along_x=True)
    marble += arch(1.85, HL, -4.85, along_x=True)
    lv, bk = cypress(-4.45, H2 - 0.3, -2.8); olive += lv; barks += bk
    bm = bmesh.new(); box(bm, (-2.2, H1 - 1.55, 1.62), (-1.7, H1 - 1.0, 2.05)); chisel(bm, 2, depth=(0.02, 0.06)); marble.append(finish(bm, 'relief'))      # a carved block in the face of the rock
else:
    QUARRY_ON = PLAN.get('scene') == 'quarry'
    NS = PLAN.get('node_slabs')      # (a way of separate stones, laid on rock made elsewhere: the third level's crooked path; its floors are the rock's own)
    for nm, fl in PLAN['floors'].items():
        if NS: continue
        m, r = floor(nm, 0, 0, 0, 0, fl['h'], 0, poly=[tuple(p) for p in fl['xz']])
        if nm in PLAN.get('risers', []): RISERS[nm] = (m, r); continue      # (a floor that moves in the game: its slab and its rock kept apart)
        marble += m; rock += r
    for fl in PLAN['flights']:
        m, r = flight(tuple(fl[0]), tuple(fl[1]), fl[2], fl[3] if len(fl) > 3 else None, solid=QUARRY_ON); marble += m; rock += r
        while len(fl) < 4: fl.append(len(STEPS[-1]))
        fl[4:] = [STEPS[-1]]
    for (c, r_, top) in ([] if NS else PLAN.get('rocks', [])):      # rock that binds the floors into one mountain
        rock += ledge('ledge', c, r_, top)
    if NS:      # (a stone under each place of the way: each cut by hand, a little out of square and out of line, its corners cut aslant, set a little lower or higher; the owner: "on the path the stone crooked and uneven")
        sz = float(NS.get('size', 1.3)); th_ = float(NS.get('thick', 0.3)); skip = set(NS.get('skip', []))
        fls_ = PLAN.get('flights', [])
        def half(poly, n_, c_, side):      # (a stone's outline on one side of a crack through it)
            out_ = []
            for i in range(len(poly)):
                a_, b_ = poly[i], poly[(i + 1) % len(poly)]
                da = ((a_[0] - c_[0]) * n_[0] + (a_[1] - c_[1]) * n_[1]) * side; db = ((b_[0] - c_[0]) * n_[0] + (b_[1] - c_[1]) * n_[1]) * side
                if da >= 0: out_.append(a_)
                if (da >= 0) != (db >= 0):
                    t = da / (da - db); out_.append((a_[0] + (b_[0] - a_[0]) * t, a_[1] + (b_[1] - a_[1]) * t))
            return out_
        for k_, p_ in PLAN['nodes'].items():
            if k_ in skip: continue
            ang = math.radians(rnd.uniform(-9.0, 9.0)); dh = rnd.uniform(-0.04, -0.004)
            hx, hz = sz / 2 * rnd.uniform(0.86, 1.04), sz / 2 * rnd.uniform(0.86, 1.04)
            ca, sa = math.cos(ang), math.sin(ang)
            pts = []
            for (cx, cz) in [(-hx, -hz), (hx, -hz), (hx, hz), (-hx, hz)]:
                cx += rnd.uniform(-0.11, 0.11); cz += rnd.uniform(-0.11, 0.11)
                pts.append((p_[0] + cx * ca - cz * sa, p_[2] + cx * sa + cz * ca))
            keep = [(fl[i][0], fl[i][2]) for fl in fls_ for i in (0, 1) if abs(fl[i][1] - p_[1]) < 0.05 and math.hypot(fl[i][0] - p_[0], fl[i][2] - p_[2]) < sz * 1.2]
            pieces = [pts]
            if not keep and k_ not in set(NS.get('whole', [])) and rnd.random() < 0.38:      # (some stones cracked in two, the halves a little apart, each set its own way; the special ones whole)
                th0 = ang + (0.0 if rnd.random() < 0.5 else math.pi / 2) + math.radians(rnd.uniform(-28.0, 28.0))
                n_ = (math.cos(th0), math.sin(th0)); c_ = (p_[0] + rnd.uniform(-0.18, 0.18) * n_[0], p_[2] + rnd.uniform(-0.18, 0.18) * n_[1])
                pieces = []
                for side in (1.0, -1.0):
                    c2 = (c_[0] + n_[0] * 0.025 * side, c_[1] + n_[1] * 0.025 * side)
                    hp = half(pts, n_, c2, side)
                    if len(hp) >= 3: pieces.append(hp)
            for pi_, pts_ in enumerate(pieces):
                poly = cut_corners(pts_, [(q, 0.9) for q in keep])
                cracked = len(pieces) > 1
                out = square_to_flights(broken(faceted(poly, keep, seg=(0.3, 0.55), jit=0.02 if cracked else 0.035), seg=0.2, jit=0.008 if cracked else 0.014, chip=0.0 if cracked else 0.1), p_[1])      # (a cracked half: its edges less broken, its outline kept simple)
                dh_ = dh if pi_ == 0 else rnd.uniform(-0.045, -0.004)
                marble.append(slab('stone_%s_%d' % (k_, pi_), ccw(out), p_[1] + dh_, thick=th_, keep=keep))
    for (p, h) in PLAN.get('columns', []):
        x_, z_ = on_floor(p[0], p[1], p[2], 0.42)
        cw = clear_of_way(x_, p[1], z_, 0.26)
        if cw is None: print('COLUMN at', p, 'dropped: no room off the way'); continue
        if math.hypot(cw[0] - x_, cw[1] - z_) > 0.01: print('COLUMN at', p, 'moved off the way to', [round(cw[0], 2), round(cw[1], 2)])
        marble += column(cw[0], p[1], cw[1], h)
    for (cx_, cy_, cz_, ch_, cr_, cb_) in PLAN.get('sea_columns', []):      # (columns standing in the water, a ruin half sunk: off the way, scenery)
        marble += column(cx_, cy_, cz_, ch_, cr_, cb_)
    for (px, pz, top, hs) in PLAN.get('pedestals', []):      # (a square marble pedestal standing out of the still water, a statue on it)
        bm = bmesh.new(); box(bm, (px - hs, top - 2.4, pz - hs), (px + hs, top, pz + hs)); chisel(bm, 3, depth=(0.015, 0.05), keep_above=None); marble.append(finish(bm, 'pedestal'))
    for (p, ax) in PLAN.get('arches', []):
        marble += arch(p[0], p[1], p[2], W=1.42, Hh=2.3, r=0.41, D=0.36, along_x=(ax == 'x'))
    for (bx0, bx1, bz0, bz1, bh) in PLAN.get('bridges', []):      # (a slab over a chasm: marble only, nothing under it but the sea; square where it meets the floors)
        ends = bridge_ends(bh)
        kp_ = [e for (es, _) in ends for e in es]
        marble.append(slab('bridge', ccw(broken(rect(bx0, bx1, bz0, bz1, 0.0), seg=0.3, jit=0.008, chip=0.03)), bh, thick=0.34, keep=kp_))
    if PLAN.get('cypress'):
        cp, ch_ = PLAN['cypress']
        x_, z_ = on_floor(cp[0], cp[1], cp[2], 0.32)
        cw = clear_of_way(x_, cp[1], z_, 0.3)
        if cw is None: print('CYPRESS dropped: no room off the way')
        else: lv, bk = cypress(cw[0], cp[1], cw[1], ch_); olive += lv; barks += bk
    if QUARRY_ON: quarries += quarry_terrain(PLAN)
    U = Vector((0.7071, 0.0, -0.7071)); W = Vector((0.7071, 0.0, 0.7071)); Y = Vector((0.0, 1.0, 0.0))
    if PLAN.get('relief'): PLAN['relief'] = list(Vector(PLAN['relief']) + W * 0.32)      # (a small carved stone set in the face of the rock: the game puts it there)
    RELIEF_W = W


def join(obs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs: o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active; o.name = name; o.data.name = name
    return o


M = join(marble, 'marble'); R = join(rock, 'rock') if rock else None; O = join(olive, 'olive') if olive else None; B = join(barks, 'bark') if barks else None
QU = join(quarries, 'quarry') if quarries else None
SN = join(SNOWS, 'snow') if SNOWS else None
RS = []
for nm_, (m_, r_) in RISERS.items():
    RS.append(join(m_, 'riser_%s_marble' % nm_))
    if r_: RS.append(join(r_, 'riser_%s_rock' % nm_))
if PLAN is not None and PLAN.get('relief'):      # (the small carved stone: on the face of the rock toward the eye, half sunk in it)
    rp = Vector(PLAN['relief']); Wd = RELIEF_W
    for lift in (0.0, 0.25, -0.25, 0.5):
        o = rp + Wd * 2.0 + Vector((0.0, lift, 0.0))
        hit, loc, nrm_, idx = R.ray_cast(G(o.x, o.y, o.z), G(-Wd.x, -Wd.y, -Wd.z))
        if hit:
            PLAN['relief'] = [loc.x, loc.z - 0.17, -loc.y]; PLAN['relief'] = list(Vector(PLAN['relief']) + Wd * 0.05)
            print('RELIEF on the rock at', [round(v, 2) for v in PLAN['relief']]); break
print('TRIS', sum(len(o.data.polygons) for o in (M, R, O, B, SN, QU) if o is not None))

# ------------------------------------------------------------------ the shore: where the still water meets the stone
# How far each spot of the water lies from the nearest stone standing in it, so the sea can draw a thin brightness
# hugging every rock and small slow waves going out from it (the game reads <level>/shore.png over the rect in
# level.json). Red: what stands in the water for good (the rock, the floors, the Observer); green: the stones that rise.
SHORE = None
if PLAN is not None and PLAN.get('shore') and PLAN.get('sea_y') is not None:
    import os
    import numpy as np
    from scipy import ndimage
    from scipy.sparse import coo_matrix
    from scipy.sparse.csgraph import connected_components
    from PIL import Image
    SY = float(PLAN['sea_y']) + 0.015

    def cut(ob):
        """the body cut by the water's face: per island of it, its segments [x0, z0, x1, z1] in the game's x and z"""
        mw = ob.matrix_world; me = ob.data; me.calc_loop_triangles()
        V = np.array([tuple(mw @ v.co) for v in me.vertices], dtype=np.float64)
        T = np.array([tuple(t.vertices) for t in me.loop_triangles], dtype=np.int64)
        if len(T) == 0: return []
        _, inv = np.unique(np.round(V, 5), axis=0, return_inverse=True); T = inv.reshape(-1)[T]      # (a vertex split at a hard edge is still one point of the body)
        V = np.array([tuple(mw @ v.co) for v in me.vertices], dtype=np.float64)
        Vu = np.zeros((int(inv.max()) + 1, 3)); Vu[inv.reshape(-1)] = V; V = Vu
        n = len(V); e = np.concatenate([T[:, [0, 1]], T[:, [1, 2]], T[:, [2, 0]]])
        _, lab = connected_components(coo_matrix((np.ones(len(e)), (e[:, 0], e[:, 1])), shape=(n, n)), directed=False)
        h = V[:, 2] - SY; h[np.abs(h) < 1e-7] = 1e-7
        sg = np.sign(h[T]); T = T[~(sg == sg[:, :1]).all(axis=1)]
        if len(T) == 0: return []
        P = []; C = []
        for (a_, b_) in ((0, 1), (1, 2), (2, 0)):
            ha = h[T[:, a_]]; hb = h[T[:, b_]]
            C.append(ha * hb < 0)
            P.append(V[T[:, a_]] + (V[T[:, b_]] - V[T[:, a_]]) * (ha / np.where(ha - hb == 0, 1e-9, ha - hb))[:, None])
        P = np.stack(P, axis=1); C = np.stack(C, axis=1)
        ix = np.argsort(~C, axis=1, kind='stable')[:, :2]; ar = np.arange(len(T))
        p0 = P[ar, ix[:, 0]]; p1 = P[ar, ix[:, 1]]
        sg2 = np.stack([p0[:, 0], -p0[:, 1], p1[:, 0], -p1[:, 1]], axis=1)
        il = lab[T[:, 0]]
        return [sg2[il == k] for k in np.unique(il)]

    def fill(mask, sg, x0, z0, res):
        """one body's outline filled into the mask: row by row, even-odd, if it is closed; if it is not (a model with a
        hole in it), its outline drawn, its gaps closed, and all it rings filled"""
        X0, Z0, X1, Z1 = sg[:, 0], sg[:, 1], sg[:, 2], sg[:, 3]
        jlo = max(0, int((min(Z0.min(), Z1.min()) - z0) / res) - 1); jhi = min(mask.shape[0] - 1, int((max(Z0.max(), Z1.max()) - z0) / res) + 1)
        xc = x0 + (np.arange(mask.shape[1]) + 0.5) * res
        rows = []
        for j in range(jlo, jhi + 1):
            z = z0 + (j + 0.5) * res
            c = (Z0 - z) * (Z1 - z) < 0
            if not c.any(): continue
            xs = np.sort(X0[c] + (X1[c] - X0[c]) * (z - Z0[c]) / (Z1[c] - Z0[c]))
            if len(xs) % 2: rows = None; break
            rows.append((j, np.searchsorted(xs, xc) % 2 == 1))
        if rows is not None:
            for (j, r) in rows: mask[j] |= r
            return
        ol = np.zeros(mask.shape, dtype=bool)
        for (a0, b0, a1, b1) in sg:
            n_ = max(2, int(math.hypot(a1 - a0, b1 - b0) / (res * 0.5)) + 1)
            t = np.linspace(0.0, 1.0, n_)
            ii = ((a0 + (a1 - a0) * t - x0) / res).astype(int); jj = ((b0 + (b1 - b0) * t - z0) / res).astype(int)
            ok = (ii >= 0) & (ii < mask.shape[1]) & (jj >= 0) & (jj < mask.shape[0]); ol[jj[ok], ii[ok]] = True
        ol = ndimage.binary_closing(ol, iterations=3)
        mask |= ndimage.binary_fill_holes(ol)
        print('SHORE an open body, filled by its outline:', len(sg), 'segments')

    still = []
    for o in (M, R):
        if o is not None: still += cut(o)
    rising = []
    for o in RS: rising += cut(o)
    def stand(model, foot, height, turn):      # (a model set as the game sets it: its box's foot-middle at its foot, its height the plan's, turned about the up; its cut by the water)
        fn = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'props', '%s.glb' % model)
        before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=fn)
        new = [o for o in bpy.data.objects if o not in before]; mesh_ = [o for o in new if o.type == 'MESH']
        vs = [o.matrix_world @ v.co for o in mesh_ for v in o.data.vertices]
        lo = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs))); hi = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
        k_ = float(height) / (hi.z - lo.z)
        Mx = Matrix.Translation(G(foot[0], foot[1], foot[2])) @ Matrix.Rotation(float(turn), 4, 'Z') @ Matrix.Scale(k_, 4) @ Matrix.Translation(-Vector(((lo.x + hi.x) * 0.5, (lo.y + hi.y) * 0.5, lo.z)))
        for o in mesh_: o.matrix_world = Mx @ o.matrix_world
        bpy.context.view_layer.update()
        sg_ = []
        for o in mesh_: sg_ += cut(o)
        for o in new: bpy.data.objects.remove(o, do_unlink=True)
        return sg_
    ob_ = PLAN.get('observer')
    if ob_: still += stand(PLAN.get('observer_model', 'observer'), ob_[:3], ob_[3], ob_[4])      # (the Observer)
    for s_ in PLAN.get('statues', []):      # (a statue standing in the water, as the third level's light-bearer: the foam hugs her too)
        if s_[0] in PLAN.get('shore_statues', []): still += stand('statue_' + s_[0], s_[1], s_[2], s_[3])
    allsg = np.concatenate(still + rising)
    D = 1.6; res = 0.03
    x0 = float(min(allsg[:, 0].min(), allsg[:, 2].min())) - D; x1 = float(max(allsg[:, 0].max(), allsg[:, 2].max())) + D
    z0 = float(min(allsg[:, 1].min(), allsg[:, 3].min())) - D; z1 = float(max(allsg[:, 1].max(), allsg[:, 3].max())) + D
    nx = int(math.ceil((x1 - x0) / res)); nz = int(math.ceil((z1 - z0) / res)); x1 = x0 + nx * res; z1 = z0 + nz * res
    chans = []
    for group in (still, rising):
        mk = np.zeros((nz, nx), dtype=bool)
        for sg in group: fill(mk, sg, x0, z0, res)
        d = ndimage.distance_transform_edt(~mk) * res if mk.any() else np.full((nz, nx), D)
        chans.append((np.clip(1.0 - d / D, 0.0, 1.0) * 255.0 + 0.5).astype(np.uint8))
    chans.append(np.zeros((nz, nx), dtype=np.uint8))
    Image.fromarray(np.stack(chans, axis=2), 'RGB').save(os.path.join(os.path.dirname(OUTJ) or '.', 'shore.png'))
    SHORE = {'rect': [round(x0, 4), round(z0, 4), round(x1, 4), round(z1, 4)], 'D': D}
    print('SHORE', nx, 'x', nz, 'islands', len(still), '+', len(rising))

# ------------------------------------------------------------------ the shade of corners and clefts, into the vertices
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = SAMPLES
w = bpy.data.worlds.new('w'); scene.world = w; w.light_settings.distance = 0.55      # (only the close corners and clefts darken)
scene.render.bake.target = 'VERTEX_COLORS'
for o in (M, R, O, B, SN, QU, *RS):
    if o is None: continue
    mat = bpy.data.materials.new(o.name); o.data.materials.append(mat)
    ca = o.data.color_attributes.new('ao', 'BYTE_COLOR', 'CORNER')
    o.data.color_attributes.active_color = ca
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.bake(type='AO')
    dep = o.data.attributes.get('dep')      # (its depth under its floor, into the green of the same colours: AO stays in the red)
    for poly in o.data.polygons:
        for li in poly.loop_indices:
            c = ca.data[li].color
            d = dep.data[o.data.loops[li].vertex_index].value if dep is not None else 0.0
            ca.data[li].color = (c[0], min(1.0, d / 4.0), c[2], c[3])
    print('BAKED', o.name)

bpy.ops.object.select_all(action='SELECT')
kw = dict(filepath=OUT, export_format='GLB', use_selection=False, export_apply=True, export_normals=True)
for extra in (dict(export_vertex_color='ACTIVE'), dict(export_colors=True), {}):
    try:
        bpy.ops.export_scene.gltf(**kw, **extra); print('EXPORTED', extra); break
    except TypeError as e:
        print('retry', e)

# ------------------------------------------------------------------ the way, for the game
if PLAN is not None:
    way = {k: PLAN.get(k) for k in ('heights', 'nodes', 'edges', 'volute', 'head', 'ring', 'eye', 'flights', 'floors', 'relief', 'faces', 'stone', 'scene', 'sea_y', 'arches', 'braziers', 'dial', 'mirrors', 'door', 'walls', 'trench', 'observer', 'observer_haze', 'observer_model', 'horizon', 'sun', 'statues', 'holes')}
    way['stair_groove'] = STAIR_GROOVE
    if SHORE is not None: way['shore'] = SHORE
    with open(OUTJ, 'w') as f: json.dump(way, f, indent=1)
    print('DONE'); sys.exit(0)
way = {
    'heights': {'H0': H0, 'H1': H1, 'HL': HL, 'H2': H2, 'H3': H3, 'HS': HS},
    'nodes': {'s': (4.95, HS, 5.3), 'n0': (1.4, H0, 5.3), 'n1': (0.0, H0, 5.3), 'n2': (0.0, H0, 3.8), 't1': (0.0, H1, 0.8), 'b0': (0.0, H1, -0.1),
              'i1': (0.0, H1, -1.45), 'v': (1.45, H1, -0.1), 'n': (1.45, H1, -1.25), 'l': (0.2, HL, -3.8), 't2': (-2.75, H2, -3.85), 'r': (-2.1, H3, -6.95)},
    'edges': [['s', 'n0', [(4.55, HS, 5.3), (2.15, H0, 5.3)]], ['n0', 'n1', []], ['n1', 'n2', []], ['n2', 't1', [(0.0, H0, 3.3), (0.0, H1, 0.95)]],
              ['t1', 'b0', []], ['b0', 'i1', []], ['b0', 'v', []], ['v', 'n', []], ['i1', 'l', [(0.0, H1, -2.0), (0.0, HL, -3.2)]],
              ['l', 't2', [(-0.75, HL, -3.85), (-2.05, H2, -3.85)]], ['t2', 'r', [(-3.0, H2, -4.75), (-3.0, H3, -6.1)]]],
    'volute': (2.15, H1, -1.6), 'head': (-2.3, H1 - 0.25, 0.4), 'ring': (-2.1, H3, -6.95),
}
with open(OUTJ, 'w') as f: json.dump(way, f, indent=1)
print('DONE')
