"""Paints the creases of the Tripo cloth into the sheet's texture: its heights, seen from above, lit from one side.

usage: python3.11 -I cloth_tex.py -- <tripo cloth.glb (the full model)> <out.png>
The game gives the cloth its colour; this picture gives only light and dark.
"""
import bpy, sys
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
a = sys.argv[sys.argv.index('--') + 1:]
src, out = a[0], a[1]
TW, TH = 512, 672
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
T = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
me = T.data.copy(); me.transform(T.matrix_world)
n = len(me.vertices); co = np.empty(n * 3, dtype=np.float32); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
me.calc_loop_triangles(); nt = len(me.loop_triangles); tri = np.empty(nt * 3, dtype=np.int32); me.loop_triangles.foreach_get('vertices', tri); tri = tri.reshape(-1, 3)
bvh = BVHTree.FromPolygons([Vector(c) for c in co], [tuple(t) for t in tri])
x0, y0, z0 = co.min(0); x1, y1, z1 = co.max(0)
Hm = np.full((TH, TW), np.nan, dtype=np.float32)
down = Vector((0, 0, -1))
for j in range(TH):
    y = y0 + (y1 - y0) * (0.03 + 0.94 * (j + 0.5) / TH)
    for i in range(TW):
        hit = bvh.ray_cast(Vector((x0 + (x1 - x0) * (0.03 + 0.94 * (i + 0.5) / TW), y, z1 + 1.0)), down)
        if hit[0] is not None: Hm[j, i] = hit[0].z
Hm[np.isnan(Hm)] = np.nanmean(Hm)
Hm = (Hm - Hm.min()) / (Hm.max() - Hm.min())
def blur(a, r):
    k = np.ones(2 * r + 1, dtype=np.float32) / (2 * r + 1)
    a = np.apply_along_axis(lambda m: np.convolve(np.pad(m, r, mode='edge'), k, mode='valid'), 0, a)
    return np.apply_along_axis(lambda m: np.convolve(np.pad(m, r, mode='edge'), k, mode='valid'), 1, a)
Hs = blur(Hm, 1)
gx = (np.roll(Hs, -1, 1) - np.roll(Hs, 1, 1)) * TW / 2.0      # towards the east
gy = (np.roll(Hs, -1, 0) - np.roll(Hs, 1, 0)) * TH / 2.0      # towards the north
shade = 0.5 * gx + 0.6 * gy                                    # the light comes from the south-west, low
shade = shade / (np.abs(shade).mean() * 4.5)
hollow = (Hs - blur(Hs, 9)) * 2.2                              # what lies low is a little darker
v = np.clip(0.6 + 0.3 * np.tanh(shade) + hollow, 0.08, 1.0)
img = bpy.data.images.new('sheet', TW, TH)
rgba = np.stack([v, v, v, np.ones_like(v)], 2).astype(np.float32)   # row 0 is the south edge, as Blender stores it
img.colorspace_settings.name = 'Non-Color'
img.pixels = rgba.reshape(-1); img.filepath_raw = out; img.file_format = 'PNG'; img.save()
print('wrote', out, 'tris', nt, 'v range', float(v.min()), float(v.max()), float(v.mean()))
