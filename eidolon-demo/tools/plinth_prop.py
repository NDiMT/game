# Prepares the generated turning plinth for the game: sorts its faces into parts by colour (stone, gold, crim), turns
# it so its red pointer looks along the game's +Z, and cuts it level where the bronze gear lies on the marble base.
# Saves two models about the same upright axis: the base, standing on the ground, closed by a disc where the gear
# covered it, and the top (gear and drum), which the game turns on it.
# usage: python3.11 -I plinth_prop.py -- <in.glb> <out base.glb> <out top.glb> [check.png]
import bpy, sys, math, colorsys, mathutils, bmesh
a = sys.argv[sys.argv.index('--') + 1:]
src, out_base, out_top = a[0], a[1], a[2]; check = a[3] if len(a) > 3 else ""
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
img = [n.image for n in me.materials[0].node_tree.nodes if n.type == 'TEX_IMAGE' and n.image][0]
W, H = img.size; px = list(img.pixels); uvl = me.uv_layers.active.data
def tex(u, v):
    x = min(W - 1, max(0, int((u % 1.0) * W))); y = min(H - 1, max(0, int((v % 1.0) * H))); i = (y * W + x) * 4
    return px[i], px[i + 1], px[i + 2]
# stand it on the ground about its own axis (the drum is the surest guide to where that is)
zs = [v.co.z for v in me.vertices]; z0 = min(zs); h = max(zs) - z0
hi = [v.co for v in me.vertices if v.co.z > z0 + 0.8 * h]
cx = (min(v.x for v in hi) + max(v.x for v in hi)) / 2; cy = (min(v.y for v in hi) + max(v.y for v in hi)) / 2
for v in me.vertices: v.co.x -= cx; v.co.y -= cy; v.co.z -= z0
me.update()
drum_r = max(math.hypot(v.co.x, v.co.y) for v in me.vertices if v.co.z > 0.8 * h)
def what(r, g, b):
    hh, ss, vv = colorsys.rgb_to_hsv(r, g, b)
    if ss > 0.55 and (hh < 0.04 or hh > 0.94) and vv > 0.35: return "crim"
    return "gold" if ss > 0.22 else "stone"
names = ["stone", "gold", "crim"]; kind = []
for p in me.polygons:
    uvs = [uvl[li].uv for li in p.loop_indices]
    c = mathutils.Vector((sum(u.x for u in uvs) / len(uvs), sum(u.y for u in uvs) / len(uvs)))
    votes = {}
    for q in [c] + [c.lerp(u, 0.55) for u in uvs]:
        k = what(*tex(q.x, q.y)); votes[k] = votes.get(k, 0) + (1.5 if q is c else 1.0)
    kind.append(max(votes, key=votes.get))
# the gear: the widest gold thing above the lowest fifth; the base's top is the ledge that shows outside it
gear_r = max(math.hypot(p.center.x, p.center.y) for p in me.polygons if kind[p.index] == "gold" and p.center.z > 0.2 * h and p.center.z < 0.5 * h)
cut = max(p.center.z for p in me.polygons if p.normal.z > 0.8 and math.hypot(p.center.x, p.center.y) > gear_r * 1.03) + 0.003
gear_top = max(p.center.z for p in me.polygons if math.hypot(p.center.x, p.center.y) > 0.8 * gear_r and p.center.z > cut)
red = [p for p in me.polygons if kind[p.index] == "crim" and 0.5 * h < p.center.z < 0.85 * h]
for p in me.polygons:
    z = p.center.z; r = math.hypot(p.center.x, p.center.y)
    if cut < z <= gear_top + 0.004: kind[p.index] = "gold"                  # the whole wheel is bronze, shaded or not
    elif kind[p.index] == "crim" and p not in red: kind[p.index] = "gold"   # copper studs
    elif z <= cut and kind[p.index] == "crim": kind[p.index] = "gold"
edge_faces = {}
for p in me.polygons:
    for ek in p.edge_keys: edge_faces.setdefault(ek, []).append(p.index)
for _pass in range(2):
    nk = list(kind)
    for p in me.polygons:
        around = [kind[f] for ek in p.edge_keys for f in edge_faces[ek] if f != p.index]
        if len(around) >= 2 and kind[p.index] not in around: nk[p.index] = max(set(around), key=around.count)
    kind = nk
# the pointer goes to the game's +Z, which is -Y here
ax = sum(p.center.x * p.area for p in red) / sum(p.area for p in red); ay = sum(p.center.y * p.area for p in red) / sum(p.area for p in red)
turn = -math.pi / 2 - math.atan2(ay, ax)
rot = mathutils.Matrix.Rotation(turn, 4, 'Z')
for v in me.vertices: v.co = rot @ v.co
me.update()
# how many teeth: runs of rim round the wheel
bins = [False] * 720
for v in me.vertices:
    if cut < v.co.z <= gear_top + 0.004 and math.hypot(v.co.x, v.co.y) > 0.955 * gear_r: bins[int((math.atan2(v.co.y, v.co.x) + math.pi) / (2 * math.pi) * 720) % 720] = True
teeth = sum(1 for i in range(720) if bins[i] and not bins[i - 1])
me.materials.clear()
for nm in names: me.materials.append(bpy.data.materials.new(nm))
for p in me.polygons: p.material_index = names.index(kind[p.index]); p.use_smooth = False
print("PLINTH parts", {k: kind.count(k) for k in names}, "height", round(h, 3), "cut", round(cut, 3), "gear top", round(gear_top, 3), "gear r", round(gear_r, 3), "drum r", round(drum_r, 3), "base r", round(max(math.hypot(v.co.x, v.co.y) for v in me.vertices), 3), "teeth runs", teeth)
bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.ops.object.duplicate(); top = bpy.context.view_layer.objects.active; top.name = "top"; ob.name = "base"
for o, keep_top in ((ob, False), (top, True)):
    bm = bmesh.new(); bm.from_mesh(o.data)
    dead = [f for f in bm.faces if (f.calc_center_median().z > cut) != keep_top]
    bmesh.ops.delete(bm, geom=dead, context='FACES')
    if not keep_top:       # where the wheel lay the base is open: close it with a disc of its own stone
        n = 28; cv = bm.verts.new((0, 0, cut)); ring = [bm.verts.new((math.cos(i * 2 * math.pi / n) * gear_r * 1.02, math.sin(i * 2 * math.pi / n) * gear_r * 1.02, cut)) for i in range(n)]
        for i in range(n): bm.faces.new((cv, ring[i], ring[(i + 1) % n])).material_index = 0
    bm.to_mesh(o.data); bm.free()
if check:
    shown = {"stone": (0.95, 0.95, 0.95, 1), "gold": (0.9, 0.72, 0.3, 1), "crim": (0.85, 0.1, 0.12, 1)}
    for m in bpy.data.materials:
        if m.name in shown:
            m.use_nodes = True; bs = m.node_tree.nodes["Principled BSDF"]; bs.inputs["Base Color"].default_value = shown[m.name]; bs.inputs["Roughness"].default_value = 1.0
    top.location = (1.15, 0, 0)
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 8; sc.cycles.use_denoising = False; sc.render.resolution_x = 640; sc.render.resolution_y = 360
    w = bpy.data.worlds.new('w'); w.use_nodes = True; w.node_tree.nodes["Background"].inputs[0].default_value = (0.5, 0.5, 0.5, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 0.8; sc.world = w
    sl = bpy.data.lights.new('s', 'SUN'); sl.energy = 2.5; so = bpy.data.objects.new('s', sl); sc.collection.objects.link(so); so.rotation_euler = (0.9, 0.1, 0.5)
    cd = bpy.data.cameras.new('c'); c = bpy.data.objects.new('c', cd); sc.collection.objects.link(c); sc.camera = c
    c.location = (0.575 + 1.2, -2.4, 1.9); d = mathutils.Vector((0.575, 0, 0.2)) - c.location; c.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler(); cd.lens = 55
    sc.render.filepath = check; bpy.ops.render.render(write_still=True)
    top.location = (0, 0, 0)
for o, path in ((ob, out_base), (top, out_top)):
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True, use_selection=True)
