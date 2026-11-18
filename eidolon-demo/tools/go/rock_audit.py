"""Where rock shows through what it should not, in a built level (the owner, 18/11: "make sure the rocks are clean, none
through objects, one in another"): rock over a slab's top inside its outline or at its edge; rock faces crossing the
space over each floor (to 1.9 m); rock in a stair; rock in a statue (as the game sets it: scaled to its height, its foot
at its place, turned), above the sea; rock in the white sea rocks; and, given a box, rock in it (the block where it comes
to rest: "x0,x1,z0,z1,y0,y1" in the game's axes).

usage: python3.11 -I tools/go/rock_audit.py -- <level dir> [props dir] [box]
"""
import bpy, sys, json, math, os
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
a = sys.argv[sys.argv.index('--') + 1:]
lv = a[0]; props = a[1] if len(a) > 1 else "props"; box = a[2] if len(a) > 2 else None
plan = json.load(open(os.path.join(lv, 'plan.json')))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(lv, 'level.glb'))
G = lambda p: (p.x, p.z, -p.y)      # (Blender to the game's x, y, z)
def inside(poly, x, z):
    c = False; n = len(poly)
    for i in range(n):
        x1, z1 = poly[i]; x2, z2 = poly[(i + 1) % n]
        if (z1 > z) != (z2 > z) and x < (x2 - x1) * (z - z1) / (z2 - z1) + x1: c = not c
    return c
def segd(p, a, b):
    ax, az = a; bx, bz = b; px, pz = p; dx, dz = bx - ax, bz - az; L = dx * dx + dz * dz
    t = 0.0 if L == 0 else max(0.0, min(1.0, ((px - ax) * dx + (pz - az) * dz) / L))
    return math.hypot(px - (ax + t * dx), pz - (az + t * dz))
objs = {o.name: o for o in bpy.context.scene.objects if o.type == 'MESH'}
rocks = [o for n, o in objs.items() if 'rock' in n]
def pts(o):      # (its vertices and its faces' middles, in the game's axes)
    mw = o.matrix_world; out = []
    for v in o.data.vertices: out.append(G(mw @ v.co))
    for f in o.data.polygons: out.append(G(mw @ f.center))
    return out
sea = plan.get('sea_y', -0.3)
print('LEVEL', lv)
# 1. over a slab's top, or at its edge
floors = plan['floors']; hits = {}
for o in rocks:
    for (x, y, z) in pts(o):
        if y < sea: continue
        for fname, f in floors.items():
            h = f['h']; poly = f['xz']
            if y <= h - 0.03: continue
            ins = inside(poly, x, z)
            ed = min(segd((x, z), poly[i], poly[(i + 1) % len(poly)]) for i in range(len(poly)))
            if ins or ed < 0.05:
                k = (o.name, fname, round(x * 2) / 2, round(z * 2) / 2)
                hits.setdefault(k, []).append(y - h)
for k, v in sorted(hits.items()):
    print('  OVER SLAB  %-14s floor %-4s at x %5.1f z %5.1f : %3d pts, up to %+.2f m over its top' % (k[0], k[1], k[2], k[3], len(v), max(v)))
# 2. in a stair
for i, fl in enumerate(plan.get('flights', [])):
    p0, p1, w = Vector(fl[0]), Vector(fl[1]), fl[2]
    ax = Vector((p1.x - p0.x, 0, p1.z - p0.z)); Lh = ax.length; ax.normalize(); lat = Vector((-ax.z, 0, ax.x))
    n = 0; top = -9
    for o in rocks:
        for (x, y, z) in pts(o):
            q = Vector((x - p0.x, 0, z - p0.z)); t = q.dot(ax) / Lh; s = q.dot(lat)
            if 0.0 <= t <= 1.0 and abs(s) < w / 2 - 0.02:
                yh = p0.y + t * (p1.y - p0.y)
                if y > yh - 0.12: n += 1; top = max(top, y - yh)
    print('  STAIR %d: %d rock pts above its steps%s' % (i, n, (' (up to %+.2f m)' % top) if n else ''))
# 3. in a statue, or in the gate: overlap of their faces with the rock's, above the sea
def bvh(o, mw=None):
    mw = mw or o.matrix_world
    vs = [mw @ v.co for v in o.data.vertices]; return BVHTree.FromPolygons(vs, [list(p.vertices) for p in o.data.polygons]), vs, o
rb = [bvh(o) for o in rocks]
def overlap(tb, label):
    tree, tv, to = tb; tot = 0; zs = []
    for (rt, rv, ro) in rb:
        pairs = tree.overlap(rt)
        for (i, j) in pairs:
            c = sum((tv[k] for k in to.data.polygons[i].vertices), Vector()) / len(to.data.polygons[i].vertices)
            if c.z > sea + 0.02: tot += 1; zs.append((round(c.x, 1), round(c.z, 1), round(-c.y, 1)))
    if tot: print('  %s: %d faces in the rock above the sea, e.g. (game x,y,z) %s' % (label, tot, sorted(set(zs))[:6]))
    else: print('  %s: clear' % label)
for st in plan.get('statues', []):
    nm, at, hgt, turn = st[0], st[1], st[2], st[3]
    f = os.path.join(props, 'statue_%s.glb' % nm)
    if not os.path.exists(f): print('  statue', nm, 'no model'); continue
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=f)
    new = [o for o in bpy.context.scene.objects if o not in before and o.type == 'MESH']
    for o in new:
        bpy.context.view_layer.update()
        vs = [o.matrix_world @ v.co for v in o.data.vertices]
        zmin = min(v.z for v in vs); zmax = max(v.z for v in vs); sc = hgt / (zmax - zmin)
        # as the game sets it (prop_model): scaled to its height, its foot at the place, turned
        M = Matrix.Translation(Vector((at[0], -at[2], at[1]))) @ Matrix.Rotation(turn, 4, 'Z') @ Matrix.Scale(sc, 4) @ Matrix.Translation(Vector((0, 0, -zmin)))
        overlap(bvh(o, M @ o.matrix_world), 'STATUE %-10s' % nm)
        for oo in new: oo.hide_set(True)
for o in objs.values():
    if o.name.startswith('arch') or 'gate' in o.name: overlap(bvh(o), 'GATE ' + o.name)
if 'salt' in objs: overlap(bvh(objs['salt']), 'SALT ROCKS')
# 4. faces crossing the space over each floor, from 0.02 m over its top to 1.9 m
def shrink(poly, d):      # (the outline drawn in by d)
    n = len(poly); out = []
    area = sum(poly[i][0] * poly[(i + 1) % n][1] - poly[(i + 1) % n][0] * poly[i][1] for i in range(n)); s = 1 if area > 0 else -1
    for i in range(n):
        p0, p1, p2 = Vector(poly[i - 1]), Vector(poly[i]), Vector(poly[(i + 1) % n])
        e1 = (p1 - p0).normalized(); e2 = (p2 - p1).normalized()
        n1 = Vector((-e1.y, e1.x)) * s; n2 = Vector((-e2.y, e2.x)) * s
        b = (n1 + n2); b = b / max(b.dot(n1), 1e-3)
        out.append(p1 + b * d)
    return out
import bmesh
B = lambda x, y, z: Vector((x, -z, y))
def solid(bm):
    return BVHTree.FromBMesh(bm)
for fn, f in floors.items():
    h = f['h']; poly = shrink(f['xz'], 0.06)
    bm = bmesh.new(); lo = [bm.verts.new(B(p.x, h + 0.02, p.y)) for p in poly]; hi = [bm.verts.new(B(p.x, h + 1.9, p.y)) for p in poly]
    bm.faces.new(lo); bm.faces.new(hi[::-1])
    for i in range(len(poly)): bm.faces.new([lo[i], lo[(i + 1) % len(poly)], hi[(i + 1) % len(poly)], hi[i]])
    bt = solid(bm); tot = sum(len(rt.overlap(bt)) for (rt, rv, ro) in rb)
    print('  OVER FLOOR %-4s: %d rock faces in the space over it' % (fn, tot))
if box:
    x0, x1, z0, z1, y0, y1 = [float(v) for v in box.split(',')]
    bm = bmesh.new(); vs = [bm.verts.new(B(x, y, z)) for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)]
    for fc in [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]: bm.faces.new([vs[i] for i in fc])
    bt = solid(bm); tot = sum(len(rt.overlap(bt)) for (rt, rv, ro) in rb)
    ins = sum(1 for (rt, rv, ro) in rb for p in rv if x0 <= p.x <= x1 and z0 <= -p.y <= z1 and y0 <= p.z <= y1)
    print('  BOX %s: %d rock faces through it, %d rock vertices in it' % (box, tot, ins))
