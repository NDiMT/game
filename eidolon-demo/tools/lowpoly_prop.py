"""Turns a detailed Tripo model into a prop in the style of the world: few faces, and a texture reduced to a handful of
flat colours.

usage: python3.11 -I lowpoly_prop.py -- <in.glb> <out.glb> <triangles> [colours] [remesh]
"""
import bpy, sys
import numpy as np
a = sys.argv[sys.argv.index('--') + 1:]
src, out, target = a[0], a[1], int(a[2]); K = int(a[3]) if len(a) > 3 and a[3].isdigit() else 6
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
for o in bpy.context.scene.objects: o.select_set(o.type == 'MESH')
bpy.context.view_layer.objects.active = objs[0]
if len(objs) > 1: bpy.ops.object.join()
o = bpy.context.view_layer.objects.active
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
if 'remesh' in a:   # thin, open cloth breaks into shards when it is reduced: first make one closed skin of it
    r = o.modifiers.new('r', 'REMESH'); r.mode = 'VOXEL'; r.voxel_size = 0.022; r.adaptivity = 0.0
    bpy.ops.object.modifier_apply(modifier='r')
    sm = o.modifiers.new('s', 'SMOOTH'); sm.factor = 0.8; sm.iterations = 6
    bpy.ops.object.modifier_apply(modifier='s')
tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
m = o.modifiers.new('d', 'DECIMATE'); m.ratio = min(1.0, target / max(tris, 1))
bpy.ops.object.modifier_apply(modifier='d')
for im in bpy.data.images:
    if im.size[0] < 16: continue
    im.scale(256, 256)
    px = np.array(im.pixels[:], dtype=np.float32).reshape(256, 256, 4)
    rgb = px[..., :3].reshape(-1, 3)
    rng = np.random.default_rng(1)
    cen = rgb[rng.choice(len(rgb), K, replace=False)].copy()
    for _ in range(14):   # a few rounds of k-means
        d = ((rgb[:, None, :] - cen[None, :, :]) ** 2).sum(2); lab = d.argmin(1)
        for k in range(K):
            if (lab == k).any(): cen[k] = rgb[lab == k].mean(0)
    px[..., :3] = cen[lab].reshape(256, 256, 3)
    im.pixels = px.reshape(-1)
    print('COLOURS', [[round(float(c), 2) for c in cc] for cc in cen])
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_image_format='AUTO')
print('LOWPOLY', tris, '->', sum(len(p.vertices) - 2 for p in o.data.polygons))
