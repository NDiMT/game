"""A statue of few flat faces with the level's light and shade painted into the colours of its faces (the goddess of the
third level: the owner, 18/11, "the first Aphrodite", "light and shade on the first model"). The game shows them as they are
(`baked_k` 2 in IV_SH), so the light is the one baked here: give it in the model's own axes, the world's light turned by
the statue's -turn (the goddess: world 0.72, 0.61, -0.34 at turn -1.2 -> -0.056, 0.61, -0.794).

usage: python3.11 -I tools/go/bake_painted_vc.py -- <in.glb (her flat model)> <out.glb> <samples, 64> "<x,y,z>"
"""
import bpy, sys, math
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]
src, out, samples = a[0], a[1], int(a[2])
key = Vector(tuple(float(x) for x in a[3].split(',')))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
ob = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
me = ob.data
for p in me.polygons: p.use_smooth = False
for ca in list(me.color_attributes): me.color_attributes.remove(ca)
mat = bpy.data.materials.new('marble'); mat.use_nodes = True
bs = mat.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value = (0.93, 0.92, 0.95, 1); bs.inputs['Roughness'].default_value = 0.85
me.materials.clear(); me.materials.append(mat)
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = samples
w = bpy.data.worlds.new('sky'); sc.world = w; w.use_nodes = True
bg = w.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (0.62, 0.62, 0.86, 1); bg.inputs['Strength'].default_value = 0.45
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun)
sun.data.energy = 2.4; sun.data.angle = math.radians(12.0); sun.data.color = (1.0, 0.97, 0.93)
sun.rotation_euler = Vector((key.x, -key.z, key.y)).normalized().to_track_quat('Z', 'Y').to_euler()
ca = me.color_attributes.new('baked', 'BYTE_COLOR', 'CORNER'); me.color_attributes.active_color = ca
bpy.context.view_layer.objects.active = ob; ob.select_set(True)
sc.render.bake.target = 'VERTEX_COLORS'
sc.render.bake.use_pass_direct = True; sc.render.bake.use_pass_indirect = True; sc.render.bake.use_pass_color = True
bpy.ops.object.bake(type='DIFFUSE')
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_vertex_color='ACTIVE', export_normals=True, export_materials='NONE')
print('SAVED', out, len(me.polygons), 'faces')
