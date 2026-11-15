"""Builds the ivory level of Eidolon GO in Blender: marble floors on rock cut in uneven planes, flights of steps,
fluted broken columns, arches, a cypress, outcrops of rock; bakes the shade of corners and clefts (ambient occlusion)
into the vertices; writes the level (goiv/level.glb) and its way (goiv/level.json) for the game.

Everything is placed in the game's own axes (x across, y up, z toward the eye's left), in metres from the level's origin.

usage: python3.11 -I tools/ivory_level.py -- <out.glb> <out.json> [seed] [samples] [plan.json]
With a plan (made by tools/ivory/trace.py from a concept picture) the floors, flights and things stand where the
picture shows them; without one, the built-in plan below is used.
"""
import bpy, bmesh, math, random, sys, json
from mathutils import Vector

a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = a[0] if len(a) > 0 else 'goiv/level.glb'
OUTJ = a[1] if len(a) > 1 else 'goiv/level.json'
SEED = int(a[2]) if len(a) > 2 else 7
SAMPLES = int(a[3]) if len(a) > 3 else 48
PLAN = json.load(open(a[4])) if len(a) > 4 else None
rnd = random.Random(SEED)

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


def slab(name, outline, h, thick=0.36, keep=()):
    """a floor of marble: a thick slab on the broken outline, level on top, here and there a chip off its top edge
    (but not where a flight meets it: keep, the points where flights come to it)"""
    nr = normals(outline)
    inner, top, bot = [], [], []
    for i, (x, z) in enumerate(outline):
        nx, nz = nr[i]
        inner.append((x - nx * 0.1, h, z - nz * 0.1))
        near_flight = any(math.hypot(x - k[0], z - k[1]) < 0.9 for k in keep)
        if rnd.random() < 0.2 and not near_flight:      # a chip: the edge a little lower and further in
            dy, dn = -rnd.uniform(0.02, 0.05), -rnd.uniform(0.01, 0.035)
        else: dy, dn = 0.0, 0.0
        top.append((x + nx * dn, h + dy, z + nz * dn))
        b = rnd.uniform(0.0, 0.05)
        bot.append((x - nx * b, h - thick + rnd.uniform(-0.03, 0.03), z - nz * b))
    bm = bmesh.new(); loft(bm, [inner, top, bot], cap0=True, cap1=True)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return finish(bm, name + '_slab')


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


def mass(name, poly, top_at, inset=0.06, rough=1.0, dome=False):
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
    soften(ob)
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


def floor(name, x0, x1, z0, z1, h, ch, poly=None):
    """a floor of the way: its marble slab on the rock, the rock in blocks under its edge"""
    poly = poly or rect(x0, x1, z0, z1, ch)
    out = square_to_flights(broken(grow(poly, 0.05)), h)
    poly = simplify(square_to_flights(densify(ccw(poly), 0.3), h))
    keep = [(fl[i][0], fl[i][2]) for fl in (PLAN or {}).get('flights', []) for i in (0, 1) if abs(fl[i][1] - h) < 0.05]
    m = [slab(name, out, h, keep=keep)]
    r = [mass(name, poly, lambda x, z: h - 0.33)]
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


def ledge(name, c, rad, top):
    """rock without marble, that binds the floors into one mountain: a body of rock, its top rounded over in facets"""
    ring = []
    for k in range(9):
        aa = 2.0 * math.pi * k / 9.0 + rnd.uniform(-0.18, 0.18)
        rr = rad * rnd.uniform(0.82, 1.05)
        ring.append((c[0] + math.cos(aa) * rr, c[2] + math.sin(aa) * rr))
    return [mass(name, ring, lambda x, z: top - 0.04, inset=0.0, dome=True)]


def flight(foot, head, w, n=None, step=0.12):
    """a flight of steps as one smooth body of marble: up each riser and over each tread, each nosing eased a little,
    a stringer under the line of the nosings; its last tread a hair under the upper floor and on under it (so no two
    faces lie in one plane); the rock under it, its top along the stringer, and a cut mass of rock under that"""
    fx, fy, fz = foot; hx, hy, hz = head
    d = Vector((hx - fx, 0.0, hz - fz)); L = d.length; d.normalize()
    s = Vector((-d.z, 0.0, d.x))
    n = int(n or max(1, round((hy - fy) / step))); rise = (hy - fy) / n; run = L / n
    D = 0.24      # the stringer: how deep under the line of the nosings (and under the upper floor, past the head)
    under = lambda t: min(fy + rise * (1.0 + t / run), hy) - D
    end = L + 0.34
    prof = [(-0.2, min(under(-0.2), fy - 0.25)), (-0.2, fy - 0.004), (0.0, fy - 0.004)]
    noses = []
    for k in range(n):
        y = fy + rise * (k + 1) - (0.004 if k == n - 1 else 0.0)
        noses.append(len(prof)); prof.append((k * run, y))      # the nosing of step k
        prof.append(((k + 1) * run if k < n - 1 else L + 0.12, y))      # the back of its tread
    prof += [(end, hy - 0.004), (end, under(end))]
    base = Vector((fx, 0.0, fz))
    bm = bmesh.new()
    def V(t, y, side):
        p = base + d * t + s * (side * w * 0.5)
        return bm.verts.new(G(p.x, y, p.z))
    A = [V(t, y, -1.0) for (t, y) in prof]; B = [V(t, y, 1.0) for (t, y) in prof]
    bm.faces.new(A); bm.faces.new(list(reversed(B)))
    for i in range(len(prof)):
        j = (i + 1) % len(prof)
        bm.faces.new([A[i], A[j], B[j], B[i]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    eds = [bm.edges.get([A[i], B[i]]) for i in noses]
    bmesh.ops.bevel(bm, geom=[e for e in eds if e is not None], offset=0.014, segments=1, affect='EDGES', profile=0.5)      # (a line of light along each nosing)
    m = [finish(bm, 'flight')]
    # the rock under it: the blocks of the mountain go on along both its sides, flush with the ends of its steps, their
    # tops along the stringer; they meet in the middle under it
    tt = lambda x, z: under((Vector((x, 0.0, z)) - base).dot(d)) + 0.02
    foot_ = [base + d * -0.1 + s * (sd * w * 0.5) for sd in (-1.0, 1.0)]
    head_ = [base + d * end + s * (sd * w * 0.5) for sd in (1.0, -1.0)]
    r = [mass('flight', [(q.x, q.z) for q in foot_ + head_], tt, inset=0.0, rough=0.6)]
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
    """a cypress as the picture has it: a flame cut as if in stone, in a few broad faces, to a point; a short trunk"""
    bark = []
    bm = bmesh.new()
    hexa(bm, [(x - 0.06, y - 0.1, z - 0.05), (x + 0.06, y - 0.1, z - 0.05), (x + 0.06, y - 0.1, z + 0.06), (x - 0.06, y - 0.1, z + 0.06),
              (x - 0.045, y + 0.42, z - 0.035), (x + 0.045, y + 0.42, z - 0.035), (x + 0.045, y + 0.42, z + 0.045), (x - 0.045, y + 0.42, z + 0.045)])
    bark.append(finish(bm, 'bark'))
    R = 0.29
    prof = [(0.0, 0.42), (0.1, 0.86), (0.28, 1.0), (0.5, 0.86), (0.7, 0.58), (0.86, 0.3)]      # (up the flame, how wide)
    y0 = y + 0.3; n = 7
    rings = []
    for j, (t, k) in enumerate(prof):
        a0 = j * 0.45
        rings.append([(x + math.cos(a0 + 2 * math.pi * i / n) * R * k * rnd.uniform(0.9, 1.08), y0 + h * t + rnd.uniform(-0.03, 0.03), z + math.sin(a0 + 2 * math.pi * i / n) * R * k * rnd.uniform(0.9, 1.08)) for i in range(n)])
    bm = bmesh.new(); vs = loft(bm, rings, cap0=True, cap1=False)
    tip = bm.verts.new(G(x + rnd.uniform(-0.02, 0.02), y0 + h * 1.02, z + rnd.uniform(-0.02, 0.02)))
    for i in range(n):
        try: bm.faces.new([vs[-1][i], vs[-1][(i + 1) % n], tip])
        except ValueError: pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    leaves = [finish(bm, 'leaves', fine=3.0)]
    return leaves, bark


# ------------------------------------------------------------------ the level
marble, rock, olive, barks = [], [], [], []
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
    for nm, fl in PLAN['floors'].items():
        m, r = floor(nm, 0, 0, 0, 0, fl['h'], 0, poly=[tuple(p) for p in fl['xz']]); marble += m; rock += r
    for fl in PLAN['flights']:
        m, r = flight(tuple(fl[0]), tuple(fl[1]), fl[2], fl[3] if len(fl) > 3 else None); marble += m; rock += r
    for (c, r_, top) in PLAN.get('rocks', []):      # rock that binds the floors into one mountain
        rock += ledge('ledge', c, r_, top)
    for (p, h) in PLAN['columns']:
        x_, z_ = on_floor(p[0], p[1], p[2], 0.42)
        marble += column(x_, p[1], z_, h)
    for (p, ax) in PLAN['arches']:
        marble += arch(p[0], p[1], p[2], W=1.42, Hh=2.3, r=0.41, D=0.36, along_x=(ax == 'x'))
    cp, ch_ = PLAN['cypress']
    x_, z_ = on_floor(cp[0], cp[1], cp[2], 0.32)
    lv, bk = cypress(x_, cp[1], z_, ch_); olive += lv; barks += bk
    U = Vector((0.7071, 0.0, -0.7071)); W = Vector((0.7071, 0.0, 0.7071)); Y = Vector((0.0, 1.0, 0.0))
    PLAN['relief'] = list(Vector(PLAN['relief']) + W * 0.32)      # (a small carved stone set in the face of the rock: the game puts it there)


def join(obs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs: o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active; o.name = name; o.data.name = name
    return o


M = join(marble, 'marble'); R = join(rock, 'rock'); O = join(olive, 'olive'); B = join(barks, 'bark')
print('TRIS', sum(len(o.data.polygons) for o in (M, R, O, B)))

# ------------------------------------------------------------------ the shade of corners and clefts, into the vertices
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = SAMPLES
w = bpy.data.worlds.new('w'); scene.world = w; w.light_settings.distance = 0.55      # (only the close corners and clefts darken)
scene.render.bake.target = 'VERTEX_COLORS'
for o in (M, R, O, B):
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
    way = {k: PLAN[k] for k in ('heights', 'nodes', 'edges', 'volute', 'head', 'ring', 'eye', 'flights', 'floors', 'relief')}
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
