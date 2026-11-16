"""A plain picture of a level as Blender built it, through the game's eye (orthographic, the same pitch and yaw),
with its things marked (nodes, the faces, the stone, Ione, the ring) and the sea: the layout to paint a concept on.

usage: python3.11 -I tools/go/preview.py -- <level.glb> <level.json> <out.png> [width px] [sea height]
"""
import bpy, json, math, sys
from mathutils import Vector, Euler

a = sys.argv[sys.argv.index('--') + 1:]
GLB, JS, OUT = a[0], a[1], a[2]
PX = int(a[3]) if len(a) > 3 else 1080
SEA = float(a[4]) if len(a) > 4 else None
J = json.load(open(JS))
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
G = lambda x, y, z: Vector((x, -z, y))

bpy.ops.import_scene.gltf(filepath=GLB)
def mat(name, rgb):
    m = bpy.data.materials.new(name); m.diffuse_color = (*rgb, 1.0); m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    if bs: bs.inputs['Base Color'].default_value = (*rgb, 1.0); bs.inputs['Roughness'].default_value = 0.9
    return m
COL = {'marble': (0.93, 0.91, 0.87), 'rock': (0.45, 0.43, 0.42), 'olive': (0.45, 0.48, 0.35), 'bark': (0.4, 0.28, 0.22)}
for o in sc.objects:
    if o.type == 'MESH':
        k = next((k for k in COL if k in o.name.lower()), 'marble')
        o.data.materials.clear(); o.data.materials.append(mat(o.name, COL[k]))

def prim(kind, at, size, rgb, name):
    if kind == 'disc': bpy.ops.mesh.primitive_cylinder_add(radius=size, depth=0.03, location=at)
    elif kind == 'cube': bpy.ops.mesh.primitive_cube_add(size=size, location=at)
    elif kind == 'cyl': bpy.ops.mesh.primitive_cylinder_add(radius=size * 0.25, depth=size, location=at)
    elif kind == 'torus': bpy.ops.mesh.primitive_torus_add(major_radius=size, minor_radius=size * 0.18, location=at)
    elif kind == 'ball': bpy.ops.mesh.primitive_uv_sphere_add(radius=size, location=at)
    o = bpy.context.active_object; o.name = name; o.data.materials.append(mat(name, rgb)); return o

for k, p in J['nodes'].items():
    prim('disc', G(p[0], p[1] + 0.02, p[2]), 0.17, (0.98, 0.97, 0.95), 'node_' + k)
for p, d in (J.get('faces') or []):
    prim('cube', G(p[0], p[1] + 0.2, p[2]), 0.4, (0.85, 0.83, 0.8), 'plinth')
    prim('ball', G(p[0], p[1] + 0.62, p[2]), 0.24, (0.95, 0.93, 0.9), 'face')
    prim('ball', G(p[0] + d[0] * 0.2, p[1] + 0.66, p[2] + d[2] * 0.2), 0.07, (0.15, 0.12, 0.1), 'eye')
if J.get('stone'):
    p = J['stone']; prim('cube', G(p[0], p[1] + 0.36, p[2]), 0.72, (0.9, 0.86, 0.8), 'stone')
p = J['nodes'][J.get('start', 'S')] if isinstance(J['nodes'], dict) else None
if p: prim('cyl', G(p[0], p[1] + 0.5, p[2]), 1.0, (0.7, 0.25, 0.15), 'ione')
r = J['ring']; prim('torus', G(r[0], r[1] + 0.06, r[2]), 0.38, (1.0, 1.0, 0.95), 'ring')
if SEA is not None:
    bpy.ops.mesh.primitive_plane_add(size=80, location=G(-2.0, SEA, 1.0)); o = bpy.context.active_object; o.data.materials.append(mat('sea', (0.25, 0.45, 0.5)))
for (kind, at, sz, rgb) in (J.get('scenery') or []):      # (placeholders for what the concept will paint: a colossal face, sea stacks, a far isle)
    if kind == 'face':
        bpy.ops.mesh.primitive_uv_sphere_add(radius=1.0, location=G(*at)); o = bpy.context.active_object; o.scale = (sz[0], sz[1], sz[2])
        bpy.ops.mesh.primitive_cone_add(radius1=0.25 * sz[0], depth=0.6 * sz[0], location=G(at[0] + 0.0, at[1], at[2] + sz[2] * 0.9)); n = bpy.context.active_object; n.rotation_euler = (math.radians(90), 0, 0); n.data.materials.append(mat('nose', rgb))
    else:
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=G(*at)); o = bpy.context.active_object; o.scale = (sz[0], sz[2], sz[1])
    o.data.materials.append(mat(kind, rgb))

eye = J['eye']; c = Vector(eye['centre'])
yaw = math.radians(45.0); pit = math.radians(eye['pitch'])
fwd_game = Vector((-math.sin(yaw) * math.cos(pit), -math.sin(pit), -math.cos(yaw) * math.cos(pit)))
fwd = Vector((fwd_game.x, -fwd_game.z, fwd_game.y))
cam_d = bpy.data.cameras.new('eye'); cam_d.type = 'ORTHO'; cam_d.ortho_scale = eye['width']; cam_d.sensor_fit = 'HORIZONTAL'
cam = bpy.data.objects.new('eye', cam_d); sc.collection.objects.link(cam); sc.camera = cam
cam.location = G(c.x, c.y, c.z) - fwd * 40.0
cam.rotation_euler = fwd.to_track_quat('-Z', 'Y').to_euler(); cam_d.clip_end = 200.0
sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 3.0
so = bpy.data.objects.new('sun', sun); sc.collection.objects.link(so)
so.rotation_euler = Vector((0.62, 0.5, -0.56)).normalized().to_track_quat('Z', 'Y').to_euler()
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 24; sc.cycles.use_denoising = False
sc.render.resolution_x = PX; sc.render.resolution_y = int(PX * 16 / 9)
sc.render.filepath = OUT
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
bg = w.node_tree.nodes.get('Background')
if bg: bg.inputs['Color'].default_value = (0.75, 0.8, 0.85, 1.0); bg.inputs['Strength'].default_value = 0.8
bpy.ops.render.render(write_still=True)
print('SAVED', OUT)
