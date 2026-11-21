"""The fifth level's blockout (the Guardian, tools/go/gaze_trial.py guardian()), straight from the board, through the
game's eye (orthographic, yaw 45 degrees, pitch 35): white slabs on dark rock round a small pool where the Guardian of
glass stands on his pedestal, his gaze a cold line of light along the way he looks, the stone, the pier out to the
goddess's bronze mirror, the ring and the gate, Ione at her start. The layout to paint its concept on.

usage: python3.11 -I tools/go/gaze_blockout.py -- <out.png> [width px]
"""
import bpy, math, os, sys, random
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]
OUT = a[0]; PX = int(a[1]) if len(a) > 1 else 720
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gaze_trial import guardian, DIRS
T = guardian()
STEP = 1.5; H0 = 0.1; SEA = -0.3
B = lambda c, z=0.0: Vector((c[0] * STEP, c[1] * STEP, z))      # (the board's x east, y north, to Blender's)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
rnd = random.Random(5)

def mat(name, rgb, emit=0.0, rough=0.85, alpha=1.0, trans=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*rgb, 1.0); bs.inputs['Roughness'].default_value = rough
    if emit: bs.inputs['Emission Color'].default_value = (*rgb, 1.0); bs.inputs['Emission Strength'].default_value = emit
    if trans: bs.inputs['Transmission Weight'].default_value = trans
    if alpha < 1.0: bs.inputs['Alpha'].default_value = alpha
    return m
MARBLE = mat('marble', (0.9, 0.87, 0.84)); ROCK = mat('rock', (0.24, 0.18, 0.17)); STONE = mat('stone', (0.78, 0.68, 0.55))
GLASS = mat('glass', (0.78, 0.86, 0.95), rough=0.08, trans=0.55); GAZE = mat('gaze', (0.82, 0.9, 1.0), emit=6.0)
BRONZE = mat('bronze', (0.72, 0.5, 0.26), rough=0.3); BRONZE_F = mat('bronze_face', (0.95, 0.8, 0.55), rough=0.12)
LIGHT = mat('light', (1.0, 0.98, 0.94), emit=4.0); IONE = mat('ione', (0.72, 0.32, 0.2)); SKIN = mat('skin', (0.95, 0.92, 0.88))
POOL = mat('pool', (0.42, 0.46, 0.6), rough=0.1); DEEP = mat('deep', (0.25, 0.28, 0.42), rough=0.1)

def box(at, size, m, rot=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at, rotation=(0, 0, rot)); o = bpy.context.active_object
    o.scale = size; o.data.materials.append(m); return o
def cyl(at, r, depth, m, verts=24, r2=None, rot=(0, 0, 0)):
    if r2 is None: bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=at, vertices=verts, rotation=rot)
    else: bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=r2, depth=depth, location=at, vertices=verts, rotation=rot)
    o = bpy.context.active_object; o.data.materials.append(m); return o

# the sea
bpy.ops.mesh.primitive_plane_add(size=120, location=(0, 0, SEA)); bpy.context.active_object.data.materials.append(mat('sea', (0.6, 0.6, 0.7), rough=0.25))
# the floors: a slab at each place of the way, joined along the ways; rock under them, chunky
for c in T.cells:
    p = B(c); box(p + Vector((0, 0, H0 - 0.2)), (1.3, 1.3, 0.4), MARBLE, rnd.uniform(-0.03, 0.03))
    box(p + Vector((rnd.uniform(-0.1, 0.1), rnd.uniform(-0.1, 0.1), -0.9)), (1.55, 1.55, 1.4), ROCK, rnd.uniform(-0.2, 0.2))
for w in {tuple(sorted(w)) for w in T.level}:
    p, q = B(w[0]), B(w[1]); m_ = (p + q) / 2; d = q - p
    box(m_ + Vector((0, 0, H0 - 0.2)), (abs(d.x) + 1.0 if d.x else 1.0, abs(d.y) + 1.0 if d.y else 1.0, 0.38), MARBLE)
# under the goddess's mirror, its own small slab
box(B(T.mirror, H0 - 0.2), (1.1, 1.1, 0.4), MARBLE); box(B(T.mirror, -0.9), (1.3, 1.3, 1.4), ROCK, 0.3)
# the pool round his pedestal (its rim the walk's own edge), and the deep water at its back corner
box(B(T.guard, SEA + 0.02), (1.5, 1.5, 0.02), POOL)
for s_ in T.sinks: box(B(s_, SEA + 0.02), (1.4, 1.4, 0.02), DEEP)
cyl(B(T.guard, 0.0), 0.62, 0.7, MARBLE, 32)      # (the pedestal)
# the Guardian of glass: hooded, a sculptor's apron, 3.4 m
g = B(T.guard)
cyl(g + Vector((0, 0, 1.95)), 0.58, 3.2, GLASS, 24, r2=0.34)
cyl(g + Vector((0, 0, 3.85)), 0.36, 0.62, GLASS, 24, r2=0.12)      # (the hood)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.29, location=g + Vector((0.05, -0.1, 3.7))); bpy.context.active_object.data.materials.append(GLASS)
box(g + Vector((0, -0.42, 1.2)), (0.55, 0.06, 1.4), GLASS)      # (the apron)
# his gaze: he first looks south, a cold line of light out along his line until the water's end
d = DIRS[T.d0]; lit, _ = T.beam(T.start, T.stone0, T.mface0, 0)
far = (lit[-1] if lit else T.guard)
p0 = g + Vector((d[0] * 0.3, d[1] * 0.3, 3.7)); p1 = B(far, 0.35) + Vector((d[0] * 0.7 * STEP, d[1] * 0.7 * STEP, 0))
v = p1 - p0; o = cyl((p0 + p1) / 2, 0.045, v.length, GAZE, 12); o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = v.to_track_quat('Z', 'Y')
# the stone
box(B(T.stone0, H0 + 0.46), (0.92, 0.92, 0.92), STONE, 0.04)
# the goddess's mirror on its stand, at first facing south (its face toward the eye's right)
mp = B(T.mirror, H0)
cyl(mp + Vector((0, 0, 0.6)), 0.05, 1.2, BRONZE, 12)
f = DIRS[T.mface0]; o = cyl(mp + Vector((0, 0, 1.45)), 0.55, 0.06, BRONZE_F, 40); o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((f[0], f[1], 0)).to_track_quat('Z', 'Y')
# the ring before the gate, and the gate square to the way's last stretch (north), its opening white
r = B(T.ring, H0 + 0.05)
bpy.ops.mesh.primitive_torus_add(location=r, major_radius=0.42, minor_radius=0.06); bpy.context.active_object.data.materials.append(mat('ring', (0.98, 0.97, 0.95), emit=0.6))
gp = B((T.ring[0], T.ring[1] + 0.8), H0)
box(gp + Vector((-0.8, 0, 1.4)), (0.32, 0.4, 2.8), MARBLE); box(gp + Vector((0.8, 0, 1.4)), (0.32, 0.4, 2.8), MARBLE)
box(gp + Vector((0, 0, 2.95)), (2.0, 0.5, 0.35), MARBLE); box(gp + Vector((0, 0.05, 1.3)), (1.3, 0.05, 2.6), LIGHT)
box(gp + Vector((0, 0.6, -0.5)), (2.4, 1.4, 1.6), ROCK)
# Ione at her start, facing the way in
ip = B(T.start, H0)
cyl(ip + Vector((0, 0, 0.75)), 0.2, 1.5, IONE, 16, r2=0.1); bpy.ops.mesh.primitive_uv_sphere_add(radius=0.12, location=ip + Vector((0, 0, 1.6))); bpy.context.active_object.data.materials.append(SKIN)
# a few rocks in the sea, few (as every level)
for (x, y, s) in ((-4.2, -3.6, 1.0), (6.6, -3.2, 0.8), (-5.6, 3.6, 1.2), (7.4, 3.0, 0.7)):
    bpy.ops.mesh.primitive_ico_sphere_add(radius=s, subdivisions=1, location=(x, y, SEA + 0.2)); o = bpy.context.active_object; o.scale = (1.2, 1.0, 0.8); o.data.materials.append(ROCK)

# the eye: orthographic, from the south-west, 35 degrees down; the board in the middle and a little low
yaw = math.radians(45.0); pit = math.radians(35.0)
fwd = Vector((math.sin(yaw) * math.cos(pit), math.cos(yaw) * math.cos(pit), -math.sin(pit)))
pts = [B(c, 0.0) for c in T.cells] + [B(T.mirror, 1.8), gp + Vector((-1.0, 0, 3.1)), gp + Vector((1.0, 0, 3.1)), gp + Vector((-1.0, 0, -0.4))]
right = Vector((math.cos(yaw), -math.sin(yaw), 0)); up = right.cross(fwd).normalized() * -1
xs = [p.dot(right) for p in pts]; ys = [p.dot(up) for p in pts]
width = (max(xs) - min(xs)) * 1.16
cx_, cy_ = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
centre = right * cx_ + up * (cy_ - (width * 16 / 9) * 0.04) + fwd * (sum(pts, Vector()) / len(pts)).dot(fwd)
cam_d = bpy.data.cameras.new('eye'); cam_d.type = 'ORTHO'; cam_d.ortho_scale = width * 16 / 9; cam_d.sensor_fit = 'VERTICAL'
cam = bpy.data.objects.new('eye', cam_d); sc.collection.objects.link(cam); sc.camera = cam
cam.location = centre - fwd * 60.0; cam.rotation_euler = fwd.to_track_quat('-Z', 'Y').to_euler(); cam_d.clip_end = 200.0
# a low warm sun behind the scene at the upper right, and the haze's light
sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 3.2; sun.color = (1.0, 0.86, 0.7); sun.angle = math.radians(6)
so = bpy.data.objects.new('sun', sun); sc.collection.objects.link(so)
so.rotation_euler = Vector((-0.5, -0.75, 0.45)).normalized().to_track_quat('Z', 'Y').to_euler()
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
bg = w.node_tree.nodes.get('Background'); bg.inputs['Color'].default_value = (0.82, 0.8, 0.88, 1.0); bg.inputs['Strength'].default_value = 0.8
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 40; sc.cycles.use_denoising = False
sc.render.resolution_x = PX; sc.render.resolution_y = int(PX * 16 / 9); sc.render.filepath = OUT
bpy.ops.render.render(write_still=True); print('SAVED', OUT)
