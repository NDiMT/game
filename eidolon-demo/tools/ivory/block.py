"""The meander stone of Eidolon GO's ivory level, cut as by hand: a block a little taller than wide, its faces not
quite flat, its edges eased unevenly, a chip gone from a corner here and there, a Greek key cut into each side; the
shade of its grooves baked into its vertices. Its foot is at the origin.

usage: python3.11 -I tools/ivory/block.py -- <out.glb> [seed]
"""
import bpy, bmesh, math, random, sys
from mathutils import Vector

a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = a[0] if a else 'goiv/block.glb'
rnd = random.Random(int(a[1]) if len(a) > 1 else 5)
S, H = 0.72, 0.84      # its width and height (as the game's _ivp_block)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def G(x, y, z): return Vector((x, -z, y))      # the game's axes (y up) to Blender's


def box(bm, lo, hi):
    x0, y0, z0 = lo; x1, y1, z1 = hi
    v = [bm.verts.new(G(*p)) for p in [(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1), (x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)]]
    for f in [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]: bm.faces.new([v[i] for i in f])


def obj(bm, name):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); scene.collection.objects.link(ob)
    return ob


# the block: cut finer first (so its faces can be a little uneven), its edges eased
bm = bmesh.new(); box(bm, (-S / 2, 0, -S / 2), (S / 2, H, S / 2))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=3, use_grid_fill=True)
for v in bm.verts:      # (no face quite flat)
    v.co += Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))) * 0.0035
bmesh.ops.bevel(bm, geom=[e for e in bm.edges if e.calc_face_angle(0) > 0.5], offset=0.018, segments=2, affect='EDGES', profile=0.6, clamp_overlap=True)
B = obj(bm, 'block')

# chips: a few corners and edges with a piece gone (cutters taken away from the block)
cutters = []
for k in range(4):
    sx, sy, sz = rnd.choice((-1, 1)), rnd.choice((0, 1)), rnd.choice((-1, 1))
    c = Vector((sx * S / 2, sy * H, sz * S / 2))
    if rnd.random() < 0.5: c.x *= rnd.uniform(-0.6, 0.6)      # (along an edge, not at a corner)
    r = rnd.uniform(0.035, 0.06)
    bmc = bmesh.new()
    bmesh.ops.create_icosphere(bmc, subdivisions=1, radius=r)
    for v in bmc.verts: v.co = Vector((v.co.x * rnd.uniform(0.8, 1.3), v.co.y * rnd.uniform(0.8, 1.3), v.co.z * rnd.uniform(0.6, 1.0))) + G(c.x, c.y, c.z)
    bmesh.ops.recalc_face_normals(bmc, faces=bmc.faces[:])
    cutters.append(obj(bmc, 'chip%d' % k))

# the key on each side: grooves along its path (as the game's own block draws it)
u = S / 7.0; hu = H / 7.0; bw = u * 0.72; dep = 0.03
key = [(1, 1), (6, 1), (6, 6), (1.9, 6), (1.9, 2.9), (4.1, 2.9), (4.1, 4.1)]
for f in range(4):
    ang = math.pi * 0.5 * f
    out = Vector((math.sin(ang), 0, math.cos(ang))); right = Vector((math.cos(ang), 0, -math.sin(ang)))
    org = out * (S * 0.5) - right * (S * 0.5)
    bmc = bmesh.new()
    for k in range(len(key) - 1):
        a_, b_ = key[k], key[k + 1]
        pa = org + right * (a_[0] * u) + Vector((0, a_[1] * hu, 0)); pb = org + right * (b_[0] * u) + Vector((0, b_[1] * hu, 0))
        d = (pb - pa); L = d.length; d.normalize()
        side = d.cross(out).normalized() * (bw * 0.5)
        e0 = pa - d * (bw * 0.5); e1 = pb + d * (bw * 0.5)
        pts = [e0 - side - out * dep, e1 - side - out * dep, e1 + side - out * dep, e0 + side - out * dep,
               e0 - side + out * dep, e1 - side + out * dep, e1 + side + out * dep, e0 + side + out * dep]
        v = [bmc.verts.new(G(p.x, p.y, p.z)) for p in pts]
        for fc in [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]:
            try: bmc.faces.new([v[i] for i in fc])
            except ValueError: pass
    bmesh.ops.recalc_face_normals(bmc, faces=bmc.faces[:])
    cutters.append(obj(bmc, 'key%d' % f))

bpy.ops.object.select_all(action='DESELECT')
for c in cutters: c.select_set(True)
bpy.context.view_layer.objects.active = cutters[0]
bpy.ops.object.join()
CUT = bpy.context.view_layer.objects.active
mod = B.modifiers.new('cut', 'BOOLEAN'); mod.operation = 'DIFFERENCE'; mod.solver = 'EXACT'; mod.object = CUT
mod.use_self = True; mod.use_hole_tolerant = True
bpy.context.view_layer.objects.active = B
bpy.ops.object.modifier_apply(modifier='cut')
bpy.data.objects.remove(CUT)
print('TRIS', len(B.data.polygons))

# the shade of its grooves and chips, into its vertices
scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'; scene.cycles.samples = 96
w = bpy.data.worlds.new('w'); scene.world = w; w.light_settings.distance = 0.06
scene.render.bake.target = 'VERTEX_COLORS'
mat = bpy.data.materials.new('block'); B.data.materials.append(mat)
ca = B.data.color_attributes.new('ao', 'BYTE_COLOR', 'CORNER'); B.data.color_attributes.active_color = ca
bpy.ops.object.select_all(action='DESELECT'); B.select_set(True); bpy.context.view_layer.objects.active = B
bpy.ops.object.bake(type='AO')
kw = dict(filepath=OUT, export_format='GLB', use_selection=True, export_apply=True, export_normals=True)
for extra in (dict(export_vertex_color='ACTIVE'), dict(export_colors=True), {}):
    try:
        bpy.ops.export_scene.gltf(**kw, **extra); print('EXPORTED'); break
    except TypeError as e:
        print('retry', e)
print('DONE')
