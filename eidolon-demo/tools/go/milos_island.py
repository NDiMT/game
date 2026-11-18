"""The third level's island (gomilos/), as the concept paints it and as Milos has it at Sarakiniko: white volcanic rock
worn smooth by the sea, soft and rounded, faint beds across its faces, a groove the sea wears along the waterline,
sea-worn hollows; its walks flat on top. Not the other levels' slabs on chunky rock: the owner liked the concept's
island ("what Gemini made, like Milos, Sarakiniko").

The rock is a field of distances: each walk of the plan a flat top whose edge is rounded and whose sides fall away,
flaring a little as they go down; the island's shoulders a step below the walks; rounded masses for the higher rocks
(the plan's 'rocks'); the channel, its arm and the chasm cut out of it ('waters'), a bridge of the rock itself left
over the chasm ('bridges'), its tunnel under it; the stair cut into it (the plan's flight); the hollows ('hollows'). The
sea's wearing (a slow swell of the surface, the beds) is laid on the faces and never on the walks. It is meshed
(marching cubes), thinned, its hollows baked into its colours (AO in red), and joined with the gate's arch (an extras
GLB made by tools/ivory_level.py from the arches alone). The small waves' map (shore.png) comes from the field itself,
cut at the sea.

usage: python3.11 -I tools/go/milos_island.py -- <plan.json> <out dir> [extras.glb] [voxel m]
"""
import sys, os, json, math
sys.path.append(os.path.expanduser('~/.local/lib/python3.11/site-packages'))      # (scikit-image, for the marching cubes)
import numpy as np
from scipy import ndimage
from skimage.measure import marching_cubes
import bpy, bmesh
from mathutils import Vector

a = sys.argv[sys.argv.index('--') + 1:]
PLAN = json.load(open(a[0])); OUT = a[1]
EXTRAS = a[2] if len(a) > 2 and a[2].endswith('.glb') else None
V = float(a[3]) if len(a) > 3 else 0.06
SEA = float(PLAN['sea_y'])
DROP = float(PLAN.get('rock_drop', 0.0))      # (where the way is laid in separate stones: the rock's own top this much under theirs)
rng = np.random.default_rng(sum(ord(c) * (i + 1) for i, c in enumerate('gomilos')))      # (its own dice: from its name)

# ---------------------------------------------------------------- the grid
fl = PLAN['floors']; rocks = PLAN.get('rocks', [])
xs = [p[0] for f in fl.values() for p in f['xz']] + [r[0][0] - r[1] * 1.3 for r in rocks] + [r[0][0] + r[1] * 1.3 for r in rocks]
zs = [p[1] for f in fl.values() for p in f['xz']] + [r[0][2] - r[1] * 1.3 for r in rocks] + [r[0][2] + r[1] * 1.3 for r in rocks]
tops = [f['h'] for f in fl.values()] + [r[2] for r in rocks]
X0, X1 = min(xs) - 1.2, max(xs) + 1.2; Z0, Z1 = min(zs) - 1.2, max(zs) + 1.2
Y0, Y1 = SEA - 1.4, max(tops) + 0.8
nx, ny, nz = int((X1 - X0) / V) + 1, int((Y1 - Y0) / V) + 1, int((Z1 - Z0) / V) + 1
gx = X0 + np.arange(nx) * V; gy = Y0 + np.arange(ny) * V; gz = Z0 + np.arange(nz) * V
print('GRID', nx, ny, nz, '=', nx * ny * nz, 'voxels of', V, 'm')
Xg, Zg = np.meshgrid(gx, gz, indexing='ij')      # (2D: x, z)
Y3 = gy[None, :, None]


def poly_inside(poly):
    """which cells of the 2D grid lie inside a polygon (x, z)"""
    P = np.asarray(poly, dtype=float); inside = np.zeros(Xg.shape, dtype=bool)
    j = len(P) - 1
    for i in range(len(P)):
        xi, zi = P[i]; xj, zj = P[j]
        cross = ((zi > Zg) != (zj > Zg)) & (Xg < (xj - xi) * (Zg - zi) / ((zj - zi) + 1e-12) + xi)
        inside ^= cross; j = i
    return inside


def sdf2(mask):
    """signed distance to a 2D region's edge: negative inside"""
    return (ndimage.distance_transform_edt(~mask) - ndimage.distance_transform_edt(mask)) * V


def walk(d2, h, re=0.2, flare=0.12):
    """a walk: flat on top at h, its edge rounded (re), its sides falling and flaring outward a little as they go down"""
    d = d2[:, None, :] - flare * np.clip(h - Y3, 0.0, None)
    qx = d + re; qy = (Y3 - h) + re
    return np.sqrt(np.maximum(qx, 0) ** 2 + np.maximum(qy, 0) ** 2) + np.minimum(np.maximum(qx, qy), 0) - re


def smin(a_, b_, k):
    h = np.clip(0.5 + 0.5 * (b_ - a_) / k, 0.0, 1.0)
    return b_ * (1 - h) + a_ * h - k * h * (1 - h)


def smax(a_, b_, k): return -smin(-a_, -b_, k)


def box3(x0, x1, z0, z1, y0, y1, r=0.0):
    """a box (rounded by r) as a field over the grid"""
    cx, cz, cy = (x0 + x1) / 2, (z0 + z1) / 2, (y0 + y1) / 2
    hx, hz, hy = (x1 - x0) / 2 - r, (z1 - z0) / 2 - r, (y1 - y0) / 2 - r
    qx = np.abs(gx - cx)[:, None, None] - hx; qy = np.abs(gy - cy)[None, :, None] - hy; qz = np.abs(gz - cz)[None, None, :] - hz
    out = np.sqrt(np.maximum(qx, 0) ** 2 + np.maximum(qy, 0) ** 2 + np.maximum(qz, 0) ** 2)
    return out + np.minimum(np.maximum(np.maximum(qx, qy), qz), 0) - r


def blob(c, r):
    """a rounded mass: an ellipsoid (centre, radii), its field near enough to a distance"""
    px = (gx - c[0])[:, None, None] / r[0]; py = (gy - c[1])[None, :, None] / r[1]; pz = (gz - c[2])[None, None, :] / r[2]
    return (np.sqrt(px * px + py * py + pz * pz) - 1.0) * min(r)


# ---------------------------------------------------------------- the walks, the shoulders, the masses
D = np.full((nx, ny, nz), 9.0, dtype=np.float32)
inside_any = np.zeros(Xg.shape, dtype=bool); htop = np.full(Xg.shape, -9.0); dnear = np.full(Xg.shape, 9.0)
for nm, f in fl.items():
    m = poly_inside(f['xz']); d2 = sdf2(m); hr = f['h'] - DROP
    D = np.minimum(D, walk(d2, hr).astype(np.float32))
    closer = d2 < dnear; htop = np.where(closer, hr, htop); dnear = np.minimum(dnear, d2); inside_any |= m
    if f['h'] > SEA + 0.6:      # (its shoulder: the rock a step below the walk, broader, flaring more)
        D = smin(D, walk(d2 - 0.75, hr - 0.4, re=0.35, flare=0.25).astype(np.float32), 0.35)
for (x0, x1, z0, z1, h) in PLAN.get('bridges', []):      # (a bridge of the rock itself: its walk on top)
    m = (Xg >= x0) & (Xg <= x1) & (Zg >= z0 - 0.3) & (Zg <= z1 + 0.3); d2 = sdf2(m)
    D = np.minimum(D, walk(d2, h - DROP, re=0.15, flare=0.05).astype(np.float32))
    closer = d2 < dnear; htop = np.where(closer, h - DROP, htop); dnear = np.minimum(dnear, d2)
def pillow(c, r, top, k):
    """a rounded mass of the white rock, as the sea leaves them: broad, flat-topped, its edge rolling down and out; its
    outline wandering a little round it"""
    th = np.arctan2(Zg - c[2], Xg - c[0])
    wob = 1.0 + 0.1 * np.sin(3 * th + k) + 0.06 * np.sin(5 * th + 2.1 * k) + 0.05 * np.sin(2 * th - 1.3 * k)
    d2 = np.sqrt((Xg - c[0]) ** 2 + (Zg - c[2]) ** 2) - r * wob
    re = min(0.75, max(0.25, (top - SEA) * 0.32))
    return walk(d2, top, re=re, flare=0.3).astype(np.float32)
for i, (c, r, top) in enumerate(rocks):      # (the higher rocks and the shoulders in the sea)
    D = smin(D, pillow(c, r * 1.05, top, i * 1.7), 0.4)
    if top - SEA > 1.8:      # (a tall one stands on a broader shelf of its own, a step down)
        D = smin(D, pillow((c[0] + 0.25, 0, c[2] - 0.2), r * 1.4, SEA + (top - SEA) * 0.55, i * 2.3 + 0.7), 0.45)
for st in PLAN.get('statues', []):      # (where a statue stands on a rock: a flat place for its foot)
    x, y, z = st[1]
    if y > SEA + 0.2 and not any(abs(y - f['h']) < 0.05 for f in fl.values()):
        D = smin(D, box3(x - 0.55, x + 0.55, z - 0.55, z + 0.55, y - 1.6, y, r=0.18).astype(np.float32), 0.3)
# the stair cut in it: each step a block from its tread down and back to the walk above
for (foot, head, w, n, *_) in PLAN.get('flights', []):
    dx, dz = head[0] - foot[0], head[2] - foot[2]; L = math.hypot(dx, dz); ux, uz = dx / L, dz / L
    rise = (head[1] - foot[1]) / n; run = L / n
    for k in range(n):
        t0 = run * k; t1 = L + 0.35      # (from its riser back under the walk above)
        pa = (foot[0] + ux * t0, foot[2] + uz * t0); pb = (foot[0] + ux * t1, foot[2] + uz * t1)
        sx, sz = -uz * w / 2, ux * w / 2
        xs_ = [pa[0] + sx, pa[0] - sx, pb[0] + sx, pb[0] - sx]; zs_ = [pa[1] + sz, pa[1] - sz, pb[1] + sz, pb[1] - sz]
        D = np.minimum(D, box3(min(xs_), max(xs_), min(zs_), max(zs_), SEA - 1.0, foot[1] + rise * (k + 1), r=0.02).astype(np.float32))

# ---------------------------------------------------------------- the waters cut out, the hollows
for (x0, x1, z0, z1) in PLAN.get('waters', []):
    cut = box3(x0, x1, z0, z1, SEA - 6.0, Y1 + 6.0, r=0.32).astype(np.float32)
    for (bx0, bx1, bz0, bz1, bh) in PLAN.get('bridges', []):      # (the bridge stays: only its tunnel is cut under it)
        keep = box3(bx0 - 0.02, bx1 + 0.02, bz0 - 0.4, bz1 + 0.4, bh - 0.62, bh + 3.0, r=0.12).astype(np.float32)
        cut = np.maximum(cut, -keep)
    D = smax(D, -cut, 0.16)
for nc in PLAN.get('niches', []):      # (a niche cut for a thing to go into: the rock over it as a roof, the hollow under it)
    (rx, ry, rz), (ax, ay, az) = nc['roof']
    D = smin(D, blob((rx, ry, rz), (ax, ay, az)).astype(np.float32), 0.35)
    x0, x1, z0, z1, y0, y1 = nc['cut']
    D = smax(D, -box3(x0, x1, z0, z1, y0, y1, r=0.12).astype(np.float32), 0.08)
for (x, y, z, r) in PLAN.get('hollows', []):
    D = smax(D, -blob((x, y, z), (r, r * 0.8, r)).astype(np.float32), 0.12)

# ---------------------------------------------------------------- the sea's wearing, on the faces only
def noise3(cell, seed_shift):
    n0 = (int((X1 - X0) / cell) + 3, int((Y1 - Y0) / cell) + 3, int((Z1 - Z0) / cell) + 3)
    g = rng.uniform(-1.0, 1.0, n0).astype(np.float32)
    z_ = ndimage.zoom(g, ((nx + 2) / n0[0], (ny + 2) / n0[1], (nz + 2) / n0[2]), order=3)
    return z_[:nx, :ny, :nz]
N1 = noise3(1.3, 0); N2 = noise3(0.55, 1)
wv = np.clip(np.maximum((htop[:, None, :] - 0.14 - Y3) / 0.55, (dnear[:, None, :] - 0.08) / 0.4), 0.0, 1.0)      # (none on the walks and their lips)
beds = 0.014 * np.sin((Y3 - SEA) * (2 * math.pi / 0.46) + 2.6 * N1) * np.clip(0.5 + N2, 0.0, 1.0)      # (the beds across the faces: faint, wandering, here and there)
groove = 0.11 * np.exp(-((Y3 - (SEA + 0.22)) / 0.2) ** 2)      # (where the sea wears along the waterline: a soft groove)
D = D + wv * (0.1 * N1 + 0.035 * N2 + beds) + groove * np.clip((htop[:, None, :] - Y3 - 0.4) / 0.4, 0.0, 1.0)
D[:, 0, :] = np.maximum(D[:, 0, :], 0.01)      # (closed under: nothing below the grid)
D[0, :, :] = 1; D[-1, :, :] = 1; D[:, :, 0] = 1; D[:, :, -1] = 1; D[:, -1, :] = 1

# ---------------------------------------------------------------- the small waves' map: the rock cut at the sea
j_sea = int(round((SEA + 0.015 - Y0) / V))
mk = D[:, j_sea, :] < 0.0
dist = ndimage.distance_transform_edt(~mk) * V; RD = 1.6
red = (np.clip(1.0 - dist / RD, 0.0, 1.0) * 255 + 0.5).astype(np.uint8).T      # (rows z, columns x)
from PIL import Image
Image.fromarray(np.stack([red, np.zeros_like(red), np.zeros_like(red)], axis=2), 'RGB').save(os.path.join(OUT, 'shore.png'))
SHORE = {'rect': [round(X0 - V / 2, 4), round(Z0 - V / 2, 4), round(X0 + nx * V - V / 2, 4), round(Z0 + nz * V - V / 2, 4)], 'D': RD}
print('SHORE', mk.sum(), 'cells of rock at the sea')

# ---------------------------------------------------------------- the mesh
verts, faces, normals, _ = marching_cubes(D, level=0.0, spacing=(V, V, V))
verts += np.array([X0, Y0, Z0])
print('MESH', len(verts), 'verts', len(faces), 'faces')
# the walks dead flat: what lies within a hair of a walk's top, over it, is set on it
ix = np.clip(np.round((verts[:, 0] - X0) / V).astype(int), 0, nx - 1); iz = np.clip(np.round((verts[:, 2] - Z0) / V).astype(int), 0, nz - 1)
on_walk = (dnear[ix, iz] < 0.02) & (np.abs(verts[:, 1] - htop[ix, iz]) < 0.035)
verts[on_walk, 1] = htop[ix, iz][on_walk]
print('FLAT', int(on_walk.sum()), 'verts set on their walks')
bpy.ops.wm.read_factory_settings(use_empty=True)
me = bpy.data.meshes.new('island')
G = lambda v: (v[0], -v[2], v[1])      # (the game's axes, y up, to Blender's, z up; the glTF writer turns them back)
me.from_pydata([G(v) for v in verts], [], [tuple(int(i) for i in f) for f in faces])
me.update()
up = [p.normal.z for p in me.polygons if p.center.z > PLAN['heights']['H1'] - 0.01 and abs(p.normal.z) > 0.9]
if up and sum(up) < 0:      # (its faces turned outward: the walks' tops look up)
    for p in me.polygons: p.flip()
    me.update(); print('FLIPPED the faces outward')
ob = bpy.data.objects.new('island', me); bpy.context.scene.collection.objects.link(ob)
bpy.context.view_layer.objects.active = ob; ob.select_set(True)
dm = ob.modifiers.new('thin', 'DECIMATE'); dm.ratio = float(os.environ.get('MILOS_KEEP', '0.22'))
bpy.ops.object.modifier_apply(modifier='thin')
for p in me.polygons: p.use_smooth = True
print('THINNED', len(me.polygons), 'faces')

# ---------------------------------------------------------------- the arch and what else the boulder builder made, alongside
if EXTRAS:
    before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=EXTRAS)
    print('EXTRAS', [o.name for o in bpy.data.objects if o not in before])

# ---------------------------------------------------------------- its hollows baked into its colours
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = int(os.environ.get('MILOS_AO', '16'))
w = bpy.data.worlds.new('w'); sc.world = w; w.light_settings.distance = 0.7
sc.render.bake.target = 'VERTEX_COLORS'
mat = bpy.data.materials.new('island'); me.materials.append(mat)
ca = me.color_attributes.new('ao', 'BYTE_COLOR', 'CORNER'); me.color_attributes.active_color = ca
bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
bpy.ops.object.bake(type='AO')
for c in ca.data: c.color = (c.color[0], 0.0, c.color[2], c.color[3])
print('BAKED island')
bpy.ops.object.select_all(action='SELECT')
kw = dict(filepath=os.path.join(OUT, 'level.glb'), export_format='GLB', use_selection=False, export_apply=True, export_normals=True)
for extra in (dict(export_vertex_color='ACTIVE'), dict(export_colors=True), {}):
    try: bpy.ops.export_scene.gltf(**kw, **extra); print('EXPORTED', extra); break
    except TypeError as e: print('retry', e)
way = {k: PLAN.get(k) for k in ('heights', 'nodes', 'edges', 'volute', 'head', 'ring', 'eye', 'flights', 'floors', 'relief', 'faces', 'stone', 'scene', 'sea_y', 'arches', 'braziers', 'dial', 'mirrors', 'door', 'walls', 'trench', 'observer', 'observer_haze', 'observer_model', 'horizon', 'sun', 'statues', 'holes')}
way['stair_groove'] = 0.0; way['shore'] = SHORE; way['island'] = True
json.dump(way, open(os.path.join(OUT, 'level.json'), 'w'), indent=1)
print('DONE')
