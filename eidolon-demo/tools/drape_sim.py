"""Drapes a sheet over the world's standing mirror and writes the sheet out as a low-poly mesh.

usage: python3.11 -I drape_sim.py -- <out.glb> <turn of the sheet, radians> <shift x> <shift y> <tie: 1 or 0> [length] [width] [pin]
pin: the sheet is held along the top of the mirror, so that it can hang far more to one side without sliding off
The mirror is the one mirror_stand() builds in the game: a frame 0.86 m wide and 2 m tall on a low base. Blender: x
along the mirror, y through it, z up (the game's x, -z, y). The sheet is a coarse grid, so that it comes out in the
flat facets of the rest of the world; where it is tied, it is drawn in against the mirror afterwards.
"""
import bpy, sys, math
import numpy as np
a = sys.argv[sys.argv.index('--') + 1:]
out, turn, sx, sy, tie = a[0], float(a[1]), float(a[2]), float(a[3]), a[4] == '1'
LX = float(a[6]) if len(a) > 6 and a[6] != 'pin' else 1.5   # not much wider than the mirror: a wide sheet stands out at the sides like wings
LY = float(a[5]) if len(a) > 5 else 3.5
NX, NY = int(round(LX / 0.068)), int(round(LY / 0.075))
PIN = 'pin' in a
bpy.ops.wm.read_factory_settings(use_empty=True)
def box(x0, x1, y0, y1, z0, z1):
    bpy.ops.mesh.primitive_cube_add(size=1, location=((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)); o = bpy.context.active_object
    o.scale = (x1 - x0, y1 - y0, z1 - z0); bpy.ops.object.transform_apply(scale=True)
    o.modifiers.new('col', 'COLLISION'); o.collision.cloth_friction = 22; o.collision.thickness_outer = 0.02; o.collision.damping = 0.8
    return o
box(-0.46, 0.46, -0.06, 0.06, 0.1, 1.97); box(-0.1, 0.1, -0.05, 0.05, 1.97, 2.06); box(-0.44, 0.44, -0.15, 0.15, 0.0, 0.1)
bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, 0)); g = bpy.context.active_object
g.modifiers.new('col', 'COLLISION'); g.collision.cloth_friction = 12; g.collision.thickness_outer = 0.015
verts = []; faces = []
ca, sa = math.cos(turn), math.sin(turn)
for j in range(NY + 1):
    for i in range(NX + 1):
        x = -LX / 2 + LX * i / NX; y = -LY / 2 + LY * j / NY
        verts.append((x * ca - y * sa + sx, x * sa + y * ca + sy, 2.16))
for j in range(NY):
    for i in range(NX):
        k = j * (NX + 1) + i; faces.append((k, k + 1, k + NX + 2, k + NX + 1))
m = bpy.data.meshes.new('sheet'); m.from_pydata(verts, [], faces); m.update()
ob = bpy.data.objects.new('sheet', m); bpy.context.scene.collection.objects.link(ob)
if PIN:
    vg = ob.vertex_groups.new(name='pin'); vg.add([k for k, v in enumerate(verts) if abs(v[1]) < 0.06 and abs(v[0]) < 0.47], 1.0, 'REPLACE')
    for k, v in enumerate(verts):
        if abs(v[1]) < 0.06 and abs(v[0]) < 0.47: m.vertices[k].co.z = 2.0
cl = ob.modifiers.new('cloth', 'CLOTH'); cs = cl.settings
cs.quality = 14; cs.mass = 0.45; cs.tension_stiffness = 22; cs.compression_stiffness = 22; cs.shear_stiffness = 8; cs.bending_stiffness = 0.04   # soft: it must hang close, not stand off like card
cs.tension_damping = 8; cs.compression_damping = 8; cs.shear_damping = 8; cs.bending_damping = 0.6; cs.air_damping = 2.5
if PIN: cs.vertex_group_mass = 'pin'
cc = cl.collision_settings; cc.use_collision = True; cc.distance_min = 0.02; cc.use_self_collision = True; cc.self_distance_min = 0.02; cc.collision_quality = 4
sc = bpy.context.scene; sc.frame_start = 1; sc.frame_end = 230; cl.point_cache.frame_start = 1; cl.point_cache.frame_end = 230
for f in range(1, 231): sc.frame_set(f)
dg = bpy.context.evaluated_depsgraph_get(); e = ob.evaluated_get(dg); me2 = e.to_mesh()
co = np.empty(len(me2.vertices) * 3, dtype=np.float32); me2.vertices.foreach_get('co', co); co = co.reshape(-1, 3).copy(); e.to_mesh_clear()
if tie:   # where the rope goes round, the sheet is drawn in against the mirror
    for zc in (0.72, 1.36):
        w = np.exp(-((co[:, 2] - zc) / 0.12) ** 2) * 0.7
        tx = np.clip(co[:, 0], -0.53, 0.53); ty = np.clip(co[:, 1], -0.12, 0.12)
        co[:, 0] += (tx - co[:, 0]) * w; co[:, 1] += (ty - co[:, 1]) * w
co[:, 2] = np.maximum(co[:, 2], 0.012)
print('RANGE x', co[:, 0].min(), co[:, 0].max(), 'y', co[:, 1].min(), co[:, 1].max(), 'z', co[:, 2].min(), co[:, 2].max())
for o in list(bpy.context.scene.objects): bpy.data.objects.remove(o, do_unlink=True)
m2 = bpy.data.meshes.new('drape'); m2.from_pydata([tuple(map(float, c)) for c in co], [], faces); m2.update()
o2 = bpy.data.objects.new('drape', m2); bpy.context.scene.collection.objects.link(o2); o2.select_set(True); bpy.context.view_layer.objects.active = o2
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True)
print('wrote', out)
