"""EIDOLON a7 (Agent A): the heroine's REAL rig, built in Blender (bpy 5.x, headless) and exported as one GLB with all
her animation clips (retargeted CC0 Quaternius UAL mocap + keyed gestures built on mocap base poses).

  python3.11 dev_rig/tools/heroine_bl_rig.py [--out assets/models/heroine_v2.glb] [--clips a,b,...] [--blend out.blend]

Source mesh: assets/models/heroine_v1_rigged.glb (the Tripo heroine af708ae1, welded, hem cap dropped, arms in a 50 deg
A-pose, COLOR_0.r = her porcelain skin mask). Its old skeleton/weights are DISCARDED; only the mesh is kept.

Skeleton (SkeletonProfileHumanoid names, X = each bone's bend axis, Z forward):
  Hips > Spine > Chest > UpperChest > Neck > Head;  UpperChest > {Left,Right}Shoulder > UpperArm > LowerArm > Hand >
  Fingers1 > Fingers2 (+ ForeTwist under LowerArm: half the hand's twist);  Hips > UpperLeg > LowerLeg > Foot > Toes;
  Hips > Skirt<k>_1 > Skirt<k>_2 (8 gown chains, baked per frame from the legs: the forward knee pushes the gown, the
  hem hangs and never goes through the floor).
Weights: Blender bone-heat (automatic) weights for the body on a welded copy, then region blends: the gown below the
waist rides the skirt chains (no leg weights: nothing tears between the legs), the veil follows head > neck > chest
by height, smoothing passes, 4 influences.
"""
import bpy, sys, os, math, argparse, json
import numpy as np
from mathutils import Vector, Matrix, Quaternion
from mathutils.kdtree import KDTree
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bl_rig_lib as L
from bl_rig_lib import ss

HERE = os.path.dirname(os.path.abspath(__file__))
# RIG=warden builds the Glass Warden (assets/models/warden_v2.glb) with the same pipeline
RIG = os.environ.get('RIG', 'heroine')
WARDEN = RIG == 'warden'
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
ap = argparse.ArgumentParser()
ap.add_argument('--src', default=os.path.join(ROOT, 'assets/models/warden_rigged.glb' if WARDEN else 'assets/models/heroine_v1_rigged.glb'))
ap.add_argument('--ual1', default=os.path.join(ROOT, 'dev_rig/ual/UAL1_Standard.glb'))
ap.add_argument('--ual2', default=os.path.join(ROOT, 'dev_rig/ual/UAL2_Standard.glb'))
ap.add_argument('--out', default=os.path.join(ROOT, 'assets/models/warden_v2.glb' if WARDEN else 'assets/models/heroine_v2.glb'))
ap.add_argument('--clips', default='')
ap.add_argument('--blend', default='')
ap.add_argument('--noexport', action='store_true')
args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:])

FPS = 30
L.reset()
bpy.context.scene.render.fps = FPS

# ------------------------------------------------------------------ the mesh
objs = L.import_glb(args.src)
body = [o for o in objs if o.type == 'MESH' and o.name == ('Warden' if WARDEN else 'Heroine')][0]
for o in objs:
    if o is not body:
        bpy.data.objects.remove(o, do_unlink=True)
for a_ in list(bpy.data.actions):          # (the old GLB's own clips: never mixed with the new ones)
    bpy.data.actions.remove(a_)
for m in list(body.modifiers):
    body.modifiers.remove(m)
body.parent = None
body.vertex_groups.clear()
body.matrix_world = Matrix.Identity(4)
CO, TRI = L.mesh_arrays(body)
N = len(CO)
x, y, z = CO[:, 0], CO[:, 1], CO[:, 2]          # Blender: y = -forward (her back is +y), z up
print('mesh verts', N, 'tris', len(TRI))

# welded twin (the GLB splits vertices at UV seams): the weights are solved and smoothed on it
import scipy.spatial as sps
tree = sps.cKDTree(CO)
pairs = tree.query_pairs(1e-5, output_type='ndarray')
import scipy.sparse as sp, scipy.sparse.csgraph as cg
G = sp.coo_matrix((np.ones(len(pairs)), (pairs[:, 0], pairs[:, 1])), shape=(N, N))
ncomp, lab = cg.connected_components(G, directed=False)
U = np.zeros((ncomp, 3)); np.add.at(U, lab, CO); U /= np.bincount(lab)[:, None]
TU = lab[TRI]
TU = TU[(TU[:, 0] != TU[:, 1]) & (TU[:, 1] != TU[:, 2]) & (TU[:, 0] != TU[:, 2])]
NU = len(U)
A = L.adjacency(NU, TU)
print('welded verts', NU)
ux, uy, uz = U[:, 0], U[:, 1], U[:, 2]

# ------------------------------------------------------------------ joints (from the A6-centred joints, checked on the mesh)
def V(*a): return Vector(a)
J = {
    'Hips': V(0, 0, 0.90), 'Spine': V(0, 0.0, 1.00), 'Chest': V(0, 0.005, 1.095), 'UpperChest': V(0, 0.012, 1.225),
    'Neck': V(0, 0.020, 1.400), 'Head': V(0, 0.005, 1.490), 'HeadTop': V(0, 0.0, 1.66),
}
S = {  # her left side; the right mirrors x
    'Shoulder': V(0.030, 0.020, 1.330), 'UpperArm': V(0.165, 0.025, 1.300), 'LowerArm': V(0.301, -0.002, 1.068),
    'Hand': V(0.467, -0.050, 0.902),
    'UpperLeg': V(0.085, 0.0, 0.860), 'LowerLeg': V(0.075, -0.020, 0.470), 'Foot': V(0.070, -0.030, 0.085),
    'Toes': V(0.070, -0.130, 0.025), 'ToeTip': V(0.070, -0.235, 0.010),
}
if WARDEN:   # (his old A6-checked joints: gaunt, long arms, the robe to the knees, bare legs and feet below)
    J = {'Hips': V(0, 0.02, 0.90), 'Spine': V(0, 0.02, 0.98), 'Chest': V(0, 0.03, 1.08), 'UpperChest': V(0, 0.04, 1.22),
         'Neck': V(0, 0.045, 1.40), 'Head': V(0, 0.025, 1.50), 'HeadTop': V(0, 0.015, 1.64)}
    S = {'Shoulder': V(0.040, 0.050, 1.360), 'UpperArm': V(0.200, 0.060, 1.330), 'LowerArm': V(0.314, 0.062, 1.107),
         'Hand': V(0.405, 0.024, 0.903), 'UpperLeg': V(0.100, 0.030, 0.840), 'LowerLeg': V(0.160, 0.060, 0.465),
         'Foot': V(0.172, 0.070, 0.090), 'Toes': V(0.190, -0.040, 0.025), 'ToeTip': V(0.211, -0.166, 0.004)}
# the hand: its tip from the mesh (the farthest skin past the wrist along the forearm line)
fa = (S['Hand'] - S['LowerArm']).normalized()
w0 = np.array(S['Hand'])
rel = U - w0
along = rel @ np.array(fa)
perp = np.linalg.norm(rel - np.outer(along, fa), axis=1)
hand_v = (along > 0) & (perp < 0.075) & (ux > 0.3)
tipv = U[hand_v][np.argmax(along[hand_v])]
S['HandTip'] = Vector(tipv)
hl = (S['HandTip'] - S['Hand']).length
hd = (S['HandTip'] - S['Hand']).normalized()
S['Fingers1'] = S['Hand'] + hd * hl * 0.47
S['Fingers2'] = S['Hand'] + hd * hl * 0.75
print('hand length', round(hl, 3), 'tip', tuple(round(v, 3) for v in tipv))

def mir(v): return Vector((-v.x, v.y, v.z))
FWD = V(0, -1, 0)
bones = [
    ('Hips', None, J['Hips'], J['Spine'], FWD, False),
    ('Spine', 'Hips', J['Spine'], J['Chest'], FWD, True),
    ('Chest', 'Spine', J['Chest'], J['UpperChest'], FWD, True),
    ('UpperChest', 'Chest', J['UpperChest'], J['Neck'], FWD, True),
    ('Neck', 'UpperChest', J['Neck'], J['Head'], FWD, True),
    ('Head', 'Neck', J['Head'], J['HeadTop'], FWD, True),
]
for side, f in (('Left', lambda v: v), ('Right', mir)):
    bones += [
        (side + 'Shoulder', 'UpperChest', f(S['Shoulder']), f(S['UpperArm']), FWD, False),
        (side + 'UpperArm', side + 'Shoulder', f(S['UpperArm']), f(S['LowerArm']), FWD, True),
        (side + 'LowerArm', side + 'UpperArm', f(S['LowerArm']), f(S['Hand']), FWD, True),
        (side + 'ForeTwist', side + 'LowerArm', f(S['LowerArm'].lerp(S['Hand'], 0.5)), f(S['Hand']), FWD, False),
        (side + 'Hand', side + 'LowerArm', f(S['Hand']), f(S['Fingers1']), FWD, True),
        (side + 'Fingers1', side + 'Hand', f(S['Fingers1']), f(S['Fingers2']), FWD, True),
        (side + 'Fingers2', side + 'Fingers1', f(S['Fingers2']), f(S['HandTip']), FWD, True),
        (side + 'UpperLeg', 'Hips', f(S['UpperLeg']), f(S['LowerLeg']), FWD, False),
        (side + 'LowerLeg', side + 'UpperLeg', f(S['LowerLeg']), f(S['Foot']), FWD, True),
        (side + 'Foot', side + 'LowerLeg', f(S['Foot']), f(S['Toes']), V(0, 0, 1), True),
        (side + 'Toes', side + 'Foot', f(S['Toes']), f(S['ToeTip']), V(0, 0, 1), True),
    ]

# ------------------------------------------------------------------ the gown chains (8 around, 2 segments: hips > knee > hem)
AX_Y = float(np.mean(uy[(uz > 0.9) & (uz < 1.3) & (np.abs(ux) < 0.15)]))     # the body axis (y)
SK_ANG = [0, 45, 90, 135, 180, -135, -90, -45]          # degrees, 0 = front (-y), +90 = her left (+x)
SK_Z = [0.92, 0.62, 0.36] if WARDEN else [0.90, 0.48, 0.03]
def surf_r(phi, zz, band=0.03, cone=12.0):
    a = np.degrees(np.arctan2(ux, -(uy - AX_Y)))
    m = (np.abs(uz - zz) < band) & (np.abs((a - phi + 180) % 360 - 180) < cone) & (np.abs(ux) < 0.7)
    if not m.any():
        return None
    return float(np.hypot(ux[m], uy[m] - AX_Y).max())
SK = []
for k, phi in enumerate(SK_ANG):
    pts = []
    for zz in SK_Z:
        r = surf_r(phi, zz)
        r = (r if r else 0.15) - 0.02
        if zz == SK_Z[0]:
            r = min(r, 0.13)
        pa = math.radians(phi)
        pts.append(V(math.sin(pa) * r, AX_Y - math.cos(pa) * r, zz))
    SK.append(pts)
    bones += [('Skirt%d_1' % k, 'Hips', pts[0], pts[1], None, False), ('Skirt%d_2' % k, 'Hips', pts[1], pts[2], None, False)]   # (both under the hips: their scale never shears a child)
print('skirt chains', [[tuple(round(c, 2) for c in p) for p in c] for c in SK][:3], '...')

arm = L.build_armature('WardenArmature' if WARDEN else 'HeroineArmature', bones)
# skirt rolls: Z outward (bend axis X tangential)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='EDIT')
for k, phi in enumerate(SK_ANG):
    pa = math.radians(phi)
    out = V(math.sin(pa), -math.cos(pa), 0)
    for i in (1, 2):
        arm.data.edit_bones['Skirt%d_%d' % (k, i)].align_roll(out)
bpy.ops.object.mode_set(mode='OBJECT')
BN = [b.name for b in arm.data.bones]
BI = {n: i for i, n in enumerate(BN)}
RESTM = L.rest_mats(arm)

# ------------------------------------------------------------------ weights
# --- regions (welded verts)
def poly_near(P, poly):
    best = np.full(len(P), np.inf); par = np.zeros(len(P))
    for k in range(len(poly) - 1):
        a, b_ = np.array(poly[k]), np.array(poly[k + 1]); d = b_ - a
        t = np.clip(((P - a) @ d) / (d @ d), 0, 1)
        dist = np.linalg.norm(P - (a + t[:, None] * d), axis=1)
        m = dist < best; best[m] = dist[m]; par[m] = k + t[m]
    return par, best
arm_m = np.zeros(NU)
arm_side = {}
for sg in (1, -1):
    f = (lambda v: v) if sg > 0 else mir
    poly = [f(S['Shoulder']), f(S['UpperArm']), f(S['LowerArm']), f(S['Hand']), f(S['HandTip'])]
    par_, dist_ = poly_near(U, poly)
    side_ok = np.maximum(ss(0.135, 0.17, ux * sg), ss(1.3, 1.6, par_))
    am_ = (1 - ss(0.05, 0.08, dist_)) * side_ok * ss(0.6, 1.0, par_) * (ux * sg > 0)
    arm_side[sg] = (am_, par_)
    arm_m = np.maximum(arm_m, am_)
# feet: grown from the soles, near each ankle axis
foot_m = np.zeros(NU, bool)
def near_foot(i):
    sg = 1 if ux[i] > 0 else -1
    return math.hypot((ux[i] - sg * 0.07) / 0.06, (uy[i] + 0.07) / 0.14) < 1.0 and uz[i] < 0.14
seeds = [] if WARDEN else [i for i in np.where(uz < 0.06)[0] if near_foot(i)]
foot_m[seeds] = True
import collections
q = collections.deque(seeds)
nbr = A.tolil().rows
while q:
    a_ = q.popleft()
    for c_ in nbr[a_]:
        if not foot_m[c_] and near_foot(c_):
            foot_m[c_] = True; q.append(c_)
BODY_HEAT = [n for n in BN if not n.startswith('Skirt') and 'ForeTwist' not in n]
def heat_weights():
    """bone heat on the welded mesh, body bones only; 'allowed' stands in for the visibility test:
    a side's arm bones bind only that arm (hand/finger bones only past the wrist), the torso never binds the arms."""
    segs = [(np.array(RESTM[n].translation), np.array(arm.data.bones[n].tail_local)) for n in BODY_HEAT]
    allowed = np.ones((NU, len(BODY_HEAT)), bool)
    for j, n in enumerate(BODY_HEAT):
        for sd, sg in (('Left', 1), ('Right', -1)):
            if n.startswith(sd) and any(k in n for k in ('UpperArm', 'LowerArm', 'Hand', 'Fingers')):
                am_, par_ = arm_side[sg]
                ok = am_ > 0.05
                if 'Hand' in n or 'Fingers' in n:
                    ok &= par_ > 2.6
                if 'UpperArm' in n:
                    ok |= (ux * sg > 0.12) & (uz > 1.12) & (uz < 1.40)
                allowed[:, j] = ok
        if not any(k in n for k in ('UpperArm', 'LowerArm', 'Hand', 'Fingers')):
            allowed[:, j] = arm_m < 0.7
            if n.endswith('Shoulder'):
                allowed[:, j] &= (ux * (1 if n.startswith('Left') else -1) > 0.0)
    Wb = L.bone_heat(U, TU, segs, allowed)
    W = np.zeros((NU, len(BN)))
    for j, n in enumerate(BODY_HEAT):
        W[:, BI[n]] = Wb[:, j]
    return W
WH = heat_weights()
miss = np.where(WH.sum(1) < 1e-6)[0]
print('heat: verts without weights', len(miss))
if len(miss):                                            # (rare) unreached verts: grow from neighbours
    for _ in range(50):
        deg = np.asarray(A.sum(1)).ravel(); deg[deg == 0] = 1
        nb = (A @ WH) / deg[:, None]
        z0 = WH.sum(1) < 1e-6
        WH[z0] = nb[z0]
        if not (WH.sum(1) < 1e-6).any():
            break
WH = WH / np.maximum(WH.sum(1, keepdims=True), 1e-9)

print('foot verts', int(foot_m.sum()), 'arm verts', int((arm_m > 0.5).sum()))
foot_w = L.smooth_weights(foot_m.astype(float)[:, None], A, 2)[:, 0]

# the gown: below the waist, not the arms/hands, not the feet
gown_m = ss(1.0, 0.88, uz) * (1 - arm_m) * (1 - foot_w)
if WARDEN:
    # his robe ends at the knees: the bare legs (near each leg's line, under the robe's inside) keep their heat weights
    legd = np.minimum(L.seg_dist(U, np.array(S['UpperLeg']), np.array(S['LowerLeg'])), L.seg_dist(U, np.array(mir(S['UpperLeg'])), np.array(mir(S['LowerLeg']))))
    legd = np.minimum(legd, np.minimum(L.seg_dist(U, np.array(S['LowerLeg']), np.array(S['Foot'])), L.seg_dist(U, np.array(mir(S['LowerLeg'])), np.array(mir(S['Foot'])))))
    gown_m = gown_m * ss(0.055, 0.085, legd) * ss(0.24, 0.32, uz)
# the veil's back panel (behind the shoulder blades) and side flaps: follow the head/neck/chest by height
ax = np.abs(ux)
BACK_Y = AX_Y + 0.09
veil_back = ss(BACK_Y - 0.01, BACK_Y + 0.02, uy) * ss(0.9, 0.98, uz) * ss(1.48, 1.42, uz) * ss(0.26, 0.2, ax) * (1 - arm_m)
veil_side = ss(0.095, 0.125, ax) * ss(1.30, 1.34, uz) * ss(1.60, 1.50, uz) * (1 - arm_m) * (1 - veil_back) * ss(0.1, 0.06, uy - AX_Y)
veil_m = np.clip(veil_back + veil_side, 0, 1) * (1 - gown_m) * (0.0 if WARDEN else 1.0)

def ladder(zz, stops):
    """vertical blend over (z, bone) stops (descending z) -> (NU, NB)"""
    W = np.zeros((len(zz), len(BN)))
    zs = [s[0] for s in stops]
    for i in range(len(zz)):
        v = zz[i]
        if v >= zs[0]:
            W[i, BI[stops[0][1]]] = 1; continue
        if v <= zs[-1]:
            W[i, BI[stops[-1][1]]] = 1; continue
        for k in range(len(stops) - 1):
            if zs[k] >= v >= zs[k + 1]:
                t = (zs[k] - v) / (zs[k] - zs[k + 1]); t = t * t * (3 - 2 * t)
                W[i, BI[stops[k][1]]] += 1 - t; W[i, BI[stops[k + 1][1]]] += t
                break
    return W
W_veil = ladder(uz, [(1.47, 'Head'), (1.38, 'Neck'), (1.26, 'UpperChest'), (1.10, 'Chest'), (1.0, 'Spine')])

# gown: two nearest chains by angle x along-chain blend (hips > seg1 > seg2)
ang = np.degrees(np.arctan2(ux, -(uy - AX_Y)))
W_gown = np.zeros((NU, len(BN)))
step = 45.0
a0 = np.floor((ang - SK_ANG[0]) / step).astype(int)
for i in range(NU):
    k0 = a0[i] % 8
    t = ((ang[i] - SK_ANG[0]) / step) - np.floor((ang[i] - SK_ANG[0]) / step)
    # SK_ANG goes 0,45,90,135,180,-135,-90,-45 = k*45 (mod 360)
    for k, wk in ((k0, 1 - t), ((k0 + 1) % 8, t)):
        zz = uz[i]
        top = ss(0.97, 0.80, zz)                 # hips -> chain
        mid = ss(0.62, 0.36, zz)                 # seg1 -> seg2 around the knee
        W_gown[i, BI['Hips']] += wk * (1 - top)
        W_gown[i, BI['Skirt%d_1' % k]] += wk * top * (1 - mid)
        W_gown[i, BI['Skirt%d_2' % k]] += wk * top * mid
W_foot = np.zeros((NU, len(BN)))
for i in np.where(foot_w > 0)[0]:
    sd = 'Left' if ux[i] > 0 else 'Right'
    tt = ss(-0.03, -0.12, uy[i])
    W_foot[i, BI[sd + 'Foot']] = 1 - tt; W_foot[i, BI[sd + 'Toes']] = tt

body_m = np.clip(1 - gown_m - veil_m - foot_w, 0, 1)
W = WH * body_m[:, None] + W_gown * gown_m[:, None] + W_veil * veil_m[:, None] + W_foot * foot_w[:, None]
# no leg bone above the hem in the gown band (the legs are inside the gown; the gown rides the chains)
for sd in ('Left', 'Right'):
    for b in ('UpperLeg', 'LowerLeg'):
        if not WARDEN:
            W[:, BI[sd + b]] *= foot_w
# forearm twist: the distal half of the forearm takes the twist bone (the hand's roll split along the forearm)
for sd, sg in (('Left', 1), ('Right', -1)):
    f = (lambda v: v) if sg > 0 else mir
    a_, b_ = np.array(f(S['LowerArm'])), np.array(f(S['Hand']))
    d = b_ - a_; t = np.clip(((U - a_) @ d) / (d @ d), 0, 1.2)
    k = ss(0.25, 0.85, t)
    lo = W[:, BI[sd + 'LowerArm']].copy()
    W[:, BI[sd + 'LowerArm']] = lo * (1 - k); W[:, BI[sd + 'ForeTwist']] += lo * k
W = W / np.maximum(W.sum(1, keepdims=True), 1e-9)
# smoothing: everywhere a little, the region seams and the joints more
W = L.smooth_weights(W, A, 6, 0.5)
W = L.limit_normalize(W, 4, 0.02)
W = L.smooth_weights(W, A, 2, 0.5)
W = L.limit_normalize(W, 4, 0.02)
# back to the split vertices
WS = W[lab]
CLOTH = (W_gown * gown_m[:, None])[lab][:, [BI[n] for n in BN if n.startswith('Skirt')]].sum(1)
L.set_weights(body, BN, WS)
body.parent = arm
mod = body.modifiers.new('Armature', 'ARMATURE'); mod.object = arm
print('weights done; max influences', int((WS > 0).sum(1).max()))

# ------------------------------------------------------------------ the gown solver (baked into every frame)
SK_REST = [[p.copy() for p in c] for c in SK]
KNEE_R, SHIN_R = 0.075, 0.06            # the leg's half-thickness at the knee / the shin (the gown's inner margin)
SK_LEN = [[(c[1] - c[0]).length, (c[2] - c[1]).length] for c in SK]
def skirt_pose(T):
    """T: armature-space pose matrices (body done). Adds Skirt<k>_<i>."""
    H = T['Hips']; H0 = RESTM['Hips']
    Hrel = H @ H0.inverted()
    # the gown hangs: its chains take the hips' turn (yaw) whole but only part of their pitch / roll
    qh = Hrel.to_quaternion()
    tw_ = Quaternion((qh.w, 0, 0, qh.z)).normalized() if abs(qh.w) + abs(qh.z) > 1e-6 else Quaternion()
    sw_ = qh @ tw_.inverted()
    Rs = (Quaternion().slerp(sw_, 0.3) @ tw_).to_matrix()
    hp0 = H0.translation; hp = H.translation
    legs = {}
    for sd in ('Left', 'Right'):
        kn_r = RESTM[sd + 'LowerLeg'].translation; an_r = RESTM[sd + 'Foot'].translation
        legs[sd] = (hp + Rs @ (kn_r - hp0), T[sd + 'LowerLeg'].translation, hp + Rs @ (an_r - hp0), T[sd + 'Foot'].translation)
    for k, phi in enumerate(SK_ANG):
        pa = math.radians(phi)
        n = (Rs @ V(math.sin(pa), -math.cos(pa), 0)).normalized()
        p0 = Hrel @ SK_REST[k][0]
        p1 = p0 + Rs @ (SK_REST[k][1] - SK_REST[k][0])
        p2 = p1 + Rs @ (SK_REST[k][2] - SK_REST[k][1])
        push1 = V(0, 0, 0); push2 = V(0, 0, 0)
        for sd, sg in (('Left', 1), ('Right', -1)):
            near = ss(-0.75, 0.2, sg * math.sin(pa))       # the left leg pushes the front/left/back, not the right side
            kr, kp, ar, apos = legs[sd]
            dk = kp - kr; da = apos - ar
            # a knee / shin only pushes the gown where it would come through it: past the gown's own surface at this
            # azimuth (less a body margin); it drags it a little sideways
            o1 = min(max(0.0, (kp - p1).dot(n) + KNEE_R), 0.22) * near
            o2 = min(max(0.0, (apos - p2).dot(n) + SHIN_R), 0.15) * near
            push1 += n * o1 + (dk - n * dk.dot(n)) * 0.15 * near
            push2 += n * o2 + (da - n * da.dot(n)) * 0.10 * near
        p1n = p1 + push1
        d1 = (p1n - p0).normalized()
        # (a knee drawn up to the chest - a climb - lifts the gown, never flips it up into a sheet: 65 deg at most)
        d1r = (p1 - p0).normalized()
        if d1r.angle(d1, 0.0) > math.radians(65):
            ax_ = d1r.cross(d1)
            if ax_.length > 1e-6:
                d1 = Quaternion(ax_.normalized(), math.radians(65)) @ d1r
        p1n = p0 + d1 * SK_LEN[k][0]
        # the lower segment: carried by the knee push, pushed by the shin/foot, hangs toward the floor
        p2n = p2 + push1 + push2
        d2 = (p2n - p1n)
        down = V(0, 0, -1)
        d2 = d2.normalized().lerp(down, 0.15).normalized()
        p2n = p1n + d2 * SK_LEN[k][1]
        # the floor: the gown lies on it, spreading outward (each segment may shorten by a quarter as it piles up),
        # never under it and never folded back through itself
        FL = 0.012
        L1, L2 = SK_LEN[k]
        def onto_floor(a_, b_, Ls, lift):
            if b_.z >= FL + lift:
                return b_
            h_ = max(a_.z - (FL + lift), 0.0)
            hz = V(b_.x - a_.x, b_.y - a_.y, 0)
            if hz.length < 1e-4 or hz.normalized().dot(V(n.x, n.y, 0).normalized()) < 0.2:
                hz = hz + V(n.x, n.y, 0) * 0.5
            hz = hz.normalized() if hz.length > 1e-4 else V(n.x, n.y, 0).normalized()
            # the segment keeps its own flare (horizontal reach) and only drops onto the floor, shortening; when the
            # body sinks further the length allowed (3/4) spreads it outward on the floor
            off0 = V(b_.x - a_.x, b_.y - a_.y, 0).length
            Lt = max(h_, 0.75 * Ls)
            off = max(off0, math.sqrt(max(Lt * Lt - h_ * h_, 0.0)))
            return a_ + hz * off + V(0, 0, -h_)
        p1n = onto_floor(p0, p1n, L1, 0.03)
        p2n = p1n + (p2n - p1n).normalized() * L2
        p2n = onto_floor(p1n, p2n, L2, 0.0)
        for i, (a_, b_) in enumerate(((p0, p1n), (p1n, p2n)), 1):
            nm = 'Skirt%d_%d' % (k, i)
            R0 = RESTM[nm].to_3x3()
            dr = (Rs @ (R0 @ V(0, 1, 0))).normalized()
            R = (dr.rotation_difference((b_ - a_).normalized()).to_matrix() @ Rs @ R0).normalized()
            sy = (b_ - a_).length / SK_LEN[k][i - 1]
            M = (R @ Matrix.Diagonal((1.0, sy, 1.0))).to_4x4(); M.translation = a_
            T[nm] = M
    return T

def twist_pose(T):
    """ForeTwist: the forearm's frame turned by half the hand's twist about the forearm axis."""
    for sd in ('Left', 'Right'):
        F = T[sd + 'LowerArm'].to_3x3(); Hn = T[sd + 'Hand'].to_3x3()
        F0 = RESTM[sd + 'LowerArm'].to_3x3(); H0 = RESTM[sd + 'Hand'].to_3x3()
        rel = (F @ (F0.inverted() @ H0)).inverted() @ Hn          # the hand's rotation relative to rigid-with-forearm
        qr = rel.to_quaternion()
        # twist about local Y (the hand bone's axis ~ the forearm's)
        tw = Quaternion((qr.w, 0, qr.y, 0)).normalized() if abs(qr.w) + abs(qr.y) > 1e-6 else Quaternion()
        half = Quaternion().slerp(tw, 0.5)
        R0 = RESTM[sd + 'ForeTwist'].to_3x3()
        Rr = F @ (F0.inverted() @ R0)                             # rigid with the forearm
        R = Rr @ half.to_matrix()
        M = R.to_4x4()
        M.translation = T[sd + 'LowerArm'] @ (RESTM[sd + 'LowerArm'].inverted() @ RESTM[sd + 'ForeTwist'].translation)
        T[sd + 'ForeTwist'] = M
    return T

def finish(T):
    twist_pose(T)
    skirt_pose(T)
    return T

# ------------------------------------------------------------------ export of the rest for checks
STATE = dict(arm=arm, body=body, BN=BN, RESTM=RESTM, finish=finish, CLOTH=CLOTH, AX_Y=AX_Y, S=S, J=J)
if __name__ == '__main__' and os.environ.get('HR_STAGE', '') == 'rig':
    if args.blend:
        bpy.ops.wm.save_as_mainfile(filepath=args.blend)
    print('RIG OK')

# ------------------------------------------------------------------ sources
def load_sources():
    src = {}
    for key, path in (('ual1', args.ual1), ('ual2', args.ual2)):
        objs_ = L.import_glb(path)
        a_ = [o for o in objs_ if o.type == 'ARMATURE'][0]
        for o in objs_:
            if o is not a_:
                bpy.data.objects.remove(o, do_unlink=True)
        a_.name = 'SRC_' + key
        src[key] = a_
    return src

HIP_SCALE = (0.84 if WARDEN else 0.86) / 0.932             # her hip joint height / the UAL mannequin's

def retargeter(src_arm):
    mp = {k: v for k, v in L.UAL_MAP.items()}
    fing = {}
    for sd, s in (('Left', 'l'), ('Right', 'r')):
        fing[sd + 'Fingers1'] = (['%s_%s' % (f, s) for f in L.FINGER_SRC['1']], None)
        fing[sd + 'Fingers2'] = (['%s_%s' % (f, s) for f in L.FINGER_SRC['2']], None)
    return L.Retarget(src_arm, arm, mp, HIP_SCALE, fing)

def sample_clip(rt, src_arm, act_name, t0=None, t1=None, length=None, src_fps=24.0, warp=None):
    """retarget [t0, t1] (source seconds) of a source action into a list of target armature-space poses at FPS.
    warp: optional list of (out_t, src_t) pairs (piecewise-linear time map, smoothstepped)."""
    a_ = bpy.data.actions[act_name]
    src_arm.animation_data.action = a_
    f0, f1 = a_.frame_range
    s0 = f0 / src_fps if t0 is None else t0
    s1 = f1 / src_fps if t1 is None else t1
    if length is None:
        length = s1 - s0
    n = int(round(length * FPS)) + 1
    poses = []
    for i in range(n):
        t = i / FPS
        if warp:
            st = np.interp(t, [w[0] for w in warp], [w[1] for w in warp])
        else:
            st = s0 + (s1 - s0) * (t / max(length, 1e-6))
        poses.append(rt.target_pose(rt.sample_src(st * src_fps)))
    return poses

def bake(name, poses):
    fb = [L.to_basis(arm, finish(T)) for T in poses]
    return L.write_action(arm, name, fb, FPS)

# ------------------------------------------------------------------ build every clip, export, write the clip table
def g(v):
    """Blender point -> her Godot model space (glTF: x, z, -y)"""
    return (round(v[0], 4), round(v[2], 4), round(-v[1], 4))

def build_all():
    import time
    import bl_pose as P
    HC = __import__('warden_bl_clips' if WARDEN else 'heroine_bl_clips')
    t_start = time.time()
    bpy.context.scene.collection.objects.unlink(body)
    src = load_sources()
    rts = {k: retargeter(a_) for k, a_ in src.items()}
    def sample(key, act, t):
        a_ = bpy.data.actions[act]
        if src[key].animation_data.action != a_:
            src[key].animation_data.action = a_
        return rts[key].target_pose(rts[key].sample_src(a_.frame_range[0] + t * 24.0))
    def dur(key, act):
        a_ = bpy.data.actions[act]
        return (a_.frame_range[1] - a_.frame_range[0]) / 24.0
    sk = P.Sk(arm)
    lib = HC.Lib(dict(sk=sk, sample=sample, dur=dur))
    clips = lib.build()
    want = [c for c in args.clips.split(',') if c] or list(clips)
    meta_out = {}
    for name in want:
        fn, meta = clips[name]
        n = int(round(meta['len'] * FPS)) + 1
        poses = [fn(min(i / FPS, meta['len'])) for i in range(n)]
        st_ = {}
        poses = [P.anatomy(sk, T, st_) for T in poses]
        fb = [L.to_basis(arm, finish(T)) for T in poses]
        L.write_action(arm, name, fb, FPS)
        m = dict(meta)
        m['frames'] = n
        # the authored hand positions at each IK window's full point (her model space): the runtime's default "@"
        for ik in m.get('ik', []):
            sd = 'Right' if ik['side'] == 'R' else 'Left'
            k = min(int(round(ik['t'][1] * FPS)), n - 1)
            ik['hand'] = g(poses[k][sd + 'Hand'].translation)
        if name in HC.AT:
            m['at'] = g(HC.AT[name])
        if name in HC.NRM:
            m['n'] = g(HC.NRM[name])
        if name == 'walk':
            zs = {sd: [p_[sd + 'Foot'].translation.z for p_ in poses] for sd in ('Left', 'Right')}
            ys = {sd: [p_[sd + 'Foot'].translation.y for p_ in poses] for sd in ('Left', 'Right')}
            ev = {}
            sp = []
            for sd in ('Left', 'Right'):
                y_ = np.array(ys[sd]); z_ = np.array(zs[sd])
                kf = int(np.argmin(y_))                       # the foot farthest forward (-y): the heel strike
                ev['step_' + sd[0].lower()] = round(kf / FPS, 3)
                st = z_ < z_.min() + 0.012                    # stance frames: the foot sweeps back at the walk speed
                v = np.diff(y_) * FPS
                sp += list(v[st[:-1] & (v > 0)])
            m['ev'] = ev
            m['speed'] = round(float(np.median(sp)), 4) if sp else 1.0
            print('walk: steps', ev, 'native speed (model m/s)', m['speed'])
        meta_out[name] = m
        print('clip', name, n, 'frames')
    bpy.context.scene.collection.objects.link(body)
    for a_ in src.values():
        bpy.data.objects.remove(a_, do_unlink=True)
    for a_ in list(bpy.data.actions):
        if a_.name not in meta_out:
            bpy.data.actions.remove(a_)
    print('build s', round(time.time() - t_start, 1))
    return meta_out

def export(meta_out):
    # rest pose for the export, every action in the GLB; no images (the game loads her JPEG maps itself)
    arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
    bpy.ops.object.select_all(action='DESELECT')
    arm.select_set(True); body.select_set(True)
    bpy.context.view_layer.objects.active = arm
    if 'Color' in body.data.color_attributes:
        body.data.color_attributes.active_color = body.data.color_attributes['Color']
    bpy.ops.export_scene.gltf(filepath=args.out, export_format='GLB', use_selection=True, export_image_format='NONE',
                              export_vertex_color='ACTIVE', export_animations=True, export_animation_mode='ACTIONS',
                              export_force_sampling=True, export_optimize_animation_size=False, export_def_bones=False,
                              export_skins=True, export_influence_nb=4, export_morph=False, export_yup=True,
                              export_anim_slide_to_zero=True, export_reset_pose_bones=True)
    print('exported', args.out, os.path.getsize(args.out) // 1024, 'KB')

def write_gd(meta_out, path):
    """scripts/fx/heroine_clip_data.gd: the clip table (generated)"""
    def gd(v):
        if isinstance(v, bool):
            return 'true' if v else 'false'
        if isinstance(v, (int, float, np.floating)):
            return repr(round(float(v), 4))
        if isinstance(v, str):
            return '"%s"' % v
        if isinstance(v, tuple) and len(v) == 3:
            return 'Vector3(%s, %s, %s)' % tuple(gd(x) for x in v)
        if isinstance(v, (list, tuple)):
            return '[' + ', '.join(gd(x) for x in v) + ']'
        if isinstance(v, dict):
            return '{' + ', '.join('"%s": %s' % (k, gd(x)) for k, x in v.items()) + '}'
        raise TypeError(type(v))
    lines = ['class_name ' + ('WardenClipData' if WARDEN else 'HeroineClipData'), 'extends RefCounted',
             '## GENERATED by dev_rig/tools/heroine_bl_rig.py (a7): her clips in assets/models/heroine_v2.glb. Do not edit by hand.',
             '## per clip: len (s), frames, loop, hold_t (-1: none), blend [in, out], ev {name: t}, idle (an idle variant), layer',
             '## ("arm_r": an upper-body hold), ik [{side, t: [in0, in1, out0, out1], hand (authored wrist at in1, model space),',
             '## off}] (the runtime moves the hand by "@" - at), at (the authored default "@", model space), n (its normal).',
             'const CLIPS := {']
    for name, m in meta_out.items():
        d = {k: m[k] for k in ('len', 'frames') if k in m}
        d['loop'] = bool(m.get('loop', False))
        d['hold_t'] = float(m.get('hold_t', -1.0))
        d['blend'] = list(m.get('blend', [0.2, 0.3]))
        d['ev'] = m.get('ev', {})
        d['idle'] = bool(m.get('idle', False))
        d['layer'] = m.get('layer', '')
        if 'ik' in m:
            d['ik'] = [{k: (tuple(v) if k == 'off' else v) for k, v in ik.items() if k != 'off_free'} for ik in m['ik']]
        for k in ('at', 'n', 'speed'):
            if k in m:
                d[k] = m[k]
        lines.append('\t"%s": %s,' % (name, gd(d)))
    lines.append('}')
    open(path, 'w').write('\n'.join(lines) + '\n')
    print('wrote', path)

if __name__ == '__main__' and os.environ.get('HR_STAGE', '') != 'rig':
    meta_out = build_all()
    if args.blend:
        bpy.ops.wm.save_as_mainfile(filepath=args.blend)
    if not args.noexport:
        export(meta_out)
        write_gd(meta_out, os.path.join(ROOT, 'scripts/fx/warden_clip_data.gd' if WARDEN else 'scripts/fx/heroine_clip_data.gd'))
