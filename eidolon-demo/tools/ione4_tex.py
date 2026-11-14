# The heroine's "ione4" data picture: what the game's shader needs to draw her cloth and her marble richly, baked
# from the generated model into its own unwrap, 1024 px. No colours are stored: the game sets the red and the white.
#   R  light and dark of the surface, halved (0.5 = plain): the flat planes of a low-poly cut of her (facets of the
#      marble, broad folds of the cloth), the ridges and hollows of the folds, the veins and the crack of the marble
#   G  cloth (1) or marble (0), as a soft ramp across the edge (0.5 on the edge) so the game can draw the edge sharp
#   B  how open the surface is (1) or how deep under a band or in a fold (0): shade under the torn edges
# usage: python3.11 -I ione4_tex.py -- <model.glb from the generator, with its own 4096 colour picture> <out.png> [size 1024]
import bpy, bmesh, sys, os, math
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from scipy.ndimage import gaussian_filter, distance_transform_edt, label, zoom
a = sys.argv[sys.argv.index('--') + 1:]
src, out = a[0], a[1]; SIZE = int(a[2]) if len(a) > 2 else 1024
N = SIZE * 2                                     # worked out at twice the size, then halved
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
sc = bpy.context.scene
body = max((o for o in bpy.data.objects if o.type == 'MESH'), key=lambda o: len(o.data.polygons))
me = body.data
col_im = next(i for i in bpy.data.images if i.name.startswith("Color") or "Color" in i.name)
CW, CH = col_im.size
cpx = np.array(col_im.pixels[:], dtype=np.float32).reshape(CH, CW, 4)[..., :3]     # row 0 = bottom (v = 0)
print("TEX colour picture", col_im.name, CW, CH)

# ---- the cloth, from the generated colours (red against white), its edge drawn smooth, specks removed
r, g, b = cpx[..., 0], cpx[..., 1], cpx[..., 2]
m0 = np.clip((r - b - 0.08) / 0.12, 0.0, 1.0)
mb = gaussian_filter(m0, 4.0, mode="wrap") > 0.5
for kind in (True, False):
    lab, n = label(mb == kind)
    if n:
        sizes = np.bincount(lab.ravel()); small = sizes < 400; small[0] = False
        mb = np.where(small[lab], not kind, mb)
lum = 0.3 * r + 0.55 * g + 0.15 * b
sd = distance_transform_edt(mb) - distance_transform_edt(~mb)                       # texels of the 4096 picture
def to_n(x):                                     # a 4096 map brought to N by averaging
    k = CW // N
    return x.reshape(N, k, N, k).mean(axis=(1, 3)) if k >= 1 and CW % N == 0 else zoom(x, N / CW, order=1)
mask_soft = to_n(np.clip(0.5 + sd / 24.0, 0.0, 1.0).astype(np.float32))            # ramp 24 texels of 4096 = 6 of 1024 to each side
mask_bin = to_n(mb.astype(np.float32))
dark = to_n(np.clip((0.62 - lum) / 0.3, 0.0, 1.0) * (~mb))                          # dark drawing on the marble (the crack)

# ---- the mesh as arrays
me.calc_loop_triangles()
nv = len(me.vertices); nt = len(me.loop_triangles)
co = np.empty(nv * 3); me.vertices.foreach_get("co", co); co = co.reshape(nv, 3)
no = np.empty(nv * 3); me.vertices.foreach_get("normal", no); no = no.reshape(nv, 3)
tl = np.empty(nt * 3, dtype=np.int64); me.loop_triangles.foreach_get("loops", tl); tl = tl.reshape(nt, 3)
tv = np.empty(nt * 3, dtype=np.int64); me.loop_triangles.foreach_get("vertices", tv); tv = tv.reshape(nt, 3)
nl = len(me.loops)
uv = np.empty(nl * 2); me.uv_layers.active.data.foreach_get("uv", uv); uv = uv.reshape(nl, 2)
mw = np.array(body.matrix_world); co = co @ mw[:3, :3].T + mw[:3, 3]; no = no @ mw[:3, :3].T
print("TEX mesh verts", nv, "tris", nt, "bbox", co.min(axis=0).round(3), co.max(axis=0).round(3))

# ---- curvature of the surface at each vertex, at two scales (ridges light, hollows dark)
ne = len(me.edges); ev = np.empty(ne * 2, dtype=np.int64); me.edges.foreach_get("vertices", ev); ev = ev.reshape(ne, 2)
# vertices that share a place (split by the unwrap) are one point for this
key = np.round(co * 20000).astype(np.int64); _, weld, inv = np.unique(key, axis=0, return_index=True, return_inverse=True); inv = inv.ravel()
nw = len(weld); wco = np.zeros((nw, 3)); wn = np.zeros((nw, 3)); cnt = np.zeros(nw)
np.add.at(wco, inv, co); np.add.at(wn, inv, no); np.add.at(cnt, inv, 1.0); wco /= cnt[:, None]; wn /= np.maximum(np.linalg.norm(wn, axis=1), 1e-9)[:, None]
e0 = inv[ev[:, 0]]; e1 = inv[ev[:, 1]]
deg = np.zeros(nw); np.add.at(deg, e0, 1.0); np.add.at(deg, e1, 1.0); deg = np.maximum(deg, 1.0)
def nb_mean(x):
    s = np.zeros_like(x); np.add.at(s, e0, x[e1]); np.add.at(s, e1, x[e0]); return s / (deg[:, None] if x.ndim == 2 else deg)
elen = np.linalg.norm(wco[e0] - wco[e1], axis=1).mean()
def curv(p):
    d = nb_mean(p) - p; return -(d * wn).sum(axis=1) / elen      # > 0 on a ridge
c1 = curv(wco)
for _ in range(2): c1 = 0.5 * c1 + 0.5 * nb_mean(c1)
ps = wco.copy()
for _ in range(10): ps = 0.5 * ps + 0.5 * nb_mean(ps)
c2 = (wco - ps); c2 = (c2 * wn).sum(axis=1) / elen               # how far the surface stands out of its smoothed self: broad folds
for _ in range(3): c2 = 0.5 * c2 + 0.5 * nb_mean(c2)
print("TEX curvature fine %.3f..%.3f (sd %.3f), broad %.3f..%.3f (sd %.3f), edge %.4f" % (c1.min(), c1.max(), c1.std(), c2.min(), c2.max(), c2.std(), elen))
vc1 = c1[inv]; vc2 = c2[inv]
def vnormals(p):                                                  # normals of the welded surface with its points at p
    wt = inv[tv]; fnn = np.cross(p[wt[:, 1]] - p[wt[:, 0]], p[wt[:, 2]] - p[wt[:, 0]])
    out_n = np.zeros((nw, 3))
    for k in range(3): np.add.at(out_n, wt[:, k], fnn)
    return out_n / np.maximum(np.linalg.norm(out_n, axis=1), 1e-12)[:, None]
n_hi = vnormals(wco)
ps2 = wco.copy()
for _ in range(int(os.environ.get("RELIEF_IT", "24"))): ps2 = 0.5 * ps2 + 0.5 * nb_mean(ps2)
n_sm = vnormals(ps2)
LREL = np.array([0.3, 0.2, 0.93]); LREL /= np.linalg.norm(LREL)
rel = (n_hi - n_sm) @ LREL
for _ in range(1): rel = 0.5 * rel + 0.5 * nb_mean(rel)
def despeckle(f):                                                 # a single point far off its neighbours (a spike of the generated surface) would show as a bright or dark dot
    for _ in range(2):
        m = nb_mean(f); d = f - m; bad = np.abs(d) > 2.2 * d.std(); f = np.where(bad, m, f)
    return f
c1 = despeckle(c1); c2 = despeckle(c2); rel = despeckle(rel); vc1 = c1[inv]; vc2 = c2[inv]
print("TEX relief %.3f..%.3f (sd %.3f)" % (rel.min(), rel.max(), rel.std()))
vrel = rel[inv]

# ---- which triangle, and where in it, each texel of the unwrap shows
tri_id = np.full((N, N), -1, dtype=np.int32); bary = np.zeros((N, N, 3), dtype=np.float32)
P = uv[tl] * N                                                    # (nt, 3, 2) in texels; x = u, y = v (row 0 = bottom)
for t in range(nt):
    p0, p1, p2 = P[t]
    x0 = max(int(math.floor(min(p0[0], p1[0], p2[0]) - 1.0)), 0); x1 = min(int(math.ceil(max(p0[0], p1[0], p2[0]) + 1.0)), N - 1)
    y0 = max(int(math.floor(min(p0[1], p1[1], p2[1]) - 1.0)), 0); y1 = min(int(math.ceil(max(p0[1], p1[1], p2[1]) + 1.0)), N - 1)
    if x1 < x0 or y1 < y0: continue
    den = (p1[1] - p2[1]) * (p0[0] - p2[0]) + (p2[0] - p1[0]) * (p0[1] - p2[1])
    if abs(den) < 1e-9: continue
    xs = np.arange(x0, x1 + 1) + 0.5; ys = np.arange(y0, y1 + 1) + 0.5
    X, Y = np.meshgrid(xs, ys)
    w0 = ((p1[1] - p2[1]) * (X - p2[0]) + (p2[0] - p1[0]) * (Y - p2[1])) / den
    w1 = ((p2[1] - p0[1]) * (X - p2[0]) + (p0[0] - p2[0]) * (Y - p2[1])) / den
    w2 = 1.0 - w0 - w1
    mn = np.minimum(np.minimum(w0, w1), w2)
    sub = tri_id[y0:y1 + 1, x0:x1 + 1]; sb = bary[y0:y1 + 1, x0:x1 + 1]
    eps = 0.75 / max(math.sqrt(abs(den)), 1.0)                    # a little beyond the edge, so that neighbours in the unwrap meet
    ins = (mn >= -eps) & ((sub < 0) | (mn >= 0.0))
    sub[ins] = t; sb[ins, 0] = w0[ins]; sb[ins, 1] = w1[ins]; sb[ins, 2] = w2[ins]
cov = tri_id >= 0
print("TEX texels covered %.1f%%" % (100.0 * cov.mean()))
ti = tri_id[cov]; bw = np.clip(bary[cov], 0.0, 1.0); bw /= bw.sum(axis=1)[:, None]
V = tv[ti]
pos = (co[V] * bw[:, :, None]).sum(axis=1)
nrm = (no[V] * bw[:, :, None]).sum(axis=1); nrm /= np.maximum(np.linalg.norm(nrm, axis=1), 1e-9)[:, None]
cf = (vc1[V] * bw).sum(axis=1); cb = (vc2[V] * bw).sum(axis=1); rl = (vrel[V] * bw).sum(axis=1)

# ---- how open the surface is: ambient occlusion over a short distance, baked by Cycles into the same unwrap
ao_im = bpy.data.images.new("ao", N, N, alpha=False, float_buffer=True)
mat = me.materials[0]; nt_ = mat.node_tree
for nd in list(nt_.nodes):
    if nd.type == 'TEX_IMAGE': nt_.nodes.remove(nd)
tn = nt_.nodes.new("ShaderNodeTexImage"); tn.image = ao_im; nt_.nodes.active = tn; tn.select = True
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = int(os.environ.get("AO_SAMPLES", "48")); sc.cycles.use_denoising = False
w = bpy.data.worlds.new("w"); sc.world = w
w.light_settings.distance = float(os.environ.get("AO_DIST", "0.07"))
bpy.ops.object.select_all(action='DESELECT'); body.select_set(True); bpy.context.view_layer.objects.active = body
for o in bpy.data.objects:
    if o.type == 'ARMATURE': o.hide_render = True
bpy.ops.object.bake(type='AO', margin=8, use_clear=True)
ao = np.array(ao_im.pixels[:], dtype=np.float32).reshape(N, N, 4)[..., 0]
ao_c = ao[cov]
print("TEX ao %.3f..%.3f mean %.3f" % (ao_c.min(), ao_c.max(), ao_c.mean()))

# ---- the flat planes of a low-poly cut of her: each texel takes the plane of the nearest face of a coarse copy
lowfaces = int(os.environ.get("FACETS", "2600"))
bpy.ops.object.duplicate(); low = bpy.context.view_layer.objects.active
while low.data.uv_layers: low.data.uv_layers.remove(low.data.uv_layers[0])      # welded, so the cut is not held back by seams
bm = bmesh.new(); bm.from_mesh(low.data); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5); bm.to_mesh(low.data); bm.free()
for m in list(low.modifiers): low.modifiers.remove(m)
d = low.modifiers.new("dec", 'DECIMATE'); d.ratio = lowfaces / len(low.data.polygons); d.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier="dec")
low.data.update()
bvh = BVHTree.FromPolygons([tuple(v.co) for v in low.data.vertices], [tuple(p.vertices) for p in low.data.polygons])
lown = np.array([tuple(low.matrix_world.to_3x3() @ p.normal) for p in low.data.polygons])
fid = np.empty(len(pos), dtype=np.int64)
fn = bvh.find_nearest
for i in range(len(pos)):
    fid[i] = fn(pos[i])[2]
fnrm = lown[fid]
flip = (fnrm * nrm).sum(axis=1) < 0.0; fnrm[flip] = -fnrm[flip]
print("TEX facets: coarse copy has", len(low.data.polygons), "faces")
KEY = np.array([0.5, 0.42, 0.76]); KEY /= np.linalg.norm(KEY)       # she faces +X, her left is +Y, up is +Z (Blender)
KEY2 = np.array([0.3, -0.75, 0.35]); KEY2 /= np.linalg.norm(KEY2)
facet = (fnrm @ KEY - nrm @ KEY) + 0.6 * (fnrm @ KEY2 - nrm @ KEY2)
hsh = np.modf(np.sin(fid * 12.9898 + 4.1) * 43758.5453)[0]           # and each plane a touch lighter or darker of its own
facet_own = (np.abs(hsh) - 0.5)

# ---- veins of the marble: thin long lines and broad faint ones, in space (so they cross seams of the unwrap unbroken)
def h3(i): return np.modf(np.abs(np.sin(i @ np.array([127.1, 311.7, 74.7])) * 43758.5453))[0]
def n3(p):
    i = np.floor(p); f = p - i; f = f * f * (3.0 - 2.0 * f)
    def c(dx, dy, dz): return h3(i + np.array([dx, dy, dz]))
    x00 = c(0, 0, 0) * (1 - f[:, 0]) + c(1, 0, 0) * f[:, 0]; x10 = c(0, 1, 0) * (1 - f[:, 0]) + c(1, 1, 0) * f[:, 0]
    x01 = c(0, 0, 1) * (1 - f[:, 0]) + c(1, 0, 1) * f[:, 0]; x11 = c(0, 1, 1) * (1 - f[:, 0]) + c(1, 1, 1) * f[:, 0]
    y0 = x00 * (1 - f[:, 1]) + x10 * f[:, 1]; y1 = x01 * (1 - f[:, 1]) + x11 * f[:, 1]
    return y0 * (1 - f[:, 2]) + y1 * f[:, 2]
def sstep(a_, b_, x): t = np.clip((x - a_) / (b_ - a_), 0.0, 1.0); return t * t * (3.0 - 2.0 * t)
pm = pos * 1.72                                                      # metres
warp = np.stack([n3(pm * 3.1 + 11.0), n3(pm * 3.1 + 5.0), n3(pm * 3.1 + 23.0)], axis=1) - 0.5
q = pm + warp * 0.22
va = np.abs(np.sin((q @ np.array([0.9, 1.3, 0.75])) * 9.0)); vb = np.abs(np.sin((q @ np.array([-0.7, 1.1, -1.25])) * 6.5 + 1.7)); vc = np.abs(np.sin((q @ np.array([1.2, -0.5, 0.9])) * 13.0 + 0.6))
patch = sstep(0.32, 0.6, n3(pm * 2.1 + 7.0)); patch2 = sstep(0.35, 0.65, n3(pm * 1.7 + 31.0)); patch3 = sstep(0.5, 0.75, n3(pm * 2.6 + 3.0))
thin = np.maximum(np.maximum((1.0 - sstep(0.0, 0.035, va)) * patch, (1.0 - sstep(0.0, 0.03, vb)) * patch2 * 0.9), (1.0 - sstep(0.0, 0.04, vc)) * patch3 * 0.6)
broad = np.maximum((1.0 - sstep(0.0, 0.16, va)) * patch, (1.0 - sstep(0.0, 0.14, vb)) * patch2)
cloud = n3(pm * 4.0 + 17.0) - 0.5

# ---- put together
msk = mask_bin[cov] > 0.5
zf = pos[:, 2] - co[:, 2].min()                                      # height above her soles
if os.environ.get("FIND_BARE"):                                      # (to find a stray bare spot: marble texels in a box "x0,x1,y0,y1,z0,z1")
    bx = [float(v) for v in os.environ["FIND_BARE"].split(",")]
    sel = (~msk) & (pos[:, 0] > bx[0]) & (pos[:, 0] < bx[1]) & (pos[:, 1] > bx[2]) & (pos[:, 1] < bx[3]) & (zf > bx[4]) & (zf < bx[5])
    if sel.any(): print("TEX bare texels in the box:", int(sel.sum()), "from", np.round(np.c_[pos[sel, :2], zf[sel]].min(axis=0), 3), "to", np.round(np.c_[pos[sel, :2], zf[sel]].max(axis=0), 3), "mean", np.round(np.c_[pos[sel, :2], zf[sel]].mean(axis=0), 3))
    ysel = pos[sel, 1]
    for y0 in np.arange(bx[2], bx[3], 0.01): print("  y %.2f: %d" % (y0, int(((ysel >= y0) & (ysel < y0 + 0.01)).sum())))
    sys.exit(0)
# a bare spot the generator left in the sash on her left shoulder (a hole the size of a coin) is closed: it reads as a flaw
for ball in [tuple(float(v) for v in b.split(",")) for b in os.environ.get("CLOSE", "-0.02,0.078,0.836,0.038").split(";")]:      # x, y, height, radius (model units; her left is +y)
    inb = np.linalg.norm(np.c_[pos[:, :2], zf] - np.array(ball[:3])[None], axis=1) < ball[3]
    if inb.any(): print("TEX closed a bare spot: %d texels" % int((inb & ~msk).sum()))
    msk = msk | inb
closed = np.zeros((N, N), dtype=bool); closed[cov] = msk & ~(mask_bin[cov] > 0.5)
dk = dark[cov]
is_arm = (pos[:, 1] < -0.17) & (pos[:, 2] - co[:, 2].min() > 0.7)                    # the crack is drawn on her right forearm; elsewhere dark paint is stray
crack = np.where(is_arm, sstep(0.15, 0.6, dk), 0.0)
print("TEX dark texels", int((dk > 0.3).sum()), "on the marble", int(((dk > 0.3) & ~msk).sum()), "place of those", pos[(dk > 0.3) & ~msk].min(axis=0).round(3) if ((dk > 0.3) & ~msk).any() else None, pos[(dk > 0.3) & ~msk].max(axis=0).round(3) if ((dk > 0.3) & ~msk).any() else None)
K = {k: float(v) for k, v in (kv.split("=") for kv in os.environ.get("TONE", "").split(",") if kv)}
def kk(n_, d_): return K.get(n_, d_)
t_cloth = 1.0 + kk("cf", 0.12) * facet + kk("co", 0.03) * facet_own + kk("c1", 0.08) * np.clip(cf, -1.2, 1.2) + kk("c2", 0.22) * np.clip(cb, -1.5, 1.5) + kk("cr", 0.75) * np.clip(rl, -0.5, 0.5)
t_marb = 1.0 + kk("mf", 0.30) * facet + kk("mo", 0.07) * facet_own + kk("m1", 0.04) * np.clip(cf, -1.0, 1.0) + 0.03 * cloud
t_marb = t_marb * (1.0 - kk("vt", 0.30) * thin) * (1.0 - kk("vb", 0.085) * broad) * (1.0 - 0.72 * crack)
tone = np.where(msk, np.clip(t_cloth, 0.62, 1.3), t_marb)
print("TEX tone cloth %.2f..%.2f (sd %.3f)  marble %.2f..%.2f (sd %.3f)  crack texels %d" % (t_cloth[msk].min(), t_cloth[msk].max(), t_cloth[msk].std(), t_marb[~msk].min(), t_marb[~msk].max(), t_marb[~msk].std(), int((crack > 0.3).sum())))
R = np.zeros((N, N), dtype=np.float32); G = mask_soft.copy(); B = np.ones((N, N), dtype=np.float32)
G[closed] = 1.0
R[cov] = np.clip(tone * 0.5, 0.0, 1.0); B[cov] = np.clip(ao_c, 0.0, 1.0)
inner = distance_transform_edt(cov) > float(os.environ.get("RIM", "3.5"))
_, (jy, jx) = distance_transform_edt(~inner, return_indices=True)
rim = cov & ~inner & (np.hypot(jy - np.arange(N)[:, None], jx - np.arange(N)[None, :]) < 9.0)
G[rim] = G[jy[rim], jx[rim]]
print("TEX rim texels given the cloth-or-marble of the inside: %d" % int(rim.sum()))
# texels no triangle shows take the nearest that one does (so that small sizes of the picture do not pull in rubbish)
_, (iy, ix) = distance_transform_edt(~cov, return_indices=True)
R = R[iy, ix]; B = B[iy, ix]; G = G[iy, ix]
B = gaussian_filter(B, 1.2)                                          # the baked shade is grainy
img = np.stack([R, G, B], axis=2)
img = img.reshape(SIZE, 2, SIZE, 2, 3).mean(axis=(1, 3))
from_bottom = (np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8)
o = bpy.data.images.new("data", SIZE, SIZE, alpha=False); o.colorspace_settings.name = 'Non-Color'
full = np.concatenate([from_bottom.astype(np.float32) / 255.0, np.ones((SIZE, SIZE, 1), dtype=np.float32)], axis=2)
o.pixels = full.ravel(); o.filepath_raw = out; o.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGB'; o.save()
np.save(out + ".vmask.npy", np.array([0]))                           # (placeholder: the build reads the mask from the picture)
print("TEX wrote", out, SIZE)
