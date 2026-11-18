"""The second level's block: the first trials' carved cube (goiv/block.glb) made rougher, as fresh from the quarry, its
meander kept and lifted out to be coloured apart (the owner: "the stone a little more uneven, a little different in
shade"; the meander "more uneven and darker").

  - The meander is the grooves cut 3.3 cm into each side: their floors and walls become a mesh of their own
    ('meander'), so the game can colour it.
  - The meander as cut by hand: its outline wavers, its width and its depth vary (a smooth field in each face's own
    plane, the same for a groove's rim and its floor, so its walls stay walls; long edges about it cut short first).
  - Block and meander are bent together: each upright face out of true its own way, the top a little out of level.
  - A few corners of the block are broken off aslant (the meander lies in the middle of each face, clear of them).
  - The whole made the size of a causeway stone (0.9 m square, 1.04 m high), its foot at its origin.

usage: python3.11 -I tools/go/block_meander.py -- <src block.glb> <out.glb> [seed]
"""
import bpy, bmesh, sys, random
from mathutils import Vector, noise

a = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT = a[0], a[1]; SEED = int(a[2]) if len(a) > 2 else 7
rnd = random.Random(SEED)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
ob = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
ob.name = 'source'      # (its name free for the new block)
bm = bmesh.new(); bm.from_mesh(ob.data); bm.transform(ob.matrix_world)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)      # (its faces each came with their own corners: welded, it is one closed stone, and a break in it closes)
import math
bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(0.05), verts=bm.verts[:], edges=bm.edges[:])      # (each flat run of a groove, its floor or a wall, one face: its outline can then be cut evenly along it)
xs = [v.co.x for v in bm.verts]; ys = [v.co.y for v in bm.verts]; zs = [v.co.z for v in bm.verts]
X0, X1, Y0, Y1, Z0, Z1 = min(xs), max(xs), min(ys), max(ys), min(zs), max(zs)
H = Z1 - Z0

# the meander: on each side, the groove floors (facing out, 2-4.5 cm under the face) and the groove walls between
sides = [(Vector((1, 0, 0)), X1), (Vector((-1, 0, 0)), -X0), (Vector((0, 1, 0)), Y1), (Vector((0, -1, 0)), -Y0)]
mea = set()
for f in bm.faces:
    c = f.calc_center_median()
    if c.z < Z0 + 0.05 or c.z > Z1 - 0.05: continue
    for (ax, outer) in sides:
        depth = outer - c.dot(ax)
        lateral = abs(c.dot(Vector((ax.y, -ax.x, 0))))      # (how far along the face from its middle)
        half = (X1 - X0) / 2 if ax.x == 0 else (Y1 - Y0) / 2
        if lateral > half - 0.045: continue      # (never the block's own edges)
        if f.normal.dot(ax) > 0.9 and 0.02 < depth < 0.045: mea.add(f)
        elif abs(f.normal.dot(ax)) < 0.35 and abs(f.normal.z) < 0.95 and 0.0 < depth < 0.04: mea.add(f)
        elif abs(f.normal.z) > 0.9 and 0.0 < depth < 0.04: mea.add(f)      # (the grooves' upper and lower walls)
print('meander faces', len(mea), 'of', len(bm.faces))

LEAN = {k: (rnd.uniform(-0.03, 0.03), rnd.uniform(-0.018, 0.018)) for k in range(4)}      # (the faces out of true, the top out of level: the same for block and meander, so they stay one)
TOP = (rnd.uniform(-0.025, 0.025), rnd.uniform(-0.025, 0.025))
def bend(co):
    p = co.copy(); u = (co.z - Z0) / H
    for k, (ax, outer) in enumerate(sides):
        s = co.dot(ax)
        if s > 0:
            w = s / outer      # (more of it the nearer that face)
            lat = co.dot(Vector((ax.y, -ax.x, 0))) / outer
            p += ax * w * (LEAN[k][0] * u + LEAN[k][1] * lat)
    p.z += u * (TOP[0] * co.x / X1 + TOP[1] * co.y / Y1)
    return p

# (the meander marked on each face, so the marks go with the faces through every cut; then the whole, still closed,
# bent and broken at its corners, and only then parted in two)
bm.faces.index_update(); mea_ix = {f.index for f in mea}      # (by index: a new layer leaves the old face references stale)
mark = bm.faces.layers.int.new('mea')
for f in bm.faces: f[mark] = 1 if f.index in mea_ix else 0
print('marked', sum(f[mark] for f in bm.faces), 'area', round(sum(f.calc_area() for f in bm.faces if f[mark]), 4))

# the meander uneven, as cut by hand
WOB = (0.02, 0.0125, 0.015)      # (its outline's broad waver and fine one, and its floor's depth, per unit of noise: the noise is mostly about 0.2, so about 4, 2.5 and 3 mm in the source's metres, at times twice that)
def sm(e0, e1, x):
    t = min(max((x - e0) / (e1 - e0), 0.0), 1.0); return t * t * (3.0 - 2.0 * t)
def side_of(co):      # (the side a point near the meander lies on, its across and its up, how deep under that face, how far from its edges)
    k = max(range(4), key=lambda i: co.dot(sides[i][0]) - sides[i][1])
    ax, outer = sides[k]; t = Vector((ax.y, -ax.x, 0))
    half = (X1 - X0) / 2 if ax.x == 0 else (Y1 - Y0) / 2
    w = (1.0 - sm(half - 0.075, half - 0.035, abs(co.dot(t)))) * sm(Z0 + 0.03, Z0 + 0.07, co.z) * (1.0 - sm(Z1 - 0.07, Z1 - 0.03, co.z))
    return k, ax, t, outer - co.dot(ax), co.dot(t), w
SEG = 0.035      # (the longest a piece of the meander's outline may be: each run wavers along its length)
def split_long(e):      # (cut into even pieces, the faces on either side kept whole: no fan of new faces about it)
    A, B = e.verts[0].co.copy(), e.verts[1].co.copy(); n = int((B - A).length / SEG) + 1
    cur = e
    for k in range(1, n):
        P = A + (B - A) * (k / n)
        a = cur.verts[0] if (cur.verts[0].co - A).length < (cur.verts[1].co - A).length else cur.verts[1]
        ne, nv = bmesh.utils.edge_split(cur, a, (P - a.co).length / cur.calc_length())
        nv.co = P
        cur = ne if B.to_tuple(6) in [x.co.to_tuple(6) for x in ne.verts] else cur
long_es = [e for e in bm.edges if e.calc_length() > SEG and any(f[mark] for f in e.link_faces) and side_of((e.verts[0].co + e.verts[1].co) * 0.5)[5] > 0.0]
for e in long_es: split_long(e)
noise.seed_set(SEED)
moved = 0
for v in bm.verts:
    k, ax, t, depth, u, w = side_of(v.co)
    if w <= 0.0 or depth < -0.01 or depth > 0.05: continue
    q = Vector((u, v.co.z, 0.0))
    d1 = noise.noise_vector(q / 0.2 + Vector((0.0, 0.0, 3.1 * k + 0.5)))
    d2 = noise.noise_vector(q / 0.09 + Vector((0.0, 0.0, 7.3 * k + 11.5)))
    off = t * (WOB[0] * d1.x + WOB[1] * d2.x) + Vector((0, 0, 1)) * (WOB[0] * d1.y + WOB[1] * d2.y)
    if depth > 0.018: off -= ax * WOB[2] * noise.noise(q / 0.09 + Vector((0.0, 0.0, 5.7 * k + 23.0)))      # (the floor deeper here, shallower there)
    v.co += off * w; moved += 1
bmesh.ops.triangulate(bm, faces=bm.faces[:], quad_method='BEAUTY', ngon_method='BEAUTY')      # (the wavering faces in triangles again)
print('uneven: verts moved', moved, 'faces now', len(bm.faces), 'marked area', round(sum(f.calc_area() for f in bm.faces if f[mark]), 4))
for v in bm.verts: v.co = bend(v.co)

def cut(b, co, no):
    geom = b.verts[:] + b.edges[:] + b.faces[:]
    r = bmesh.ops.bisect_plane(b, geom=geom, dist=1e-6, plane_co=co, plane_no=no, clear_outer=True)
    edges = [e for e in r['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
    if edges:
        made = bmesh.ops.holes_fill(b, edges=edges, sides=0)
        for f in made.get('faces', []): f[mark] = 0
corners = [(sx, sy, sz) for sx in (-1, 1) for sy in (-1, 1) for sz in (0, 1)]
rnd.shuffle(corners)
for (sx, sy, sz) in corners[:5]:      # (corners broken off aslant, each its own size; those at the top more)
    c = Vector((X1 if sx > 0 else X0, Y1 if sy > 0 else Y0, Z1 if sz else Z0))
    n = Vector((sx * rnd.uniform(0.6, 1.0), sy * rnd.uniform(0.6, 1.0), (1 if sz else -1) * rnd.uniform(0.3, 1.0))).normalized()
    cut(bm, bend(c) - n * (rnd.uniform(0.04, 0.08) if sz else rnd.uniform(0.02, 0.04)), n)

def part(val):
    b2 = bmesh.new(); vmap = {}
    for f in bm.faces:
        if f[mark] != val: continue
        vs = []
        for v in f.verts:
            if v.index not in vmap: vmap[v.index] = b2.verts.new(v.co)
            vs.append(vmap[v.index])
        try: b2.faces.new(vs)
        except ValueError: pass
    return b2

holes = [e for e in bm.edges if e.is_boundary]
if holes: bmesh.ops.holes_fill(bm, edges=holes, sides=0)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])      # (on the whole, while it is closed: on a part with the meander taken out, faces turned inward)
print('marked after the cuts', sum(f[mark] for f in bm.faces), 'open edges', len([e for e in bm.edges if e.is_boundary]))
bm.verts.index_update()
body = part(0); mbm = part(1)
print('parted: block', len(body.faces), 'faces, meander', len(mbm.faces), 'faces')
S = 1.04 / H      # (to the causeway stone's size)
for b, name in ((body, 'block'), (mbm, 'meander')):
    for v in b.verts: v.co = Vector((v.co.x * S, v.co.y * S, (v.co.z - Z0) * S))
    me = bpy.data.meshes.new(name); b.to_mesh(me); b.free()
    for p in me.polygons: p.use_smooth = False
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.context.scene.objects:
    if o.name in ('block', 'meander'): o.select_set(True)
bpy.data.objects.remove(ob)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_normals=True, export_materials='NONE')
print('SAVED', OUT)
