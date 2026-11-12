# Second pass for the sculptor's yard crane (after flat_prop.py has sorted it into wood, rope, gold, stone, about the
# axis of its turntable, the jib along +X, the windlass's axle towards the game's +Z). It
#   - puts right what colour could not sort: the turntable is all wood under its bronze ring, bolts and the far axle
#     end are bronze, the square hole in the near axle end is a part of its own ("dark"),
#   - cuts off the rope that hung from the jib's tip (nothing hangs from the jib: the game hangs its own chains),
#   - levels the jib, lengthens its plain middle, and scales the whole so that the tip is the given distance from the
#     axis while the mast keeps a sensible height,
#   - leads a rope from the drum up to the pulley on the mast head (the generator left that stretch out),
#   - and prints the measures the game needs, in the game's frame (x along the jib, y up, z towards the crank).
# before it: flat_prop.py -- raw.glb flat.glb "wood=#4a2e20,wood=#7a4a2c,wood=#b98a5a,rope=#e6d7b0,gold=#f0c020,stone=#d8d8dc" - 0 - "axis=0.0-0.08;stone:x<-0.06&up>0.25&up<0.75"
# usage: python3.11 -I crane_prop.py -- <in.glb> <out.glb> [tip 3.6] [mast timber top 3.0] [plain stretch of jib from 0.39] [to 0.61] [axle end slimmed to 0.7]
import bpy, sys, math, bmesh, mathutils
from mathutils.bvhtree import BVHTree
a = sys.argv[sys.argv.index('--') + 1:]
src, out = a[0], a[1]
TIP = float(a[2]) if len(a) > 2 else 3.6; MAST = float(a[3]) if len(a) > 3 else 3.0
XA = float(a[4]) if len(a) > 4 else 0.39; XB = float(a[5]) if len(a) > 5 else 0.61; END = float(a[6]) if len(a) > 6 else 0.7
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
me.materials.append(bpy.data.materials.new("dark")); names.append("dark")
W, R, G, S, D = [names.index(n) for n in ("wood", "rope", "gold", "stone", "dark")]
bm = bmesh.new(); bm.from_mesh(me)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)       # the faces come apart from each other: joined, one can tell what touches what
bm.faces.ensure_lookup_table(); bm.verts.ensure_lookup_table()
H = max(v.co.z for v in bm.verts)
# ---- the parts
disc_r = max(math.hypot(v.co.x, v.co.y) for v in bm.verts if v.co.z < 0.06 * H)
disc_top = max(v.co.z for v in bm.verts if v.co.z < 0.08 * H and math.hypot(v.co.x, v.co.y) > 0.85 * disc_r)
y_end = min(v.co.y for v in bm.verts)                       # the near end of the windlass's axle
for f in bm.faces:
    c = f.calc_center_median()
    if c.z < disc_top + 0.002 and f.material_index != G: f.material_index = W
    elif c.y < y_end + 0.05 and f.material_index != G: f.material_index = D
# ---- nothing hangs from the tip
tip_x = max(v.co.x for v in bm.verts)
under_tip = min(v.co.z for f in bm.faces if f.material_index == W and f.calc_center_median().x > tip_x - 0.08 for v in f.verts)
dead = [f for f in bm.faces if f.material_index == R and f.calc_center_median().x > tip_x - 0.12 and f.calc_center_median().z < under_tip + 0.03]
bmesh.ops.delete(bm, geom=dead, context='FACES')
bm.faces.ensure_lookup_table(); bm.verts.ensure_lookup_table()
def islands(mi):
    seen = set(); res = []
    for f in bm.faces:
        if f.material_index != mi or f.index in seen: continue
        grp = [f]; seen.add(f.index); i = 0
        while i < len(grp):
            for e in grp[i].edges:
                for g in e.link_faces:
                    if g.material_index == mi and g.index not in seen: seen.add(g.index); grp.append(g)
            i += 1
        res.append(grp)
    return res
def centre(grp):
    ar = sum(f.calc_area() for f in grp) or 1e-9
    return sum((f.calc_center_median() * f.calc_area() for f in grp), mathutils.Vector()) / ar, ar
low = [(centre(g), g) for g in islands(R)]
drum = max((x for x in low if x[0][0].z < 0.5 * H), key=lambda x: x[0][1])[1]       # the winding on the drum: the largest pale thing below
for (c, ar), g in low:
    if g is drum or ((c.z > 0.9 * H or c.x < -0.1) and ar > 0.0015): continue       # the winding, the rope along the top, the counterweight's sling
    if c.z < 0.5 * H and c.x > 0.03: to = G                        # the far axle end, pale in the picture
    else:                                                          # bolts and stray faces: what lies round them
        about = {}
        for f in g:
            for e in f.edges:
                for o in e.link_faces:
                    if o.material_index != R: about[o.material_index] = about.get(o.material_index, 0.0) + e.calc_length()
        to = max(about, key=about.get) if about else G
    for f in g: f.material_index = to
top_rope = [v for f in bm.faces if f.material_index == R and f.calc_center_median().z > 0.85 * H and XA < f.calc_center_median().x < XB for v in f.verts]
rr = (max(v.co.y for v in top_rope) - min(v.co.y for v in top_rope)) / 2          # the rope along the jib: the new stretch is as thick
# the counterweight: its shaded facets are stone too, and the pale bolts of its sling's block are bronze
st = sorted(((centre(g), g) for g in islands(S)), key=lambda x: -x[0][1]); body = [v.co for f in st[0][1] for v in f.verts]
blo = [min(c[i] for c in body) for i in range(3)]; bhi = [max(c[i] for c in body) for i in range(3)]
for (c, ar), g in st[1:]:
    if c.z > bhi[2]:
        for f in g: f.material_index = G
for f in bm.faces:
    c = f.calc_center_median()
    if f.material_index == W and all(blo[i] < c[i] < bhi[i] for i in range(3)): f.material_index = S
# ---- level the jib: the slope of its underside, taken out of all that lies above the windlass
tree0 = BVHTree.FromBMesh(bm); pts = []
for i in range(13):          # looks up at the jib's underside along its plain stretch
    hit = tree0.ray_cast(mathutils.Vector((XA + (XB - XA) * i / 12, 0.0, 0.45 * H)), mathutils.Vector((0, 0, 1)))
    if hit[0] is not None: pts.append((hit[0], 1.0))
sw = sum(w for _, w in pts); mx = sum(c.x * w for c, w in pts) / sw; mz = sum(c.z * w for c, w in pts) / sw
slope = sum((c.x - mx) * (c.z - mz) * w for c, w in pts) / sum((c.x - mx) ** 2 * w for c, w in pts)
under0 = mz - slope * mx                                      # the underside's height at the axis
z1, z2 = 0.47 * H, under0 - 0.02
for v in bm.verts:
    t = min(1.0, max(0.0, (v.co.z - z1) / (z2 - z1))); v.co.z -= slope * v.co.x * t * t * (3 - 2 * t)
# ---- the mast's timber top, and the jib's length for it
caps = [f for f in bm.faces if f.material_index == W and f.normal.z > 0.7 and math.hypot(f.calc_center_median().x, f.calc_center_median().y) < 0.06 and f.calc_center_median().z > under0]
mast_top = max(f.calc_center_median().z for f in caps if f.calc_area() > 0.3 * max(c.calc_area() for c in caps))      # not the small wooden things in the pulley above it
k = MAST / mast_top; tip_x = max(v.co.x for v in bm.verts); grow = TIP / k - tip_x; fx = 1.0 + grow / (XB - XA)
for v in bm.verts:
    if v.co.x > XB: v.co.x += grow
    elif v.co.x > XA: v.co.x = XA + (v.co.x - XA) * fx
# ---- the rope from the drum up to the pulley on the mast head: up before the brace and the jib's near side, over its edge, to the pulley
dv = {v for f in drum if f.is_valid for v in f.verts}
dx0, dx1 = min(v.co.x for v in dv), max(v.co.x for v in dv); dz1 = max(v.co.z for v in dv); dzc = (min(v.co.z for v in dv) + dz1) / 2
px = dx0 + (dx1 - dx0) * 0.8
jib_here = [v.co for f in bm.faces if f.material_index == W and abs(f.calc_center_median().x - px) < 0.06 and f.calc_center_median().z > under0 - 0.02 for v in f.verts]
jy = min(c.y for c in jib_here); jtop = max(c.z for c in jib_here); jw = (jy, max(c.y for c in jib_here))
head = [v.co for f in bm.faces if f.material_index in (G, R) and f.calc_center_median().z > mast_top and math.hypot(f.calc_center_median().x, f.calc_center_median().y) < 0.08 for v in f.verts]
hx = (min(c.x for c in head) + max(c.x for c in head)) / 2; hy = (min(c.y for c in head) + max(c.y for c in head)) / 2; hz = max(c.z for c in head)
path = [mathutils.Vector((px, jy - rr * 1.6, dzc)), mathutils.Vector((px, jy - rr * 1.6, jtop + rr * 0.3)), mathutils.Vector((px - 0.02, jy + rr * 0.5, jtop + rr * 1.2)), mathutils.Vector((hx + 0.012, hy, hz - rr * 1.3))]
rings = []
for i, p in enumerate(path):
    d = (path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)]).normalized()
    u = d.cross(mathutils.Vector((1, 0, 0))).normalized(); w = d.cross(u).normalized()
    rings.append([bm.verts.new(p + (u * math.cos(q * math.pi / 2 + 0.785) + w * math.sin(q * math.pi / 2 + 0.785)) * rr * 1.2) for q in range(4)])
for i in range(len(rings) - 1):
    for q in range(4):
        f = bm.faces.new((rings[i][q], rings[i][(q + 1) % 4], rings[i + 1][(q + 1) % 4], rings[i + 1][q])); f.material_index = R
        mid = f.calc_center_median(); axis_pt = (path[i] + path[i + 1]) / 2
        f.normal_update()
        if f.normal.dot(mid - axis_pt) < 0: f.normal_flip()
# ---- the axle's square end, where the crank goes on: a little slimmer, nearer the size of the crank's eye
ev = [v for v in bm.verts if v.co.y < y_end + 0.02]
ecx = (min(v.co.x for v in ev) + max(v.co.x for v in ev)) / 2; ecz = (min(v.co.z for v in ev) + max(v.co.z for v in ev)) / 2
ew = max(v.co.x for v in ev) - min(v.co.x for v in ev); eh = max(v.co.z for v in ev) - min(v.co.z for v in ev); side = END * min(ew, eh)      # and square
for v in bm.verts:
    if v.co.y < y_end + 0.05:
        t = min(1.0, (y_end + 0.05 - v.co.y) / 0.03)
        v.co.x = ecx + (v.co.x - ecx) * (1.0 - (1.0 - side / ew) * t); v.co.z = ecz + (v.co.z - ecz) * (1.0 - (1.0 - side / eh) * t)
# ---- to size
for v in bm.verts: v.co *= k
bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
bm.normal_update(); bm.to_mesh(me); me.update()
for p in me.polygons: p.use_smooth = False
# ---- the measures (game frame: x, up, z = -y here)
tree = BVHTree.FromBMesh(bm)
def under(x):          # the jib's underside at x: the lowest thing met above the brace, looking up from under the jib across its width
    best = None
    for i in range(9):
        y = (jy + (i + 0.5) * (-2 * jy) / 9) * k; z = (under0 - 0.06) * k
        hit = tree.ray_cast(mathutils.Vector((x, y, z)), mathutils.Vector((0, 0, 1)))
        if hit[0] is not None and (best is None or hit[0].z < best): best = hit[0].z
    return best
def g(c): return "(%.3f, %.3f, %.3f)" % (c[0], c[2], -c[1])
vs = [v.co for v in bm.verts]
tipv = [c for c in vs if c.x > TIP - 0.02]; tip_wood = [v.co for f in bm.faces if f.material_index == W for v in f.verts if v.co.x > TIP - 0.6]
endv = [c for c in vs if c.y < y_end * k + 0.02]
gold_low = [v.co for f in bm.faces if f.material_index == G for v in f.verts if v.co.z < 0.1 * H * k]
back = min(c.x for c in vs); stone = [v.co for f in bm.faces if f.material_index == S for v in f.verts]
arm_end = min(v.co.x for f in bm.faces if f.material_index == W for v in f.verts if v.co.z > under0 * k - 0.1)
print("CRANE triangles", len(bm.faces), "parts", {n: sum(1 for f in bm.faces if f.material_index == i) for i, n in enumerate(names)}, "| scale", round(k, 3), "jib slope taken out", round(slope, 4), "plain jib lengthened x", round(fx, 3))
print("CRANE size x %.3f..%.3f, up 0..%.3f, z %.3f..%.3f" % (min(c.x for c in vs), max(c.x for c in vs), max(c.z for c in vs), min(-c.y for c in vs), max(-c.y for c in vs)))
print("CRANE mast timber top %.3f, highest point (pulley on the mast head) %.3f" % (mast_top * k, max(c.z for c in vs if math.hypot(c.x, c.y) < 0.4)))
def over(x): return tree.ray_cast(mathutils.Vector((x, jy * 0.6 * k, H * k + 1.0)), mathutils.Vector((0, 0, -1)))[0].z       # beside the rope that lies on it
print("CRANE jib underside at 1.0: %.3f, at 2.0: %.3f, at 3.4: %.3f; jib top at 1.0: %.3f, at 2.0: %.3f, at 3.4: %.3f; jib z from %.3f to %.3f" % (under(1.0), under(2.0), under(3.4), over(1.0), over(2.0), over(3.4), -jw[1] * k, -jw[0] * k))
bx = 0.5; free = under(2.0)
while bx < TIP and tree.ray_cast(mathutils.Vector((bx, 0.0, dz1 * k + 0.05)), mathutils.Vector((0, 0, 1)))[0].z < free - 0.03: bx += 0.02
print("CRANE the brace lies under the jib's middle as far as x %.2f (its underside is at %.3f up at x 1.0); beyond that the jib's underside is free" % (bx, tree.ray_cast(mathutils.Vector((1.0, 0.0, dz1 * k + 0.05)), mathutils.Vector((0, 0, 1)))[0].z))
print("CRANE tip: furthest point", g(max(vs, key=lambda c: c.x)), "timber end x %.3f, up %.3f..%.3f" % (max(c.x for c in tip_wood), min(c.z for c in tip_wood if c.x > TIP - 0.3), max(c.z for c in tip_wood if c.x > TIP - 0.3)))
print("CRANE windlass axle end (centre of its end face)", g(((min(c.x for c in endv) + max(c.x for c in endv)) / 2, y_end * k, (min(c.z for c in endv) + max(c.z for c in endv)) / 2)), "axle points along +z; end face %.3f wide, %.3f high" % (max(c.x for c in endv) - min(c.x for c in endv), max(c.z for c in endv) - min(c.z for c in endv)))
print("CRANE drum winding x %.3f..%.3f up to %.3f" % (dx0 * k, dx1 * k, dz1 * k))
print("CRANE turntable disc radius %.3f, top %.3f; toothed ring radius %.3f, top %.3f" % (disc_r * k, disc_top * k, max(math.hypot(c.x, c.y) for c in gold_low), max(c.z for c in gold_low)))
print("CRANE behind the axis: counter-arm timber to x %.3f; counterweight x %.3f..%.3f, up %.3f..%.3f, z %.3f..%.3f; furthest back x %.3f" % (arm_end, min(c.x for c in stone), max(c.x for c in stone), min(c.z for c in stone), max(c.z for c in stone), min(-c.y for c in stone), max(-c.y for c in stone), back))
bm.free()
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_apply=True)
