# Prepares a Tripo mirror model for the game: turns it to face +Z, stands it on the ground at the origin, and gives the
# faces of its glass a material of their own ("glass"), found by the colour of the texture, so that the game can put a
# reflecting surface there.   usage: python3.11 -I mirror_prop.py -- <in.glb> <out.glb> <turn in quarter turns> <check.png or -> [glass 1|0] [lowest glass, as a part of the height]
import bpy, sys, math, mathutils
a = sys.argv[sys.argv.index('--') + 1:]
src, out, quarter = a[0], a[1], int(a[2]); check = a[3] if len(a) > 3 and a[3] != "-" else ""; want_glass = len(a) < 5 or a[4] == "1"; low = float(a[5]) if len(a) > 5 else 0.0
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
zs = [v.co.z for v in me.vertices]; xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]
img = None
for n in me.materials[0].node_tree.nodes:
    if n.type == 'TEX_IMAGE' and n.image: img = n.image; break
W, H = img.size; px = list(img.pixels)
def tex(u, v):
    x = min(W - 1, max(0, int((u % 1.0) * W))); y = min(H - 1, max(0, int((v % 1.0) * H))); i = (y * W + x) * 4
    return px[i], px[i + 1], px[i + 2]
gm = bpy.data.materials.new("glass"); gm.use_nodes = True
gm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.2, 0.9, 1.0, 1.0)
uvl = me.uv_layers.active.data
h = max(zs) - min(zs)
ob.location = (-(min(xs) + max(xs)) / 2, 0.0, -min(zs))
bpy.ops.object.transform_apply(location=True)
# the glass: flat faces that look straight forward (or straight back) and are painted dark or blue
def pane(sign):
    rows = []   # (area, x0, x1, z0, z1, y)
    for p in me.polygons:
        if p.normal.y * sign < 0.93: continue
        uvs = [uvl[li].uv for li in p.loop_indices]
        c = mathutils.Vector((sum(u.x for u in uvs) / len(uvs), sum(u.y for u in uvs) / len(uvs)))
        pts = [c] + [c.lerp(u, 0.6) for u in uvs]; hit = 0
        for q in pts:
            r, g, b = tex(q.x, q.y)
            if (b - r > 0.035 and b > g - 0.03) or (r + g + b) < 0.5 or (abs(r - b) < 0.05 and r < 0.62 and b >= r - 0.01): hit += 1
        if hit * 2 <= len(pts): continue
        co = [me.vertices[vi].co for vi in p.vertices]
        if not (0.1 * h < p.center.z < 0.95 * h): continue
        rows.append((p.area, min(v.x for v in co), max(v.x for v in co), min(v.z for v in co), max(v.z for v in co), p.center.y))
    area = sum(r[0] for r in rows)
    if area < 0.004: return None
    ys = sorted((r[5], r[0]) for r in rows); acc = 0.0; ymed = ys[0][0]
    for y, ar in ys:
        acc += ar
        if acc >= area * 0.5: ymed = y; break
    rows = [r for r in rows if abs(r[5] - ymed) < 0.02]
    return (min(r[1] for r in rows), max(r[2] for r in rows), min(r[3] for r in rows), max(r[4] for r in rows), ymed, area)
quads = []
for sign in (-1.0, 1.0):
    g = pane(sign) if want_glass else None
    print("PANE", out.split('/')[-1], "front" if sign < 0 else "back", None if g is None else [round(v, 3) for v in g])
    if g is None: continue
    x0, x1, z0, z1, y, _a = g; y += sign * 0.004; z0 = max(z0, low * h)
    m2 = bpy.data.meshes.new("glass_%s" % ("f" if sign < 0 else "b"))
    vs = [(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)]
    m2.from_pydata(vs, [], [(0, 1, 2, 3)] if sign < 0 else [(3, 2, 1, 0)]); m2.update()
    uv = m2.uv_layers.new(name="UVMap")
    for li, l in enumerate(m2.loops):
        v = vs[l.vertex_index]; uv.data[li].uv = ((v[0] - x0) / (x1 - x0), (v[2] - z0) / (z1 - z0))
    m2.materials.append(gm)
    o2 = bpy.data.objects.new(m2.name, m2); bpy.context.scene.collection.objects.link(o2); quads.append(o2)
print("SIZE", out.split('/')[-1], "height", round(h, 3), "width", round(max(xs) - min(xs), 3))
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_apply=True)
if check:
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 8; sc.cycles.use_denoising = False
    sc.render.resolution_x = 300; sc.render.resolution_y = 420
    w = bpy.data.worlds.new('w'); w.use_nodes = True; w.node_tree.nodes["Background"].inputs[0].default_value = (0.8, 0.8, 0.8, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 1.6; sc.world = w
    bs = me.materials[0].node_tree.nodes.get("Principled BSDF")
    if bs: bs.inputs["Metallic"].default_value = 0.0; bs.inputs["Roughness"].default_value = 1.0
    cd = bpy.data.cameras.new('c'); c = bpy.data.objects.new('c', cd); sc.collection.objects.link(c); sc.camera = c
    c.location = (1.3, -2.2, 1.5); d = mathutils.Vector((0, 0, 0.5)) - c.location; c.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler(); cd.lens = 60
    sc.render.filepath = check; bpy.ops.render.render(write_still=True)
