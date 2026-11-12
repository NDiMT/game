# Second pass for the inscribed stele (after flat_prop.py has sorted it into stone and gold): brings the slab to its
# size (given total height, the slab's width and thickness; the base and pediment follow), stands it on the ground
# with the slab's middle on the origin, front towards the game's +Z, and cuts the sculptor's writing into the sunk
# panel of its front: rows of short abstract strokes, a part of their own ("dark"), lying a hair before the panel.
# before it: flat_prop.py -- raw.glb flat.glb "stone=#e9e6e0,stone=#c9c4bc,gold=#e8b43a,gold=#c08a2a"
# usage: python3.11 -I stele_prop.py -- <in.glb> <out.glb> [height 1.25] [slab width 0.5] [slab thickness 0.14] [rows 6] [most triangles 1200]
import bpy, sys, math, random, bmesh, mathutils
from mathutils.bvhtree import BVHTree
a = sys.argv[sys.argv.index('--') + 1:]
src, out = a[0], a[1]
H = float(a[2]) if len(a) > 2 else 1.25; SW = float(a[3]) if len(a) > 3 else 0.5; ST = float(a[4]) if len(a) > 4 else 0.14
rows = int(a[5]) if len(a) > 5 else 6; most = int(a[6]) if len(a) > 6 else 1200
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
obs = [o for o in bpy.data.objects if o.type == 'MESH']
for o in obs: o.select_set(True)
bpy.context.view_layer.objects.active = obs[0]
if len(obs) > 1: bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
me = ob.data
# the slab is what stands at mid height; here Z is up and the front looks along -Y (the game's +Z)
zs = [v.co.z for v in me.vertices]; z0 = min(zs); h = max(zs) - z0
band = [me.vertices[i].co for p in me.polygons if min(me.vertices[i].co.z for i in p.vertices) < z0 + 0.45 * h < max(me.vertices[i].co.z for i in p.vertices) for i in p.vertices]
bx0, bx1 = min(v.x for v in band), max(v.x for v in band); by0, by1 = min(v.y for v in band), max(v.y for v in band)
sx, sy, sz = SW / (bx1 - bx0), ST / (by1 - by0), H / h
for v in me.vertices: v.co = mathutils.Vector(((v.co.x - (bx0 + bx1) / 2) * sx, (v.co.y - (by0 + by1) / 2) * sy, (v.co.z - z0) * sz))
me.update()
# the sunk panel: where a look at the front from before it goes deepest
bm = bmesh.new(); bm.from_mesh(me); tree = BVHTree.FromBMesh(bm)
nx, nz = 60, 120; deep = {}
for i in range(nx):
    for j in range(nz):
        x = -SW / 2 + (i + 0.5) * SW / nx; z = (0.12 + 0.76 * (j + 0.5) / nz) * H
        hit = tree.ray_cast(mathutils.Vector((x, -5.0, z)), mathutils.Vector((0, 1, 0)))
        if hit[0] is not None: deep[(i, j)] = (x, z, hit[0].y)
mid = sorted(d[2] for d in deep.values() if abs(d[0]) < SW * 0.2 and 0.35 * H < d[1] < 0.6 * H)
py = mid[len(mid) // 2]                                  # the panel's face
inpanel = [d for d in deep.values() if abs(d[2] - py) < 0.0035]
# its rectangle: the rows and columns of the look that lie in it nearly whole
colx = {}; rowz = {}
for d in inpanel: colx[d[0]] = colx.get(d[0], 0) + 1; rowz[d[1]] = rowz.get(d[1], 0) + 1
gx = [x for x, n in colx.items() if n > 0.8 * max(colx.values())]; gz = [z for z, n in rowz.items() if n > 0.8 * max(rowz.values())]
px0, px1, pz0, pz1 = min(gx), max(gx), min(gz), max(gz)
front = min(d[2] for d in deep.values() if px0 <= d[0] <= px1 and pz0 <= d[1] <= pz1)   # nothing of the panel stands before this
# the writing: each sign is one or two short bars, in words, in rows; the last row stops short, as a text does
SIGNS = [[(0.5, 0, 0.5, 1)], [(0.15, 0, 0.85, 1)], [(0.85, 0, 0.15, 1)], [(0, 0.5, 1, 0.5)], [(0.1, 0, 0.1, 1), (0.1, 1, 1, 1)], [(0, 0, 0.5, 1), (0.5, 1, 1, 0)],
         [(0.5, 0, 0.5, 1), (0, 1, 1, 1)], [(0.1, 0, 0.1, 1), (0.1, 0, 1, 0)], [(0, 1, 0.5, 0), (0.5, 0, 1, 1)], [(0, 0.15, 1, 0.15), (0, 0.85, 1, 0.85)], [(0.2, 0, 0.2, 1), (0.8, 0, 0.8, 1)]]
rnd = random.Random(11)
pw, ph = px1 - px0, pz1 - pz0
pitch = ph / (rows + 0.6); gh = pitch * 0.5; gw = gh * 0.5; gap = gw * 0.55; th = gh * 0.17; mx = pw * 0.09
dark = bpy.data.materials.new("dark"); me.materials.append(dark); di = len(me.materials) - 1
tris = sum(len(p.vertices) - 2 for p in me.polygons); bars = 0
yq = front - 0.003
def bar(x0, z0, x1, z1):
    d = mathutils.Vector((x1 - x0, z1 - z0)); d.normalize(); n = mathutils.Vector((-d.y, d.x)) * th / 2; e = d * th / 2
    q = [(x0 - e.x - n.x, z0 - e.y - n.y), (x1 + e.x - n.x, z1 + e.y - n.y), (x1 + e.x + n.x, z1 + e.y + n.y), (x0 - e.x + n.x, z0 - e.y + n.y)]
    f = bm.faces.new([bm.verts.new((x, yq, z)) for x, z in q]); f.material_index = di
    if f.normal.y > 0: f.normal_flip()
for r in range(rows):
    zb = pz1 - pitch * (r + 0.8) - gh / 2; x = px0 + mx; end = px1 - mx - (pw * 0.35 if r == rows - 1 else 0.0); left = rnd.randint(2, 5)
    while x + gw <= end and tris + bars * 2 + 4 <= most:
        sign = SIGNS[rnd.randrange(len(SIGNS))]
        for (u0, v0, u1, v1) in sign: bar(x + u0 * gw, zb + v0 * gh, x + u1 * gw, zb + v1 * gh); bars += 1
        x += gw + gap; left -= 1
        if left == 0: x += gap * 1.6; left = rnd.randint(2, 5)
bm.normal_update(); bm.to_mesh(me); bm.free()
for p in me.polygons: p.use_smooth = False
vs = [v.co for v in me.vertices]
print("STELE size (x, depth, up)", [round(max(v[i] for v in vs) - min(v[i] for v in vs), 3) for i in range(3)], "slab", SW, ST, "panel x", round(px0, 3), round(px1, 3), "up", round(pz0, 3), round(pz1, 3),
      "panel face at depth", round(-py, 4), "front of slab at", round(ST / 2, 4), "bars", bars, "triangles", sum(len(p.vertices) - 2 for p in me.polygons), "parts", [m.name for m in me.materials])
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_apply=True)
