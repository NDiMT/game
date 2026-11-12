# lighten a prepared prop (the output of tools/flat_prop.py): fewer faces, the same parts
# usage: python3.11 -I decimate.py -- <in.glb> <out.glb> <ratio> [check.png]
import bpy, sys, mathutils
a = sys.argv[sys.argv.index('--') + 1:]
src, out, ratio = a[0], a[1], float(a[2]); check = a[3] if len(a) > 3 else ""
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
obs = [o for o in bpy.data.objects if o.type == 'MESH']
for o in obs: o.select_set(True)
bpy.context.view_layer.objects.active = obs[0]
if len(obs) > 1: bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active
n0 = len(ob.data.polygons)
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.remove_doubles(threshold=0.0005); bpy.ops.object.mode_set(mode='OBJECT')
m = ob.modifiers.new('d', 'DECIMATE'); m.ratio = ratio; m.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier='d')
for p in ob.data.polygons: p.use_smooth = False
print("FACES", n0, "->", len(ob.data.polygons), {mt.name: sum(1 for p in ob.data.polygons if ob.data.materials[p.material_index] == mt) for mt in ob.data.materials})
if check:
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 8; sc.cycles.use_denoising = False; sc.render.resolution_x = 400; sc.render.resolution_y = 400
    w = bpy.data.worlds.new('w'); w.use_nodes = True; w.node_tree.nodes["Background"].inputs[0].default_value = (0.5, 0.5, 0.5, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 0.8; sc.world = w
    sl = bpy.data.lights.new('s', 'SUN'); sl.energy = 2.5; so = bpy.data.objects.new('s', sl); sc.collection.objects.link(so); so.rotation_euler = (0.9, 0.1, 0.5)
    cd = bpy.data.cameras.new('c'); c = bpy.data.objects.new('c', cd); sc.collection.objects.link(c); sc.camera = c
    xs = [v.co.x for v in ob.data.vertices]; ys = [v.co.y for v in ob.data.vertices]; zs = [v.co.z for v in ob.data.vertices]
    hgt = max(zs) - min(zs); wid = max(max(xs) - min(xs), max(ys) - min(ys)); r = max(hgt, wid) * 2.4
    c.location = (r * 0.5, -r * 0.8, hgt * 0.5 + r * 0.45); d = mathutils.Vector((0, 0, hgt * 0.45)) - c.location; c.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler(); cd.lens = 60
    sc.render.filepath = check; bpy.ops.render.render(write_still=True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_apply=True)
