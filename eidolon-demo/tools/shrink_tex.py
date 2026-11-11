# Re-saves a model with its pictures no larger than a given size (for a phone: a 2048 picture costs four times the
# memory of a 1024 one). usage: python3.11 -I shrink_tex.py -- <in.glb> <out.glb> <largest side>
import bpy, sys
a = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a[0])
for im in bpy.data.images:
    w, h = im.size
    if max(w, h) > int(a[2]):
        k = int(a[2]) / max(w, h); im.scale(max(1, int(w * k)), max(1, int(h * k))); print("SHRINK", im.name[:30], w, h, "->", im.size[:])
bpy.ops.export_scene.gltf(filepath=a[1], export_format='GLB', export_image_format='AUTO')
