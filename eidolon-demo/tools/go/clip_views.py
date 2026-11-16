"""A clip of the heroine's rig, frame by frame, from the side and the front: to see what her legs do.
usage: python3.11 -I clip_views.py -- <rig.glb> <clip> <out.png> <frames,comma,separated>"""
import bpy, sys, math, os
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]
glb, clip, out, frames = a[0], a[1], a[2], [int(x) for x in a[3].split(',')]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
sc = bpy.context.scene
arm = next(o for o in sc.objects if o.type == 'ARMATURE')
act = next((ac for ac in bpy.data.actions if ac.name.split('|')[-1] == clip or ac.name == clip or ac.name.endswith(clip)), None)
print('ACTIONS', [ac.name for ac in bpy.data.actions], 'using', act.name if act else None)
arm.animation_data_create(); arm.animation_data.action = act
for o in sc.objects:
    if o.type == 'MESH' and o.parent is not None and o != max((m for m in sc.objects if m.type == 'MESH'), key=lambda m: len(m.data.polygons)): o.hide_render = True
mat = bpy.data.materials.new('m'); mat.diffuse_color = (0.85, 0.8, 0.78, 1)
for o in sc.objects:
    if o.type == 'MESH': o.data.materials.clear(); o.data.materials.append(mat)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = float(os.environ.get('OS', '1.15'))
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun); sun.data.energy = 3.0
sun.rotation_euler = Vector((0.4, -0.5, -0.8)).to_track_quat('-Z', 'Y').to_euler()
w = bpy.data.worlds.new('w'); sc.world = w; w.color = (0.55, 0.55, 0.6)
sc.render.engine = 'CYCLES'; sc.cycles.samples = 8; sc.cycles.device = 'CPU'; sc.render.resolution_x = 300; sc.render.resolution_y = 345
import numpy as np
from PIL import Image
tiles = []
VIEWS = {'side': Vector((1, 0, 0)), 'front': Vector((0, -1, 0)), 'game': Vector((-0.58, 0.58, 0.57)).normalized(), 'side2': Vector((-1, 0, 0))}
import os
for view in os.environ.get('VIEWS', 'side,front').split(','):
    d = VIEWS[view]
    row = []
    for f in frames:
        sc.frame_set(f)
        cam.location = Vector((0, 0, float(os.environ.get('CZ', '0.5')))) + d * 10.0
        cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
        p = '/tmp/_cv_%s_%d.png' % (view, f); sc.render.filepath = p; bpy.ops.render.render(write_still=True)
        row.append(np.asarray(Image.open(p).convert('RGB')))
    tiles.append(np.concatenate(row, axis=1))
Image.fromarray(np.concatenate(tiles, axis=0)).save(out); print('SAVED', out)
