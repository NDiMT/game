"""Simulates the cloth that covers the pool being gathered in, hand over hand, and writes it out for the game.

usage: python3.11 -I cloth_sim.py -- <tripo cloth.glb> <out dir> [frames]
The sheet is a regular grid that takes its wrinkles and its colours from the Tripo model. Blender: x east, y north, z up.
She stands east of the sheet and hauls it towards her. Along three lines (the middle and two sides) small patches of
the cloth are moved by hand: they slide east at the hauling speed and the side ones draw in towards the middle; each
patch of the middle line is lifted to her waist by one hand and dropped on the heap at her feet. Everything else
is left to the simulation.
Out: sheet.bin (float32, every 2nd frame, [frame][vertex] x y z in metres, sheet centre at the origin),
     sheet.json (grid size, frames, the grabs: vertex and frames), sheet.png (the colours, seen from above).
"""
import bpy, sys, json, math
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
a = sys.argv[sys.argv.index('--') + 1:]
src, out = a[0], a[1]
F = int(a[2]) if len(a) > 2 else 290
LX, LY = 3.2, 4.2            # the sheet: 3.2 m east-west (it lies a metre beyond the pool on her side), 4.2 m north-south
NX, NY = 52, 68
T0 = 20                      # the hauling starts
V = 0.5 / 30.0               # metres a frame
XR = LX / 2 + 0.12           # where her hands take the cloth
NK = 8                       # patches along each line, 0.4 m apart

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
T = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
dg = bpy.context.evaluated_depsgraph_get()
me = T.evaluated_get(dg).to_mesh(); me.transform(T.matrix_world)
vs = [v.co.copy() for v in me.vertices]; tris = []
me.calc_loop_triangles()
uvl = me.uv_layers.active.data
tri_uv = []
for lt in me.loop_triangles:
    tris.append(tuple(lt.vertices)); tri_uv.append([uvl[i].uv.copy() for i in lt.loops])
bvh = BVHTree.FromPolygons(vs, tris)
xs = [v.x for v in vs]; ys = [v.y for v in vs]; zs = [v.z for v in vs]
x0, x1, y0, y1, z0, z1 = min(xs), max(xs), min(ys), max(ys), min(zs), max(zs)
img = None
for im in bpy.data.images:
    if im.size[0] > 8: img = im
W, H = img.size
px = np.array(img.pixels[:], dtype=np.float32).reshape(H, W, 4)

def probe(u, v):
    """height (0..1) and colour of the Tripo cloth at a point of the sheet, u east, v north, both 0..1"""
    p = Vector((x0 + (x1 - x0) * (0.03 + 0.94 * u), y0 + (y1 - y0) * (0.03 + 0.94 * v), z1 + 1.0))
    hit = bvh.ray_cast(p, Vector((0, 0, -1)))
    if hit[0] is None: return None, None
    loc, _, idx, _ = hit
    A, B, C = [vs[i] for i in tris[idx]]
    # barycentric
    v0, v1, v2 = B - A, C - A, loc - A
    d00, d01, d11, d20, d21 = v0.dot(v0), v0.dot(v1), v1.dot(v1), v2.dot(v0), v2.dot(v1)
    den = d00 * d11 - d01 * d01
    if abs(den) < 1e-12: return (loc.z - z0) / (z1 - z0), None
    bv = (d11 * d20 - d01 * d21) / den; bw = (d00 * d21 - d01 * d20) / den; bu = 1 - bv - bw
    uv = tri_uv[idx][0] * bu + tri_uv[idx][1] * bv + tri_uv[idx][2] * bw
    c = px[int(min(max(uv.y, 0), 0.9999) * H), int(min(max(uv.x, 0), 0.9999) * W), :3]
    return (loc.z - z0) / (z1 - z0), c

# the colours, seen from above
TW, TH = 384, 672
tex = np.zeros((TH, TW, 3), dtype=np.float32); miss = np.zeros((TH, TW), dtype=bool)
for j in range(TH):
    for i in range(TW):
        h, c = probe((i + 0.5) / TW, (j + 0.5) / TH)
        if c is None: miss[j, i] = True
        else: tex[j, i] = c
tex[miss] = tex[~miss].mean(0)
# linear -> sRGB, and save
srgb = np.where(tex <= 0.0031308, tex * 12.92, 1.055 * np.power(np.maximum(tex, 1e-6), 1 / 2.4) - 0.055)
o = bpy.data.images.new('sheet', TW, TH)
rgba = np.concatenate([srgb, np.ones((TH, TW, 1), dtype=np.float32)], 2)
o.pixels = rgba.reshape(-1); o.filepath_raw = out + '/sheet.png'; o.file_format = 'PNG'; o.save()

# the sheet
verts = []; faces = []; heights = []
for j in range(NY + 1):
    for i in range(NX + 1):
        h, _ = probe(i / NX, j / NY)
        heights.append(0.3 if h is None else h)
hmin = min(heights)
for j in range(NY + 1):
    for i in range(NX + 1):
        verts.append((-LX / 2 + LX * i / NX, -LY / 2 + LY * j / NY, 0.02 + (heights[j * (NX + 1) + i] - hmin) * 0.2))
for j in range(NY):
    for i in range(NX):
        k = j * (NX + 1) + i
        faces.append((k, k + 1, k + NX + 2, k + NX + 1))
m = bpy.data.meshes.new('sheet'); m.from_pydata(verts, [], faces); m.update()
ob = bpy.data.objects.new('sheet', m); bpy.context.scene.collection.objects.link(ob)
# the patches that are moved by hand
def ss(x): x = min(max(x, 0.0), 1.0); return x * x * (3 - 2 * x)
patches = []   # line (-1, 0, 1), k, vertex ids, rest centre, arrival frame
pin = ob.vertex_groups.new(name='pin')
for line in (-1, 0, 1):
    for k in range(NK):
        c = Vector((LX / 2 - 0.06 - 0.4 * k, line * 1.15, 0.0))
        ids = [n for n, v in enumerate(verts) if (Vector((v[0], v[1], 0)) - c).length < 0.085]
        pin.add(ids, 1.0, 'REPLACE')
        arr = T0 + int(round((XR - c.x) / V))
        patches.append({'line': line, 'k': k, 'ids': ids, 'c': c, 'arr': arr, 'rest': [Vector(verts[n]) for n in ids]})
def place(pt, f):
    """where the centre of a patch is at frame f, as an offset from where it lay"""
    c, arr, k, line = pt['c'], pt['arr'], pt['k'], pt['line']
    slid = min(max(f - T0, 0), arr - T0) * V                      # it slides east until it reaches her
    prog = slid / max(XR - c.x, 1e-6)
    x = c.x + slid; y = c.y; z = 0.0
    if line == 0:
        z = 0.5 * ss((slid - (XR - c.x - 0.3)) / 0.3) if XR - c.x > 0.3 else 0.5 * ss(prog)   # the taut cloth rises to her hand
        if f > arr:                                                # to her waist, then dropped on the heap
            u = ss((f - arr) / 10.0); d = ss((f - arr - 10) / 8.0)
            hx = XR - 0.38 + 0.13 * (k % 3); hy = (0.1 + 0.05 * k) * (1 if k % 2 else -1); hz = 0.06 + 0.018 * k   # the heap lies in front of her, low and spread
            x = XR + (XR + 0.18 - XR) * u; z = 0.5 + 0.4 * u
            x = x + (hx - x) * d; y = hy * d; z = z + (hz - z) * d
    else:
        y = c.y * (1.0 - 0.8 * ss(prog))                           # the sides draw in as they come
        z = (0.02 + 0.012 * k) * ss(prog)
        x = c.x + slid - 0.34 * ss(prog) - 0.05 * (k % 2)
    return Vector((x - c.x, y - c.y, z))
# each patch hangs on a hook, and the hook is keyed for every frame. (Moving the vertices of the mesh itself would
# throw the simulation away at every step.)
bpy.context.view_layer.update()
for n_, pt in enumerate(patches):
    g = ob.vertex_groups.new(name='p%d' % n_); g.add(pt['ids'], 1.0, 'REPLACE')
    em = bpy.data.objects.new('h%d' % n_, None); bpy.context.scene.collection.objects.link(em)
    em.location = pt['c']; bpy.context.view_layer.update()
    hk = ob.modifiers.new('hook%d' % n_, 'HOOK'); hk.object = em; hk.vertex_group = g.name; hk.matrix_inverse = em.matrix_world.inverted()
    for f in range(1, F + 1):
        em.location = pt['c'] + place(pt, f); em.keyframe_insert('location', frame=f)
cl = ob.modifiers.new('cloth', 'CLOTH'); cs = cl.settings
cs.quality = 12; cs.mass = 0.25; cs.tension_stiffness = 18; cs.compression_stiffness = 18; cs.shear_stiffness = 6; cs.bending_stiffness = 0.22
cs.tension_damping = 6; cs.compression_damping = 6; cs.shear_damping = 6; cs.bending_damping = 0.5; cs.air_damping = 1.5
cs.vertex_group_mass = 'pin'; cs.pin_stiffness = 1.0
cc = cl.collision_settings; cc.use_collision = True; cc.distance_min = 0.012; cc.use_self_collision = True; cc.self_distance_min = 0.012; cc.self_friction = 6; cc.collision_quality = 4
bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, 0)); gr = bpy.context.active_object
gr.modifiers.new('col', 'COLLISION'); gr.collision.cloth_friction = 5; gr.collision.thickness_outer = 0.012; gr.collision.damping = 0.6
# she herself: the cloth must heap in front of her, not through her legs
bpy.ops.mesh.primitive_cylinder_add(radius=0.24, depth=1.4, location=(XR + 0.42, 0, 0.7)); body = bpy.context.active_object
body.modifiers.new('col', 'COLLISION'); body.collision.cloth_friction = 3; body.collision.thickness_outer = 0.015
sc = bpy.context.scene; sc.frame_start = 1; sc.frame_end = F; sc.render.fps = 30
cl.point_cache.frame_start = 1; cl.point_cache.frame_end = F
frames = []
for f in range(1, F + 1):
    sc.frame_set(f)
    dg = bpy.context.evaluated_depsgraph_get(); e = ob.evaluated_get(dg); me2 = e.to_mesh()
    co = np.empty(len(me2.vertices) * 3, dtype=np.float32); me2.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    if f % 2 == 1: frames.append(co.copy())
    if f % 20 == 0: print('frame', f, 'x', round(float(co[:, 0].min()), 2), round(float(co[:, 0].max()), 2), 'y', round(float(co[:, 1].min()), 2), round(float(co[:, 1].max()), 2), 'z max', round(float(co[:, 2].max()), 2), 'z min', round(float(co[:, 2].min()), 3), flush=True)
    e.to_mesh_clear()
arr = np.stack(frames)   # [n, V, 3] in Blender axes
np.asarray(arr, dtype='<f4').tofile(out + '/sheet.bin')
grabs = [{'v': pt['ids'][len(pt['ids']) // 2], 'arr': pt['arr'], 'waist': pt['arr'] + 10, 'drop': pt['arr'] + 18} for pt in patches if pt['line'] == 0]
json.dump({'nx': NX, 'ny': NY, 'lx': LX, 'ly': LY, 'frames': len(frames), 'step': 2, 'fps': 30, 't0': T0, 'end': F, 'xr': XR, 'grabs': grabs}, open(out + '/sheet.json', 'w'))
print('wrote', arr.shape, [g['arr'] for g in grabs])
