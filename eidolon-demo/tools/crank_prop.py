# Second pass for the windlass crank (after flat_prop.py has sorted it into gold, wood and dark; it comes lying flat,
# its eye with the square socket at one end, its wooden grip standing up at the other). Slims the heavy boss under
# the grip and shortens the grip, gives the eye's back a dark square too (the socket shows from both sides), scales
# it to its length and lays it on its side: arm along X, socket axis and grip along the game's Z (the grip towards
# +Z), the socket's centre on x = 0, the eye's back face on z = 0, lowest point on the ground.
# before it: flat_prop.py -- raw.glb flat.glb "gold=#f0b820,gold=#c08a20,wood=#5a3220,dark=#201a18" - 0 - "dark:x<-0.28;wood:up>0.47"
# usage: python3.11 -I crank_prop.py -- <in.glb> <out.glb> [length 0.38] [boss slimmed to 0.5] [boss width to 0.7] [grip length to 0.8]
import bpy, sys, math, bmesh, mathutils
a = sys.argv[sys.argv.index('--') + 1:]
src, out = a[0], a[1]
LEN = float(a[2]) if len(a) > 2 else 0.38; S = float(a[3]) if len(a) > 3 else 0.5; SY = float(a[4]) if len(a) > 4 else 0.7; G = float(a[5]) if len(a) > 5 else 0.8
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
obs = [o for o in bpy.data.objects if o.type == 'MESH']
for o in obs: o.select_set(True)
bpy.context.view_layer.objects.active = obs[0]
if len(obs) > 1: bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
me = ob.data; names = [m.name for m in me.materials]
def verts_of(nm): return {vi for p in me.polygons if names[p.material_index] == nm for vi in p.vertices}
co = [v.co.copy() for v in me.vertices]
wood = verts_of("wood"); darkv = verts_of("dark")
if sum(co[i].x for i in wood) / len(wood) < sum(co[i].x for i in darkv) / len(darkv):       # the eye goes to -X
    co = [mathutils.Vector((-c.x, -c.y, c.z)) for c in co]
gx = (min(co[i].x for i in wood) + max(co[i].x for i in wood)) / 2; gy = (min(co[i].y for i in wood) + max(co[i].y for i in wood)) / 2
gr = max(math.hypot(co[i].x - gx, co[i].y - gy) for i in wood); zb = min(co[i].z for i in wood)
grip = {i for i, c in enumerate(co) if c.z >= zb - 0.002 and math.hypot(c.x - gx, c.y - gy) <= gr * 1.6}
ex = (min(co[i].x for i in darkv) + max(co[i].x for i in darkv)) / 2; ey = (min(co[i].y for i in darkv) + max(co[i].y for i in darkv)) / 2
hole = max(max(co[i].x for i in darkv) - min(co[i].x for i in darkv), max(co[i].y for i in darkv) - min(co[i].y for i in darkv))
xmin = min(c.x for c in co); eye_end = ex + (ex - xmin)
eye = [c for i, c in enumerate(co) if i not in grip and c.x <= eye_end]
z_lo, z_hi = min(c.z for c in eye), max(c.z for c in eye); z_ref = (z_lo + z_hi) / 2
hw = max(abs(c.y - ey) for i, c in enumerate(co) if i not in grip); x2 = gx - 1.5 * hw
def k(x):          # 0 at the eye, 1 at the boss
    t = min(1.0, max(0.0, (x - eye_end) / (x2 - eye_end))); return t * t * (3 - 2 * t)
zb2 = z_ref + (zb - z_ref) * S
for i, c in enumerate(co):
    if i in grip: c.z = zb2 + (c.z - zb) * G
    else:
        t = k(c.x); c.z = z_ref + (c.z - z_ref) * (1 + (S - 1) * t); c.y = ey + (c.y - ey) * (1 + (SY - 1) * t)
for v, c in zip(me.vertices, co): v.co = c
me.update()
bm = bmesh.new(); bm.from_mesh(me)
di = names.index("dark"); h = hole / 2; zq = z_lo - 0.004        # the socket seen from behind
f = bm.faces.new([bm.verts.new((ex + sx * h, ey + sy * h, zq)) for sx, sy in ((-1, -1), (-1, 1), (1, 1), (1, -1))]); f.material_index = di
bm.normal_update()
if f.normal.z > 0: f.normal_flip()
sc = LEN / (max(c.x for c in co) - min(c.x for c in co))
for v in bm.verts: v.co = mathutils.Vector(((v.co.x - ex) * sc, -(v.co.z - z_lo) * sc, (v.co.y - ey) * sc))       # laid on its side: the grip, that stood up, now points along -Y here, the game's +Z
low = min(v.co.z for v in bm.verts)
for v in bm.verts: v.co.z -= low
bm.normal_update(); bm.to_mesh(me); bm.free()
for p in me.polygons: p.use_smooth = False
vs = [v.co for v in me.vertices]
print("CRANK (game frame: x along the arm, y up, z along socket and grip) size x %.3f y %.3f z %.3f" % (max(v.x for v in vs) - min(v.x for v in vs), max(v.z for v in vs) - min(v.z for v in vs), max(v.y for v in vs) - min(v.y for v in vs)),
      "| x from %.3f to %.3f" % (min(v.x for v in vs), max(v.x for v in vs)),
      "| socket centre (0, %.3f, z), square %.3f wide, eye from z=0 to z=%.3f" % (-low, hole * sc, (z_hi - z_lo) * sc),
      "| grip axis at x=%.3f y=%.3f, its tip at z=%.3f, its foot at z=%.3f" % ((gx - ex) * sc, (gy - ey) * sc - low, max(-v.y for v in vs), (zb2 - z_lo) * sc),
      "| triangles", sum(len(p.vertices) - 2 for p in me.polygons), "parts", names)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_apply=True)
