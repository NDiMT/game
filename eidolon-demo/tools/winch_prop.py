# Prepares the generated capstan for the game: sorts its faces into parts by colour (wood, rope, gold, stone), cuts
# the handwheel from the rest where the axle meets it, and saves two models: the base, standing on the ground at its
# pedestal's centre, and the wheel, with its hub at the origin and its axle along X, so the game can turn it.
# usage: python3.11 -I winch_prop.py -- <in.glb> <out base.glb> <out wheel.glb> [check.png]
import bpy, sys, math, colorsys, mathutils, bmesh
a = sys.argv[sys.argv.index('--') + 1:]
src, out_base, out_wheel = a[0], a[1], a[2]; check = a[3] if len(a) > 3 else ""
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
img = None
for n in me.materials[0].node_tree.nodes:
    if n.type == 'TEX_IMAGE' and n.image: img = n.image; break
W, H = img.size; px = list(img.pixels)
def tex(u, v):
    x = min(W - 1, max(0, int((u % 1.0) * W))); y = min(H - 1, max(0, int((v % 1.0) * H))); i = (y * W + x) * 4
    return px[i], px[i + 1], px[i + 2]
names = ["wood", "rope", "gold", "stone"]
zs = [v.co.z for v in me.vertices]; z0 = min(zs); h = max(zs) - z0
xs = [v.co.x for v in me.vertices]; xmax = max(xs)
low = [v.co for v in me.vertices if v.co.z < z0 + 0.15 * h]
pcx = (min(v.x for v in low) + max(v.x for v in low)) / 2; pcy = (min(v.y for v in low) + max(v.y for v in low)) / 2
prad = max(math.hypot(v.x - pcx, v.y - pcy) for v in low)
ped_top = max(v.co.z for v in me.vertices if v.co.x < pcx and math.hypot(v.co.x - pcx, v.co.y - pcy) > 0.8 * prad)   # the top of the marble pedestal
uvl = me.uv_layers.active.data
# The generator paints wood, rope and bronze in neighbouring browns, so colour alone will not part them: the place
# of a face decides first (pedestal or above it), then how pale and how yellow it is
def what(r, g, b, z):
    hh, ss, vv = colorsys.rgb_to_hsv(r, g, b); hue = hh * 360.0
    if z <= ped_top + 0.004: return "stone" if ss < 0.2 else "gold"          # the pedestal, and the lion ring on it
    if ss < 0.2 and vv > 0.45: return "rope"                                   # white: the turns of rope
    if hue >= 36.0 and vv > 0.58: return "gold"                                # yellow and bright: bands, gear, hub
    if vv > 0.58 and ss < 0.42: return "rope"                                  # the shade between the turns
    return "wood"
kind = []
for p in me.polygons:
    uvs = [uvl[li].uv for li in p.loop_indices]
    c = mathutils.Vector((sum(u.x for u in uvs) / len(uvs), sum(u.y for u in uvs) / len(uvs)))
    votes = {}
    for q in [c] + [c.lerp(u, 0.55) for u in uvs]:
        k = what(*tex(q.x, q.y), p.center.z)
        votes[k] = votes.get(k, 0) + (1.5 if q is c else 1.0)
    kind.append(max(votes, key=votes.get))
edge_faces = {}
for p in me.polygons:
    for ek in p.edge_keys: edge_faces.setdefault(ek, []).append(p.index)
for _pass in range(2):
    nk = list(kind)
    for p in me.polygons:
        around = [kind[f] for ek in p.edge_keys for f in edge_faces[ek] if f != p.index]
        if len(around) >= 2 and kind[p.index] not in around: nk[p.index] = max(set(around), key=around.count)
    kind = nk
# the wheel: the thin wide disc at the far end of the axle
end = [v.co for v in me.vertices if v.co.x > xmax - 0.04]
yc = (min(v.y for v in end) + max(v.y for v in end)) / 2; zc = (min(v.z for v in end) + max(v.z for v in end)) / 2
rmax = max(math.hypot(v.y - yc, v.z - zc) for v in end)
cut = xmax; step = 0.006; inside = False
while cut > 0.0:      # walk back along the axle: into the wheel, then on until the slice is no longer as wide as it
    sl = [v.co for v in me.vertices if cut - step <= v.co.x < cut]
    rr = max(math.hypot(v.y - yc, v.z - zc) for v in sl) if sl else 0.0
    if rr > 0.8 * rmax: inside = True
    elif inside and rr < 0.55 * rmax: break
    cut -= step
hub_x = (cut + xmax) / 2
for p in me.polygons:        # the wheel carries no rope, only wood and its bronze hub; the cap of the drum is bronze
    if p.center.x > cut and kind[p.index] == "rope": kind[p.index] = "wood"
    if p.center.x <= cut and (p.center.z - z0) / h > 0.9 and kind[p.index] != "wood": kind[p.index] = "gold"
me.materials.clear()
for nm in names: me.materials.append(bpy.data.materials.new(nm))
for p in me.polygons: p.material_index = names.index(kind[p.index]); p.use_smooth = False
print("WINCH parts", {k: kind.count(k) for k in names}, "cut at x", round(cut, 3), "wheel radius", round(rmax, 3), "hub at", [round(hub_x - pcx, 3), round(yc - pcy, 3), round(zc - z0, 3)], "height", round(h, 3))
# two objects
bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.ops.object.duplicate(); wheel = bpy.context.view_layer.objects.active; wheel.name = "wheel"; ob.name = "base"
for o, keep_wheel in ((ob, False), (wheel, True)):
    bm = bmesh.new(); bm.from_mesh(o.data)
    dead = [f for f in bm.faces if (f.calc_center_median().x > cut) != keep_wheel]
    bmesh.ops.delete(bm, geom=dead, context='FACES'); bm.to_mesh(o.data); bm.free()
ob.location = (-pcx, -pcy, -z0); wheel.location = (-hub_x, -yc, -zc)
for o in (ob, wheel):
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o; bpy.ops.object.transform_apply(location=True)
if check:
    shown = {"wood": (0.6, 0.4, 0.28, 1), "rope": (0.92, 0.88, 0.76, 1), "gold": (0.9, 0.72, 0.3, 1), "stone": (0.95, 0.95, 0.95, 1)}
    for m in bpy.data.materials:
        if m.name.split('.')[0] in shown:
            m.use_nodes = True; bs = m.node_tree.nodes["Principled BSDF"]; bs.inputs["Base Color"].default_value = shown[m.name.split('.')[0]]; bs.inputs["Roughness"].default_value = 1.0
    wheel.location = (hub_x - pcx + 0.12, yc - pcy, zc - z0)      # shown a little apart, to see the cut
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 8; sc.cycles.use_denoising = False; sc.render.resolution_x = 420; sc.render.resolution_y = 420
    w = bpy.data.worlds.new('w'); w.use_nodes = True; w.node_tree.nodes["Background"].inputs[0].default_value = (0.5, 0.5, 0.5, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 0.8; sc.world = w
    sl2 = bpy.data.lights.new('s', 'SUN'); sl2.energy = 2.5; so = bpy.data.objects.new('s', sl2); sc.collection.objects.link(so); so.rotation_euler = (0.9, 0.1, 0.5)
    cd = bpy.data.cameras.new('c'); c = bpy.data.objects.new('c', cd); sc.collection.objects.link(c); sc.camera = c
    c.location = (1.4, -2.2, 1.6); d = mathutils.Vector((0.1, 0, 0.5)) - c.location; c.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler(); cd.lens = 60
    sc.render.filepath = check; bpy.ops.render.render(write_still=True)
    wheel.location = (0, 0, 0)
for o, path in ((ob, out_base), (wheel, out_wheel)):
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True)
