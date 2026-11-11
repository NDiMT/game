# Prepares a Tripo mirror model for the game: turns it to face +Z, stands it on the ground at the origin, lays a face
# of its own ("glass") over its pane, so that the game can put a reflecting surface there, and sorts every other face
# by the colour painted on it into what it is made of (cloth, rope, gold, stone, gem, pane). The texture is then
# dropped: the game paints each part flat, with a colour of its own palette, like everything else in its world.   usage: python3.11 -I mirror_prop.py -- <in.glb> <out.glb> <turn in quarter turns> <check.png or -> [glass 1|0] [lowest glass, as a part of the height] [twin: one pane found, shown on both sides | shape: the pane is not a rectangle, its own faces become the glass]
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
def pane(sign, blue_only=True):
    rows = []   # (area, x0, x1, z0, z1, y, vertices)
    for p in me.polygons:
        if p.normal.y * sign < 0.93: continue
        uvs = [uvl[li].uv for li in p.loop_indices]
        c = mathutils.Vector((sum(u.x for u in uvs) / len(uvs), sum(u.y for u in uvs) / len(uvs)))
        pts = [c] + [c.lerp(u, 0.6) for u in uvs]; hit = 0
        for q in pts:
            r, g, b = tex(q.x, q.y)
            if (b - r > 0.035 and b > g - 0.03) or (not blue_only and ((r + g + b) < 0.5 or (abs(r - b) < 0.05 and r < 0.62 and b >= r - 0.01))): hit += 1
        if hit * 2 <= len(pts): continue
        co = [me.vertices[vi].co for vi in p.vertices]
        if not (0.1 * h < p.center.z < 0.95 * h): continue
        rows.append((p.area, min(v.x for v in co), max(v.x for v in co), min(v.z for v in co), max(v.z for v in co), p.center.y, co))
    area = sum(r[0] for r in rows)
    if area < 0.004: return pane(sign, False) if blue_only else None
    ys = sorted((r[5], r[0]) for r in rows); acc = 0.0; ymed = ys[0][0]
    for y, ar in ys:
        acc += ar
        if acc >= area * 0.5: ymed = y; break
    rows = [r for r in rows if abs(r[5] - ymed) < 0.04]
    # the pane may lean: y = ya + yb * z, fitted through its corners
    pts = [v for r in rows for v in r[6]]; n = len(pts)
    mz = sum(v.z for v in pts) / n; my = sum(v.y for v in pts) / n
    den = sum((v.z - mz) ** 2 for v in pts)
    yb = sum((v.z - mz) * (v.y - my) for v in pts) / den if den > 1e-9 else 0.0
    return {"x0": min(r[1] for r in rows), "x1": max(r[2] for r in rows), "z0": min(r[3] for r in rows), "z1": max(r[4] for r in rows), "ya": my - yb * mz, "yb": yb, "area": area}
# what each face is made of, by the colour painted on it
import colorsys
PARTS = ["cloth", "rope", "gold", "stone", "gem", "pane"]
def what(r, g, b, zrel, flat):
    hh, ss, vv = colorsys.rgb_to_hsv(r, g, b); hue = hh * 360.0
    if (hue < 8.0 or hue > 345.0) and ss > 0.7 and vv > 0.5 and zrel > 0.8: return "gem"
    if flat and ((b - r > 0.035 and b > g - 0.03) or vv < 0.2): return "pane"
    if ss < 0.2 and zrel < 0.075: return "stone"
    if ss > 0.3 and 8.0 < hue < 62.0: return "rope" if (hue < 27.0 or vv < 0.4) else "gold"
    if vv < 0.3: return "rope"
    return "cloth"
kind = []
for p in me.polygons:
    uvs = [uvl[li].uv for li in p.loop_indices]
    c = mathutils.Vector((sum(u.x for u in uvs) / len(uvs), sum(u.y for u in uvs) / len(uvs)))
    votes = {}
    for q in [c] + [c.lerp(u, 0.55) for u in uvs]:
        k = what(*tex(q.x, q.y), p.center.z / h, abs(p.normal.y) > 0.93)
        votes[k] = votes.get(k, 0) + (1.5 if q is c else 1.0)
    kind.append(max(votes, key=votes.get))
# a face that stands alone among others of one kind takes theirs (twice over)
edge_faces = {}
for p in me.polygons:
    for ek in p.edge_keys: edge_faces.setdefault(ek, []).append(p.index)
for _pass in range(2):
    nk = list(kind)
    for p in me.polygons:
        around = [kind[f] for ek in p.edge_keys for f in edge_faces[ek] if f != p.index]
        if len(around) >= 2 and kind[p.index] not in around and kind[p.index] != "gem":
            nk[p.index] = max(set(around), key=around.count)
    kind = nk
me.materials.clear()
for nm in PARTS: me.materials.append(bpy.data.materials.new(nm))
for p in me.polygons: p.material_index = PARTS.index(kind[p.index])
me.update()
if kind.count("gem") > 60: kind = ["rope" if k == "gem" else k for k in kind]   # a gem is small: this is red rope
for p in me.polygons: p.material_index = PARTS.index(kind[p.index])
print("PARTS", out.split('/')[-1], {k: kind.count(k) for k in PARTS})
shown = {"cloth": (0.93, 0.9, 0.82, 1), "rope": (0.45, 0.28, 0.2, 1), "gold": (0.9, 0.72, 0.3, 1), "stone": (0.95, 0.95, 0.95, 1), "gem": (0.85, 0.1, 0.12, 1), "pane": (0.3, 0.33, 0.4, 1)}
for m in me.materials:
    m.use_nodes = True; bs = m.node_tree.nodes["Principled BSDF"]; bs.inputs["Base Color"].default_value = shown[m.name]; bs.inputs["Roughness"].default_value = 1.0
quads = []; twin = len(a) > 6 and a[6] == "twin"; shape = len(a) > 6 and a[6] == "shape"
found = {sg: (pane(sg) if want_glass and not shape else None) for sg in (-1.0, 1.0)}
if shape:   # a round or oval pane: its own faces show the reflection
    gi = [p.index for p in me.polygons if kind[p.index] == "pane" and 0.1 * h < p.center.z < 0.97 * h]
    if gi:
        vs = [me.vertices[i].co for f in gi for i in me.polygons[f].vertices]
        x0, x1, z0, z1 = min(v.x for v in vs), max(v.x for v in vs), min(v.z for v in vs), max(v.z for v in vs)
        me.materials.append(gm); slot = len(me.materials) - 1
        for f in gi:
            me.polygons[f].material_index = slot
            for li in me.polygons[f].loop_indices:
                v = me.vertices[me.loops[li].vertex_index].co; uvl[li].uv = ((v.x - x0) / (x1 - x0), (v.z - z0) / (z1 - z0))
    print("SHAPE", out.split('/')[-1], len(gi), "faces")
both = [g for g in found.values() if g is not None]
if twin and both:
    best = max(both, key=lambda g: g["area"]); found = {-1.0: best, 1.0: best}
rect = max(both, key=lambda g: g["area"]) if both else None
pane_ys = [] if rect is None else [v.co.y for p in me.polygons if kind[p.index] == "pane" and p.area > 0.02 and abs(p.center.y - (rect["ya"] + rect["yb"] * p.center.z)) < 0.035
    and rect["x0"] - 0.02 < p.center.x < rect["x1"] + 0.02 and rect["z0"] - 0.02 < p.center.z < rect["z1"] + 0.02 for v in [me.vertices[i] for i in p.vertices]]   # the big faces of the pane itself
for sign in (-1.0, 1.0):
    g = found[sign]
    print("PANE", out.split('/')[-1], "front" if sign < 0 else "back", None if g is None else {k: round(v, 3) for k, v in g.items()})
    if g is None: continue
    x0, x1, z0, z1 = g["x0"], g["x1"], max(g["z0"], low * h), g["z1"]
    def yat(z):   # just outside whatever of the pane lies outermost on this side
        ys = [o["ya"] + o["yb"] * z for o in both] + pane_ys
        return (min(ys) if sign < 0 else max(ys)) + sign * 0.005
    m2 = bpy.data.meshes.new("glass_%s" % ("f" if sign < 0 else "b"))
    vs = [(x0, yat(z0), z0), (x1, yat(z0), z0), (x1, yat(z1), z1), (x0, yat(z1), z1)]
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
    w = bpy.data.worlds.new('w'); w.use_nodes = True; w.node_tree.nodes["Background"].inputs[0].default_value = (0.5, 0.5, 0.5, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 0.7; sc.world = w
    sl = bpy.data.lights.new('s', 'SUN'); sl.energy = 2.5; so = bpy.data.objects.new('s', sl); sc.collection.objects.link(so); so.rotation_euler = (0.9, 0.1, 0.5)
    for p in me.polygons: p.use_smooth = False
    cd = bpy.data.cameras.new('c'); c = bpy.data.objects.new('c', cd); sc.collection.objects.link(c); sc.camera = c
    c.location = (1.3, -2.2, 1.5); d = mathutils.Vector((0, 0, 0.5)) - c.location; c.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler(); cd.lens = 60
    sc.render.filepath = check; bpy.ops.render.render(write_still=True)
