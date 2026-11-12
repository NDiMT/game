# Gives a prepared prop (one already sorted into parts by flat_prop.py) its true size: scales it so that its longest
# side has the given length, and leaves it on the ground about the origin. For small things the game places as made.
# the bronze key: flat_prop.py -- raw.glb flat.glb "gold=#d4a24a,gold=#b9793f,gold=#8a5a30,gold=#e9e6e0,crim=#c81e2c" - 0 - "crim:x<-0.2", then this with 0.30
# usage: python3.11 -I size_prop.py -- <in.glb> <out.glb> <length of its longest side, metres>
import bpy, sys
a = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a[0])
obs = [o for o in bpy.data.objects if o.type == 'MESH']
for o in obs: o.select_set(True)
bpy.context.view_layer.objects.active = obs[0]
if len(obs) > 1: bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
me = ob.data
lo = [min(v.co[i] for v in me.vertices) for i in range(3)]; hi = [max(v.co[i] for v in me.vertices) for i in range(3)]
k = float(a[2]) / max(hi[i] - lo[i] for i in range(3))
for v in me.vertices: v.co = ((v.co.x - (lo[0] + hi[0]) / 2) * k, (v.co.y - (lo[1] + hi[1]) / 2) * k, (v.co.z - lo[2]) * k)
for p in me.polygons: p.use_smooth = False
print("SIZED", a[1].split('/')[-1], "x %.3f, depth %.3f, up %.3f" % tuple((hi[i] - lo[i]) * k for i in range(3)), "triangles", sum(len(p.vertices) - 2 for p in me.polygons), "parts", [m.name for m in me.materials])
bpy.ops.export_scene.gltf(filepath=a[1], export_format='GLB', export_apply=True)
