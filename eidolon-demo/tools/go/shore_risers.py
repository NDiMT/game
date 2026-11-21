"""Each rising stone's own shore map (gowake/): how far each spot of the water lies from that one stone, as the
shore map's green holds it for all of them as one, but a channel for each (red the first of the plan's risers, green
the second, blue the third), over the same rect and in the same measure. The foam thrown out as a stone breaks the
water reads its own channel, so it hugs that stone only: read from the green, which holds every rising stone's
outline as one, it ran out as white lines round the stones still under the water (the owner, 21/11: "the rocks that
come up and this ridiculous flash").

usage: python3.11 -I tools/go/shore_risers.py -- <level dir>      (Blender as a module; run it again whenever the
level is rebuilt; it checks that its channels together are the shore map's green)
"""
import bpy, json, math, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components

d = sys.argv[sys.argv.index('--') + 1]
j = json.load(open(os.path.join(d, 'level.json')))
plan = json.load(open(os.path.join(d, 'plan.json')))
x0, z0, x1, z1 = j['shore']['rect']; D = float(j['shore']['D'])
shore = np.asarray(Image.open(os.path.join(d, 'shore.png')).convert('RGB'))
nz, nx = shore.shape[:2]; res = (x1 - x0) / nx
SY = float(plan['sea_y']) + 0.015      # (as the level's builder cuts them: a hair over the still water)
names = sorted((str(n) for n in plan.get('risers', [])), key=str.lower)[:3]      # (by name, as the game takes them: the first red)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(d, 'level.glb'))
bpy.context.view_layer.update()


def cut(ob):
    """the body cut by the water's face: per island of it, its segments [x0, z0, x1, z1] in the game's x and z (as
    tools/ivory_level.py cuts it)"""
    mw = ob.matrix_world; me = ob.data; me.calc_loop_triangles()
    V = np.array([tuple(mw @ v.co) for v in me.vertices], dtype=np.float64)
    T = np.array([tuple(t.vertices) for t in me.loop_triangles], dtype=np.int64)
    if len(T) == 0: return []
    _, inv = np.unique(np.round(V, 5), axis=0, return_inverse=True); T = inv.reshape(-1)[T]      # (a vertex split at a hard edge is still one point of the body)
    Vu = np.zeros((int(inv.max()) + 1, 3)); Vu[inv.reshape(-1)] = V; V = Vu
    n = len(V); e = np.concatenate([T[:, [0, 1]], T[:, [1, 2]], T[:, [2, 0]]])
    _, lab = connected_components(coo_matrix((np.ones(len(e)), (e[:, 0], e[:, 1])), shape=(n, n)), directed=False)
    h = V[:, 2] - SY; h[np.abs(h) < 1e-7] = 1e-7
    sg = np.sign(h[T]); T = T[~(sg == sg[:, :1]).all(axis=1)]
    if len(T) == 0: return []
    P = []; C = []
    for (a_, b_) in ((0, 1), (1, 2), (2, 0)):
        ha = h[T[:, a_]]; hb = h[T[:, b_]]
        C.append(ha * hb < 0)
        P.append(V[T[:, a_]] + (V[T[:, b_]] - V[T[:, a_]]) * (ha / np.where(ha - hb == 0, 1e-9, ha - hb))[:, None])
    P = np.stack(P, axis=1); C = np.stack(C, axis=1)
    ix = np.argsort(~C, axis=1, kind='stable')[:, :2]; ar = np.arange(len(T))
    p0 = P[ar, ix[:, 0]]; p1 = P[ar, ix[:, 1]]
    sg2 = np.stack([p0[:, 0], -p0[:, 1], p1[:, 0], -p1[:, 1]], axis=1)
    il = lab[T[:, 0]]
    return [sg2[il == k] for k in np.unique(il)]


def fill(mask, sg):
    """one island's outline filled into the mask, as the builder fills it: row by row, even-odd, if it is closed;
    if it is not, its outline drawn, its gaps closed, and all it rings filled"""
    X0, Z0, X1, Z1 = sg[:, 0], sg[:, 1], sg[:, 2], sg[:, 3]
    jlo = max(0, int((min(Z0.min(), Z1.min()) - z0) / res) - 1); jhi = min(mask.shape[0] - 1, int((max(Z0.max(), Z1.max()) - z0) / res) + 1)
    xc = x0 + (np.arange(mask.shape[1]) + 0.5) * res
    rows = []
    for jj_ in range(jlo, jhi + 1):
        z = z0 + (jj_ + 0.5) * res
        c = (Z0 - z) * (Z1 - z) < 0
        if not c.any(): continue
        xs = np.sort(X0[c] + (X1[c] - X0[c]) * (z - Z0[c]) / (Z1[c] - Z0[c]))
        if len(xs) % 2: rows = None; break
        rows.append((jj_, np.searchsorted(xs, xc) % 2 == 1))
    if rows is not None:
        for (jj_, r) in rows: mask[jj_] |= r
        return
    ol = np.zeros(mask.shape, dtype=bool)
    for (a0, b0, a1, b1) in sg:
        n_ = max(2, int(math.hypot(a1 - a0, b1 - b0) / (res * 0.5)) + 1)
        t = np.linspace(0.0, 1.0, n_)
        ii = ((a0 + (a1 - a0) * t - x0) / res).astype(int); jj = ((b0 + (b1 - b0) * t - z0) / res).astype(int)
        ok = (ii >= 0) & (ii < mask.shape[1]) & (jj >= 0) & (jj < mask.shape[0]); ol[jj[ok], ii[ok]] = True
    ol = ndimage.binary_closing(ol, iterations=3)
    mask |= ndimage.binary_fill_holes(ol)


chans = []
for nm in names:
    obs = [o for o in bpy.data.objects if o.type == 'MESH' and o.name.lower().startswith('riser_%s_' % nm.lower())]
    mk = np.zeros((nz, nx), dtype=bool)
    for o in obs:
        for sg in cut(o): fill(mk, sg)
    dist = ndimage.distance_transform_edt(~mk) * res if mk.any() else np.full((nz, nx), D)
    chans.append((np.clip(1.0 - dist / D, 0.0, 1.0) * 255.0 + 0.5).astype(np.uint8))
    print('riser', nm, [o.name for o in obs], 'cells in it', int(mk.sum()))
while len(chans) < 3: chans.append(np.zeros((nz, nx), dtype=np.uint8))
out = np.stack(chans, axis=2)
Image.fromarray(out, 'RGB').save(os.path.join(d, 'shore_risers.png'))
g = shore[..., 1].astype(int); m = out.max(axis=2).astype(int)
near = g > 200      # (within a third of a metre of a stone: where the foam is)
print('against the shore map green: mean |diff| %.2f, max %d where it matters (of 255)' % (np.abs(g - m).mean(), np.abs(g - m)[near].max()))
