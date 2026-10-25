"""EIDOLON heroine rig: weights + cloth chains + A-pose bake + GLB export (numpy/scipy, no Blender).
Same approach and bone naming as eidolon-world/dev_rig/tools/rig_build.py / rig_export.py (wanderer),
adapted to the heroine mesh (metres, 1.7 m, +y up, faces +z, figure's left = +x, T-pose source).
  python3 eidolon-world/dev_rig/tools/heroine_rig.py eidolon-world/dev_rig/tools/heroine_src.glb eidolon-world/assets/models/heroine_rigged.glb [debug_dir]
(heroine_src.glb = Tripo task 9a5c9a62 normalised: +Z front, 1.7 m, feet at y=0, 1024 px textures)
env ARM_DOWN (deg, default 52), ARM_FWD (deg, default 14)
"""
import sys, os, io, json, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import scipy.sparse as sp, scipy.sparse.csgraph as cg
from PIL import Image
from glb import load, acc
from glbw import W as GW, debug_mesh

SRC, OUTGLB = sys.argv[1], sys.argv[2]
DBG = sys.argv[3] if len(sys.argv) > 3 else None
ARM_DOWN = float(os.environ.get('ARM_DOWN', '52'))
ARM_FWD = float(os.environ.get('ARM_FWD', '14'))
LEG_FRONT = float(os.environ.get('LEG_FRONT', '0.22'))

def ss(e0, e1, x):
    t = np.clip((np.asarray(x, float) - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)

# ------------------------------------------------------------------ load + weld
js, b = load(SRC)
prim = js['meshes'][0]['primitives'][0]
P = acc(js, b, prim['attributes']['POSITION']).astype(np.float64)
NRM = acc(js, b, prim['attributes']['NORMAL']).astype(np.float64)
UV = acc(js, b, prim['attributes']['TEXCOORD_0']).astype(np.float32)
I = acc(js, b, prim['indices']).reshape(-1, 3).astype(np.int64)
# drop the hidden hem cap (Tripo closes the skirt bottom onto the ankles); it would web between the
# skirt and the striding feet. The dress material is made double-sided so the open hem has an inside.
_fn = np.cross(P[I[:, 1]] - P[I[:, 0]], P[I[:, 2]] - P[I[:, 0]]); _fn /= np.maximum(np.linalg.norm(_fn, axis=1, keepdims=True), 1e-12)
_c = P[I].mean(1)
_dA = np.minimum(np.hypot(_c[:, 0] - 0.058, _c[:, 2] - 0.03), np.hypot(_c[:, 0] + 0.058, _c[:, 2] - 0.03))
CAP_DROP = (_fn[:, 1] < -0.5) & (_c[:, 1] > 0.065) & (_c[:, 1] < 0.17) & (_dA > float(os.environ.get('CAP_KEEP_R', '0.07')))
if os.environ.get('KEEP_CAP') != '1':
    I = I[~CAP_DROP]
    used = np.unique(I); remap = -np.ones(len(P), np.int64); remap[used] = np.arange(len(used))
    P, NRM, UV, I = P[used], NRM[used], UV[used], remap[I]
key = np.round(P / 1e-5).astype(np.int64)
_, wid, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
inv = inv.ravel()
U = P[wid]; NU = len(U); TU = inv[I]
E = np.concatenate([TU[:, [0, 1]], TU[:, [1, 2]], TU[:, [2, 0]]])
E = E[E[:, 0] != E[:, 1]]
E = np.unique(np.sort(E, 1), axis=0)
EL = np.linalg.norm(U[E[:, 0]] - U[E[:, 1]], axis=1)
nbrs = [[] for _ in range(NU)]
for a_, c_ in E:
    nbrs[a_].append(c_); nbrs[c_].append(a_)
x, y, z = U[:, 0], U[:, 1], U[:, 2]
ax = np.abs(x)
AXIS_Z = 0.0
phi = np.degrees(np.arctan2(x, z - AXIS_Z))     # azimuth, 0 = front, +90 = figure's left

# ------------------------------------------------------------------ body skeleton (T-pose joints, metres)
def mirror(p): return (-p[0], p[1], p[2])
L_ = {
    'Thigh': (0.080, 0.870, 0.000), 'Calf': (0.068, 0.470, 0.010), 'Foot': (0.058, 0.085, -0.005),
    'ToeBase': (0.058, 0.022, 0.110),
    'Clavicle': (0.030, 1.345, -0.020), 'Upperarm': (0.170, 1.335, -0.030),
    'Forearm': (0.420, 1.328, -0.005), 'Hand': (0.600, 1.325, 0.070),
}
BODY = [
    ('BoneRoot', None, (0.0, 0.880, 0.0)),
    ('Hip', 'BoneRoot', (0.0, 0.885, 0.0)),
    ('Pelvis', 'Hip', (0.0, 0.920, 0.0)),
    ('Waist', 'Hip', (0.0, 1.000, 0.0)),
    ('Spine01', 'Waist', (0.0, 1.095, -0.005)),
    ('Spine02', 'Spine01', (0.0, 1.225, -0.012)),
    ('NeckTwist01', 'Spine02', (0.0, 1.395, -0.020)),
    ('NeckTwist02', 'NeckTwist01', (0.0, 1.430, -0.012)),
    ('Head', 'NeckTwist02', (0.0, 1.470, 0.000)),
]
for s, sg in (('L', 1), ('R', -1)):
    f = (lambda p: p) if sg > 0 else mirror
    BODY += [(s + '_Thigh', 'Pelvis', f(L_['Thigh'])), (s + '_Calf', s + '_Thigh', f(L_['Calf'])),
             (s + '_Foot', s + '_Calf', f(L_['Foot'])), (s + '_ToeBase', s + '_Foot', f(L_['ToeBase'])),
             (s + '_Clavicle', 'Spine02', f(L_['Clavicle'])), (s + '_Upperarm', s + '_Clavicle', f(L_['Upperarm'])),
             (s + '_Forearm', s + '_Upperarm', f(L_['Forearm'])), (s + '_Hand', s + '_Forearm', f(L_['Hand']))]
LEAF_TIP = {'Head': (0.0, 1.68, 0.0), 'L_Hand': (0.775, 1.30, 0.10), 'R_Hand': (-0.775, 1.30, 0.10),
            'L_ToeBase': (0.058, 0.015, 0.17), 'R_ToeBase': (-0.058, 0.015, 0.17)}
PRIMARY = {'BoneRoot': 'Hip', 'Hip': 'Waist', 'Pelvis': None, 'Spine02': 'NeckTwist01'}
bones, bidx = [], {}
def add_bone(n, parent, pos, **kw):
    bidx[n] = len(bones); d = dict(name=n, parent=parent, pos=np.array(pos, float)); d.update(kw); bones.append(d)
for n, p, pos in BODY:
    add_bone(n, p, pos)
NBODY = len(bones)

# ------------------------------------------------------------------ regions
# arms: bare arms + cap sleeve, out past the shoulder, below the veil's shoulder drape
arm_m = ss(0.150, 0.205, ax) * ss(1.17, 1.25, y) * (1 - ss(1.40, 1.43, y) * ss(0.24, 0.20, ax))
# feet: grow from the soles while staying near the ankle axis (the hem ring is excluded)
foot_c = {1: np.array([0.058, 0.03]), -1: np.array([-0.058, 0.03])}
def near_foot(i):
    sg = 1 if x[i] > 0 else -1
    return np.hypot(*(np.array([x[i], z[i]]) - foot_c[sg]) / np.array([0.075, 0.16])) < 1.0 and y[i] < 0.16
foot_m = np.zeros(NU, bool)
seeds = list(np.where(y < 0.06)[0]); foot_m[seeds] = True
q = collections.deque(seeds)
while q:
    a_ = q.popleft()
    for c_ in nbrs[a_]:
        if not foot_m[c_] and near_foot(c_):
            foot_m[c_] = True; q.append(c_)
foot_w = foot_m.astype(float)
# veil back panel: behind the back, below the nape
BACK_Z = -0.075
veil_back_m = ss(BACK_Z + 0.01, BACK_Z - 0.02, z) * ss(0.70, 0.76, y) * ss(1.44, 1.38, y) * ss(0.26, 0.22, ax) * (1 - arm_m)
# head / veil over the head: above the neck
head_m = ss(1.385, 1.445, y) * (1 - arm_m)
# veil side flaps: the veil hanging beside the head onto the shoulders
veil_side_m = ss(0.085, 0.115, ax) * ss(1.30, 1.34, y) * ss(1.52, 1.46, y) * (1 - arm_m) * (1 - veil_back_m) * ss(-0.09, -0.05, z)

# ------------------------------------------------------------------ geometry helpers
tri = TU
T0, T1, T2 = U[tri[:, 0]], U[tri[:, 1]], U[tri[:, 2]]
def ray_far(o, d):
    e1 = T1 - T0; e2 = T2 - T0
    pv = np.cross(d, e2); det = (e1 * pv).sum(1)
    ok = np.abs(det) > 1e-12
    inv_det = np.where(ok, 1.0 / np.where(ok, det, 1), 0)
    tv = o - T0
    u = (tv * pv).sum(1) * inv_det
    qv = np.cross(tv, e1)
    v = (qv * d).sum(1) * inv_det
    t = (e2 * qv).sum(1) * inv_det
    hit = ok & (u >= 0) & (v >= 0) & (u + v <= 1) & (t > 1e-6)
    return t[hit].max() if hit.any() else None
def surf_point(phi_deg, yy, inset=0.012):
    d = np.array([np.sin(np.radians(phi_deg)), 0.0, np.cos(np.radians(phi_deg))])
    o = np.array([0.0, yy, AXIS_Z])
    t = ray_far(o, d)
    return None if t is None else o + d * max(t - inset, 0.0)
def smooth_poly(p, it=2):
    p = p.copy()
    for _ in range(it): p[1:-1] = 0.25 * p[:-2] + 0.5 * p[1:-1] + 0.25 * p[2:]
    return p

import trimesh
_TM = trimesh.Trimesh(U, TU, process=False)
_SC = {}
def SECT(yy):
    if yy not in _SC:
        sg_ = trimesh.intersections.mesh_plane(_TM, [0, 1, 0], [0, yy, 0]).reshape(-1, 3)
        _SC[yy] = sg_[np.hypot(sg_[:, 0], sg_[:, 2]) < 0.30]
    return _SC[yy]

chains = []
def add_chain(name, kind, parent, joints, **kw):
    c = dict(name=name, kind=kind, parent=parent, joints=np.asarray(joints, float)); c.update(kw); chains.append(c)

# ------------------------------------------------------------------ hem chains: 8 around the skirt
HEM_ROOT_Y, HEM_TIP_Y, NB_HEM = 0.90, 0.115, 4
SECTORS = [22, 67, 112, 157]
report = collections.OrderedDict(hem=[], veil=[])
for sgn, side in ((1, 'L'), (-1, 'R')):
    for k, sc in enumerate(SECTORS):
        ph = sgn * sc
        ys = np.linspace(HEM_ROOT_Y, HEM_TIP_Y, 9)
        pts = []
        for yy in ys:
            sec = SECT(yy)
            dang = np.abs(((np.degrees(np.arctan2(sec[:, 0], sec[:, 2] - AXIS_Z)) - ph) + 180) % 360 - 180)
            r_ = np.hypot(sec[dang < 10, 0], sec[dang < 10, 2] - AXIS_Z).max() - 0.012
            pts.append(np.r_[np.sin(np.radians(ph)) * r_, yy, AXIS_Z + np.cos(np.radians(ph)) * r_])
        pts = np.array(pts)
        pts = smooth_poly(pts, 2)
        seg = np.linalg.norm(np.diff(pts, axis=0), axis=1); cum = np.r_[0, np.cumsum(seg)]
        tt = np.linspace(0, cum[-1], NB_HEM + 1)
        jts = np.c_[[np.interp(tt, cum, pts[:, j]) for j in range(3)]].T
        nm = 'Hem%s%d' % (side, k)
        add_chain(nm, 'hem', 'Pelvis', jts, side=side, phi=ph)
        report['hem'].append(dict(chain=nm, azimuth=ph, root=np.round(jts[0], 3).tolist(), tip=np.round(jts[-1], 3).tolist()))

# ------------------------------------------------------------------ veil chains: 3 down the back panel, 1 per side
vb_ids = np.where(veil_back_m > 0.5)[0]
VB_ROOT_Y = 1.38
vb_bottom = y[vb_ids].min()
for k, (nm, xc) in enumerate((('VeilB0', 0.13), ('VeilB1', 0.0), ('VeilB2', -0.13))):
    ys = np.linspace(VB_ROOT_Y, vb_bottom + 0.005, 9)
    pts = []
    for yy in ys:
        band = vb_ids[(np.abs(y[vb_ids] - yy) < 0.04) & (np.abs(x[vb_ids] - xc) < 0.06)]
        if len(band) == 0: continue
        pts.append(np.r_[xc, yy, (z[band].min() + z[band].max()) * 0.5])
    pts = smooth_poly(np.array(pts), 2)
    tip_band = vb_ids[np.abs(x[vb_ids] - xc) < 0.06]
    pts[-1, 1] = y[tip_band].min()
    seg = np.linalg.norm(np.diff(pts, axis=0), axis=1); cum = np.r_[0, np.cumsum(seg)]
    tt = np.linspace(0, cum[-1], 5)
    jts = np.c_[[np.interp(tt, cum, pts[:, j]) for j in range(3)]].T
    add_chain(nm, 'veil', 'Spine02', jts, xc=xc)
    report['veil'].append(dict(chain=nm, root=np.round(jts[0], 3).tolist(), tip=np.round(jts[-1], 3).tolist()))
vs_ids = {s: np.where((veil_side_m > 0.5) & (np.sign(x) == sg))[0] for s, sg in (('L', 1), ('R', -1))}
for s, sg in (('L', 1), ('R', -1)):
    ids = vs_ids[s]
    lo = ids[np.argmin(y[ids])]
    root = np.array([sg * 0.095, 1.50, -0.005])
    tip = np.array([x[ids].mean() * 0.4 + x[lo] * 0.6, y[lo], z[ids].mean()])
    jts = np.array([root, (root + tip) / 2, tip])
    add_chain('Veil' + s + '0', 'veil', 'Head', jts, side=s)
    report['veil'].append(dict(chain='Veil' + s + '0', verts=int(len(ids)), root=np.round(root, 3).tolist(), tip=np.round(tip, 3).tolist()))

for ch in chains:
    ch['bones'] = []; par = ch['parent']
    for k in range(len(ch['joints']) - 1):
        bn = '%s_%d' % (ch['name'], k)
        add_bone(bn, par, ch['joints'][k], chain=ch['name']); ch['bones'].append(bn); par = bn
NB = len(bones)

# ------------------------------------------------------------------ weights
Wt = np.zeros((NU, NB))
def tents(s, n):
    c = np.arange(-1, n) + 0.5
    w = np.clip(1 - np.abs(s[:, None] - c[None, :]), 0, 1)
    w[:, 0] = np.where(s < -0.5, 1.0, w[:, 0]); w[:, -1] = np.where(s > n - 0.5, 1.0, w[:, -1])
    return w / w.sum(1, keepdims=True)
def chain_param(c, yy):
    n = len(c['bones']); yr = c['joints'][0][1]; yt = c['joints'][-1][1]
    return tents((yr - yy) / (yr - yt) * n, n)

tor_b = ['Pelvis', 'Waist', 'Spine01', 'Spine02', 'NeckTwist01']
tor_y = [0.93, 1.00, 1.10, 1.24, 1.40]
def height_blend(yy):
    out = np.zeros((len(yy), len(tor_b)))
    for i in range(len(tor_b)):
        lo = tor_y[i - 1] if i > 0 else -1e9; hi = tor_y[i + 1] if i < len(tor_b) - 1 else 1e9; c = tor_y[i]
        up = np.clip((yy - lo) / (c - lo), 0, 1) if i > 0 else np.ones_like(yy)
        dn = np.clip((hi - yy) / (hi - c), 0, 1) if i < len(tor_b) - 1 else np.ones_like(yy)
        out[:, i] = np.minimum(up, dn)
    return out / out.sum(1, keepdims=True)

# --- skirt: ring of hem chains (smooth angular blend between the 8 chains)
hem_ch = [c for c in chains if c['kind'] == 'hem']
anchors = sorted([(c['phi'] % 360, c) for c in hem_ch], key=lambda a: a[0])
ang_w = {c['name']: np.zeros(NU) for c in hem_ch}
ph360 = phi % 360
for i in range(len(anchors)):
    a0, c0 = anchors[i]; a1, c1 = anchors[(i + 1) % len(anchors)]
    span = (a1 - a0) % 360; rel = (ph360 - a0) % 360
    m = rel <= span; t = np.where(m, rel / span, 0); t = t * t * (3 - 2 * t)
    ang_w[c0['name']] += np.where(m, 1 - t, 0); ang_w[c1['name']] += np.where(m, t, 0)
skirt_w = np.zeros((NU, NB))
for c in hem_ch:
    tw = chain_param(c, y)
    skirt_w[:, bidx['Pelvis']] += ang_w[c['name']] * tw[:, 0]
    for k, bn in enumerate(c['bones']):
        skirt_w[:, bidx[bn]] += ang_w[c['name']] * tw[:, k + 1]
sk_m = ss(HEM_ROOT_Y + 0.06, HEM_ROOT_Y - 0.03, y)
hb = height_blend(y)
tor_w = np.zeros((NU, NB))
for i, bn in enumerate(tor_b): tor_w[:, bidx[bn]] = hb[:, i]
lower = skirt_w * sk_m[:, None] + tor_w * (1 - sk_m[:, None])
# soft leg share (front > back) with a wide smooth L/R split
front = ss(-0.6, 0.7, np.cos(np.radians(phi)))
k_leg = ss(HEM_ROOT_Y, 0.25, y) * (0.08 + LEG_FRONT * front)
lr = np.clip(0.5 + x / 0.25, 0, 1)
knee_t = ss(0.55, 0.40, y)
legw = np.zeros((NU, NB))
for side, f in (('L', lr), ('R', 1 - lr)):
    legw[:, bidx[side + '_Thigh']] = k_leg * f * (1 - knee_t)
    legw[:, bidx[side + '_Calf']] = k_leg * f * knee_t
lower = lower * (1 - k_leg)[:, None] + legw
# around the feet the hem rides the calf (the foot kicks the hem forward) so it does not web to the feet
KICK_R = float(os.environ.get('KICK_R', '0'))   # off by default: measured worse (stress test)
for side, sg in ((('L', 1), ('R', -1)) if KICK_R > 0 else ()):
    dA = np.hypot(x - sg * 0.058, z - 0.03)
    t_ = ss(KICK_R, 0.06, dA) * ss(0.26, 0.13, y) * (np.sign(x) == sg)
    kw = np.zeros((NU, NB)); kw[:, bidx[side + '_Calf']] = 1.0
    lower = lower * (1 - t_)[:, None] + kw * t_[:, None]
body_m = np.clip(1 - arm_m - head_m, 0, 1) * (1 - foot_w) * (1 - veil_back_m) * (1 - veil_side_m)
Wt += lower * body_m[:, None]

# --- feet
for side, sg in (('L', 1), ('R', -1)):
    fm = foot_w * (np.sign(x) == sg)
    toe = ss(0.06, 0.10, z)
    ank = ss(0.10, 0.15, y)
    Wt[:, bidx[side + '_ToeBase']] += fm * toe * (1 - ank)
    Wt[:, bidx[side + '_Foot']] += fm * (1 - toe) * (1 - ank)
    Wt[:, bidx[side + '_Calf']] += fm * ank

# --- head and the veil over it
neck_t = ss(1.40, 1.47, y)
hm = head_m * (1 - veil_side_m)
Wt[:, bidx['Head']] += hm * neck_t
Wt[:, bidx['NeckTwist02']] += hm * (1 - neck_t) * 0.4
Wt[:, bidx['NeckTwist01']] += hm * (1 - neck_t) * 0.3
Wt[:, bidx['Spine02']] += hm * (1 - neck_t) * 0.3

# --- veil back panel: Shepard blend of the 3 back chains by x, tents down each chain
vb_ch = [c for c in chains if c['kind'] == 'veil' and c['name'].startswith('VeilB')]
lat = np.stack([1.0 / ((x - c['xc']) ** 2 + 0.03 ** 2) ** 1.5 for c in vb_ch], 1)
lat /= lat.sum(1, keepdims=True)
vbw = np.zeros((NU, NB))
for i, c in enumerate(vb_ch):
    tw = chain_param(c, y)
    vbw[:, bidx['Spine02']] += lat[:, i] * tw[:, 0]
    for k, bn in enumerate(c['bones']): vbw[:, bidx[bn]] += lat[:, i] * tw[:, k + 1]
Wt += vbw * veil_back_m[:, None]

# --- veil side flaps
for s, sg in (('L', 1), ('R', -1)):
    c = [c_ for c_ in chains if c_['name'] == 'Veil%s0' % s][0]
    tw = chain_param(c, y)
    m_ = veil_side_m * (np.sign(x) == sg)
    Wt[:, bidx['Head']] += m_ * tw[:, 0]
    for k, bn in enumerate(c['bones']): Wt[:, bidx[bn]] += m_ * tw[:, k + 1]

# --- arms: envelope along x
for side, sg in (('L', 1), ('R', -1)):
    am = arm_m * ((x * sg) > 0)
    cen = np.array([0.10, 0.295, 0.51, 0.66])
    bn = [side + '_Clavicle', side + '_Upperarm', side + '_Forearm', side + '_Hand']
    wa = np.zeros((NU, 4))
    for i in range(4):
        lo = cen[i - 1] if i > 0 else -1e9; hi = cen[i + 1] if i < 3 else 1e9
        up = np.clip((ax - lo) / (cen[i] - lo), 0, 1) if i > 0 else np.ones(NU)
        dn = np.clip((hi - ax) / (hi - cen[i]), 0, 1) if i < 3 else np.ones(NU)
        wa[:, i] = np.minimum(up, dn)
    wa /= wa.sum(1, keepdims=True)
    sh = ss(0.23, 0.15, ax)
    arm_w = np.zeros((NU, NB))
    for i in range(4): arm_w[:, bidx[bn[i]]] = wa[:, i] * (1 - 0.5 * sh)
    arm_w[:, bidx['Spine02']] += 0.5 * sh
    Wt += arm_w * am[:, None]

z0 = Wt.sum(1) < 1e-6
Wt[z0, bidx['Spine01']] = 1
Wt /= Wt.sum(1, keepdims=True)

# ------------------------------------------------------------------ smooth, prune to 4, normalise
iw = 1.0 / np.maximum(EL, 1e-4)
Lm = sp.coo_matrix((np.r_[iw, iw], (np.r_[E[:, 0], E[:, 1]], np.r_[E[:, 1], E[:, 0]])), shape=(NU, NU)).tocsr()
deg = np.asarray(Lm.sum(1)).ravel(); deg[deg == 0] = 1
Wsm = Wt.copy()
for it in range(6):
    Wsm = 0.5 * Wsm + 0.5 * (Lm @ Wsm) / deg[:, None]
o = np.argsort(-Wsm, 1)[:, :4]
WWu = np.take_along_axis(Wsm, o, 1); WWu[WWu < 0.01] = 0; WWu /= WWu.sum(1, keepdims=True)
JWu = o
print('bones: body', NBODY, '+ cloth', NB - NBODY, '=', NB, '; unassigned', int(z0.sum()), '; foot verts', int(foot_m.sum()),
      '; veil back verts', int((veil_back_m > 0.5).sum()))
print(json.dumps(report))

# debug: region colours (welded verts) on the source pose
if DBG:
    os.makedirs(DBG, exist_ok=True)
    C = np.full((NU, 3), 0.75)
    C[arm_m > 0.5] = (0.9, 0.5, 0.2); C[head_m > 0.5] = (0.3, 0.6, 0.95); C[veil_back_m > 0.5] = (0.2, 0.8, 0.4)
    C[veil_side_m > 0.5] = (0.9, 0.9, 0.2); C[foot_m] = (0.8, 0.2, 0.6)
    debug_mesh(os.path.join(DBG, 'regions.glb'), U, TU, C)
    # dominant bone colours
    rng = np.random.default_rng(3); pal = rng.uniform(0.15, 1.0, (NB, 3))
    Cw = (Wsm[:, :, None] * pal[None]).sum(1)
    debug_mesh(os.path.join(DBG, 'weights.glb'), U, TU, Cw)

# ------------------------------------------------------------------ A-pose bake + export (as rig_export.py)
def normalize(v): return v / np.linalg.norm(v)
def arc(a, c):
    a = normalize(a); c = normalize(c); v = np.cross(a, c); s_ = np.linalg.norm(v)
    if s_ < 1e-9: return np.eye(3)
    k = v / s_; K = np.array([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]]); ang = np.arctan2(s_, a @ c)
    return np.eye(3) + np.sin(ang) * K + (1 - np.cos(ang)) * K @ K
children = {bb['name']: [] for bb in bones}
for bb in bones:
    if bb['parent']: children[bb['parent']].append(bb['name'])
chain_of = {c['name']: c for c in chains}
def tail_T(bb):
    n = bb['name']
    if 'chain' in bb:
        c = chain_of[bb['chain']]; return c['joints'][c['bones'].index(n) + 1]
    if n in LEAF_TIP: return np.array(LEAF_TIP[n])
    if n in PRIMARY and PRIMARY[n] is None: return bb['pos'] + np.array([0, -0.08, 0])
    kid = PRIMARY.get(n) or (children[n][0] if children[n] else None)
    return bones[bidx[kid]]['pos'] if kid else bb['pos'] + np.array([0, 0.08, 0])
def basis_y(d, fwd=np.array([0, 0, 1.0])):
    yv = normalize(d); zr = fwd if abs(yv @ fwd) < 0.95 else np.array([0, 1.0, 0])
    xv = normalize(np.cross(yv, zr)); zv = np.cross(xv, yv)
    return np.c_[xv, yv, zv]
GT = np.zeros((NB, 4, 4))
for i, bb in enumerate(bones):
    GT[i] = np.eye(4)
    GT[i][:3, :3] = np.eye(3) if bb['name'] == 'BoneRoot' else basis_y(tail_T(bb) - bb['pos'])
    GT[i][:3, 3] = bb['pos']
GA = GT.copy()
for side, sg in (('L', 1), ('R', -1)):
    S = bones[bidx[side + '_Upperarm']]['pos']; H = bones[bidx[side + '_Hand']]['pos']
    a, f = np.radians(ARM_DOWN), np.radians(ARM_FWD)
    Rm = arc(H - S, np.array([sg * np.cos(a) * np.cos(f), -np.sin(a), np.cos(a) * np.sin(f)]))
    for n in ('_Upperarm', '_Forearm', '_Hand'):
        i = bidx[side + n]
        GA[i][:3, :3] = Rm @ GT[i][:3, :3]; GA[i][:3, 3] = S + Rm @ (GT[i][:3, 3] - S)
for c in chains: c['joints_A'] = c['joints'].copy()
Mx = np.einsum('bij,bjk->bik', GA, np.linalg.inv(GT))
JW = JWu[inv]; WW = WWu[inv]
Ph = np.c_[P, np.ones(len(P))]
PA = np.zeros_like(P); NA = np.zeros_like(NRM)
for k in range(4):
    m = Mx[JW[:, k]]
    PA += WW[:, k:k + 1] * np.einsum('nij,nj->ni', m, Ph)[:, :3]
    NA += WW[:, k:k + 1] * np.einsum('nij,nj->ni', m[:, :3, :3], NRM)
NA /= np.linalg.norm(NA, axis=1, keepdims=True)
def mat2q(Rn):
    q = np.empty(4); tr = np.trace(Rn)
    if tr > 0:
        s_ = np.sqrt(tr + 1) * 2; q[3] = 0.25 * s_; q[0] = (Rn[2, 1] - Rn[1, 2]) / s_; q[1] = (Rn[0, 2] - Rn[2, 0]) / s_; q[2] = (Rn[1, 0] - Rn[0, 1]) / s_
    else:
        i = np.argmax(np.diag(Rn)); j, k = (i + 1) % 3, (i + 2) % 3
        s_ = np.sqrt(1 + Rn[i, i] - Rn[j, j] - Rn[k, k]) * 2
        q[i] = 0.25 * s_; q[3] = (Rn[k, j] - Rn[j, k]) / s_; q[j] = (Rn[j, i] + Rn[i, j]) / s_; q[k] = (Rn[k, i] + Rn[i, k]) / s_
    return q / np.linalg.norm(q)
w = GW(); nodes = []
for i, bb in enumerate(bones):
    par = bb['parent']
    Lmat = GA[i] if par is None else np.linalg.inv(GA[bidx[par]]) @ GA[i]
    nd = {'name': bb['name'], 'translation': [float(v) for v in Lmat[:3, 3]], 'rotation': [float(v) for v in mat2q(Lmat[:3, :3])]}
    kids = [bidx[c] for c in children[bb['name']]]
    if kids: nd['children'] = kids
    nodes.append(nd)
mesh_node = len(nodes); nodes.append({'name': 'Heroine', 'mesh': 0, 'skin': 0})
arm_node = len(nodes); nodes.append({'name': 'Armature', 'children': [mesh_node, bidx['BoneRoot']]})
ibm = np.linalg.inv(GA).transpose(0, 2, 1).reshape(NB, 16).astype(np.float32)
attrs = {'POSITION': w.acc(PA.astype(np.float32), 5126, 'VEC3', 34962, True),
         'NORMAL': w.acc(NA.astype(np.float32), 5126, 'VEC3', 34962),
         'TEXCOORD_0': w.acc(UV, 5126, 'VEC2', 34962),
         'JOINTS_0': w.acc(JW.astype(np.uint8), 5121, 'VEC4', 34962),
         'WEIGHTS_0': w.acc(WW.astype(np.float32), 5126, 'VEC4', 34962)}
ind = w.acc(I.reshape(-1).astype(np.uint16 if len(P) < 65535 else np.uint32), 5123 if len(P) < 65535 else 5125, 'SCALAR', 34963)
ibm_a = w.acc(ibm, 5126, 'MAT4')
mat = json.loads(json.dumps(js['materials'][0])); mat['name'] = 'heroine_dress'; mat['doubleSided'] = False   # single-sided: double-sided showed dark back faces in the veil's nape slit
imgs, texs = [], []
names = {}
pbr_ = mat['pbrMetallicRoughness']
for slot, nm in (('baseColorTexture', 'heroine_basecolor'), ('metallicRoughnessTexture', 'heroine_metal_rough')):
    if slot in pbr_: names[pbr_[slot]['index']] = nm
if 'normalTexture' in mat: names[mat['normalTexture']['index']] = 'heroine_normal'
for ti, tx in enumerate(js['textures']):
    im = js['images'][tx['source']]; bv = js['bufferViews'][im['bufferView']]
    d = b[bv.get('byteOffset', 0): bv.get('byteOffset', 0) + bv['byteLength']]
    pic = Image.open(io.BytesIO(d)).convert('RGB')
    if max(pic.size) > 1024: pic = pic.resize((1024, 1024), Image.LANCZOS)
    o_ = io.BytesIO(); pic.save(o_, 'JPEG', quality=90, optimize=True)
    imgs.append({'bufferView': w.view(o_.getvalue()), 'mimeType': 'image/jpeg', 'name': names.get(ti, 'heroine_tex%d' % ti)})
    texs.append({'source': ti, 'sampler': 0})
w.js.update({
    'scene': 0, 'scenes': [{'name': 'Scene', 'nodes': [arm_node]}], 'nodes': nodes,
    'meshes': [{'name': 'Heroine', 'primitives': [{'attributes': attrs, 'indices': ind, 'material': 0}]}],
    'skins': [{'name': 'Armature', 'joints': list(range(NB)), 'inverseBindMatrices': ibm_a, 'skeleton': bidx['BoneRoot']}],
    'materials': [mat], 'images': imgs, 'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}], 'textures': texs,
    'extras': {'eidolon_rig': {'bind': 'A-pose', 'units': 'metres', 'height_m': 1.7, 'facing': '+Z', 'arm_down_deg': ARM_DOWN, 'arm_fwd_deg': ARM_FWD,
               'chains': [{'name': c['name'], 'kind': c['kind'], 'parent': c['parent'], 'bones': c['bones'],
                           'tip': [round(float(v), 4) for v in c['joints_A'][-1]]} for c in chains]}},
})
w.save(OUTGLB)
print('wrote', OUTGLB, os.path.getsize(OUTGLB), 'bytes; bones', NB, '; verts', len(P), 'tris', len(I), '; A-pose bounds', PA.min(0).round(3), PA.max(0).round(3))
if DBG:
    np.savez(os.path.join(DBG, 'rig.npz'), U=U, TU=TU, W=Wsm, names=np.array([bb['name'] for bb in bones]), GT=GT, GA=GA, JWu=JWu, WWu=WWu)
