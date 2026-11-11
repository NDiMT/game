# The heroine for a phone: the same rigged model with a smoother surface and far fewer triangles. What the game
# needs of her texture (hero_tex.py: the folds of cloth and marble, and the distance to the cloth's edge) is written
# into the vertices of the full mesh before it is thinned, and no picture ships: no texture seams, no blur, no
# texture memory, and the edge of the cloth stays a clean line because a distance is carried, not a yes or no.
#   vertex colour: R folds of the cloth, G folds of the marble, B shade where cloth meets marble, A cloth (> 0.5) or marble
# usage: python3.11 -I hero_opt.py -- <in.glb> <out.glb> <faces wanted> <data picture from hero_tex.py> [smoothing passes]
#        python3.11 -I hero_opt.py -- <in.glb> - dump <save the model's own texture here>
import bpy, sys
import numpy as np
a = sys.argv[sys.argv.index('--') + 1:]
src, out = a[0], a[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
if a[2] == "dump":
    im = max(bpy.data.images, key=lambda i: i.size[0]); im.filepath_raw = a[3]; im.file_format = 'PNG'; im.save(); sys.exit(0)
want, tex = int(a[2]), a[3]; passes = int(a[4]) if len(a) > 4 else 2
body = max((o for o in bpy.data.objects if o.type == 'MESH'), key=lambda o: len(o.data.polygons))
me = body.data; n0 = len(me.polygons)
clean = bpy.data.images.load(tex); W, H = clean.size
px = np.array(clean.pixels[:], dtype=np.float32).reshape(H, W, 4)[..., :3]
nl = len(me.loops)
uv = np.empty(nl * 2, dtype=np.float32); me.uv_layers.active.data.foreach_get("uv", uv); uv = uv.reshape(nl, 2)
xi = np.clip((np.mod(uv[:, 0], 1.0) * W).astype(np.int64), 0, W - 1); yi = np.clip((np.mod(uv[:, 1], 1.0) * H).astype(np.int64), 0, H - 1)
ldat = px[yi, xi].astype(np.float64)
vi = np.empty(nl, dtype=np.int64); me.loops.foreach_get("vertex_index", vi)
nv = len(me.vertices)
vdat = np.zeros((nv, 3)); cnt = np.zeros(nv); np.add.at(vdat, vi, ldat); np.add.at(cnt, vi, 1.0); vdat /= np.maximum(cnt, 1.0)[:, None]
cloth = vdat[:, 2] > 0.5
ne = len(me.edges); ev = np.empty(ne * 2, dtype=np.int64); me.edges.foreach_get("vertices", ev); ev = ev.reshape(ne, 2)
co = np.empty(nv * 3, dtype=np.float64); me.vertices.foreach_get("co", co); co = co.reshape(nv, 3)
elen = np.linalg.norm(co[ev[:, 0]] - co[ev[:, 1]], axis=1)
adj = [[] for _ in range(nv)]
for (p0, p1), ln in zip(ev, elen): adj[p0].append((p1, ln)); adj[p1].append((p0, ln))
# how far each vertex lies from the edge of the cloth, along the surface (for a soft shade where cloth meets marble)
import heapq
ext = co.max(axis=0) - co.min(axis=0); height = ext.max()
dist = np.full(nv, 1e9); heap = []
d = cloth[ev[:, 0]] != cloth[ev[:, 1]]
for p0, p1, ln in zip(ev[d, 0], ev[d, 1], elen[d]):
    s0 = abs(vdat[p0, 2] - 0.5); s1 = abs(vdat[p1, 2] - 0.5); t = s0 / max(s0 + s1, 1e-6)      # where on this edge the cloth ends
    for q, dq in ((p0, ln * t), (p1, ln * (1.0 - t))):
        if dq < dist[q]: dist[q] = dq; heapq.heappush(heap, (dq, q))
far = 0.05 * height / 1.72
while heap:
    dq, q = heapq.heappop(heap)
    if dq > dist[q] or dq > far: continue
    for w, ln in adj[q]:
        if dq + ln < dist[w]: dist[w] = dq + ln; heapq.heappush(heap, (dq + ln, w))
shade = np.clip(dist / far, 0.0, 1.0)
print("PAINT cloth vertices", int(cloth.sum()), "of", nv, "near the edge", int((shade < 1.0).sum()))
ca = me.color_attributes.new("Col", 'FLOAT_COLOR', 'POINT')
ca.data.foreach_set("color", np.stack([vdat[:, 0], vdat[:, 1], shade, vdat[:, 2]], axis=1).astype(np.float32).ravel())
me.color_attributes.active_color = ca; me.color_attributes.render_color_index = me.color_attributes.find("Col")
while me.uv_layers: me.uv_layers.remove(me.uv_layers[0])          # no picture, so no unwrap either: nothing holds the thinning back at seams
bpy.ops.object.select_all(action='DESELECT'); body.select_set(True); bpy.context.view_layer.objects.active = body
def apply_first(name):
    while body.modifiers[0].name != name: bpy.ops.object.modifier_move_up(modifier=name)
    bpy.ops.object.modifier_apply(modifier=name)
if passes > 0:   # even out the lumps of the generated surface, keeping its volume
    m = body.modifiers.new("smooth", 'LAPLACIANSMOOTH'); m.iterations = passes; m.lambda_factor = 0.35; m.lambda_border = 0.0; m.use_volume_preserve = True
    apply_first("smooth")
if want < n0:
    d = body.modifiers.new("dec", 'DECIMATE'); d.decimate_type = 'COLLAPSE'; d.ratio = want / n0; d.use_collapse_triangulate = True
    apply_first("dec")
me = body.data
for p in me.polygons: p.use_smooth = True
try: bpy.ops.mesh.customdata_custom_splitnormals_clear()
except Exception as e: print("NOTE normals", e)
for mat in me.materials:                                           # and the material carries no image
    nt = mat.node_tree
    for nd in [n for n in nt.nodes if n.type == 'TEX_IMAGE']: nt.nodes.remove(nd)
for im in list(bpy.data.images):
    if im.users == 0: bpy.data.images.remove(im)
print("HERO", out.split('/')[-1], "faces", n0, "->", len(me.polygons), "verts", len(me.vertices), "colour", [c.name for c in me.color_attributes], "actions", [x.name for x in bpy.data.actions])
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=True, export_skins=True, export_animation_mode='ACTIONS', export_optimize_animation_size=True,
    export_vertex_color='ACTIVE', export_active_vertex_color_when_no_material=True, export_image_format='NONE', export_texcoords=False)
