"""A Tripo FBX to a game GLB: joined, decimated to a number of triangles, flat faces (or smooth, weighted by area).

usage: python3.11 -I tools/go/fbx2glb.py -- <src.fbx> <out.glb> <triangles> [smooth]
"""
import bpy, sys, math
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]
src, out, tris = a[0], a[1], int(a[2]); smooth = len(a) > 3 and a[3] == 'smooth'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=src)
obs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in obs: o.select_set(True)
bpy.context.view_layer.objects.active = obs[0]
if len(obs) > 1: bpy.ops.object.join()
o = bpy.context.view_layer.objects.active
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
n0 = sum(len(p.vertices) - 2 for p in o.data.polygons)
m = o.modifiers.new('d', 'DECIMATE'); m.ratio = min(1.0, tris / max(1, n0)); bpy.ops.object.modifier_apply(modifier='d')
for p in o.data.polygons: p.use_smooth = smooth
if smooth:      # (soft marble: smooth normals, weighted by face area so broad folds stay broad)
    wm = o.modifiers.new('wn', 'WEIGHTED_NORMAL'); wm.keep_sharp = False; bpy.ops.object.modifier_apply(modifier='wn')
o.data.materials.clear()
for ca in list(o.data.color_attributes): o.data.color_attributes.remove(ca)
for uv in list(o.data.uv_layers): o.data.uv_layers.remove(uv)
vs = [o.matrix_world @ v.co for v in o.data.vertices]
lo = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs))); hi = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
print('TRIS', n0, '->', sum(len(p.vertices) - 2 for p in o.data.polygons), 'BOX', [round(c, 3) for c in lo], [round(c, 3) for c in hi])
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=False, export_apply=True, export_normals=True)
