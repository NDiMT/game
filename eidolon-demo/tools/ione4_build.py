# Builds the heroine "ione4r" for the game from what the generator gave: the rigged model with its retargeted clips
# (idle, walk) and the data picture of ione4_tex.py.
#   - skinning made again where the automatic one fails: below the hips every point (cloth and marble alike) takes its
#     weights from where it lies, so that the layers of the wrap and the legs under them move as one: no leg through
#     the cloth, no band folding over another; above the hips the weights are evened out over a small distance for
#     the same reason (the sash on the shoulder, the wrap of the neck)
#   - clips: "idle" and "walk" from the generator, with the feet held to the floor (the generator pins the hips and
#     lets the feet wander), the walk timed for 1.1 m/s, a breath laid over the idle; "turn_step" (steps on the spot)
#     and "kneel" (down onto one knee) and "rise" (up from one knee, through a lunge) are made here
#   - three weights of the same model, each with the unwrap kept, the data picture as the material's image, and the
#     cloth (alpha) and the data (rgb) in the vertex colours as well, for her reflection
# usage: python3.11 -I ione4_build.py -- <rig+clips.glb> <data.png> <out dir> <name>
#   env: LODS="24000,10000,6000"  STRIDE=0.9 (scale of the walk's leg swing)  ONLY_FULL=1 (skip the light copies)  CLIPS=a,b (only these)
import bpy, sys, os, math
import numpy as np
from mathutils import Vector, Matrix, Quaternion
from scipy.spatial import cKDTree
a = sys.argv[sys.argv.index('--') + 1:]
src, data_png, outdir, name = a[0], a[1], a[2], a[3]
FPS = 24.0; SCALE = 1.72; WALK_SPEED = 1.1
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
sc = bpy.context.scene; sc.render.fps = int(FPS)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
body = max((o for o in bpy.data.objects if o.type == 'MESH'), key=lambda o: len(o.data.polygons))
me = body.data
# The generator's file holds every seam of the unwrap as two rows of points. Thinning such a mesh pulls the two rows
# apart and leaves pin-holes along every seam: the rows are welded first (the unwrap lives in the corners of the faces
# and is kept).
import bmesh
bm = bmesh.new(); bm.from_mesh(me); nb0 = len(bm.verts); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6); bm.to_mesh(me); bm.free(); me.update()
print("BUILD welded the seams: %d points -> %d" % (nb0, len(me.vertices)))
def sstep(a_, b_, x): t = np.clip((x - a_) / (b_ - a_), 0.0, 1.0); return t * t * (3.0 - 2.0 * t)
def bname(n): return next(b.name for b in arm.data.bones if b.name.endswith(":" + n) or b.name == n)

# ------------------------------------------------------------------ the data picture and the cloth at each vertex
dimg = bpy.data.images.load(data_png); dimg.colorspace_settings.name = 'Non-Color'; DW, DH = dimg.size
dpx = np.array(dimg.pixels[:], dtype=np.float32).reshape(DH, DW, 4)[..., :3]
nv = len(me.vertices); nl = len(me.loops)
uv = np.empty(nl * 2); me.uv_layers.active.data.foreach_get("uv", uv); uv = uv.reshape(nl, 2)
lv = np.empty(nl, dtype=np.int64); me.loops.foreach_get("vertex_index", lv)
xi = np.clip((np.mod(uv[:, 0], 1.0) * DW).astype(np.int64), 0, DW - 1); yi = np.clip((np.mod(uv[:, 1], 1.0) * DH).astype(np.int64), 0, DH - 1)
ld = dpx[yi, xi].astype(np.float64)
vdat = np.zeros((nv, 3)); cnt = np.zeros(nv); np.add.at(vdat, lv, ld); np.add.at(cnt, lv, 1.0); vdat /= np.maximum(cnt, 1.0)[:, None]
cloth = vdat[:, 1] > 0.5
co = np.empty(nv * 3); me.vertices.foreach_get("co", co); co = co.reshape(nv, 3)
mw = np.array(body.matrix_world); co = co @ mw[:3, :3].T + mw[:3, 3]             # she faces +X, her left is +Y, up is +Z; 1 unit tall
print("BUILD verts", nv, "cloth", int(cloth.sum()), "bbox", co.min(axis=0).round(3), co.max(axis=0).round(3))

# ------------------------------------------------------------------ weights
gnames = [g.name for g in body.vertex_groups]; ng = len(gnames); gi = {n: i for i, n in enumerate(gnames)}
Wt = np.zeros((nv, ng), dtype=np.float64)
for v in me.vertices:
    for g in v.groups: Wt[v.index, g.group] = g.weight
Wt /= np.maximum(Wt.sum(axis=1), 1e-9)[:, None]
W0 = Wt.copy()
J = {b.name.split(":")[-1]: np.array(arm.matrix_world @ b.head_local) for b in arm.data.bones}
def G(n): return gi[bname(n)]
x, y, z = co[:, 0], co[:, 1], co[:, 2]
# (1) above the hips: every point takes the mean of the weights around it (a small ball), so that layers lying on one
#     another go together. The hands are left alone (their fingers lie close to each other).
tree = cKDTree(co)
R_SM = float(os.environ.get("SMOOTH_R", "0.016"))
upper = (z > 0.52) & (np.abs(y) < 0.31)
idx = np.where(upper)[0]
nb = tree.query_ball_point(co[idx], R_SM)
Ws = Wt.copy()
for k, i in enumerate(idx):
    j = np.array(nb[k]); d = np.linalg.norm(co[j] - co[i], axis=1); w = np.exp(-(d / (R_SM * 0.6)) ** 2)
    Ws[i] = (Wt[j] * w[:, None]).sum(axis=0) / w.sum()
fade_hand = sstep(0.31, 0.27, np.abs(y))
Wt = Wt + (Ws - Wt) * (upper * fade_hand)[:, None]
# (2) below the hips: weights from the place alone
yc = 0.5 * (J["LeftUpLeg"][1] + J["RightUpLeg"][1]); hipz = J["LeftUpLeg"][2]; kneez = J["LeftLeg"][2]; anklez = J["LeftFoot"][2]
LAT = float(os.environ.get("SK_LAT", "0.1")); KNEE = float(os.environ.get("SK_KNEE", "0.07"))
sL = sstep(-LAT, LAT, y - yc); sR = 1.0 - sL
tk = sstep(kneez - KNEE, kneez + KNEE, z)                       # 1 above the knee
h = sstep(hipz - float(os.environ.get("SK_HIPLO", "0.12")), hipz + float(os.environ.get("SK_HIPHI", "0.035")), z)   # 1 = the hips alone
F = np.zeros((nv, ng))
# The surface is one skin: there are no legs inside the wrap, only the patches of leg that show in the slit. So the
# wrap need not swing as far as the legs do: toward the hem it takes only part of their swing (the rest stays with
# the hips) and hangs calmer, as cloth would; the feet, below it, go all the way.
HEM = float(os.environ.get("SK_HEM", "0.86"))
dmp = HEM + (1.0 - HEM) * sstep(0.12, 0.5, z)
leg = (1 - h) * dmp
F[:, G("Hips")] = 1.0 - leg
F[:, G("LeftUpLeg")] = leg * tk * sL; F[:, G("RightUpLeg")] = leg * tk * sR
F[:, G("LeftLeg")] = leg * (1 - tk) * sL; F[:, G("RightLeg")] = leg * (1 - tk) * sR
top = sstep(hipz + 0.01, hipz + 0.09, z)                         # above this the smoothed automatic weights take over
low = np.where(cloth, 1.0, sstep(anklez - 0.012, anklez + 0.03, z))   # the feet keep their own (ankle, toes); cloth never follows a foot
mixf = (1.0 - top) * low
Wt = Wt * (1.0 - mixf)[:, None] + F * mixf[:, None]
# (3) no more than four bones to a point
order = np.argsort(-Wt, axis=1)[:, :4]
Wk = np.zeros_like(Wt); rows = np.arange(nv)[:, None]; Wk[rows, order] = Wt[rows, order]
Wk[Wk < 0.004] = 0.0; Wk /= np.maximum(Wk.sum(axis=1), 1e-9)[:, None]
print("BUILD weights changed (mean abs) %.4f" % np.abs(Wk - W0).mean(), "points below the hips made again:", int((mixf > 0.5).sum()))
if os.environ.get("KEEP_AUTO") != "1":
    for g in body.vertex_groups: g.remove(range(nv))
    for gidx in range(ng):
        col = Wk[:, gidx]; nz = np.nonzero(col)[0]
        vg = body.vertex_groups[gidx]
        for i in nz: vg.add([int(i)], float(col[i]), 'REPLACE')

# ------------------------------------------------------------------ clips
bones = [b.name for b in arm.data.bones]                          # parents come before children
bi = {n: i for i, n in enumerate(bones)}
par = [bi[b.parent.name] if b.parent else -1 for b in arm.data.bones]
REST = [np.array(arm.data.bones[n].matrix_local.to_3x3()) for n in bones]          # armature space
HEAD = [np.array(arm.data.bones[n].head_local) for n in bones]
HIPS = bi[bname("Hips")]
def q_arr(q): return np.array([q.w, q.x, q.y, q.z])
def read_clip(arm_o, action):
    """a clip as numbers: for every frame the turn of every bone (its own, on top of the rest pose) and the hips' place (armature space)"""
    if not arm_o.animation_data: arm_o.animation_data_create()
    arm_o.animation_data.action = action
    try:
        if action.slots: arm_o.animation_data.action_slot = action.slots[0]
    except Exception as e: print("slot", e)
    f0, f1 = int(round(action.frame_range[0])), int(round(action.frame_range[1]))
    names = [b.name for b in arm_o.data.bones]
    rot = np.zeros((f1 - f0 + 1, len(names), 3, 3)); hp = np.zeros((f1 - f0 + 1, 3))
    hb = next(b for b in arm_o.pose.bones if b.name.endswith("Hips"))
    for k, f in enumerate(range(f0, f1 + 1)):
        sc.frame_set(f)
        for i, n in enumerate(names): rot[k, i] = np.array((arm_o.matrix_world @ arm_o.pose.bones[n].matrix).to_3x3().normalized())
        hp[k] = np.array((arm_o.matrix_world @ hb.matrix).translation)
    return {"rot": rot, "hips": hp, "names": names}             # rot: where each bone points, in the world
src_clips = {}
for ac in list(bpy.data.actions):
    c = read_clip(arm, ac); src_clips[ac.name] = c
    print("BUILD clip of the new rig:", ac.name, c["rot"].shape[0], "frames")
arm.animation_data.action = None
for b in arm.pose.bones: b.matrix_basis = Matrix.Identity(4)
sc.frame_set(0)
AW = np.array(arm.matrix_world.to_3x3()); AWt = np.array(arm.matrix_world.translation)
RESTW = [AW @ r for r in REST]
REST_HIPS = AW @ HEAD[HIPS] + AWt
# ---- numbers about a pose: where the joints are (forward kinematics), turning a bone with all that hangs on it
NB = len(bones)
OFFS = [np.zeros(3) if par[i] < 0 else np.linalg.inv(RESTW[par[i]]) @ (AW @ (HEAD[i] - HEAD[par[i]])) for i in range(NB)]
KIDS = [[] for _ in range(NB)]
for i in range(NB):
    p = par[i]
    while p >= 0: KIDS[p].append(i); p = par[p]
def B(n): return bi[bname(n)]
def fk(c):
    nf = c["rot"].shape[0]; pos = np.zeros((nf, NB, 3))
    for i in range(NB):
        pos[:, i] = c["hips"] if par[i] < 0 else pos[:, par[i]] + np.einsum('fij,j->fi', c["rot"][:, par[i]], OFFS[i])
    return pos
def fk1(rot, hips):
    pos = np.zeros((NB, 3))
    for i in range(NB): pos[i] = hips if par[i] < 0 else pos[par[i]] + rot[par[i]] @ OFFS[i]
    return pos
def turn(rot, b, R):
    """bone b and everything below it turned by R (a world rotation, about b's own joint)"""
    rot[b] = R @ rot[b]
    for k in KIDS[b]: rot[k] = R @ rot[k]
def rdiff(a_, b_): return np.array(Vector(a_.tolist()).normalized().rotation_difference(Vector(b_.tolist()).normalized()).to_matrix())
def aim(rot, hips, b, child, want):
    pos = fk1(rot, hips); turn(rot, b, rdiff(pos[child] - pos[b], np.array(want)))
def roty(deg): return np.array(Matrix.Rotation(math.radians(deg), 3, 'Y'))     # about her left: a positive angle bows forward / points toes down
def slerp_rot(r0, r1, t):
    q0 = Matrix(r0.tolist()).to_quaternion(); q1 = Matrix(r1.tolist()).to_quaternion()
    return np.array(q0.slerp(q1, float(t)).to_matrix())
def ease(t): t = min(max(t, 0.0), 1.0); return t * t * (3.0 - 2.0 * t)
def copyc(c): return {"rot": c["rot"].copy(), "hips": c["hips"].copy()}
def resample(c, times):
    nf = c["rot"].shape[0]; out_r = np.zeros((len(times), NB, 3, 3)); out_h = np.zeros((len(times), 3))
    for k, t in enumerate(times):
        t = min(max(t, 0.0), nf - 1.0); i0 = int(math.floor(t)); i1 = min(i0 + 1, nf - 1); u = t - i0
        out_h[k] = c["hips"][i0] * (1 - u) + c["hips"][i1] * u
        for b in range(NB): out_r[k, b] = c["rot"][i0, b] if u < 1e-6 else slerp_rot(c["rot"][i0, b], c["rot"][i1, b], u)
    return {"rot": out_r, "hips": out_h}
def close_loop(c, n):
    """the last n frames are led into the first frame, so that the clip returns to its start"""
    nf = c["rot"].shape[0]
    for k in range(n):
        t = ease((k + 1) / n); f = nf - n + k
        for b in range(NB): c["rot"][f, b] = slerp_rot(c["rot"][f, b], c["rot"][0, b], t)
        c["hips"][f] = c["hips"][f] * (1 - t) + c["hips"][0] * t
    return c
LT, RT, LA, RA = B("LeftToeBase"), B("RightToeBase"), B("LeftFoot"), B("RightFoot")
TOE_REST = (AW @ HEAD[LT] + AWt)[2]; ANKLE_REST = (AW @ HEAD[LA] + AWt)[2]
def foot_lift(pos):
    """how far each foot is off the floor, by its joints (0 = as in the rest pose), per frame: (left, right)"""
    return np.minimum(pos[:, LT, 2] - TOE_REST, pos[:, LA, 2] - ANKLE_REST), np.minimum(pos[:, RT, 2] - TOE_REST, pos[:, RA, 2] - ANKLE_REST)
def ground(c, note=""):
    l, r = foot_lift(fk(c)); low = min(l.min(), r.min()); c["hips"][:, 2] -= low
    if note: print("BUILD floor of %s: moved by %.4f" % (note, -low))
    return c
def smooth_cyc(x, sigma, cyclic):
    n = len(x); k = np.arange(-3 * int(math.ceil(sigma)), 3 * int(math.ceil(sigma)) + 1); w = np.exp(-0.5 * (k / sigma) ** 2); w /= w.sum()
    out = np.zeros(n)
    for kk, ww in zip(k, w):
        idx = (np.arange(n) + kk) % n if cyclic else np.clip(np.arange(n) + kk, 0, n - 1)
        out += ww * x[idx]
    return out
def plant_feet(c, v, cyclic, note=""):
    """The clips come with the hips pinned over one point, so a standing foot wanders on the floor. Here the hips are
    let go instead: at every frame the foot that carries her is held where the floor is (passing back at v units a frame
    when she walks, still when she stands), and the hips take up the difference."""
    pos = fk(c); l, r = foot_lift(pos); nf = len(l)
    mid = [0.5 * (pos[:, LT] + pos[:, LA]), 0.5 * (pos[:, RT] + pos[:, RA])]
    sup = (r < l).astype(int)                                     # 0: the left carries her
    for _ in range(2):                                            # no support of a single frame
        for f in range(nf):
            if sup[f] != sup[f - 1] and sup[f] != sup[(f + 1) % nf]: sup[f] = sup[f - 1]
    off = np.zeros((nf, 2)); cur = np.zeros(2)
    for f in range(1, nf):
        s = sup[f]
        if sup[f] == sup[f - 1]: step = mid[s][f, :2] - mid[s][f - 1, :2]      # how the carrying foot moved under pinned hips
        else: step = 0.5 * ((mid[0][f, :2] - mid[0][f - 1, :2]) + (mid[1][f, :2] - mid[1][f - 1, :2]))
        cur = cur - step - np.array([v, 0.0]); off[f] = cur
    if cyclic:                                                    # what is left over after a whole cycle is spread evenly
        s = sup[0]; step = (mid[s][0, :2] - mid[s][nf - 1, :2]) if sup[0] == sup[nf - 1] else 0.5 * ((mid[0][0, :2] - mid[0][nf - 1, :2]) + (mid[1][0, :2] - mid[1][nf - 1, :2]))
        end = cur - step - np.array([v, 0.0])
        off -= np.outer(np.arange(nf) / nf, end)
        if note: print("BUILD feet of %s: left over a cycle %.4f %.4f (spread)" % (note, end[0], end[1]))
    for k in range(2): off[:, k] = smooth_cyc(off[:, k], 1.2, cyclic)
    off -= off.mean(axis=0)
    c["hips"][:, 0] += off[:, 0]; c["hips"][:, 1] += off[:, 1]
    if note: print("BUILD feet of %s: hips now sway x %.3f..%.3f  y %.3f..%.3f" % (note, off[:, 0].min(), off[:, 0].max(), off[:, 1].min(), off[:, 1].max()))
    return c
def centre(c):
    """every clip stands over the origin: the mean place of the middle between her feet"""
    pos = fk(c); m = 0.25 * (pos[:, LT] + pos[:, LA] + pos[:, RT] + pos[:, RA]).mean(axis=0)
    c["hips"][:, 0] -= m[0]; c["hips"][:, 1] -= m[1]
    return c
def stance_speed(c):
    """how fast the floor passes under the foot that carries her (units a frame)"""
    pos = fk(c); l, r = foot_lift(pos); sp = []
    for lift, a_, t_ in ((l, LA, LT), (r, RA, RT)):
        xx = 0.5 * (pos[:, a_, 0] + pos[:, t_, 0]); on = lift < 0.004
        v = np.gradient(xx)
        if on.sum() > 2: sp.append(-np.median(v[on]))
    return float(np.mean(sp)) if sp else 0.0
def scale_from(c, k, ref, which):
    """the named bones go only part (k) of the way from the pose ref to where the clip has them"""
    for b, n in enumerate(bones):
        if not any(t in n for t in which): continue
        for f in range(c["rot"].shape[0]): c["rot"][f, b] = slerp_rot(ref[b], c["rot"][f, b], k)
    return c
def breathe(c, cycles, deg):
    """a slow breath laid over a clip: the chest lifts and sinks a whole number of times, so the loop stays closed"""
    nf = c["rot"].shape[0]
    for f in range(nf):
        a_ = math.sin(2.0 * math.pi * cycles * f / (nf - 1))
        turn(c["rot"][f], B("Spine1"), roty(-deg * a_)); turn(c["rot"][f], B("Neck"), roty(deg * 0.8 * a_))
        for s, k in (("Left", 1.0), ("Right", -1.0)): turn(c["rot"][f], B(s + "Shoulder"), np.array(Matrix.Rotation(math.radians(deg * 0.9 * a_ * k), 3, 'X')))
    return c

clips = {}                                                       # name -> clip, ready
# ---- idle: the generator's standing clip, her feet held to the floor (the hips shift her weight), a breath added
idle = copyc(src_clips["idle"])
idle = close_loop(idle, 30)
idle = plant_feet(idle, 0.0, False, "idle"); idle = close_loop(idle, 30)
idle = breathe(idle, int(os.environ.get("BREATHS", "4")), float(os.environ.get("BREATH_DEG", "1.6")))
idle = ground(centre(idle), "idle"); clips["idle"] = idle
stand = idle["rot"][0].copy(); stand_h = idle["hips"][0].copy()
# ---- walk: timed for 1.1 m/s, the carrying foot held to the passing floor
wk = copyc(src_clips["walk"])                                    # (its last frame is one step short of its first: a cycle of that many frames)
wk = scale_from(wk, float(os.environ.get("STRIDE", "0.9")), stand, ("UpLeg", "Leg", "Foot", "Toe"))
wk = ground(wk)
def cycle_travel(c):
    """how far the floor passes under her in one cycle of the clip (units), counted along the feet that carry her"""
    pos = fk(c); l, r = foot_lift(pos); n = len(l); mid = [0.5 * (pos[:, LT, 0] + pos[:, LA, 0]), 0.5 * (pos[:, RT, 0] + pos[:, RA, 0])]
    sup = (r < l).astype(int); tot = 0.0
    for f in range(n):
        g = (f + 1) % n
        tot -= (mid[sup[f]][g] - mid[sup[f]][f]) if sup[f] == sup[g] else 0.5 * ((mid[0][g] - mid[0][f]) + (mid[1][g] - mid[1][f]))
    return tot
nf = wk["rot"].shape[0]; trav = cycle_travel(wk); v0 = trav * SCALE / (nf / FPS)
want_nf = max(int(round(trav * SCALE / WALK_SPEED * FPS)), 8)
wk = resample({"rot": np.concatenate([wk["rot"], wk["rot"][:1]]), "hips": np.concatenate([wk["hips"], wk["hips"][:1]])}, [i * nf / want_nf for i in range(want_nf)])
wk = plant_feet(wk, WALK_SPEED / SCALE / FPS, True, "walk")
wk = ground(centre(wk), "walk")
print("BUILD walk: feet passed at %.3f m/s over %d frames -> %d frames; now %.3f m/s" % (v0, nf, want_nf, stance_speed(wk) * FPS * SCALE))
def closed(c): return {"rot": np.concatenate([c["rot"], c["rot"][:1]]), "hips": np.concatenate([c["hips"], c["hips"][:1]])}   # a loop ends on its first frame
clips["walk"] = closed(wk)
# ---- steps on the spot, for turning where she stands: the walk with a small swing, feet held still under her
ts = copyc(wk)
ts = scale_from(ts, float(os.environ.get("TURN_SWING", "0.14")), stand, ("UpLeg", "Leg", "Foot", "Toe"))
ts = scale_from(ts, 0.4, stand, ("Arm", "Shoulder", "Spine", "Neck", "Head", "Hand"))
ts["hips"][:, 0] = stand_h[0]; ts["hips"][:, 1] = stand_h[1]
ts = plant_feet(ts, 0.0, True, "turn_step"); ts = ground(centre(ts), "turn_step")
clips["turn_step"] = closed(ts)
# ---- kneel: from standing down onto the right knee, the left foot staying where it stood (the leg the slit shows goes
#      forward). Made here, joint by joint: the generator has no such clip. The game runs it forward and back.
def leg_ik(rot, hips, side, ankle, pitch):
    up, lo, ft = B(side + "UpLeg"), B(side + "Leg"), B(side + "Foot")
    pos = fk1(rot, hips); a_ = pos[up]; l1 = np.linalg.norm(pos[lo] - pos[up]); l2 = np.linalg.norm(pos[ft] - pos[lo])
    to = ankle - a_; d = min(max(np.linalg.norm(to), abs(l1 - l2) + 1e-4), (l1 + l2) * 0.9995); dirn = to / np.linalg.norm(to)
    ca = min(max((l1 * l1 + d * d - l2 * l2) / (2.0 * l1 * d), -1.0), 1.0)
    pole = np.array([1.0, 0.0, 0.0]); perp = pole - dirn * (pole @ dirn); perp /= np.linalg.norm(perp)
    knee = a_ + dirn * (l1 * ca) + perp * (l1 * math.sqrt(max(1.0 - ca * ca, 0.0)))
    foot0 = rot[ft].copy()
    aim(rot, hips, up, lo, knee - a_)
    pos = fk1(rot, hips); aim(rot, hips, lo, ft, a_ + dirn * d - pos[lo])
    turn(rot, ft, (roty(pitch) @ foot0) @ rot[ft].T)             # the foot keeps its own lie on the floor, but for the pitch asked
NK = int(os.environ.get("KNEEL_FRAMES", "38"))
kr = np.zeros((NK + 1, NB, 3, 3)); kh = np.zeros((NK + 1, 3))
p0 = fk1(stand, stand_h)
thigh = np.linalg.norm(p0[B("LeftLeg")] - p0[B("LeftUpLeg")]); shin = np.linalg.norm(p0[B("LeftFoot")] - p0[B("LeftLeg")])
hipj0 = p0[B("LeftUpLeg")]; drop_end = (hipj0[2] - (ANKLE_REST + shin * 0.985)); back_end = thigh * 0.93
ra0 = p0[RA].copy(); la0 = p0[LA].copy()
ra1 = np.array([p0[B("RightUpLeg")][0] - back_end - shin * 0.93, ra0[1] - 0.01, ANKLE_REST + 0.032])
for f in range(NK + 1):
    s = f / NK; rot = stand.copy()
    e_h = ease((s - 0.12) / 0.88); e_b = ease(s / 0.8)
    hips = stand_h + np.array([-back_end * ease(s), 0.006 * math.sin(math.pi * s), -drop_end * e_h])
    turn(rot, B("Spine"), roty(5.0 * ease(s))); turn(rot, B("Head"), roty(6.0 * ease(s)))
    leg_ik(rot, hips, "Left", la0, 0.0)
    ank = ra0 * (1 - e_b) + ra1 * e_b; ank[2] += 0.03 * math.sin(math.pi * min(s / 0.8, 1.0))
    leg_ik(rot, hips, "Right", ank, 62.0 * e_b)
    turn(rot, RT, roty(-50.0 * e_b))                             # the toes stay flat on the floor behind her
    kr[f] = rot; kh[f] = hips
kn = {"rot": kr, "hips": kh}
l, r = foot_lift(fk(kn)); print("BUILD kneel: feet off the floor at the end %.3f %.3f, hips end at %.3f, right knee at %.3f" % (l[-1], r[-1], kh[-1, 2], fk1(kr[-1], kh[-1])[B("RightLeg")][2]))
clips["kneel"] = kn
# ---- rise: from one knee up to standing, as a person rises (the kneel run backwards swung the back leg forward while
#      she was still low, and her leg bent strangely). She begins on one knee, her head bowed, both hands resting on the
#      front knee, the top of the back foot flat on the floor behind her (no bent ankle, no bent toes). Her weight comes
#      forward; the back foot rolls onto its toes as that knee lifts; she pushes up from the knee with her hands into a
#      lunge as far as the back leg reaches, the back foot drawn in on its toes; her hands leave the knee; the back foot
#      steps through and she stands, her head lifting last. The game runs it forward (a_rise).
def arm_ik(rot, hips, side, wrist, pole):
    up, lo, hd = B(side + "Arm"), B(side + "ForeArm"), B(side + "Hand")
    pos = fk1(rot, hips); a_ = pos[up]; l1 = np.linalg.norm(pos[lo] - pos[up]); l2 = np.linalg.norm(pos[hd] - pos[lo])
    to = wrist - a_; d = min(max(np.linalg.norm(to), abs(l1 - l2) + 1e-4), (l1 + l2) * 0.999); dirn = to / np.linalg.norm(to)
    ca = min(max((l1 * l1 + d * d - l2 * l2) / (2.0 * l1 * d), -1.0), 1.0)
    pl = np.array(pole, dtype=float); perp = pl - dirn * (pl @ dirn); perp /= np.linalg.norm(perp)
    elbow = a_ + dirn * (l1 * ca) + perp * (l1 * math.sqrt(max(1.0 - ca * ca, 0.0)))
    aim(rot, hips, up, lo, elbow - a_)
    pos = fk1(rot, hips); aim(rot, hips, lo, hd, a_ + dirn * d - pos[lo])
RISE_S = float(os.environ.get("RISE_SECONDS", "8.0"))       # (the clip's own time: the game plays it as it is, not stretched)
NR = int(round(RISE_S * FPS))
HANG_F, HANG_O, HANG_L = (float(v) for v in os.environ.get("RISE_HANG_AT", "0.03,0.03,0.93").split(","))      # (where a hanging hand is: forward, out, down by the arm's length)
rr = np.zeros((NR + 1, NB, 3, 3)); rh = np.zeros((NR + 1, 3))
upR = B("RightUpLeg"); reach = (thigh + shin) * 0.98
v0 = p0[RA] - p0[RT]                                         # (the ankle from the ball of the foot, standing)
FLAT, TUCK = float(os.environ.get("RISE_FLAT", "84")), float(os.environ.get("RISE_TUCK", "84"))
# (the back foot at the start: on its toes, the heel up, the sole to the back, as one kneels ready to rise. The top of
#  the foot flat on the floor (RISE_FLAT 145) showed its sole to the game's eye and reached past the edge of her stone:
#  "the leg behind still breaks". The knee goes down a little closer behind the front foot (RISE_BACK of a thigh).)
back_r = thigh * float(os.environ.get("RISE_BACK", "0.8"))
ra1r = np.array([p0[B("RightUpLeg")][0] - back_r - shin * float(os.environ.get("RISE_SHINX", "0.9")), ra0[1] - 0.01, ANKLE_REST + 0.032])
ball0 = ra1r - roty(FLAT) @ v0; ball0[2] = TOE_REST          # (where the ball of the back foot lies at the start)
ball1 = p0[RT].copy()                                        # (and where it stands)
ARMS = [B(n) for n in bones if any(t in n for t in ("Shoulder", "Arm", "Hand"))]
LEAN0 = float(os.environ.get("RISE_LEAN", "60")); NECK0 = float(os.environ.get("RISE_NECK", "34")); HEAD0 = float(os.environ.get("RISE_HEAD", "46")); SHO0 = float(os.environ.get("RISE_SHO", "16"))
SPD = [float(v) for v in os.environ.get("RISE_SPD", "0.3,0.35,0.35").split(",")]      # (how the bow is shared down the spine: Spine, Spine1, Spine2)      # (her back bowed over the knee: spread down the spine, so it curves)
# The rise in its moments, each in its own time, as a person rises (the user: "you sent me a transition": everything
# had moved at once, one smooth blend from kneeling to standing). Seconds:
#   0.15-1.35  a breath: the statue stirs (her chest lifts, her shoulders rise and fall, her head stirs)
#   1.1-2.1    her crossed arms open, her hands go to the knee
#   2.0-2.9    her weight comes forward over the front foot, a little down: she gathers herself
#   2.8-5.6    the push: the hips rise; the back leg holds them to a lunge until it steps
#   3.6-4.4    the back foot drawn in a little on its toes; 4.4-5.5 stepped through beside the other
#   4.2-5.1    her hands leave the knee and hang; 3.6-6.2 her back comes up; a little sway back as it does
#   5.6-7.2    her head comes up last; 6.4-7.8 she looks out, a little up, and settles; her arms to the idle's
def win(t, a_, b_): return ease((t - a_) / (b_ - a_))
def win5(t, a_, b_): x = min(max((t - a_) / (b_ - a_), 0.0), 1.0); return x * x * x * (x * (x * 6.0 - 15.0) + 10.0)
def bump(t, a_, b_): x = min(max((t - a_) / (b_ - a_), 0.0), 1.0); return math.sin(math.pi * x)
TS = RISE_S / 8.0      # (the moments scale with the clip's length)
for f in range(NR + 1):
    t = f / FPS / TS; u = f / NR
    br = bump(t, 0.15, 1.35); unx = win(t, 1.1, 2.1); fw = win(t, 2.0, 2.9); sink = bump(t, 2.0, 3.1)
    hz = win5(t, 2.8, 5.6); sl = win(t, 3.6, 4.4); st = win(t, 4.4, 5.5); rel = win(t, 4.2, 5.1)
    lift = win(t, 3.6, 6.2); sway = bump(t, 5.8, 6.9); hlift = win(t, 5.6, 7.2); look = bump(t, 6.4, 7.8); fin = win(t, 6.4, 7.8)
    pitch = FLAT * (1.0 - st)
    toe = -80.0 * (1.0 - st)
    ball = ball0 + (ball1 - ball0) * 0.4 * sl; ball = ball * (1.0 - st) + ball1 * st; ball = ball.copy()
    ball[2] = TOE_REST + 0.05 * math.sin(math.pi * st)
    ank = ball + roty(pitch) @ v0
    hips = stand_h.copy()
    hips[0] = stand_h[0] - back_r * ((1.0 - fw) + 0.45 * fw) * (1.0 - st)
    hips[2] = stand_h[2] - drop_end * (1.0 - hz) + 0.006 * br - 0.012 * sink
    lean = (LEAN0 + 7.0 * fw) * (1.0 - lift) - 4.0 * br - 2.5 * sway
    poses = []
    for with_hands in (True, False, "crossed"):
        rot = stand.copy()
        turn(rot, B("Spine"), roty(lean * SPD[0])); turn(rot, B("Spine1"), roty(lean * SPD[1])); turn(rot, B("Spine2"), roty(lean * SPD[2]))      # (the bow mostly in the upper back: she curls over the knee, not folds at the waist)
        for sd in ("Left", "Right"): turn(rot, B(sd + "Shoulder"), roty(SHO0 * (1.0 - lift) - 5.0 * br))      # (her shoulders drawn in and down; they rise with the breath)
        turn(rot, B("Neck"), roty(NECK0 * (1.0 - hlift) - 4.0 * br)); turn(rot, B("Head"), roty(HEAD0 * (1.0 - hlift) - 5.0 * br - 7.0 * look))
        hh = hips.copy()
        for _ in range(3):      # (no higher than the back leg reaches while its foot is still behind)
            hj = fk1(rot, hh)[upR]; dxy = math.hypot(hj[0] - ank[0], hj[1] - ank[1])
            zmax = ank[2] + math.sqrt(max(reach * reach - dxy * dxy, 0.0))
            if hj[2] > zmax: hh[2] -= hj[2] - zmax
        leg_ik(rot, hh, "Left", la0, 0.0)
        leg_ik(rot, hh, "Right", ank, pitch)
        turn(rot, RT, roty(toe))
        if with_hands is True:      # (both hands on the front knee: the left at its outer side, the right over it)
            kn_ = fk1(rot, hh)[B("LeftLeg")]
            arm_ik(rot, hh, "Left", kn_ + np.array([-0.03, 0.03, 0.06]), (-0.4, 1.0, 0.0))
            arm_ik(rot, hh, "Right", kn_ + np.array([-0.015, -0.012, 0.078]), (-0.4, -1.0, 0.0))
            for sd in ("Left", "Right"): aim(rot, hh, B(sd + "Hand"), B(sd + "HandMiddle1"), np.array([0.55, 0.0, -0.83]))
        elif with_hands is False and os.environ.get("RISE_HANG", "1") == "1":      # (her arms hang by their weight: each hand below its shoulder, a little forward and out, the elbow easy)
            for sd, sgn in (("Left", 1.0), ("Right", -1.0)):
                pos_ = fk1(rot, hh); up_, lo_, hd_ = B(sd + "Arm"), B(sd + "ForeArm"), B(sd + "Hand")
                l1_ = np.linalg.norm(pos_[lo_] - pos_[up_]); l2_ = np.linalg.norm(pos_[hd_] - pos_[lo_])
                arm_ik(rot, hh, sd, pos_[up_] + np.array([HANG_F, sgn * HANG_O, -(l1_ + l2_) * HANG_L]), (-1.0, sgn * 0.3, 0.0))
                pos_ = fk1(rot, hh); fa_ = pos_[hd_] - pos_[lo_]
                aim(rot, hh, hd_, B(sd + "HandMiddle1"), fa_ / np.linalg.norm(fa_) + np.array([0.15, 0.0, 0.0]))
        elif with_hands == "crossed":      # (her forearms crossed over the front knee, each hand at its far side, close together; the elbows down on the thigh)
            kn_ = fk1(rot, hh)[B("LeftLeg")]
            XL = [float(v) for v in os.environ.get("RISE_XL", "0.0,-0.03,0.07").split(",")]; XR = [float(v) for v in os.environ.get("RISE_XR", "0.012,0.035,0.09").split(",")]
            arm_ik(rot, hh, "Left", kn_ + np.array(XL), (-0.6, 0.75, -0.45))
            arm_ik(rot, hh, "Right", kn_ + np.array(XR), (-0.6, -0.65, -0.45))
            aim(rot, hh, B("LeftHand"), B("LeftHandMiddle1"), np.array([0.3, -0.28, -0.91]))      # (the hands hang loose over the sides of the knee)
            aim(rot, hh, B("RightHand"), B("RightHandMiddle1"), np.array([0.3, 0.28, -0.91]))
        poses.append((rot, hh))
    rot, hh = poses[0]; free = poses[1][0]; cross = poses[2][0]
    if os.environ.get("RISE_HANG", "1") == "1":      # (the hanging arms come to the standing arms as she stands: at the end the clip is the idle's first frame)
        st_ = stand.copy()
        for k_, a_t in ((B("Spine"), SPD[0]), (B("Spine1"), SPD[1]), (B("Spine2"), SPD[2])): turn(st_, k_, roty(lean * a_t))
        for sd in ("Left", "Right"): turn(st_, B(sd + "Shoulder"), roty(SHO0 * (1.0 - lift) - 5.0 * br))
        for b in ARMS: free[b] = slerp_rot(free[b], st_[b], fin)
    for b in ARMS: rot[b] = slerp_rot(cross[b], rot[b], unx)
    for b in ARMS: rot[b] = slerp_rot(rot[b], free[b], rel)
    rr[f] = rot; rh[f] = hh
rz = {"rot": rr, "hips": rh}
l, r = foot_lift(fk(rz)); p_ = fk1(rr[0], rh[0])
print("BUILD rise start: head %.3f, neck %.3f, front knee %s, back knee %s, back toe x %.3f (stands at %.3f); elbows L %s R %s; wrists L %s R %s" % (
    p_[B("Head")][2], p_[B("Neck")][2], np.round(p_[B("LeftLeg")], 3), np.round(p_[B("RightLeg")], 3), p_[B("RightToeBase")][0], rh[-1][0],
    np.round(p_[B("LeftForeArm")], 3), np.round(p_[B("RightForeArm")], 3), np.round(p_[B("LeftHand")], 3), np.round(p_[B("RightHand")], 3)))
print("BUILD rise: lowest foot lift %.3f %.3f, hips from %.3f to %.3f; at the start wrists %.3f %.3f from the knee; ankle rest %.3f toe rest %.3f" % (
    l.min(), r.min(), rh[0, 2], rh[-1, 2], np.linalg.norm(p_[B("LeftHand")] - p_[B("LeftLeg")]), np.linalg.norm(p_[B("RightHand")] - p_[B("LeftLeg")]), ANKLE_REST, TOE_REST))
clips["rise"] = rz
only = os.environ.get("CLIPS", "")
if only: clips = {k: v for k, v in clips.items() if k in only.split(",")}

# write the clips as actions on the armature
for ac in list(bpy.data.actions): bpy.data.actions.remove(ac)
if arm.animation_data: arm.animation_data_clear()
arm.animation_data_create()
RESTL = [np.array(arm.data.bones[n].matrix_local.to_3x3()) for n in bones]
AWi = np.linalg.inv(AW)
for b in arm.pose.bones: b.rotation_mode = 'QUATERNION'
for cname, c in clips.items():
    ac = bpy.data.actions.new(cname); arm.animation_data.action = ac
    nf = c["rot"].shape[0]
    armr = np.einsum('ij,fbjk->fbik', AWi, c["rot"])            # armature space
    prevq = {}
    for f in range(nf):
        for b, n in enumerate(bones):
            pb = arm.pose.bones[n]
            if par[b] < 0: basis = RESTL[b].T @ armr[f, b]
            else: basis = (RESTL[par[b]].T @ RESTL[b]).T @ (armr[f, par[b]].T @ armr[f, b])
            q = Matrix(basis.tolist()).to_quaternion()
            if n in prevq and prevq[n].dot(q) < 0.0: q.negate()
            prevq[n] = q.copy()
            pb.rotation_quaternion = q; pb.keyframe_insert("rotation_quaternion", frame=f)
            if b == HIPS:
                d = AWi @ (c["hips"][f] - AWt) - HEAD[b]
                pb.location = Vector((RESTL[b].T @ d).tolist()); pb.keyframe_insert("location", frame=f)
    print("BUILD wrote clip %-12s %3d frames (%.2f s)" % (cname, nf, (nf - 1) / FPS))
# ---- the seam of the hem and the toes: where the wrap's hem lies on her feet the generator joined them by faces a few
#      millimetres across, one side following the foot, the other the leg. When the foot rolls or the leg lifts they
#      stretch into long slivers ("the leg behind still breaks"). Those faces only are taken away: the hem comes free
#      of the toes, as cloth lying on a foot is.
gidx_foot = [g.index for g in body.vertex_groups if any(t in g.name for t in ("Foot", "ToeBase", "Toe_End"))]
fsh = np.zeros(len(me.vertices))
for v in me.vertices:
    for g in v.groups:
        if g.group in gidx_foot: fsh[v.index] += g.weight
zr = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", zr); zr = zr.reshape(-1, 3)
zmin_ = zr[:, 2].min(); zspan_ = zr[:, 2].max() - zmin_
seam_f = [p_.index for p_ in me.polygons if np.ptp(fsh[list(p_.vertices)]) > 0.5 and (zr[list(p_.vertices), 2].max() - zmin_) < 0.055 * zspan_]
if seam_f and os.environ.get("SEAM_CUT", "1") == "1":
    bm = bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[bm.faces[i] for i in seam_f], context='FACES_ONLY'); bm.to_mesh(me); bm.free(); me.update()
print("BUILD seam of the hem and the toes: %d faces taken away" % len(seam_f))
# ---- membranes: the generator left thin faces bridging parts that are not one cloth (across the slit of the wrap,
#      between its layers). Standing they are too thin to see; when her legs part (the kneel, the rise) they stretch
#      into long slivers ("the leg behind still breaks"). Each pose of the clips is measured, and a face that grows
#      many times longer than it was, and long on the screen, is taken away (its points stay, so the data keeps its order).
rest_co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", rest_co); rest_co = rest_co.reshape(-1, 3)
ev_ = np.array([e.vertices[:] for e in me.edges]); L0e = np.linalg.norm(rest_co[ev_[:, 0]] - rest_co[ev_[:, 1]], axis=1)
med = float(np.median(L0e)); STR, LONG = float(os.environ.get("MEMB_STRETCH", "6.0")), float(os.environ.get("MEMB_LONG", "5.0"))
bad_e = np.zeros(len(L0e), bool)
checks = [("rise", f) for f in range(0, NR + 1, 6)] + [("kneel", NK)] + [("walk", f) for f in range(0, 50, 5)]
for cname, f in checks:
    if cname not in bpy.data.actions: continue
    ac = bpy.data.actions[cname]; arm.animation_data.action = ac
    try:
        if ac.slots: arm.animation_data.action_slot = ac.slots[0]
    except Exception: pass
    sc.frame_set(f); dg = bpy.context.evaluated_depsgraph_get(); ev = body.evaluated_get(dg); m2 = ev.to_mesh()
    c2 = np.empty(len(m2.vertices) * 3); m2.vertices.foreach_get("co", c2); ev.to_mesh_clear(); c2 = c2.reshape(-1, 3)
    L1e = np.linalg.norm(c2[ev_[:, 0]] - c2[ev_[:, 1]], axis=1)
    bad_e |= (L1e > STR * np.maximum(L0e, 1e-6)) & (L1e > LONG * med)
ekey = {tuple(sorted(e.vertices[:])): i for i, e in enumerate(me.edges)}
bad_f = [p.index for p in me.polygons if any(bad_e[ekey[tuple(sorted(k))]] for k in p.edge_keys)]
if bad_f and os.environ.get("MEMB_CUT") == "1":
    bm = bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[bm.faces[i] for i in bad_f], context='FACES_ONLY'); bm.to_mesh(me); bm.free(); me.update()
print("BUILD membranes: %d edges stretch past %.1fx and %.1f of the mean edge in some pose; %d faces%s" % (int(bad_e.sum()), STR, LONG, len(bad_f), " taken away" if os.environ.get("MEMB_CUT") == "1" else " (kept)"))
arm.animation_data.action = None
for b in arm.pose.bones: b.matrix_basis = Matrix.Identity(4)
for ac in bpy.data.actions:
    tr = arm.animation_data.nla_tracks.new(); tr.name = ac.name; st = tr.strips.new(ac.name, 0, ac)
    try:
        if ac.slots: st.action_slot = ac.slots[0]
    except Exception as e: print("slot", e)

# ------------------------------------------------------------------ material, vertex colours, the three weights, export
ca = me.color_attributes.new("Col", 'FLOAT_COLOR', 'POINT')
ca.data.foreach_set("color", np.stack([vdat[:, 0], vdat[:, 0], vdat[:, 2], vdat[:, 1]], axis=1).astype(np.float32).ravel())
me.color_attributes.active_color = ca; me.color_attributes.render_color_index = me.color_attributes.find("Col")
mat = me.materials[0]; nt = mat.node_tree
for nd in [n for n in nt.nodes if n.type in ('TEX_IMAGE', 'NORMAL_MAP', 'SEPARATE_COLOR', 'SEPRGB', 'MIX', 'MIX_RGB')]: nt.nodes.remove(nd)
bs = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
tn = nt.nodes.new("ShaderNodeTexImage"); tn.image = dimg; nt.links.new(tn.outputs["Color"], bs.inputs["Base Color"])
bs.inputs["Metallic"].default_value = 0.0; bs.inputs["Roughness"].default_value = 0.9
dimg.pack()
for im in list(bpy.data.images):
    if im.users == 0: bpy.data.images.remove(im)
# ---- her head a little smaller: the generator made the wrapped head large for the figure, and bowed over the knee it
#      weighed on the whole silhouette. Each point is drawn toward the joint of the head by as much as it follows the
#      head (its weight there), so the neck goes over smoothly.
HS = float(os.environ.get("HEAD_SCALE", "0.88"))
if abs(HS - 1.0) > 1e-3:
    hg = [g.index for g in body.vertex_groups if g.name.endswith(":Head") or g.name.endswith("HeadTop_End") or g.name in ("Head", "HeadTop_End")]
    jb = arm.data.bones[bname("Head")]; jw = body.matrix_world.inverted() @ (arm.matrix_world @ jb.head_local)
    cnt = 0
    for v in me.vertices:
        wh = sum(g.weight for g in v.groups if g.group in hg)
        if wh > 1e-4:
            k = 1.0 - (1.0 - HS) * min(wh, 1.0); v.co = jw + (v.co - jw) * k; cnt += 1
    me.update(); print("BUILD head drawn in to %.2f about its joint: %d points" % (HS, cnt))
n0 = len(me.polygons)
lods = [int(v) for v in os.environ.get("LODS", "24000,10000,6000").split(",")]
if os.environ.get("ONLY_FULL") == "1": lods = lods[:1]
os.makedirs(outdir, exist_ok=True)
for li, want in enumerate(lods):
    bpy.ops.object.select_all(action='DESELECT'); body.select_set(True); bpy.context.view_layer.objects.active = body
    bpy.ops.object.duplicate(); o = bpy.context.view_layer.objects.active
    if want < n0:
        d = o.modifiers.new("dec", 'DECIMATE'); d.decimate_type = 'COLLAPSE'; d.ratio = want / n0; d.use_collapse_triangulate = True
        while o.modifiers[0].name != "dec": bpy.ops.object.modifier_move_up(modifier="dec")
        bpy.ops.object.modifier_apply(modifier="dec")
    for p in o.data.polygons: p.use_smooth = True
    try: bpy.ops.mesh.customdata_custom_splitnormals_clear()
    except Exception as e: print("NOTE normals", e)
    body.hide_set(True); body.hide_render = True
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); arm.select_set(True)
    fn = os.path.join(outdir, name + ("", "_m", "_s")[li] + ".glb")
    bpy.ops.export_scene.gltf(filepath=fn, export_format='GLB', use_selection=True, export_animations=True, export_skins=True, export_animation_mode='ACTIONS',
        export_optimize_animation_size=True, export_vertex_color='ACTIVE', export_active_vertex_color_when_no_material=True, export_image_format='AUTO',
        export_texcoords=True, export_normals=True, export_yup=True, export_force_sampling=True)
    print("BUILD", fn, "faces", len(o.data.polygons), "verts", len(o.data.vertices), "bytes", os.path.getsize(fn))
    body.hide_set(False); bpy.data.objects.remove(o, do_unlink=True)
print("BUILD done:", sorted(clips.keys()))
