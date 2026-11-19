"""The fourth level's blockout through the game's eye, the layout to paint its concept on: the real side as Blender
built it (tools/ivory_level.py, from tools/go/glass_plan.py), and its image as the mirror shows it: the same turned over
about the glass, silver, with fog where one of its floors is missing; the glass itself, a sheet of light across the
level, cracked where she crosses; the ring and the gate in the image only; the block and its image; and she, alone not
in the mirror.

usage: python3.11 -I tools/go/glass_preview.py -- <level.glb> <plan.json> <puzzle.json> <out.png> [width px]
"""
import bpy, bmesh, json, math, sys
from mathutils import Vector, Matrix

a = sys.argv[sys.argv.index('--') + 1:]
GLB, PJ, ZJ, OUT = a[:4]
PX = int(a[4]) if len(a) > 4 else 720
PL = json.load(open(PJ)); PZ = json.load(open(ZJ))
SEA = PL['sea_y']; H1 = PL['heights']['H1']
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
bpy.ops.mesh.primitive_cube_add(size=0.72, location=G(PL['stone'][0], PL['stone'][1] + 0.36, PL['stone'][2]))
st = bpy.context.active_object; st.name = 'stone'; real.append((st, 'stone'))

for o, k in real:      # (the real side only, cut at the glass)
    bm = bmesh.new(); bm.from_mesh(o.data); bm.transform(o.matrix_world)
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=CO, plane_no=NRM, clear_inner=True)
    bm.to_mesh(o.data); bm.free(); o.matrix_world = Matrix.Identity(4)
    o.data.materials.clear(); o.data.materials.append(M_REAL[k])

F = PZ['nodes'][PZ['glass']['fog'][0]]; fx, fy = F[0], -F[2]      # (the fog's cell, in Blender's axes)
for o, k in real:      # (the image: the same turned over about the glass; the fog's cell cut out of it)
    me = o.data.copy(); bm = bmesh.new(); bm.from_mesh(me); bm.transform(MIR)
    bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
    for co, no in (((fx - 0.75, 0, 0), (1, 0, 0)), ((fx + 0.75, 0, 0), (1, 0, 0)), ((0, fy - 0.75, 0), (0, 1, 0)), ((0, fy + 0.75, 0), (0, 1, 0))):
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=co, plane_no=no)
    gone = [f for f in bm.faces if abs(f.calc_center_median().x - fx) < 0.75 and abs(f.calc_center_median().y - fy) < 0.75]
    bmesh.ops.delete(bm, geom=gone, context='FACES')
    bm.to_mesh(me); bm.free()
    io = bpy.data.objects.new('img_' + o.name, me); sc.collection.objects.link(io)
    me.materials.clear(); me.materials.append(M_IMG[k])

fog = mat('fog', (0.93, 0.94, 0.97), emit=0.9, alpha=0.55)      # (the fog where the image is missing)
for i, (dz, r) in enumerate(((0.25, 0.62), (0.75, 0.5), (1.15, 0.36))):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=(fx + 0.08 * (i - 1), fy - 0.05 * i, SEA + dz))
    s = bpy.context.active_object; s.scale = (1.15, 1.15, 0.7); s.data.materials.append(fog)

# the glass: a sheet in its plane, local x along it, z up; cracked where she crosses
X = PZ['nodes'][PZ['glass']['cracks'][0]]; px = G(*X)
along = Vector((1, 1, 0)).normalized()
s_c = (px - CO).dot(along)
CRACK = [(-0.42, H1 - 0.05), (-0.5, H1 + 0.55), (-0.3, H1 + 0.9), (-0.44, H1 + 1.35), (-0.18, H1 + 1.7), (-0.26, H1 + 2.15),
         (-0.06, H1 + 2.75), (0.08, H1 + 2.3), (0.22, H1 + 2.45), (0.2, H1 + 1.85), (0.4, H1 + 1.45), (0.3, H1 + 1.0),
         (0.5, H1 + 0.6), (0.44, H1 - 0.05)]
def inside(p, poly):
    c = False; j = len(poly) - 1
    for i in range(len(poly)):
        (xi, yi), (xj, yj) = poly[i], poly[j]
        if (yi > p[1]) != (yj > p[1]) and p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi: c = not c
        j = i
    return c
bm = bmesh.new(); TOP = SEA + 8.0; d = 0.06
ss = [i * d for i in range(int(-14 / d), int(14 / d) + 1)]; ts = [SEA + i * d for i in range(int((TOP - SEA) / d) + 1)]
vs = {}
def V(i, j):
    if (i, j) not in vs: vs[(i, j)] = bm.verts.new((ss[i], 0.0, ts[j]))
    return vs[(i, j)]
for i in range(len(ss) - 1):
    for j in range(len(ts) - 1):
        c = ((ss[i] + ss[i + 1]) / 2 - s_c, (ts[j] + ts[j + 1]) / 2)
        if inside(c, CRACK): continue
        bm.faces.new((V(i, j), V(i + 1, j), V(i + 1, j + 1), V(i, j + 1)))
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
bm = bmesh.new()      # (the crack: an opening in the glass filled with light from the other side, not an outline: an outline read as lightning)
for k_, (sh, gl_k) in enumerate(((1.0, 1.6), (0.62, 4.0))):      # (a soft halo about it, and the light in it)
    pts = [CO + along * (s_c + s0 * sh) + Vector((0, 0, H1 + (t0 - H1) * (0.98 if sh < 1 else 1.04))) - NRM * (0.02 + 0.01 * k_) for s0, t0 in CRACK]
    f = bm.faces.new([bm.verts.new(p) for p in pts]); f.material_index = k_
cm = bpy.data.meshes.new('crack'); bm.to_mesh(cm); bm.free()
co_ = bpy.data.objects.new('crack', cm); sc.collection.objects.link(co_)
cm.materials.append(mat('crack_halo', (1.0, 0.95, 0.86), emit=1.6, alpha=0.6)); cm.materials.append(mat('crack', (1.0, 0.98, 0.93), emit=5.0))

# the ring and the gate, in the image only
r = PZ['nodes']['R']
bpy.ops.mesh.primitive_torus_add(major_radius=0.38, minor_radius=0.07, location=G(r[0], r[1] + 0.06, r[2]))
bpy.context.active_object.data.materials.append(mat('ring', (1.0, 1.0, 0.97), emit=2.0))
gx, gy, gz = PL['gate'][0]
gs = mat('gate', (0.82, 0.84, 0.9)); gw = mat('door', (1.0, 1.0, 0.98), emit=3.0)
for sx in (-0.62, 0.62):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=G(gx + sx, gy + 1.2, gz)); b = bpy.context.active_object
    b.scale = (0.3, 0.38, 2.4); b.data.materials.append(gs)
bpy.ops.mesh.primitive_cube_add(size=1.0, location=G(gx, gy + 2.55, gz)); b = bpy.context.active_object; b.scale = (1.7, 0.44, 0.34); b.data.materials.append(gs)
bpy.ops.mesh.primitive_plane_add(size=1.0, location=G(gx, gy + 1.15, gz - 0.02)); b = bpy.context.active_object
b.scale = (0.94, 2.3, 1.0); b.rotation_euler = (math.radians(90), 0, 0); b.data.materials.append(gw)

# the way's places, and she, not in the mirror
for k, p in PZ['nodes'].items():
    if k == 'R' or k == 'F': continue
    bpy.ops.mesh.primitive_cylinder_add(radius=0.16, depth=0.03, location=G(p[0], p[1] + 0.02, p[2]))
    bpy.context.active_object.data.materials.append(mat('node', (0.99, 0.98, 0.96) if not k.startswith('i') else (0.9, 0.92, 0.97)))
p = PZ['nodes'][PZ['start']]
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
