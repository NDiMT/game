"""The heroine's clip as the game shows her: her marble and her terracotta (from the data in her vertex colours: alpha is
the cloth), lit by the level's sun, on a white slab, from the game's own eye (orthographic, 35 deg down), with her turned
as she is in the level. Each row is one eye, each column one frame of the clip.
usage: python3.11 -I hero_look.py -- <rig.glb> <clip> <out.png> <frames,comma,separated>
  env: PHI="0"     her facing in the level, degrees (0 = along -z, the way of the waking's path; 90 = toward -x)
       EYES="game" eyes, comma separated: game (the level's camera), side (from her left), front, back, or a number = the
                   game's eye turned round her by that many degrees
       SIZE="1.25" metres the view holds across; CZ="0.45" the height looked at; W="360" H="460" the tile in pixels
       KEY="-0.45,0.82,-0.15" the level's sun (Godot axes, toward the light); SAMPLES="12"
"""
import bpy, sys, math, os
import numpy as np
from mathutils import Vector
from PIL import Image
a = sys.argv[sys.argv.index('--') + 1:]
glb, clip, out, frames = a[0], a[1], a[2], [int(x) for x in a[3].split(',')]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
sc = bpy.context.scene
arm = next(o for o in sc.objects if o.type == 'ARMATURE')
act = next((ac for ac in bpy.data.actions if ac.name.split('|')[-1] == clip or ac.name == clip or ac.name.endswith(clip)), None)
print('ACTIONS', [ac.name for ac in bpy.data.actions], 'using', act.name if act else None)
arm.animation_data_create(); arm.animation_data.action = act
try:
    if act.slots: arm.animation_data.action_slot = act.slots[0]
except Exception: pass
body = max((m for m in sc.objects if m.type == 'MESH'), key=lambda m: len(m.data.polygons))
for o in sc.objects:
    if o.type == 'MESH' and o != body: o.hide_render = True

# ---- her look: marble and terracotta by the cloth mask (vertex alpha), the data's light and dark (R) and shade (B)
mat = bpy.data.materials.new('her'); mat.use_nodes = True; nt = mat.node_tree
for n in list(nt.nodes): nt.nodes.remove(n)
outn = nt.nodes.new('ShaderNodeOutputMaterial'); bs = nt.nodes.new('ShaderNodeBsdfPrincipled')
ca = nt.nodes.new('ShaderNodeVertexColor')
if body.data.color_attributes: ca.layer_name = body.data.color_attributes[0].name
sep = nt.nodes.new('ShaderNodeSeparateColor'); nt.links.new(ca.outputs['Color'], sep.inputs['Color'])
mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'
mix.inputs[6].default_value = (0.93, 0.9, 0.87, 1.0); mix.inputs[7].default_value = (0.55, 0.22, 0.13, 1.0)
cl = nt.nodes.new('ShaderNodeMapRange'); cl.inputs[1].default_value = 0.4; cl.inputs[2].default_value = 0.6      # (the cloth's edge drawn sharp)
nt.links.new(ca.outputs['Alpha'], cl.inputs[0]); nt.links.new(cl.outputs[0], mix.inputs[0])
tone = nt.nodes.new('ShaderNodeMath'); tone.operation = 'MULTIPLY_ADD'; tone.inputs[1].default_value = 0.9; tone.inputs[2].default_value = 0.55
nt.links.new(sep.outputs[0], tone.inputs[0])
ao = nt.nodes.new('ShaderNodeMapRange'); ao.inputs[1].default_value = 0.0; ao.inputs[2].default_value = 0.9; ao.inputs[3].default_value = 0.6; ao.inputs[4].default_value = 1.0
nt.links.new(sep.outputs[2], ao.inputs[0])
m1 = nt.nodes.new('ShaderNodeMix'); m1.data_type = 'RGBA'; m1.blend_type = 'MULTIPLY'; m1.inputs[0].default_value = 1.0
nt.links.new(mix.outputs[2], m1.inputs[6]); nt.links.new(tone.outputs[0], m1.inputs[7])
m2 = nt.nodes.new('ShaderNodeMix'); m2.data_type = 'RGBA'; m2.blend_type = 'MULTIPLY'; m2.inputs[0].default_value = 1.0
nt.links.new(m1.outputs[2], m2.inputs[6]); nt.links.new(ao.outputs[0], m2.inputs[7])
nt.links.new(m2.outputs[2], bs.inputs['Base Color']); bs.inputs['Roughness'].default_value = 0.85
nt.links.new(bs.outputs[0], outn.inputs[0])
body.data.materials.clear(); body.data.materials.append(mat)
for p in body.data.polygons: p.use_smooth = True

# ---- the slab under her, the level's light, the eye
bpy.ops.mesh.primitive_plane_add(size=3.0, location=(0, 0, 0)); fl = bpy.context.active_object
fm = bpy.data.materials.new('slab'); fm.use_nodes = True; fm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.86, 0.82, 0.86, 1)
fl.data.materials.append(fm)
PHI = math.radians(float(os.environ.get('PHI', '0')))
F = Vector((-math.sin(PHI), 0.0, -math.cos(PHI))); L = Vector((F.z, 0.0, -F.x))      # (her forward and her left, in the level's axes)
def to_her(v):      # a direction in the level's axes (Godot: y up) to hers (Blender: x forward, y left, z up)
    return Vector((v.dot(F), v.dot(L), v.y)).normalized()
key = Vector([float(x) for x in os.environ.get('KEY', '-0.45,0.82,-0.15').split(',')])
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun); sun.data.energy = 3.2; sun.data.angle = math.radians(8)
sun.rotation_euler = (-to_her(key)).to_track_quat('-Z', 'Y').to_euler()
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.86, 0.72, 0.78, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 0.9
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = float(os.environ.get('SIZE', '1.25'))
sc.render.engine = 'CYCLES'; sc.cycles.samples = int(os.environ.get('SAMPLES', '12')); sc.cycles.device = 'CPU'; sc.cycles.use_denoising = False
TW, TH = int(os.environ.get('W', '360')), int(os.environ.get('H', '460')); sc.render.resolution_x = TW; sc.render.resolution_y = TH
GAME = Vector((0.58, 0.57, 0.58)).normalized()      # (toward the game's eye from what it looks at)
def eye(name):
    if name == 'game': return to_her(GAME)
    if name == 'side': return Vector((0, 1, 0.12)).normalized()
    if name == 'front': return Vector((1, 0, 0.12)).normalized()
    if name == 'back': return Vector((-1, 0, 0.3)).normalized()
    t = math.radians(float(name)); g = to_her(GAME); c, s = math.cos(t), math.sin(t)
    return Vector((g.x * c - g.y * s, g.x * s + g.y * c, g.z)).normalized()
rows = []
for en in os.environ.get('EYES', 'game').split(','):
    d = eye(en); row = []
    for f in frames:
        sc.frame_set(f)
        cam.location = Vector((0, 0, float(os.environ.get('CZ', '0.45')))) + d * 10.0
        cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
        p = os.path.join(os.path.dirname(os.path.abspath(out)), '_hl_%s_%d.png' % (en, f)); sc.render.filepath = p; bpy.ops.render.render(write_still=True)
        row.append(np.asarray(Image.open(p).convert('RGB'))); os.remove(p)
    rows.append(np.concatenate(row, axis=1))
Image.fromarray(np.concatenate(rows, axis=0)).save(out); print('SAVED', out)
