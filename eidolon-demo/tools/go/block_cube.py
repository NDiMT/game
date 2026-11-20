"""The fourth level's block: a true cube, the same carved and uneven stone as the second level's block
(tools/go/block_meander.py), its meander on all six faces, so it reads the same however it lands as it tumbles (the
owner, 20/11: "the cube looks rectangular rather than square, not the same height on every side").

  - A cube of the first trials' block's width (0.726 m in its own units), its square spiral meander (the same key as
    goiv/block.glb's, laid square) cut 3.3 cm into each of its six faces by a boolean.
  - The meander as cut by hand: its outline wavers, its width and depth vary (each face's own smooth field, the same for
    a groove's rim and its floor, so its walls stay walls; long edges about it cut short first).
  - Each face a little out of true its own way; a few corners broken off aslant.
  - Parted in two, block and meander, so the game can colour the meander (and light it); made SIDE metres on a side,
    its foot at its origin.

usage: python3.11 -I tools/go/block_cube.py -- <out.glb> [side metres] [seed]
"""
import bpy, bmesh, sys, random, math
from mathutils import Vector, noise

a = sys.argv[sys.argv.index('--') + 1:]
OUT = a[0]; SIDE = float(a[1]) if len(a) > 1 else 0.92; SEED = int(a[2]) if len(a) > 2 else 11
rnd = random.Random(SEED)
bpy.ops.wm.read_factory_settings(use_empty=True)

L = 0.726; HF = L / 2.0      # (the source block's width, and half of it)
DEPTH = 0.033
# the key, in a face's own square (s across, t up, -0.5..0.5): a band from the lower left along the bottom, up the right,
# back along the top, down the left, along the inner bottom and up into the middle, as the first block's
BARS = [(-0.40, 0.40, -0.40, -0.305), (0.305, 0.40, -0.40, 0.40), (-0.28, 0.40, 0.305, 0.40), (-0.28, -0.185, -0.12, 0.40),
        (-0.28, 0.13, -0.12, -0.025), (0.035, 0.13, -0.12, 0.14)]
# the six faces: (outward normal, s axis, t axis); the key turned a different way on each
FACES = [(Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))), (Vector((-1, 0, 0)), Vector((0, -1, 0)), Vector((0, 0, 1))),
         (Vector((0, 1, 0)), Vector((-1, 0, 0)), Vector((0, 0, 1))), (Vector((0, -1, 0)), Vector((1, 0, 0)), Vector((0, 0, 1))),
         (Vector((0, 0, 1)), Vector((1, 0, 0)), Vector((0, 1, 0))), (Vector((0, 0, -1)), Vector((1, 0, 0)), Vector((0, -1, 0)))]
TURN = [0, 1, 2, 3, 1, 2]      # (quarter turns of the key on each face)

def key_rects(k):
    q = TURN[k]
    for (s0, s1, t0, t1) in BARS:
        for _ in range(q): s0, s1, t0, t1 = -t1, -t0, s0, s1      # (a quarter turn of the rectangle in the face)
        yield s0, s1, t0, t1

# the cube, centred, and the cutter: a thin box for every bar of every face, reaching out past the face
me = bpy.data.meshes.new('cube'); bm = bmesh.new(); bmesh.ops.create_cube(bm, size=L); bm.to_mesh(me); bm.free()
cube = bpy.data.objects.new('cube', me); bpy.context.scene.collection.objects.link(cube)
cm = bpy.data.meshes.new('cut'); cb = bmesh.new()
for k, (n, sa, ta) in enumerate(FACES):
    for (s0, s1, t0, t1) in key_rects(k):
        c = n * (HF - DEPTH * 0.5 + 0.01) + sa * ((s0 + s1) * 0.5 * L) + ta * ((t0 + t1) * 0.5 * L)
        r = bmesh.ops.create_cube(cb, size=1.0)
        hs = Vector(((s1 - s0) * L, (t1 - t0) * L, DEPTH + 0.02))
        for v in r['verts']:
            p = v.co.copy()
            v.co = c + sa * (p.x * hs.x) + ta * (p.y * hs.y) + n * (p.z * hs.z)
cb.to_mesh(cm); cb.free()
cut = bpy.data.objects.new('cut', cm); bpy.context.scene.collection.objects.link(cut)
mod = cube.modifiers.new('cut', 'BOOLEAN'); mod.operation = 'DIFFERENCE'; mod.object = cut; mod.solver = 'EXACT'
mod.use_self = True; mod.use_hole_tolerant = True
dg = bpy.context.evaluated_depsgraph_get()
ev = cube.evaluated_get(dg)
bm = bmesh.new(); bm.from_mesh(ev.to_mesh())
ev.to_mesh_clear()
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(0.05), verts=bm.verts[:], edges=bm.edges[:])
print('cut: faces', len(bm.faces), 'verts', len(bm.verts))

def side_of(co):      # (the face a point lies nearest, its across and its up there, how deep under it, how far from its edges)
    k = max(range(6), key=lambda i: co.dot(FACES[i][0]))
    n, sa, ta = FACES[k]
    u, v = co.dot(sa), co.dot(ta)
    def sm(e0, e1, x):
        t = min(max((x - e0) / (e1 - e0), 0.0), 1.0); return t * t * (3.0 - 2.0 * t)
    w = (1.0 - sm(HF - 0.075, HF - 0.035, abs(u))) * (1.0 - sm(HF - 0.075, HF - 0.035, abs(v)))
    return k, n, sa, ta, HF - co.dot(n), u, v, w

mark = bm.faces.layers.int.new('mea')
for f in bm.faces:
    c = f.calc_center_median(); k, n, sa, ta, depth, u, v, w = side_of(c)
    f[mark] = 1 if (0.003 < depth < DEPTH + 0.008 and abs(u) < HF * 0.83 and abs(v) < HF * 0.83) else 0
print('meander faces', sum(f[mark] for f in bm.faces))

# the meander uneven, as cut by hand (as tools/go/block_meander.py)
WOB = (0.02, 0.0125, 0.015)
SEG = 0.035
def split_long(e):
    A, B = e.verts[0].co.copy(), e.verts[1].co.copy(); n = int((B - A).length / SEG) + 1
    cur = e
    for i in range(1, n):
        P = A + (B - A) * (i / n)
        a0 = cur.verts[0] if (cur.verts[0].co - A).length < (cur.verts[1].co - A).length else cur.verts[1]
        ne, nv = bmesh.utils.edge_split(cur, a0, (P - a0.co).length / cur.calc_length())
        nv.co = P
        cur = ne if B.to_tuple(6) in [x.co.to_tuple(6) for x in ne.verts] else cur
long_es = [e for e in bm.edges if e.calc_length() > SEG and any(f[mark] for f in e.link_faces) and side_of((e.verts[0].co + e.verts[1].co) * 0.5)[7] > 0.0]
for e in long_es: split_long(e)
noise.seed_set(SEED)
moved = 0
for v in bm.verts:
    k, n, sa, ta, depth, u, vv, w = side_of(v.co)
    if w <= 0.0 or depth < -0.01 or depth > DEPTH + 0.017: continue
    q = Vector((u, vv, 0.0))
    d1 = noise.noise_vector(q / 0.2 + Vector((0.0, 0.0, 3.1 * k + 0.5)))
    d2 = noise.noise_vector(q / 0.09 + Vector((0.0, 0.0, 7.3 * k + 11.5)))
    off = sa * (WOB[0] * d1.x + WOB[1] * d2.x) + ta * (WOB[0] * d1.y + WOB[1] * d2.y)
    if depth > 0.018: off -= n * WOB[2] * noise.noise(q / 0.09 + Vector((0.0, 0.0, 5.7 * k + 23.0)))
    v.co += off * w; moved += 1
bmesh.ops.triangulate(bm, faces=bm.faces[:], quad_method='BEAUTY', ngon_method='BEAUTY')
print('uneven: verts moved', moved, 'faces', len(bm.faces))

LEAN = [(rnd.uniform(-0.022, 0.022), rnd.uniform(-0.022, 0.022)) for _ in range(6)]      # (each face out of true its own way)
def bend(co):
    p = co.copy()
    for k, (n, sa, ta) in enumerate(FACES):
        s = co.dot(n)
        if s > 0:
            w = s / HF
            p += n * w * (LEAN[k][0] * co.dot(sa) / HF + LEAN[k][1] * co.dot(ta) / HF)
    return p
for v in bm.verts: v.co = bend(v.co)

def cutp(b, co, no):
    geom = b.verts[:] + b.edges[:] + b.faces[:]
    r = bmesh.ops.bisect_plane(b, geom=geom, dist=1e-6, plane_co=co, plane_no=no, clear_outer=True)
    edges = [e for e in r['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
    if edges:
        made = bmesh.ops.holes_fill(b, edges=edges, sides=0)
        for f in made.get('faces', []): f[mark] = 0
corners = [(sx, sy, sz) for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)]
rnd.shuffle(corners)
for (sx, sy, sz) in corners[:5]:      # (corners broken off aslant, each its own size)
    c = Vector((sx * HF, sy * HF, sz * HF))
    n = Vector((sx * rnd.uniform(0.6, 1.0), sy * rnd.uniform(0.6, 1.0), sz * rnd.uniform(0.6, 1.0))).normalized()
    cutp(bm, bend(c) - n * rnd.uniform(0.03, 0.065), n)

holes = [e for e in bm.edges if e.is_boundary]
if holes: bmesh.ops.holes_fill(bm, edges=holes, sides=0)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
bm.verts.index_update()
print('marked after the cuts', sum(f[mark] for f in bm.faces), 'open edges', len([e for e in bm.edges if e.is_boundary]))

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
body = part(0); mbm = part(1)
print('parted: block', len(body.faces), 'faces, meander', len(mbm.faces), 'faces')
S = SIDE / L
for b, name in ((body, 'block'), (mbm, 'meander')):
    for v in b.verts: v.co = Vector((v.co.x * S, v.co.y * S, (v.co.z + HF) * S))      # (its foot at its origin)
    m2 = bpy.data.meshes.new(name); b.to_mesh(m2); b.free()
    for p in m2.polygons: p.use_smooth = False
    o = bpy.data.objects.new(name, m2); bpy.context.scene.collection.objects.link(o)
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.context.scene.objects:
    if o.name in ('block', 'meander'): o.select_set(True)
bpy.data.objects.remove(cube); bpy.data.objects.remove(cut)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_normals=True, export_materials='NONE')
print('SAVED', OUT)
