"""A prop through the game's eye (orthographic, yaw 45, pitch 35) at several turns side by side, to choose the turn
that shows the eye what it should see (the Observer: her face).

usage: python3.11 -I tools/go/prop_yaw.py -- <prop.glb> <out.png> <yaw,yaw,...>
"""
import bpy, math, sys
from mathutils import Vector, Euler
a = sys.argv[sys.argv.index('--') + 1:]
glb, out = a[0], a[1]; yaws = [float(v) for v in a[2].split(',')]
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
G = lambda x, y, z: Vector((x, -z, y))
right = G(0.7071, 0, -0.7071)      # (the game's screen right: +x and -z)
for i, yw in enumerate(yaws):
    bpy.ops.import_scene.gltf(filepath=glb)
    obs = [o for o in bpy.context.selected_objects]
    root = bpy.data.objects.new('r%d' % i, None); sc.collection.objects.link(root)
    for o in obs:
        if o.parent is None: o.parent = root
    root.rotation_euler = Euler((0, 0, yw), 'XYZ')      # (a turn about the game's up)
    root.location = right * (i * 1.3)
mat = bpy.data.materials.new('m'); mat.diffuse_color = (0.92, 0.88, 0.86, 1)
for o in sc.objects:
    if o.type == 'MESH': o.data.materials.clear(); o.data.materials.append(mat)
f = G(-0.579, -0.574, -0.579)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = 1.3 * len(yaws) + 0.4
mid = right * (1.3 * (len(yaws) - 1) / 2) + G(0, 0.5, 0)
cam.location = mid - f * 20
cam.rotation_euler = f.to_track_quat('-Z', 'Y').to_euler()
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun)
sun.rotation_euler = G(0.56, -0.72, -0.41).to_track_quat('-Z', 'Z').to_euler()
sc.render.engine = 'CYCLES'; sc.cycles.samples = 16; sc.cycles.device = 'CPU'; sc.render.resolution_x = 300 * len(yaws); sc.render.resolution_y = 360
w = bpy.data.worlds.new('w'); sc.world = w; w.color = (0.6, 0.6, 0.65)
sc.render.filepath = out; bpy.ops.render.render(write_still=True); print('SAVED')
