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
ap.add_argument('--src', default=os.path.join(ROOT, 'assets/models/warden_rigged.glb' if WARDEN else 'assets/models/heroine_v3_src.glb'))
ap.add_argument('--ual1', default=os.path.join(ROOT, 'dev_rig/ual/UAL1_Standard.glb'))
ap.add_argument('--ual2', default=os.path.join(ROOT, 'dev_rig/ual/UAL2_Standard.glb'))
ap.add_argument('--out', default=os.path.join(ROOT, 'assets/models/warden_v2.glb' if WARDEN else 'assets/models/heroine_v2.glb'))
ap.add_argument('--clips', default='')
ap.add_argument('--blend', default='')
ap.add_argument('--noexport', action='store_true')
args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:])
# (a10) V3: the Tripo heroine f157f78f (dev_rig/a10/prep_v3_src.py): her head and face under a veil to the shoulders
# (a panel down the back to the belt), a belted grey dress to the ankles (hem 0.12-0.15 m), bare arms clear of the body
# (generated ~6 deg below horizontal, turned down to ~44 deg in the prep), bare feet. The a9 source (heroine_v1_rigged.glb) still builds with --src.
# LEGS: a source whose legs run whole up to the hips under a separate skirt shell (the a10 try 685c8a46) - the legs are
# drawn, keep their heat weights, knee helpers, the skirt collides with thigh and knee. The f157f78f dress is one
# surface with the legs below its hem (as a9's): LEGS is off, the feet are cut free and the legs never drawn.
V3 = (not WARDEN) and 'v3' in os.path.basename(args.src)
LEGS = False

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
import scipy.spatial as sps
import scipy.sparse as sp, scipy.sparse.csgraph as cg
def split_feet():
    """(a9) her bare feet are cut free of the gown's hem (they were one surface, and the a7 foot region took in the hem's
    front: every step stretched a sheet of hem between foot and gown, the 'webbing'). The feet = her skin mask below 17 cm;
    the edges between foot faces and gown faces are split; returns each vertex's side (1 = foot) so the weld keeps the
    two apart."""
    import bmesh
    co0, tri0 = L.mesh_arrays(body)
    pr = sps.cKDTree(co0).query_pairs(1e-5, output_type='ndarray')
    nc, lb = cg.connected_components(sp.coo_matrix((np.ones(len(pr)), (pr[:, 0], pr[:, 1])), shape=(len(co0),) * 2), directed=False)
    u0 = np.zeros((nc, 3)); np.add.at(u0, lb, co0); u0 /= np.bincount(lb)[:, None]
    # the feet are her porcelain skin (COLOR_0.r, a 0/1 mask) below the hem's top
    ca = body.data.color_attributes['Color']
    if ca.domain == 'POINT':
        cv = np.empty(len(ca.data) * 4); ca.data.foreach_get('color', cv); skin_v = cv.reshape(-1, 4)[:, 0]
    else:
        cl = np.empty(len(ca.data) * 4); ca.data.foreach_get('color', cl)
        lv = np.empty(len(body.data.loops), np.int64); body.data.loops.foreach_get('vertex_index', lv)
        skin_v = np.zeros(len(co0)); np.maximum.at(skin_v, lv, cl.reshape(-1, 4)[:, 0])
    sk_u = np.zeros(nc); np.maximum.at(sk_u, lb, skin_v)
    FZ = 0.22 if V3 else 0.17          # (a10: her ankles and feet show below the hem; the stubs inside it go too)
    fm = (sk_u > 0.5) & (u0[:, 2] < FZ)
    me = body.data
    me.calc_loop_triangles()
    pi = np.empty(len(me.loop_triangles), np.int64); me.loop_triangles.foreach_get('polygon_index', pi)
    tf = fm[lb[tri0]].all(1)
    # (the bits of foot that are not skin - straps, the sole's rim - would be left as shards on the gown: every piece of
    # the gown that is not joined to the gown's main body goes with the feet)
    for _ in range(2):
        tg_ = lb[tri0][~tf]
        ncg, lg = cg.connected_components(L.adjacency(nc, tg_), directed=False)
        used = np.zeros(nc, bool); used[tg_.ravel()] = True
        sz = np.bincount(lg[used], minlength=ncg)
        main = int(np.argmax(sz))
        nearf = (np.hypot((np.abs(u0[:, 0]) - 0.085) / 0.07, u0[:, 1] / 0.16) < 1.0) if V3 else (np.hypot((np.abs(u0[:, 0]) - 0.07) / 0.07, (u0[:, 1] + 0.07) / 0.16) < 1.0)
        far_c = np.zeros(ncg, bool); far_c[lg[used & ~nearf]] = True       # (an island reaching beyond a foot stays gown)
        isl = used & (lg != main) & ~far_c[lg] & (u0[:, 2] < (0.26 if V3 else 0.25))
        tf = tf | isl[lb[tri0]].any(1)
    # (and the loose scraps of the old hem cap under the gown - flat on the floor, between the feet - are dropped: with the
    # feet free they showed as a dark sheet whenever a step opened the hem)
    tg_ = lb[tri0][~tf]
    ncg, lg = cg.connected_components(L.adjacency(nc, tg_), directed=False)
    used = np.zeros(nc, bool); used[tg_.ravel()] = True
    sz = np.bincount(lg[used], minlength=ncg); main = int(np.argmax(sz))
    hi_c = np.zeros(ncg, bool); hi_c[lg[used & (u0[:, 2] > 0.10)]] = True
    scrap = used & (lg != main) & ~hi_c[lg]
    td = (~tf) & scrap[lb[tri0]].all(1)
    pdel = np.zeros(len(me.polygons), bool); np.logical_or.at(pdel, pi, td)
    pf = np.ones(len(me.polygons), bool)
    np.logical_and.at(pf, pi, tf)
    bm = bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table()
    ff = [f for f in bm.faces if pf[f.index]]
    dl = [f for f in bm.faces if pdel[f.index] and not pf[f.index]]
    for f in bm.faces:
        f.tag = bool(pf[f.index])
    cut = [e for e in bm.edges if any(f.tag for f in e.link_faces) and not all(f.tag for f in e.link_faces)]
    bmesh.ops.split(bm, geom=ff, use_only_faces=True)        # (verts too: no bow-tie corner keeps them joined)
    bmesh.ops.delete(bm, geom=dl, context='FACES')
    print('hem scraps dropped: faces', len(dl))
    bm.verts.ensure_lookup_table(); bm.faces.ensure_lookup_table()
    bm.verts.index_update(); bm.faces.index_update()
    side = np.zeros(len(bm.verts), np.int8)
    for f in bm.faces:
        if f.tag:
            for v in f.verts:
                side[v.index] = 1
    for f in bm.faces:
        if not f.tag:
            for v in f.verts:
                assert side[v.index] == 0, 'a foot vertex still on the gown'
    bm.to_mesh(me); bm.free(); me.update()
    # the gown's side of the cut is gown, not skin (its rim verts carried the foot's skin colour)
    ca = me.color_attributes['Color']
    co1 = np.empty(len(me.vertices) * 3); me.vertices.foreach_get('co', co1); co1 = co1.reshape(-1, 3)
    gown_low = (side == 0) & (co1[:, 2] < FZ)
    if ca.domain == 'POINT':
        cv = np.empty(len(ca.data) * 4); ca.data.foreach_get('color', cv); cv = cv.reshape(-1, 4)
        cv[gown_low, 0] = 0.0; ca.data.foreach_set('color', cv.ravel())
    else:
        cl = np.empty(len(ca.data) * 4); ca.data.foreach_get('color', cl); cl = cl.reshape(-1, 4)
        lv = np.empty(len(me.loops), np.int64); me.loops.foreach_get('vertex_index', lv)
        cl[gown_low[lv], 0] = 0.0; ca.data.foreach_set('color', cl.ravel())
    print('feet cut free: foot faces', int(pf.sum()), 'edges split', len(cut))
    return side
FOOT_SIDE = None if (WARDEN or LEGS) else split_feet()
CO, TRI = L.mesh_arrays(body)
N = len(CO)
x, y, z = CO[:, 0], CO[:, 1], CO[:, 2]          # Blender: y = -forward (her back is +y), z up
print('mesh verts', N, 'tris', len(TRI))

# welded twin (the GLB splits vertices at UV seams): the weights are solved and smoothed on it
tree = sps.cKDTree(CO if FOOT_SIDE is None else CO + np.outer(FOOT_SIDE, (100.0, 0, 0)))   # (a9: never welds a foot to the hem)
pairs = tree.query_pairs(1e-5, output_type='ndarray')
G = sp.coo_matrix((np.ones(len(pairs)), (pairs[:, 0], pairs[:, 1])), shape=(N, N))
ncomp, lab = cg.connected_components(G, directed=False)
U = np.zeros((ncomp, 3)); np.add.at(U, lab, CO); U /= np.bincount(lab)[:, None]
TU = lab[TRI]
TU = TU[(TU[:, 0] != TU[:, 1]) & (TU[:, 1] != TU[:, 2]) & (TU[:, 0] != TU[:, 2])]
NU = len(U)
A = L.adjacency(NU, TU)
print('welded verts', NU)
ux, uy, uz = U[:, 0], U[:, 1], U[:, 2]
SKIN_U = np.zeros(NU)        # (a10) her bare skin (COLOR_0.r) per welded vertex
if 'Color' in body.data.color_attributes:
    _ca = body.data.color_attributes['Color']
    if _ca.domain == 'POINT':
        _cv = np.empty(len(_ca.data) * 4); _ca.data.foreach_get('color', _cv); np.maximum.at(SKIN_U, lab, _cv.reshape(-1, 4)[:, 0])

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
if V3:       # (a10: fitted on her mesh, dev_rig/a10: front / side / arm plots)
    J = {'Hips': V(0, 0.0, 0.92), 'Spine': V(0, -0.01, 1.02), 'Chest': V(0, -0.02, 1.12), 'UpperChest': V(0, -0.01, 1.25),
         'Neck': V(0, 0.0, 1.42), 'Head': V(0, 0.0, 1.49), 'HeadTop': V(0, 0.0, 1.66)}
    # (her arms turned down 38 deg about the shoulder in prep_v3_src.py: the elbow and wrist turned with them)
    S = {'Shoulder': V(0.030, 0.020, 1.345), 'UpperArm': V(0.170, 0.050, 1.320), 'LowerArm': V(0.380, 0.074, 1.126),
         'Hand': V(0.573, 0.028, 0.941), 'UpperLeg': V(0.080, 0.0, 0.860), 'LowerLeg': V(0.080, 0.010, 0.470),
         'Foot': V(0.080, 0.015, 0.085), 'Toes': V(0.090, -0.100, 0.025), 'ToeTip': V(0.095, -0.175, 0.010)}
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
        (side + 'ForeTwist', side + 'LowerArm', f(S['LowerArm'].lerp(S['Hand'], 0.5 if WARDEN else 1 / 3)), f(S['Hand']), FWD, False),
        (side + 'Hand', side + 'LowerArm', f(S['Hand']), f(S['Fingers1']), FWD, True),
        (side + 'Fingers1', side + 'Hand', f(S['Fingers1']), f(S['Fingers2']), FWD, True),
        (side + 'Fingers2', side + 'Fingers1', f(S['Fingers2']), f(S['HandTip']), FWD, True),
        (side + 'UpperLeg', 'Hips', f(S['UpperLeg']), f(S['LowerLeg']), FWD, False),
        (side + 'LowerLeg', side + 'UpperLeg', f(S['LowerLeg']), f(S['Foot']), FWD, True),
        (side + 'Foot', side + 'LowerLeg', f(S['Foot']), f(S['Toes']), V(0, 0, 1), True),
        (side + 'Toes', side + 'Foot', f(S['Toes']), f(S['ToeTip']), V(0, 0, 1), True),
    ]
# (a9) her arm's deformation helpers (driven, never animated by hand; scripts/heroine_rig.gd _helpers() is the runtime
# twin of helper_pose() below): the upper arm's twist split (UpperArmTwist: the shoulder end keeps half the twist), the
# deltoid at half the shoulder's swing, the elbow at half the elbow's bend, the forearm's roll in thirds (ForeTwist,
# ForeTwist2). Each has its driver bone's rest orientation (same direction, same roll).
HELPERS = []
KNEE_K, KNEE_RW = 0.7, 0.07     # (a10) the knee helper's share at the joint / its half-width along the leg (m)
ELB_K, ELB_W = 0.7, 0.35          # the elbow helper's share at the joint / its half-width (par)
DLT_K, DLT_W = 0.8, 0.5          # the deltoid's
if not WARDEN:
    for side, f in (('Left', lambda v: v), ('Right', mir)):
        sh_, el_, wr_ = f(S['UpperArm']), f(S['LowerArm']), f(S['Hand'])
        HELPERS += [
            (side + 'UpperArmTwist', side + 'UpperArm', sh_, sh_.lerp(el_, 0.5), FWD, False),
            (side + 'Deltoid', side + 'Shoulder', sh_, sh_.lerp(el_, 0.35), FWD, False),
            (side + 'ElbowHelper', side + 'UpperArm', el_, el_.lerp(wr_, 0.3), FWD, False),
            (side + 'ForeTwist2', side + 'LowerArm', el_.lerp(wr_, 2 / 3), wr_, FWD, False),
        ]
        if LEGS:    # (a10) her knees show: the knee ring at half the knee's bend (the elbow helper's twin)
            kn_, an_ = f(S['LowerLeg']), f(S['Foot'])
            HELPERS += [(side + 'KneeHelper', side + 'UpperLeg', kn_, kn_.lerp(an_, 0.3), FWD, False)]
    bones += HELPERS

# ------------------------------------------------------------------ the gown chains (8 around, 2 segments: hips > knee > hem)
AX_Y = float(np.mean(uy[(uz > 0.9) & (uz < 1.3) & (np.abs(ux) < 0.15)]))     # the body axis (y)
SK_ANG = [0, 45, 90, 135, 180, -135, -90, -45]          # degrees, 0 = front (-y), +90 = her left (+x)
SK_Z = [0.92, 0.62, 0.36] if WARDEN else (([0.90, 0.66, 0.44] if LEGS else [0.90, 0.50, 0.17]) if V3 else [0.90, 0.48, 0.03])
HEM_FLOOR = 0.012 if V3 else SK_Z[2]      # (a10) the lowest a hem handle may go (a9: its own rest height, on the floor)
def surf_r(phi, zz, band=0.03, cone=12.0):
    a = np.degrees(np.arctan2(ux, -(uy - AX_Y)))
    m = (np.abs(uz - zz) < band) & (np.abs((a - phi + 180) % 360 - 180) < cone) & (np.abs(ux) < 0.7)
    if not m.any():
        return None
    return float(np.hypot(ux[m], uy[m] - AX_Y).max())
if V3:
    def surf_r(phi, zz, band=None, cone=None):
        """(a10) her skirt's big triangles leave few vertices on a ray: the farthest crossing of the mesh's slice at zz
        by the horizontal ray from the body axis at azimuth phi"""
        P = U[TU]
        zt = P[:, :, 2]
        m = (zt.min(1) < zz) & (zt.max(1) > zz)
        pts = []
        for t_ in P[m]:
            q = []
            for i in range(3):
                a_, b_ = t_[i], t_[(i + 1) % 3]
                if (a_[2] - zz) * (b_[2] - zz) < 0:
                    q.append(a_ + (b_ - a_) * (zz - a_[2]) / (b_[2] - a_[2]))
            if len(q) == 2:
                pts.append((q[0][:2], q[1][:2]))
        # (its godet folds: the mean over rays within +-20 deg of the farthest crossing on each)
        o = np.array([0.0, AX_Y]); rs = []
        for dphi in range(-20, 21, 5):
            pa = math.radians(phi + dphi)
            d = np.array([math.sin(pa), -math.cos(pa)])
            best = None
            for a_, b_ in pts:
                e = b_ - a_
                den = d[0] * (-e[1]) - d[1] * (-e[0])
                if abs(den) < 1e-12:
                    continue
                w = a_ - o
                tt = (w[0] * (-e[1]) - w[1] * (-e[0])) / den
                uu = (d[0] * w[1] - d[1] * w[0]) / den
                if tt > 0 and 0 <= uu <= 1 and tt < 0.45 and (best is None or tt > best):
                    best = tt
            if best is not None:
                rs.append(best)
        return float(np.mean(rs)) if rs else None
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
    if V3:      # (a10) her arms are bare skin: the veil's edge and the bodice over the shoulder are not arm
        am_ = am_ * np.clip(SKIN_U + ss(1.25, 1.6, par_), 0, 1)
    arm_side[sg] = (am_, par_)
    arm_m = np.maximum(arm_m, am_)
# feet: grown from the soles, near each ankle axis
foot_m = np.zeros(NU, bool)
def near_foot(i):
    sg = 1 if ux[i] > 0 else -1
    return math.hypot((ux[i] - sg * 0.07) / 0.06, (uy[i] + 0.07) / 0.14) < 1.0 and uz[i] < 0.14
seeds = [] if (WARDEN or V3) else [i for i in np.where(uz < 0.06)[0] if near_foot(i)]
if FOOT_SIDE is not None:      # (a9) the cut-free feet, exactly
    foot_m[:] = False
    np.logical_or.at(foot_m, lab, FOOT_SIDE.astype(bool))
    seeds = []
foot_m[seeds] = True
import collections
q = collections.deque(seeds)
nbr = A.tolil().rows
while q:
    a_ = q.popleft()
    for c_ in nbr[a_]:
        if not foot_m[c_] and near_foot(c_):
            foot_m[c_] = True; q.append(c_)
BODY_HEAT = [n for n in BN if not n.startswith('Skirt') and not any(k in n for k in ('Twist', 'Deltoid', 'Helper'))]
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
            if LEGS and any(k in n for k in ('Leg', 'Foot', 'Toes')):     # (a10) her thighs touch: a leg binds its own side
                sg_ = 1 if n.startswith('Left') else -1
                allowed[:, j] &= (ux * sg_ > -0.004)
            if n.endswith('Shoulder'):
                sg_ = 1 if n.startswith('Left') else -1
                allowed[:, j] &= (ux * sg_ > 0.0)
                if not WARDEN:      # (a9) the collarbone moves the shoulder's top, never her bust
                    allowed[:, j] &= (uz > 1.24) | (ux * sg_ > 0.12)
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
if LEGS:
    # (a10) the skirt shell only: cloth (not her skin) below the waist, clear of the legs (the cloth round the crotch,
    # inside, rides the hips and thighs); the legs keep their own heat weights
    legd = np.full(NU, np.inf)
    for f_ in ((lambda v: v), mir):
        for a_, b_ in (('UpperLeg', 'LowerLeg'), ('LowerLeg', 'Foot'), ('Foot', 'Toes'), ('Toes', 'ToeTip')):
            legd = np.minimum(legd, L.seg_dist(U, np.array(f_(S[a_])), np.array(f_(S[b_]))))
    gown_m = ss(0.98, 0.88, uz) * (1 - arm_m) * (1 - SKIN_U) * ss(0.075, 0.10, legd) * ss(0.37, 0.40, uz)     # (her soles are not skin-toned)
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
veil_m = np.clip(veil_back + veil_side, 0, 1) * (1 - gown_m) * (0.0 if (WARDEN or LEGS) else 1.0)     # (a10: a short hood rides the heat weights)

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

# gown: two nearest chains by angle x along-chain blend
ang = np.degrees(np.arctan2(ux, -(uy - AX_Y)))
W_gown = np.zeros((NU, len(BN)))
step = 45.0
a0 = np.floor((ang - SK_ANG[0]) / step).astype(int)
if WARDEN:
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
else:
    # (a9) a CAGE: the chains are translation handles (one shared rotation, the hips' yaw), so their linear blend is an
    # exact interpolation of the handles' offsets: no shear between chains, no volume loss, nothing tied to a leg.
    # Hips (the waist ring, z 0.90) > Skirt<k>_1 (the knee ring, z 0.48) > Skirt<k>_2 (the hem ring, z 0.03, and the
    # train on the floor), linear in height; between the two nearest chains, a half-linear/half-smooth angular blend.
    z0_, z1_, z2_ = SK_Z
    wtop = np.clip((uz - z1_) / (z0_ - z1_), 0, 1)
    wbot = np.clip((z1_ - uz) / (z1_ - z2_), 0, 1)
    wmid = 1 - wtop - wbot
    t_ = ((ang - SK_ANG[0]) / step) - np.floor((ang - SK_ANG[0]) / step)
    t_ = 0.5 * t_ + 0.5 * t_ * t_ * (3 - 2 * t_)
    if LEGS:    # (a10) the skirt's top rides her body's own (heat) weights: over the thighs it follows them a little
        W_gown += WH * wtop[:, None]
    else:
        W_gown[:, BI['Hips']] = wtop
    for k in range(8):
        wk = np.where(a0 % 8 == k, 1 - t_, 0) + np.where((a0 + 1) % 8 == k, t_, 0)
        W_gown[:, BI['Skirt%d_1' % k]] += wk * wmid
        W_gown[:, BI['Skirt%d_2' % k]] += wk * wbot
W_foot = np.zeros((NU, len(BN)))
for i in np.where(foot_w > 0)[0]:
    sd = 'Left' if ux[i] > 0 else 'Right'
    tt = ss(0.0, -0.07, uy[i]) if V3 else ss(-0.03, -0.12, uy[i])
    sh_ = ss(0.10, 0.16, uz[i]) if V3 else 0.0      # (a10: her shins show below the hem: the shin rides the lower leg)
    W_foot[i, BI[sd + 'LowerLeg']] = sh_
    W_foot[i, BI[sd + 'Foot']] = (1 - tt) * (1 - sh_); W_foot[i, BI[sd + 'Toes']] = tt * (1 - sh_)

body_m = np.clip(1 - gown_m - veil_m - foot_w, 0, 1)
W = WH * body_m[:, None] + W_gown * gown_m[:, None] + W_veil * veil_m[:, None] + W_foot * foot_w[:, None]
# no leg bone above the hem in the gown band (the legs are inside the gown; the gown rides the chains)
for sd in ('Left', 'Right'):
    for b in ('UpperLeg', 'LowerLeg'):
        if not WARDEN and not LEGS:
            W[:, BI[sd + b]] *= foot_w
if WARDEN:
    # forearm twist: the distal half of the forearm takes the twist bone (the hand's roll split along the forearm)
    for sd, sg in (('Left', 1), ('Right', -1)):
        f = (lambda v: v) if sg > 0 else mir
        a_, b_ = np.array(f(S['LowerArm'])), np.array(f(S['Hand']))
        d = b_ - a_; t = np.clip(((U - a_) @ d) / (d @ d), 0, 1.2)
        k = ss(0.25, 0.85, t)
        lo = W[:, BI[sd + 'LowerArm']].copy()
        W[:, BI[sd + 'LowerArm']] = lo * (1 - k); W[:, BI[sd + 'ForeTwist']] += lo * k
else:
    # (a9) the arm's helpers take their share of the heat weights along the arm (par: 1 = the shoulder joint,
    # 2 = the elbow, 3 = the wrist)
    def move(frac, src_, dst_):
        for b_ in src_:
            tk = W[:, BI[b_]] * frac
            W[:, BI[b_]] -= tk; W[:, BI[dst_]] += tk
    for sd, sg in (('Left', 1), ('Right', -1)):
        am_, par_ = arm_side[sg]
        side = (ux * sg > 0).astype(float)
        # the upper arm's twist: its shoulder end on UpperArmTwist (half the twist), its elbow end on UpperArm
        move((1 - ss(1.1, 1.9, par_)) * side, [sd + 'UpperArm'], sd + 'UpperArmTwist')
        # the forearm's roll in thirds
        tf = np.clip(par_ - 2.0, 0, 1)
        lo = W[:, BI[sd + 'LowerArm']].copy()
        w_ft = np.clip(np.minimum(3 * tf, 2 - 3 * tf), 0, 1)
        w_ft2 = np.clip(3 * tf - 1, 0, 1)
        w_la = np.clip(1 - 3 * tf, 0, 1)
        W[:, BI[sd + 'LowerArm']] = lo * w_la; W[:, BI[sd + 'ForeTwist']] += lo * w_ft; W[:, BI[sd + 'ForeTwist2']] += lo * w_ft2
        # the elbow ring: half of it on the half-bend helper
        move(ELB_K * np.clip(1 - np.abs(par_ - 2.0) / ELB_W, 0, 1) * side,
             [sd + 'UpperArm', sd + 'UpperArmTwist', sd + 'LowerArm', sd + 'ForeTwist'], sd + 'ElbowHelper')
        # the shoulder ring (cap, armpit, the top of the chest's side): on the half-swing deltoid
        move(DLT_K * np.clip(1 - np.abs(par_ - 1.0) / DLT_W, 0, 1) * side * ss(1.05, 1.15, uz),
             [sd + 'UpperArmTwist', sd + 'UpperArm', sd + 'Shoulder', 'UpperChest', 'Chest'], sd + 'Deltoid')
W = W / np.maximum(W.sum(1, keepdims=True), 1e-9)
# smoothing: everywhere a little, the region seams and the joints more
W = L.smooth_weights(W, A, 6, 0.5)
W = L.limit_normalize(W, 4, 0.02)
W = L.smooth_weights(W, A, 2, 0.5)
W = L.limit_normalize(W, 4, 0.02)
if not WARDEN:
    # (a9) her torso, shoulders and arms are LAYERS (skin, the bodice over it, straps, the veil's edge): smoothing on the
    # surface never joined them, so each layer kept its own blend and the layers sheared apart at the neckline, the bust
    # and the shoulder. A spatial pass (neighbours within 1.5 cm, any layer) gives touching layers one blend.
    _sp = sps.cKDTree(U).query_pairs(0.015, output_type='ndarray')
    AS = A + sp.coo_matrix((np.ones(len(_sp) * 2), (np.r_[_sp[:, 0], _sp[:, 1]], np.r_[_sp[:, 1], _sp[:, 0]])), shape=(NU, NU)).tocsr()
    up_m = ss(0.92, 1.0, uz) * (1 - foot_w) * (1 - veil_m)
    for sd, sg in (('Left', 1), ('Right', -1)):
        up_m *= 1 - ss(2.75, 2.95, arm_side[sg][1]) * (ux * sg > 0.1)          # (not the hands)
    W = L.smooth_weights(W, AS, 6, 0.5, mask=up_m)
    # the collarbones turn 25-35 deg in every clip (the arms come down from her A-pose): their blend into the chest and
    # the neck is spread wide (the shoulder's top, the trapezius, the chest's top corner)
    sh_m = ss(1.16, 1.24, uz) * ss(1.46, 1.40, uz) * ss(0.01, 0.05, ax) * (1 - ss(0.2, 0.26, ax)) * (1 - veil_m)
    W = L.smooth_weights(W, AS, 14, 0.5, mask=sh_m)
    W = L.limit_normalize(W, 4, 0.02)
if not WARDEN:      # (a9) no foot/leg weight leaks across to the other side's hem
    for sd, sg in (('Left', 1), ('Right', -1)):
        for b_ in ('UpperLeg', 'LowerLeg', 'Foot', 'Toes'):
            W[ux * sg < -0.005, BI[sd + b_]] = 0.0
    W = L.limit_normalize(W, 4, 0.02)
if LEGS:
    # (a10) her knees (the a9 mesh had none to show): the knee ring's heat weights shared with the half-bend helper
    # (LBS averages a 150 deg kneel to the bone; two 75 deg halves keep the knee's volume)
    for sd, sg in (('Left', 1), ('Right', -1)):
        f_ = (lambda v: v) if sg > 0 else mir
        kn_ = np.array(f_(S['LowerLeg'])); th_ = np.array(f_(S['UpperLeg'])); an_ = np.array(f_(S['Foot']))
        nd_ = (an_ - kn_) / np.linalg.norm(an_ - kn_) + (kn_ - th_) / np.linalg.norm(kn_ - th_); nd_ /= np.linalg.norm(nd_)
        sd_ = (U - kn_) @ nd_
        iu, il, ih = BI[sd + 'UpperLeg'], BI[sd + 'LowerLeg'], BI[sd + 'KneeHelper']
        k_ = KNEE_K * np.clip(1 - np.abs(sd_) / KNEE_RW, 0, 1) * (ux * sg > -0.01) * (L.seg_dist(U, th_, an_) < 0.12)
        for b_ in (iu, il):
            tk = W[:, b_] * k_
            W[:, b_] -= tk; W[:, ih] += tk
    W = L.limit_normalize(W, 4, 0.02)
WU = W
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

# ------------------------------------------------------------------ (a9) her gown: a damped, leg-colliding cage
SKN = [['Skirt%d_%d' % (k, i) for i in (1, 2)] for k in range(8)]
SKH = [n for c in SKN for n in c]                   # the 16 handles (x_1 at the knee ring, x_2 at the hem ring)
HEM_I = [i for i in range(16) if i % 2 == 1]        # the hem ring's handles (SKH = k0_1, k0_2, k1_1, ...)
SKH_REST = {SKN[k][i]: SK_REST[k][i + 1].copy() for k in range(8) for i in (0, 1)}
GOWN_V = np.where(WU[:, [BI[n] for n in SKH]].sum(1) > 0.02)[0] if not WARDEN else np.zeros(0, int)
G_P = U[GOWN_V]
G_WSK = WU[GOWN_V][:, [BI[n] for n in SKH]]                        # (nv, 16)
G_WB = WU[GOWN_V].copy(); G_WB[:, [BI[n] for n in SKH]] = 0.0       # its body bones
G_BODY = [j for j in range(len(BN)) if G_WB[:, j].any()]
G_FOOT = G_WB[:, [BI[sd + b] for sd in ('Left', 'Right') for b in ('UpperLeg', 'LowerLeg', 'Foot', 'Toes')]].sum(1)
G_FREE = G_WSK.sum(1)                                              # how much of it the handles move
RINV = {n: RESTM[n].inverted() for n in BN}
def _np4(M): return np.array(M)
# what must stay covered (the legs are never drawn; the feet are): the ankle (the shin's last 30%) and the foot's back
# 60% (the toes may peek out under the hem); radii fitted below the rest gown
CAPS = [('LowerLeg', 'Foot', 0.7, 1.0, 0.040), ('Foot', 'Toes', 0.0, 0.6, 0.035)]     # (the toes may peek out under the hem)
if V3 and not LEGS:     # (a10) the legs' cut stubs (to ~0.2 m) stay under the hem; the ankle and the foot never through it
    CAPS = [('LowerLeg', 'Foot', 0.55, 0.75, 0.050), ('LowerLeg', 'Foot', 0.75, 1.0, 0.050), ('Foot', 'Toes', 0.0, 0.6, 0.040)]
if LEGS:    # (a10) her legs ARE drawn: the thigh and the knee stay inside the skirt; the shin below the hem shows
    CAPS = [('UpperLeg', 'LowerLeg', 0.3, 1.0, 0.085), ('LowerLeg', 'Foot', 0.0, 0.14, 0.062),
            ('LowerLeg', 'Foot', 0.14, 1.0, 0.045), ('Foot', 'Toes', 0.0, 0.6, 0.035)]     # (a kneel lays the hem on the shins)
CAP_N = [c[0] for c in CAPS] * 2
def _caps(T):
    out = []
    for sd in ('Left', 'Right'):
        for a_, b_, f0, f1, r in CAPS:
            pa = np.array(T[sd + a_].translation); pb = np.array(T[sd + b_].translation)
            out.append((pa + (pb - pa) * f0, pa + (pb - pa) * f1, r, sd))
    return out
def _seg(P_, a_, b_):
    d = b_ - a_; t = np.clip(((P_ - a_) @ d) / max(d @ d, 1e-12), 0, 1)
    c = a_ + t[:, None] * d
    v = P_ - c; n = np.linalg.norm(v, axis=1)
    return c, v, n
if not WARDEN:
    # each capsule's radius: never more than the rest gown's clearance (less 6 mm) where the handles move it
    _rc = []
    CAP_OK = []         # (a10) per capsule: the gown vertices it may push (V3: those clear of it at rest)
    for (pa, pb, r, sd), (a_, b_, f0, f1, rn) in zip(_caps(RESTM), CAPS * 2):
        c, v, n = _seg(G_P, pa, pb)
        m = (G_FREE > 0.3) & (G_FOOT < 0.05)
        if V3:      # (a10) the full radius (a margin over the test's), never the hem cap's own ring round the stub
            _rc.append(rn); CAP_OK.append(n > rn + 0.004)
        else:
            _rc.append(max(min(rn, float(n[m].min()) - 0.006), 0.035) if np.any(m) else rn)     # (the toes come out under the hem: 3.5 cm at least)
            CAP_OK.append(np.ones(len(G_P), bool))
    CAP_R = _rc
    print('gown: verts', len(GOWN_V), 'capsule radii', [round(r, 3) for r in CAP_R])
G_FLOOR = np.minimum(G_P[:, 2], 0.004)
_vn = np.zeros((NU, 3))
_fn = np.cross(U[TU[:, 1]] - U[TU[:, 0]], U[TU[:, 2]] - U[TU[:, 0]])
for c_ in range(3):
    np.add.at(_vn, TU[:, c_], _fn)
GOWN_ACT = 0.45           # only where the handles carry most of a vertex (the waist band rides the hips)
GOWN_BUNCH = 0.6          # a chain on the floor piles up to 60% of its length before it spreads outward
G_OUT = np.c_[G_P[:, 0], G_P[:, 1] - AX_Y, np.zeros(len(G_P))]          # its rest outward side (horizontal)
G_OUT /= np.maximum(np.linalg.norm(G_OUT, axis=1, keepdims=True), 1e-6)
_gn = _vn[GOWN_V] / np.maximum(np.linalg.norm(_vn[GOWN_V], axis=1, keepdims=True), 1e-9)
G_OUTER = (_gn * G_OUT).sum(1) > 0.15          # the gown's outer face (its inside and the hem's underside never push)

def gown_targets(T):
    """the hang (no legs yet): the waist ring rides the hips; the chains turn with the hips' yaw and part of their
    lean; the hem keeps off the floor (a chain may bunch to 3/4 of its length, then spreads outward on the floor)."""
    H = T['Hips']; H0 = RESTM['Hips']
    Hrel = H @ H0.inverted()
    qh = Hrel.to_quaternion()
    tw_ = Quaternion((qh.w, 0, 0, qh.z)).normalized() if abs(qh.w) + abs(qh.z) > 1e-6 else Quaternion()
    sw_ = qh @ tw_.inverted()
    Rs = (Quaternion().slerp(sw_, 0.3) @ tw_).to_matrix()
    tgt = {}
    for k, phi in enumerate(SK_ANG):
        pa = math.radians(phi)
        n = (tw_.to_matrix() @ V(math.sin(pa), -math.cos(pa), 0)).normalized()
        p0 = Hrel @ SK_REST[k][0]
        p1 = p0 + Rs @ (SK_REST[k][1] - SK_REST[k][0])
        d2 = (Rs @ (SK_REST[k][2] - SK_REST[k][1]))
        d2 = d2.normalized().lerp((SK_REST[k][2] - SK_REST[k][1]).normalized(), 0.5).normalized() * d2.length
        p2 = p1 + d2
        def floor(a_, b_, Ls, zmin):
            if b_.z >= zmin:
                return b_
            h_ = max(a_.z - zmin, 0.0)
            hz = V(b_.x - a_.x, b_.y - a_.y, 0)
            off0 = hz.length
            hz = (hz + V(n.x, n.y, 0) * 0.05).normalized()
            Lt = max(h_, GOWN_BUNCH * Ls)
            # (it may spread out on the floor, but a ring laid flat stretches round: at most 8 cm past its own flare)
            off = min(max(off0, math.sqrt(max(Lt * Lt - h_ * h_, 0.0))), off0 + 0.08)
            return a_ + hz * off + V(0, 0, -h_)
        p1 = floor(p0, p1, SK_LEN[k][0], HEM_FLOOR + 0.04)
        p2 = floor(p1, p1 + d2, SK_LEN[k][1], HEM_FLOOR)
        tgt[SKN[k][0]] = p1; tgt[SKN[k][1]] = p2
    return tgt, tw_.to_matrix()

KNEE_M, SHIN_M = -0.02, 0.0             # the gown's clearance round the knee / the shin and ankle
def gown_push(T, hang, R):
    """(a9) the legs inside the gown: each ring first SHIFTS toward where the legs went (0.4 of their mean travel), then
    where a knee (knee ring) or a shin / ankle (hem ring) would come through it, that side of the ring is carried out
    as a BLOCK (one push vector, faded over the chains facing it): the gown bulges over the knee instead of inflating
    round it (an inflated ring was the stretch). The legs are never drawn: this only keeps the shape honest and the
    feet covered. Returns the pushed targets."""
    H = T['Hips']; H0 = RESTM['Hips']
    Hrel = H @ H0.inverted()
    legs = {}
    for sd in ('Left', 'Right'):
        kn, an = T[sd + 'LowerLeg'].translation, T[sd + 'Foot'].translation
        legs[sd] = (kn, an, kn.lerp(an, 0.5), Hrel @ RESTM[sd + 'LowerLeg'].translation, Hrel @ RESTM[sd + 'Foot'].translation)
        if LEGS:    # (a10) the rings sit at the thigh (mid ring) and the knee (hem): they follow those
            th, th0 = T[sd + 'UpperLeg'].translation.lerp(kn, 0.55), (Hrel @ RESTM[sd + 'UpperLeg'].translation).lerp(Hrel @ RESTM[sd + 'LowerLeg'].translation, 0.55)
            legs[sd] = (th, kn, kn.lerp(an, 0.1), th0, Hrel @ RESTM[sd + 'LowerLeg'].translation)
    def hz(v): return Vector((v.x, v.y, 0.0))
    sh1 = sum((hz(l[0] - l[3]) for l in legs.values()), Vector()) * 0.4
    sh2 = sum((hz(l[1] - l[4]) for l in legs.values()), Vector()) * 0.4
    out = {}
    ns = []
    P0, P1, P2 = [], [], []
    for k, phi in enumerate(SK_ANG):
        pa = math.radians(phi)
        ns.append((R @ V(math.sin(pa), -math.cos(pa), 0)).normalized())
        if V3 and not LEGS:     # (a10) only the chains facing where the legs went shift (a sit's back panel stays behind)
            f1 = 0.5 + 0.5 * max(-1.0, min(1.0, ns[k].dot(sh1.normalized()))) if sh1.length > 1e-4 else 1.0
            f2 = 0.5 + 0.5 * max(-1.0, min(1.0, ns[k].dot((sh1 * 0.5 + sh2).normalized()))) if (sh1 * 0.5 + sh2).length > 1e-4 else 1.0
        else:
            f1 = f2 = 1.0
        P0.append(Hrel @ SK_REST[k][0]); P1.append(hang[SKN[k][0]] + sh1 * f1); P2.append(hang[SKN[k][1]] + (sh1 * 0.5 + sh2) * f2)
    D1 = [Vector() for _ in range(8)]; D2 = [Vector() for _ in range(8)]
    for sd, sg in (('Left', 1), ('Right', -1)):
        kn, an, mid, _, _ = legs[sd]
        best = [(0.0, 0), (0.0, 0)]                    # (deficit, chain) for the knee ring / the hem ring
        for k in range(8):
            near = ss(-0.75, 0.2, sg * math.sin(math.radians(SK_ANG[k])))
            if near <= 0.0:
                continue
            n = ns[k]; p0, p1, p2 = P0[k], P1[k], P2[k]
            for q, m in (((kn, 0.03), (an, 0.03), (mid, 0.02)) if LEGS else ((kn, KNEE_M), (mid, SHIN_M), (an, 0.045))):
                if q.z >= p1.z:
                    continue        # (a knee raised above the knee ring - a climb, a sit - is never drawn: no tent)
                if V3 and q.z < p2.z - 0.03:
                    continue        # (a10: her shin below the hem shows; it passes under the hem)
                else:
                    u = min(max((p1.z - q.z) / max(p1.z - p2.z, 1e-3), 0.0), 1.0)
                    need = min(max(0.0, (q - p1.lerp(p2, u)).dot(n) + m), 0.35) * near
                    if u < 0.5 and need > best[0][0]: best[0] = (need, k)
                    if need > best[1][0]: best[1] = (need, k)
        for (need, k0), D in zip(best, (D1, D2)):
            if need <= 0.0:
                continue
            for j in range(8):
                c = max(0.0, ns[j].dot(ns[k0]))
                D[j] = D[j] + ns[k0] * (need * c * c)
    for k in range(8):
        out[SKN[k][0]] = P1[k] + D1[k]
        b_ = P2[k] + (D1[k] * 0.8 if (D1[k] * 0.8).length > D2[k].length else D2[k])
        b_.z = max(b_.z, HEM_FLOOR)
        out[SKN[k][1]] = b_
    return out

def gown_check(T, R):
    """the deepest a gown vertex (handle-carried) goes inside the thin leg capsules (knee r 4.5 cm, shin 4 cm)"""
    Rn = np.array(R)
    Ph = np.c_[G_P, np.ones(len(G_P))]
    X = np.zeros((len(G_P), 3))
    for j in range(len(BN)):
        w_ = G_WB[:, j] + (G_WSK[:, SKH.index(BN[j])] if BN[j] in SKH else 0)
        if not np.any(w_):
            continue
        K = _np4(T[BN[j]] @ RINV[BN[j]])
        X += w_[:, None] * (Ph @ K.T)[:, :3]
    act = (G_FREE > GOWN_ACT) & (G_FOOT < 0.05) & G_OUTER
    worst = 0.0
    for ((pa, pb, _, sd), r), ok_ in zip(zip(_caps(T), CAP_R), CAP_OK):
        c, v, nrm = _seg(X, pa, pb)
        worst = max(worst, float(((r - nrm) * act * ok_).max()))
    return worst

PUSH_MAX = 0.0
DUMP = []
GOWN_SMOOTH = 0.3
SK_LAP = np.zeros((16, 16))                          # the handles' graph Laplacian (8 round x 2 down)
for k in range(8):
    for i in (0, 1):
        for a_, b_ in ((SKH.index(SKN[k][i]), SKH.index(SKN[(k + 1) % 8][i])),) + (((SKH.index(SKN[k][0]), SKH.index(SKN[k][1])),) if i == 0 else ()):
            SK_LAP[a_, a_] += 1; SK_LAP[b_, b_] += 1; SK_LAP[a_, b_] -= 1; SK_LAP[b_, a_] -= 1
def gown_collide(T, tgt, R):
    """pushes the handles out until no gown vertex is inside a leg capsule or under the floor; sets T[Skirt*]"""
    Rn = np.array(R)
    x_body = np.zeros((len(GOWN_V), 3))
    Ph = np.c_[G_P, np.ones(len(G_P))]
    for j in G_BODY:
        K = _np4(T[BN[j]] @ RINV[BN[j]])
        x_body += G_WB[:, j:j + 1] * (Ph @ K.T)[:, :3]
    base = x_body + G_FREE[:, None] * (G_P @ Rn.T)
    t = np.array([np.array(tgt[n]) - Rn @ np.array(SKH_REST[n]) for n in SKH])     # (16, 3)
    caps = _caps(T)
    G_OUT_R = G_OUT @ Rn.T
    act = (G_FREE > GOWN_ACT) & (G_FOOT < 0.05) & G_OUTER
    pen_max = 0.0
    t0_ = t.copy()
    hem_lift = 0.01 + max(0.0, 0.6 * (RESTM['Hips'].translation.z - T['Hips'].translation.z) - 0.03)
    if V3:      # (a10) her hem hangs above the ankles: it never rises above its own knee ring
        hem_lift = np.maximum(t[[i - 1 for i in HEM_I], 2] + 0.02, 0.15)
    t[HEM_I, 2] = np.minimum(t[HEM_I, 2], hem_lift)
    if os.environ.get('GDUMP'):
        DUMP.append(dict(base=base.copy(), t=t.copy(), caps=[(c[0], c[1]) for c in caps], R=Rn.copy()))
    for it in range(30):
        X = base + G_WSK @ t
        d = np.zeros_like(X)
        pen_max = 0.0
        for ci_, ((pa, pb, _, sd), r) in enumerate(zip(caps, CAP_R)):
            # pushed along its own outward side (never through to the far side of a leg that came through it)
            # (outward and a little up, square to the leg: over a sitting thigh it lifts, past a standing one it bows out)
            c, v, nrm = _seg(X, pa, pb)
            ax_ = (pb - pa) / max(np.linalg.norm(pb - pa), 1e-9)
            # (a thigh, or a shin lying down, lifts it; a swinging shin only bows it out)
            dr = G_OUT_R + np.array([0.0, 0.0, 0.6 if CAP_N[ci_] != 'Foot' and ('Upper' in CAP_N[ci_] or abs(pb[2] - pa[2]) < 0.5 * np.linalg.norm(pb - pa)) else 0.0])
            dr -= np.outer(dr @ ax_, ax_)
            dr /= np.maximum(np.linalg.norm(dr, axis=1, keepdims=True), 1e-6)
            if LEGS:    # (a10) under a raised thigh (a sit): straight down out of it, not back along it
                rad_ = v / np.maximum(nrm[:, None], 1e-6)
                ur_ = ((rad_ * G_OUT_R).sum(1) > -0.2) & (nrm > 1e-4) & (rad_[:, 2] < -0.4)
                dr[ur_] = rad_[ur_]
                if abs(ax_[2]) < 0.6:       # (a thigh lying forward: the skirt's back panel goes under it, not back along it)
                    dn_ = np.array([0.0, 0.0, -1.0]) - ax_ * (-ax_[2]); dn_ /= max(np.linalg.norm(dn_), 1e-6)
                    ub_ = (G_OUT_R @ ax_) < -0.3
                    dr[ub_] = dn_
            s_ = (v * dr).sum(1)
            lat = np.sqrt(np.maximum(nrm * nrm - s_ * s_, 0.0))
            pen = (np.sqrt(np.maximum(r * r - lat * lat, 0.0)) - s_) * act * CAP_OK[ci_] * (lat < r) * ((nrm < r) | (s_ > -0.12))
            m = pen > 0
            if m.any():
                d[m] += dr[m] * pen[m, None]
                pen_max = max(pen_max, float(pen[m].max()))
        fl = (G_FLOOR - X[:, 2]) * act
        m = fl > 0
        d[m, 2] += fl[m]
        if m.any():
            pen_max = max(pen_max, float(fl[m].max()))
        if pen_max < 0.0015:
            break
        if os.environ.get("GDEBUG") and it == 29:
            pn = np.linalg.norm(d, axis=1); w_ = int(np.argmax(pn))
            print('   dbg worst', round(float(pn[w_]), 3), 'rest', np.round(G_P[w_], 3), 'free', round(float(G_FREE[w_]), 2),
                  'floor', round(float(fl[w_]), 3), 'z', round(float(X[w_, 2]), 3), 'n>1cm', int((pn > 0.01).sum()))
            print('   dbg d', np.round(d[w_], 3), 'wsk', [(SKH[j], round(float(G_WSK[w_, j]), 2)) for j in np.where(G_WSK[w_] > 0)[0]],
                  'body', [(BN[j], round(float(G_WB[w_, j]), 2)) for j in np.where(G_WB[w_] > 0)[0]], 'X', np.round(X[w_], 3))
            for (pa, pb, _, sd), r in zip(caps, CAP_R):
                c, v, nrm = _seg(X[w_:w_ + 1], pa, pb); print('    cap', sd, np.round(pa, 3), np.round(pb, 3), r, round(float(nrm[0]), 3))
        dm = np.linalg.norm(d, axis=1) > 0
        # the least (regularised) handle moves that carry every caught vertex out
        # (rows weighted by how much the handles move that vertex; each step at most 4 cm)
        # + a smoothness term between neighbouring handles (round each ring, knee ring to hem): the gown SHIFTS toward
        # the leg as a tube instead of one panel stretching away from its neighbours
        Wm = G_WSK[dm] * G_FREE[dm, None]
        nv_ = max(int(dm.sum()), 1)
        upd = np.linalg.solve((Wm.T @ G_WSK[dm]) / nv_ + GOWN_SMOOTH * SK_LAP + 0.002 * np.eye(len(SKH)), (Wm.T @ d[dm]) / nv_)
        nu = np.linalg.norm(upd, axis=1, keepdims=True)
        t += upd * np.minimum(1.0, 0.04 / np.maximum(nu, 1e-9))
        t[HEM_I, 2] = np.minimum(t[HEM_I, 2], hem_lift)       # the hem stays down unless she is down too
    global PUSH_MAX
    PUSH_MAX = max(PUSH_MAX, float(np.linalg.norm(t - t0_, axis=1).max()))
    for n, tt in zip(SKH, t):
        M = R.to_4x4() @ RESTM[n]
        M.translation = Vector(tt) + R @ RESTM[n].translation
        T[n] = M
    return pen_max

def helper_pose(T):
    """(a9) the arm helpers from the arm's own bones (the runtime twin: HeroineRig._helpers)"""
    def rel(n):
        p = arm.data.bones[n].parent.name
        return (RESTM[p].inverted() @ RESTM[n]).to_quaternion().inverted() @ (T[p].inverted() @ T[n]).to_quaternion()
    def tw(q):
        t_ = Quaternion((q.w, 0, q.y, 0))
        if t_.magnitude < 1e-9:
            return 0.0
        t_.normalize()
        return 2 * math.atan2(t_.y, t_.w) if t_.w >= 0 else 2 * math.atan2(-t_.y, -t_.w)
    def put(n, q):
        p = arm.data.bones[n].parent.name
        Lr = RESTM[p].inverted() @ RESTM[n]
        Lm = (Lr.to_quaternion() @ q).to_matrix().to_4x4(); Lm.translation = Lr.translation
        T[n] = T[p] @ Lm
    for sd in ('Left', 'Right'):
        qu = rel(sd + 'UpperArm'); tu = tw(qu)
        put(sd + 'UpperArmTwist', Quaternion((0, 1, 0), -0.5 * tu))
        put(sd + 'Deltoid', Quaternion().slerp(qu @ Quaternion((0, 1, 0), -0.5 * tu), 0.5))
        put(sd + 'ElbowHelper', Quaternion().slerp(rel(sd + 'LowerArm'), 0.5))
        if LEGS:
            put(sd + 'KneeHelper', Quaternion().slerp(rel(sd + 'LowerLeg'), 0.5))
        th = tw(rel(sd + 'Hand'))
        put(sd + 'ForeTwist', Quaternion((0, 1, 0), th / 3))
        put(sd + 'ForeTwist2', Quaternion((0, 1, 0), th * 2 / 3))
    return T

def finish_clip(poses, loop):
    """(a9) every frame of a clip: the arm helpers, then the gown: its hang targets eased by a damped spring (the
    hem lags and swings; a loop is run 3 times so it wraps), then pushed out of the legs and the floor."""
    if WARDEN:
        return [finish(T) for T in poses]
    for T in poses:
        helper_pose(T)
    tg = [gown_targets(T) for T in poses]
    n = len(poses)
    w0, ze, dt = 2 * math.pi * 1.8, 0.75, 1.0 / FPS / 4
    pos = {h: np.array(tg[0][0][h]) for h in SKH}; vel = {h: np.zeros(3) for h in SKH}
    out = [None] * n
    for rep in range(3 if loop else 1):
        for i in range(n):
            for h in SKH:
                g_ = np.array(tg[i][0][h])
                for _ in range(4):
                    a_ = w0 * w0 * (g_ - pos[h]) - 2 * ze * w0 * vel[h]
                    vel[h] = vel[h] + a_ * dt; pos[h] = pos[h] + vel[h] * dt
            out[i] = {h: Vector(pos[h]) for h in SKH}
    worst = 0.0
    global PUSH_MAX
    PUSH_MAX = 0.0
    for i, T in enumerate(poses):
        R = tg[i][1]
        go_ = os.environ.get('GOFF', '')
        pt_ = out[i] if 'push' in go_ else gown_push(T, out[i], R)
        if 'ls' in go_:
            for n_ in SKH:
                M = R.to_4x4() @ RESTM[n_]; M.translation = pt_[n_] - R @ SKH_REST[n_] + R @ RESTM[n_].translation; T[n_] = M
        else:
            gown_collide(T, pt_, R)
        worst = max(worst, gown_check(T, R))
    print('  gown: deepest in a leg %.4f m, largest correction %.3f m' % (worst, PUSH_MAX))
    if os.environ.get('GDUMP'):
        import pickle
        pickle.dump(dict(frames=DUMP, G_P=G_P, G_WSK=G_WSK, G_FREE=G_FREE, G_FOOT=G_FOOT, G_OUT=G_OUT, G_FLOOR=G_FLOOR,
                         CAP_R=CAP_R, SKH=SKH), open(os.environ['GDUMP'], 'wb'))
        DUMP.clear()
    return poses

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
    if WARDEN:
        twist_pose(T)
        skirt_pose(T)
        return T
    helper_pose(T)
    tg, R = gown_targets(T)
    pt = gown_push(T, tg, R)
    for n_ in SKH:
        M = R.to_4x4() @ RESTM[n_]
        M.translation = pt[n_] - R @ SKH_REST[n_] + R @ RESTM[n_].translation
        T[n_] = M
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
        fb = [L.to_basis(arm, T) for T in finish_clip(poses, bool(meta.get('loop', False)))]
        if WARDEN:
            L.write_action(arm, name, fb, FPS)
        else:
            L.write_action(arm, name, fb, FPS, loc_bones=('Hips',) + tuple(SKH), scale_prefix=())
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
            # (a10) the passing pose (the feet side by side): a walk from standing starts here, so its blend-in mixes
            # two near-standing poses (a stride blended half-in pushed her thigh through the gown)
            m['pass'] = round(float(np.argmin(np.abs(np.array(ys['Left']) - np.array(ys['Right'])))) / FPS, 3)
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
        for k in ('at', 'n', 'speed', 'pass'):
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
