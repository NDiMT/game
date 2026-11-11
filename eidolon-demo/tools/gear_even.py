# Spaces the teeth of the turning plinth's great wheel evenly, so that the pinion beside it can run in them. The
# generated wheel has the right number of teeth (28) but they stand 10 to 18 degrees apart and differ in width; a
# pinion with even teeth then rides up on every other one. Nothing is rebuilt: the teeth are slid round the rim (each
# vertex of the toothed band keeps its height and its distance from the axis, only its angle changes), so that every
# tooth is centred on a 360/28 grid and equally wide where the pinion meets it. Inside the rim nothing moves.
# Prints where a tooth centre lies (as a yaw in the game, from +Z towards +X): main.gd needs it to set the pinion.
# usage: python3.11 -I gear_even.py -- <in top.glb> <out top.glb> [share of the pitch that is tooth, default 0.45]
import bpy, sys, math
import numpy as np
a = sys.argv[sys.argv.index('--') + 1:]
src, out = a[0], a[1]; share = float(a[2]) if len(a) > 2 else 0.45
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
# Blender (x, y, z) is the game's (x, -z, y): a yaw in the game is atan2(x, -y) here
V = np.array([(v.co.x, v.co.y, v.co.z) for v in me.vertices])
r = np.hypot(V[:, 0], V[:, 1]); yaw = np.arctan2(V[:, 0], -V[:, 1])
# the wheel is the widest thing of the model, and lies at its foot
z0 = V[:, 2].min(); tip = r.max()
band_top = max(V[i, 2] for i in range(len(V)) if r[i] > 0.93 * tip) + 0.004
me.calc_loop_triangles()
T = np.array([t.vertices[:] for t in me.loop_triangles])
A, B, C = V[T[:, 0]], V[T[:, 1]], V[T[:, 2]]
N = 2880
def outline():      # the outer radius of the band, by yaw
    prof = np.zeros(N); rng = np.random.default_rng(1)
    for k in range(120):
        u = rng.random(len(T)); v = rng.random(len(T)); f = u + v > 1; u[f] = 1 - u[f]; v[f] = 1 - v[f]
        Q = A + (B - A) * u[:, None] + (C - A) * v[:, None]
        Q = Q[Q[:, 2] <= band_top]
        b = ((np.arctan2(Q[:, 0], -Q[:, 1]) + math.pi) / (2 * math.pi) * N).astype(int) % N
        np.maximum.at(prof, b, np.hypot(Q[:, 0], Q[:, 1]))
    return prof
prof = outline()
root = float(np.percentile(prof, 10)); top = float(np.percentile(prof, 95)); pitch_r = (root + top) / 2
on = prof > pitch_r
starts = np.where(on & ~np.roll(on, 1))[0]
teeth = []
for s in starts:
    e = s
    while on[e % N]: e += 1
    teeth.append((-math.pi + 2 * math.pi * s / N, -math.pi + 2 * math.pi * e / N))      # its two flanks at the pitch circle
n = len(teeth); pitch = 2 * math.pi / n
cen = np.array([(l + rr) / 2 for l, rr in teeth]); wid = np.array([rr - l for l, rr in teeth])
# the grid that moves the teeth least
off = cen - (cen[0] + pitch * np.arange(n)); c0 = cen[0] + off.mean()
want = c0 + pitch * np.arange(n); w = share * pitch
print("GEAR teeth", n, "root r %.4f tip r %.4f pitch r %.4f" % (root, top, pitch_r), "band top %.4f" % band_top)
print("GEAR before: centres off the grid by %.2f..%.2f deg, widths %.2f..%.2f deg (mean %.2f, pitch %.3f)" % (math.degrees((cen - want).min()), math.degrees((cen - want).max()), math.degrees(wid.min()), math.degrees(wid.max()), math.degrees(wid.mean()), math.degrees(pitch)))
kx = []; ky = []
for i in range(n):
    kx += [teeth[i][0], teeth[i][1]]; ky += [want[i] - w / 2, want[i] + w / 2]
kx = np.array(kx); ky = np.array(ky)
kx = np.concatenate([kx - 2 * math.pi, kx, kx + 2 * math.pi]); ky = np.concatenate([ky - 2 * math.pi, ky, ky + 2 * math.pi])
assert np.all(np.diff(kx) > 0) and np.all(np.diff(ky) > 0)
new = np.interp(yaw, kx, ky)
# full strength from just inside the root of the teeth outwards, none inside the rim; the rim's flat faces take the shear
k = np.clip((r - (root - 0.045)) / 0.04, 0.0, 1.0); k = k * k * (3 - 2 * k)
k[V[:, 2] > band_top] = 0.0
ang = yaw + (new - yaw) * k
for i, v in enumerate(me.vertices):
    if k[i] > 0.0: v.co.x = r[i] * math.sin(ang[i]); v.co.y = -r[i] * math.cos(ang[i])
me.update()
V = np.array([(v.co.x, v.co.y, v.co.z) for v in me.vertices]); A, B, C = V[T[:, 0]], V[T[:, 1]], V[T[:, 2]]
prof = outline(); on = prof > pitch_r; starts = np.where(on & ~np.roll(on, 1))[0]
cen2 = []; wid2 = []
for s in starts:
    e = s
    while on[e % N]: e += 1
    cen2.append(-math.pi + 2 * math.pi * (s + e) / 2 / N); wid2.append(2 * math.pi * (e - s) / N)
cen2 = np.array(cen2); wid2 = np.array(wid2)
d = (cen2 - c0 + pitch / 2) % pitch - pitch / 2
print("GEAR after: %d teeth, centres off the grid by %.2f..%.2f deg, widths %.2f..%.2f deg" % (len(cen2), math.degrees(d.min()), math.degrees(d.max()), math.degrees(wid2.min()), math.degrees(wid2.max())))
t0 = (c0 + pitch / 2) % pitch - pitch / 2
print("GEAR a tooth centre at yaw %.3f deg (and every %.4f deg)" % (math.degrees(t0), math.degrees(pitch)))
for p in me.polygons: p.use_smooth = False
bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_apply=True, use_selection=True)
