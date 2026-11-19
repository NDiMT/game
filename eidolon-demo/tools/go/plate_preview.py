"""The fourth level's blockout as the owner put it (plate_plan.py): the real side as Blender built it, with the block,
the gate and its ring, and its reflection as the mirror shows it, the same turned over about the glass, silver; in the
reflection only, just behind the glass, the plate of light; the glass itself a sheet of light across the level; she,
alone not in the mirror. The layout to paint its concept on.

usage: python3.11 -I tools/go/plate_preview.py -- <level.glb> <plan.json> <puzzle.json> <out.png> [width px] [solved]
"""
import bpy, bmesh, json, math, sys
from mathutils import Vector, Matrix

a = sys.argv[sys.argv.index('--') + 1:]
GLB, PJ, ZJ, OUT = a[:4]
PX = int(a[4]) if len(a) > 4 else 720
SOLVED = len(a) > 5 and a[5] == 'solved'      # (the block on its place: its reflection on the plate, the gate open)
PL = json.load(open(PJ)); PZ = json.load(open(ZJ))
SEA = PL['sea_y']; H0 = PL['heights']['H0']
K6 = PL['glass']['plane'][2]      # (the glass: x + z + K6 = 0 in the game's axes)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
G = lambda x, y, z: Vector((x, -z, y))      # (the game's axes, y up, to Blender's)
MIR = Matrix(((0, 1, 0, -K6), (1, 0, 0, K6), (0, 0, 1, 0), (0, 0, 0, 1)))      # (turned over about the glass, in Blender's axes)
NRM = Vector((1, -1, 0)).normalized(); CO = Vector((-K6 / 2, K6 / 2, 0))      # (the glass's plane; the real side before it)


def mat(name, rgb, emit=0.0, alpha=1.0, rough=0.9):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
    bs = nt.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*rgb, 1.0); bs.inputs['Roughness'].default_value = rough
    if emit > 0:
        bs.inputs['Emission Color'].default_value = (*rgb, 1.0); bs.inputs['Emission Strength'].default_value = emit
    if alpha < 1.0: bs.inputs['Alpha'].default_value = alpha
    return m


M_REAL = {'marble': mat('marble', (0.93, 0.89, 0.83)), 'rock': mat('rock', (0.33, 0.27, 0.24)),
          'stone': mat('stone', (0.88, 0.8, 0.66))}
M_IMG = {'marble': mat('i_marble', (0.78, 0.81, 0.88)), 'rock': mat('i_rock', (0.4, 0.43, 0.52)),
         'stone': mat('i_stone', (0.84, 0.84, 0.86))}

bpy.ops.import_scene.gltf(filepath=GLB)
real = []
for o in list(sc.objects):
    if o.type != 'MESH': continue
    k = 'rock' if 'rock' in o.name.lower() else 'marble'
    real.append((o, k))
stn = PZ['nodes']['T'] if SOLVED else PL['stone']
bpy.ops.mesh.primitive_cube_add(size=0.72, location=G(stn[0], stn[1] + 0.36, stn[2]))
st = bpy.context.active_object; st.name = 'stone'; real.append((st, 'stone'))
r = PL['ring']      # (the gate's ring: real, so the mirror shows it too; unlit until the gate opens)
bpy.ops.mesh.primitive_torus_add(major_radius=0.38, minor_radius=0.07, location=G(r[0], r[1] + 0.06, r[2]))
ro = bpy.context.active_object; ro.name = 'ring'; real.append((ro, 'ring'))
M_REAL['ring'] = mat('ring', (1.0, 1.0, 0.97), emit=2.0) if SOLVED else mat('ring_off', (0.82, 0.8, 0.88))
M_IMG['ring'] = mat('i_ring', (0.95, 0.96, 1.0), emit=1.2) if SOLVED else mat('i_ring_off', (0.72, 0.74, 0.82))
gx, gy, gz = PL['arches'][0][0]      # (the gate's door: shut, dark; open, white light)
bpy.ops.mesh.primitive_plane_add(size=1.0, location=G(gx, gy + 1.15, gz + 0.02)); dr_ = bpy.context.active_object
dr_.scale = (0.94, 2.3, 1.0); dr_.rotation_euler = (math.radians(90), 0, 0); dr_.name = 'door'; real.append((dr_, 'door'))
M_REAL['door'] = mat('door', (1.0, 1.0, 0.98), emit=3.0) if SOLVED else mat('door_shut', (0.36, 0.33, 0.38))
M_IMG['door'] = mat('i_door', (0.95, 0.96, 1.0), emit=2.0) if SOLVED else mat('i_door_shut', (0.5, 0.52, 0.6))

for o, k in real:      # (the real side only, cut at the glass)
    bm = bmesh.new(); bm.from_mesh(o.data); bm.transform(o.matrix_world)
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=CO, plane_no=NRM, clear_inner=True)
    bm.to_mesh(o.data); bm.free(); o.matrix_world = Matrix.Identity(4)
    o.data.materials.clear(); o.data.materials.append(M_REAL[k])

for o, k in real:      # (the reflection: the same turned over about the glass)
    me = o.data.copy(); bm = bmesh.new(); bm.from_mesh(me); bm.transform(MIR)
    bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
    bm.to_mesh(me); bm.free()
    io = bpy.data.objects.new('img_' + o.name, me); sc.collection.objects.link(io)
    me.materials.clear(); me.materials.append(M_IMG[k])

pp = PL['glass']['plate']      # (the plate of light, in the reflection only)
bpy.ops.mesh.primitive_cylinder_add(radius=0.5, depth=0.04, location=G(pp[0], pp[1] + 0.03, pp[2]))
bpy.context.active_object.data.materials.append(mat('plate', (1.0, 0.86, 0.6), emit=4.0 if SOLVED else 2.2))
bpy.ops.mesh.primitive_torus_add(major_radius=0.6, minor_radius=0.04, location=G(pp[0], pp[1] + 0.04, pp[2]))
bpy.context.active_object.data.materials.append(mat('plate_rim', (1.0, 0.9, 0.7), emit=3.0))

# the glass: a sheet in its plane, local x along it, z up
along = Vector((1, 1, 0)).normalized()
bm = bmesh.new(); TOP = SEA + 8.0
for (s0, s1) in ((-14.0, 14.0),):
    vs_ = [bm.verts.new((s0, 0.0, SEA)), bm.verts.new((s1, 0.0, SEA)), bm.verts.new((s1, 0.0, TOP)), bm.verts.new((s0, 0.0, TOP))]
    bm.faces.new(vs_)
gm = bpy.data.meshes.new('glass'); bm.to_mesh(gm); bm.free()
go = bpy.data.objects.new('glass', gm); sc.collection.objects.link(go)
go.matrix_world = Matrix.Translation(CO) @ Matrix.Rotation(math.radians(45), 4, 'Z')
gl = bpy.data.materials.new('glass'); gl.use_nodes = True; nt = gl.node_tree; nt.nodes.clear()
out = nt.nodes.new('ShaderNodeOutputMaterial'); mix = nt.nodes.new('ShaderNodeMixShader')
tr = nt.nodes.new('ShaderNodeBsdfTransparent'); em = nt.nodes.new('ShaderNodeEmission')
em.inputs['Color'].default_value = (1.0, 0.99, 0.97, 1.0); em.inputs['Strength'].default_value = 1.0
tc = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ'); mr = nt.nodes.new('ShaderNodeMapRange')
mr.inputs['From Min'].default_value = SEA; mr.inputs['From Max'].default_value = SEA + 7.0
ramp = nt.nodes.new('ShaderNodeValToRGB'); bw = nt.nodes.new('ShaderNodeRGBToBW')      # (no line at its foot: it comes up out of the water, and fades into the sky)
el = ramp.color_ramp.elements; el[0].position = 0.0; el[0].color = (0, 0, 0, 1); el[1].position = 1.0; el[1].color = (0, 0, 0, 1)
e = el.new(0.25); e.color = (0.1, 0.1, 0.1, 1)
nt.links.new(tc.outputs['Object'], sep.inputs['Vector']); nt.links.new(sep.outputs['Z'], mr.inputs['Value'])
nt.links.new(mr.outputs['Result'], ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'], bw.inputs['Color'])
nt.links.new(bw.outputs['Val'], mix.inputs['Fac']); nt.links.new(tr.outputs['BSDF'], mix.inputs[1]); nt.links.new(em.outputs['Emission'], mix.inputs[2])
nt.links.new(mix.outputs['Shader'], out.inputs['Surface'])
go.data.materials.append(gl)

# the way's places, and she, not in the mirror
for k, p in PZ['nodes'].items():
    if k == 'R': continue
    bpy.ops.mesh.primitive_cylinder_add(radius=0.16, depth=0.03, location=G(p[0], p[1] + 0.02, p[2]))
    bpy.context.active_object.data.materials.append(mat('node', (0.99, 0.98, 0.96)))
p = PZ['nodes']['C3'] if SOLVED else PZ['nodes'][PZ['start']]
bpy.ops.mesh.primitive_cylinder_add(radius=0.2, depth=0.95, location=G(p[0], p[1] + 0.48, p[2]))
bpy.context.active_object.data.materials.append(mat('ione', (0.72, 0.28, 0.16)))
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.13, location=G(p[0], p[1] + 1.05, p[2]))
bpy.context.active_object.data.materials.append(mat('head', (0.95, 0.92, 0.88)))

bpy.ops.mesh.primitive_plane_add(size=90, location=G(-3.0, SEA, -3.0))
bpy.context.active_object.data.materials.append(mat('sea', (0.45, 0.52, 0.58), rough=0.3))

eye = PL['eye']; c = Vector(eye['centre'])
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
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 32; sc.cycles.use_denoising = False
sc.render.resolution_x = PX; sc.render.resolution_y = int(PX * 16 / 9)
sc.render.filepath = OUT
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
bg = w.node_tree.nodes.get('Background')
if bg: bg.inputs['Color'].default_value = (0.78, 0.8, 0.86, 1.0); bg.inputs['Strength'].default_value = 0.85
bpy.ops.render.render(write_still=True)
print('SAVED', OUT)

