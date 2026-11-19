"""a head in the sea, only its face out of the water, seen as the game's eye sees far things (from above at 35 degrees):
usage float2.py -- <out png> <looks up, deg> <leans aside, deg> <turned aside, deg> <water at, 0..1 of its depth> <glb>"""
import bpy, sys, math
from mathutils import Vector, Matrix
a = sys.argv[sys.argv.index('--') + 1:]
out, up, lean, turn, wat, path = a[0], float(a[1]), float(a[2]), float(a[3]), float(a[4]), a[5]
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=path)
obs = [o for o in sc.objects if o.type == 'MESH']
lo = Vector((1e9,) * 3); hi = Vector((-1e9,) * 3)
for o in obs:
    for v in o.data.vertices:
        w = o.matrix_world @ v.co; lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
c0 = (lo + hi) / 2
R = Matrix.Rotation(math.radians(turn), 4, 'Z') @ Matrix.Rotation(math.radians(-up), 4, 'Y') @ Matrix.Rotation(math.radians(lean), 4, 'X')      # (its face along its own +x: leant aside about it, then looking up, then turned)
for o in obs: o.matrix_world = R @ Matrix.Translation(-c0) @ o.matrix_world
bpy.context.view_layer.update()
lo = Vector((1e9,) * 3); hi = Vector((-1e9,) * 3)
for o in obs:
    for v in o.data.vertices:
        w = o.matrix_world @ v.co; lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
ctr = (lo + hi) / 2; size = max(hi - lo)
m = bpy.data.materials.new('marble'); m.use_nodes = True
bs = m.node_tree.nodes['Principled BSDF']; bs.inputs['Base Color'].default_value = (0.93, 0.92, 0.95, 1); bs.inputs['Roughness'].default_value = 0.7
for o in obs:
    o.data.materials.clear(); o.data.materials.append(m)
    for p in o.data.polygons: p.use_smooth = True
wz = lo.z + (hi.z - lo.z) * wat
bpy.ops.mesh.primitive_plane_add(size=size * 14, location=(ctr.x, ctr.y, wz)); sea = bpy.context.active_object
sm = bpy.data.materials.new('sea'); sm.use_nodes = True; sb = sm.node_tree.nodes['Principled BSDF']
sb.inputs['Base Color'].default_value = (0.62, 0.63, 0.72, 1); sb.inputs['Roughness'].default_value = 0.2; sea.data.materials.append(sm)
cam_d = bpy.data.cameras.new('c'); cam_d.type = 'ORTHO'; cam_d.ortho_scale = size * 1.45
cam = bpy.data.objects.new('c', cam_d); sc.collection.objects.link(cam); sc.camera = cam
d = Vector((-math.cos(math.radians(35)), 0, -math.sin(math.radians(35))))      # (the game's eye, looking down at 35 degrees at its face)
tgt = Vector((ctr.x, ctr.y, wz + (hi.z - wz) * 0.45))
cam.location = tgt - d * size * 4; cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 24; sc.cycles.use_denoising = False
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.8, 0.8, 0.88, 1); w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.9
sun = bpy.data.lights.new('s', 'SUN'); sun.energy = 2.6; sun.angle = math.radians(12); so = bpy.data.objects.new('s', sun); sc.collection.objects.link(so)
so.rotation_euler = (-Vector((0.7, -0.5, 0.9))).normalized().to_track_quat('-Z', 'Y').to_euler()
sc.render.resolution_x = 600; sc.render.resolution_y = 600
sc.render.filepath = out; bpy.ops.render.render(write_still=True)
print('DONE', out)
