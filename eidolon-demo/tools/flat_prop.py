# Prepares a generated low-poly model for the game's flat, palette-painted world: stands it on the ground at the
# origin, sorts every face into a named part by the colour painted on it, and drops the texture. The game then
# paints each part with a palette of its own (prop_model with "part:palette,...").
# usage: python3.11 -I flat_prop.py -- <in.glb> <out.glb> <parts "leaf=#3f9f95,trunk=#8a5a3c"> [drop "water,stone" or -] [quarter turns] [check.png or -] [rules]
# rules, where colour alone cannot tell parts apart: "glow:y>0.2&up>0.55;stone:up<0.16;axis=0.3-0.5" lets a part be only where
# its conditions hold (x, y: across from the axis; off: distance from it; all in units of the model's largest size; up: 0 at the
# foot, 1 at the top). axis=a-b takes the upright axis, and the model's place on the ground, from the band of height a..b
import bpy, sys, math, colorsys, mathutils
a = sys.argv[sys.argv.index('--') + 1:]
src, out = a[0], a[1]
refs = [(kv.split('=')[0], kv.split('=')[1].lstrip('#')) for kv in a[2].split(',')]
drop = [] if len(a) < 4 or a[3] == "-" else a[3].split(',')
quarter = int(a[4]) if len(a) > 4 else 0; check = a[5] if len(a) > 5 and a[5] != "-" else ""
rules = {}; band = None
for r in (a[6].split(';') if len(a) > 6 else []):
    if r.startswith("axis="): band = [float(x) for x in r[5:].split('-')]
    else: rules[r.split(':')[0]] = r.split(':')[1].split('&')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
obs = [o for o in bpy.data.objects if o.type == 'MESH']
for o in obs: o.select_set(True)
bpy.context.view_layer.objects.active = obs[0]
if len(obs) > 1: bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
ob.rotation_mode = 'XYZ'; ob.rotation_euler = (0.0, 0.0, quarter * math.pi / 2)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
me = ob.data
img = None
for n in me.materials[0].node_tree.nodes:
    if n.type == 'TEX_IMAGE' and n.image: img = n.image; break
W, H = img.size; px = list(img.pixels)
def tex(u, v):
    x = min(W - 1, max(0, int((u % 1.0) * W))); y = min(H - 1, max(0, int((v % 1.0) * H))); i = (y * W + x) * 4
    return px[i], px[i + 1], px[i + 2]
def space(r, g, b):          # hue and saturation count for more than lightness: the bake shades every colour
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    return (math.cos(h * 6.2832) * s, math.sin(h * 6.2832) * s, v * 0.45)
rp = [(nm, space(int(hx[0:2], 16) / 255.0, int(hx[2:4], 16) / 255.0, int(hx[4:6], 16) / 255.0)) for nm, hx in refs]
names = []
for nm, _ in refs:
    if nm not in names: names.append(nm)
uvl = me.uv_layers.active.data
vz = [v.co.z for v in me.vertices]; zlo = min(vz); zh = max(vz) - zlo
big = max(zh, max(v.co.x for v in me.vertices) - min(v.co.x for v in me.vertices), max(v.co.y for v in me.vertices) - min(v.co.y for v in me.vertices))
bv = [v.co for v in me.vertices if band is None or zlo + band[0] * zh <= v.co.z <= zlo + band[1] * zh]
axx = (min(v.x for v in bv) + max(v.x for v in bv)) / 2; axy = (min(v.y for v in bv) + max(v.y for v in bv)) / 2
def allowed(nm, c):
    val = {"x": (c.x - axx) / big, "y": (c.y - axy) / big, "up": (c.z - zlo) / zh, "off": math.hypot(c.x - axx, c.y - axy) / big}
    for cond in rules.get(nm, []):
        op = '>' if '>' in cond else '<'; var, num = cond.split(op)
        if (val[var] > float(num)) != (op == '>'): return False
    return True
kind = []
for p in me.polygons:
    uvs = [uvl[li].uv for li in p.loop_indices]
    c = mathutils.Vector((sum(u.x for u in uvs) / len(uvs), sum(u.y for u in uvs) / len(uvs)))
    votes = {}
    for q in [c] + [c.lerp(u, 0.55) for u in uvs]:
        s3 = space(*tex(q.x, q.y))
        k = min([r for r in rp if allowed(r[0], p.center)] or rp, key=lambda r: (r[1][0] - s3[0]) ** 2 + (r[1][1] - s3[1]) ** 2 + (r[1][2] - s3[2]) ** 2)[0]
        votes[k] = votes.get(k, 0) + (1.5 if q is c else 1.0)
    kind.append(max(votes, key=votes.get))
edge_faces = {}
for p in me.polygons:
    for ek in p.edge_keys: edge_faces.setdefault(ek, []).append(p.index)
for _pass in range(2):       # a face that stands alone among others of one part takes theirs
    nk = list(kind)
    for p in me.polygons:
        around = [kind[f] for ek in p.edge_keys for f in edge_faces[ek] if f != p.index]
        if len(around) >= 2 and kind[p.index] not in around: nk[p.index] = max(set(around), key=around.count)
    kind = nk
me.materials.clear()
for nm in names: me.materials.append(bpy.data.materials.new(nm))
for p in me.polygons: p.material_index = names.index(kind[p.index])
where = {}        # where each part sits (told below, in the model's final place): the game hangs lights and such there
for nm in names:
    fs = [p for p in me.polygons if kind[p.index] == nm]; ar = sum(p.area for p in fs) or 1.0
    where[nm] = [sum(p.center[i] * p.area for p in fs) / ar for i in range(3)]
if drop:
    import bmesh
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if names[f.material_index] in drop], context='FACES'); bm.to_mesh(me); bm.free()
xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]; zs = [v.co.z for v in me.vertices]
shift = (-axx, -axy, -min(zs)) if band else (-(min(xs) + max(xs)) / 2, -(min(ys) + max(ys)) / 2, -min(zs))
ob.location = shift
bpy.ops.object.transform_apply(location=True)
for p in me.polygons: p.use_smooth = False
print("WHERE (x, y, up)", {k: [round(where[k][i] + shift[i], 3) for i in range(3)] for k in names})
print("PARTS", out.split('/')[-1], {k: kind.count(k) for k in names}, "dropped", drop, "size", round(max(xs) - min(xs), 3), round(max(ys) - min(ys), 3), round(max(zs) - min(zs), 3))
if check:
    shown = {nm: (int(hx[0:2], 16) / 255.0, int(hx[2:4], 16) / 255.0, int(hx[4:6], 16) / 255.0, 1.0) for nm, hx in refs}
    for m in me.materials:
        m.use_nodes = True; bs = m.node_tree.nodes["Principled BSDF"]; bs.inputs["Base Color"].default_value = shown[m.name]; bs.inputs["Roughness"].default_value = 1.0
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 8; sc.cycles.use_denoising = False; sc.render.resolution_x = 300; sc.render.resolution_y = 360
    w = bpy.data.worlds.new('w'); w.use_nodes = True; w.node_tree.nodes["Background"].inputs[0].default_value = (0.5, 0.5, 0.5, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 0.8; sc.world = w
    sl = bpy.data.lights.new('s', 'SUN'); sl.energy = 2.5; so = bpy.data.objects.new('s', sl); sc.collection.objects.link(so); so.rotation_euler = (0.9, 0.1, 0.5)
    cd = bpy.data.cameras.new('c'); c = bpy.data.objects.new('c', cd); sc.collection.objects.link(c); sc.camera = c
    hgt = max(zs) - min(zs); wid = max(max(xs) - min(xs), max(ys) - min(ys)); r = max(hgt, wid) * 2.6
    c.location = (r * 0.5, -r * 0.8, hgt * 0.5 + r * 0.45); d = mathutils.Vector((0, 0, hgt * 0.45)) - c.location; c.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler(); cd.lens = 60
    sc.render.filepath = check; bpy.ops.render.render(write_still=True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_apply=True)
