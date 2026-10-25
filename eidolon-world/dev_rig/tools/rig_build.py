"""EIDOLON wanderer re-rig, stage 1: clean body weights + cloth bone chains (on the T-pose source).
Model space: +y up, faces +z, figure's left = +x. Units: model units (1.0 = figure height).
Used by rig_export.py (runpy); run directly for a summary.
"""
import sys, json, collections
import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import scipy.sparse as sp, scipy.sparse.csgraph as cg
from glb import load, acc, globals_

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../assets/models/wanderer.glb')
OUT = os.path.dirname(os.path.abspath(__file__)) + '/'

def ss(e0, e1, x):
    t = np.clip((np.asarray(x, float) - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)

# ------------------------------------------------------------------ load + weld
js, b = load(SRC)
J0 = js['skins'][0]['joints']
names0 = [js['nodes'][j]['name'] for j in J0]
P = acc(js, b, 0).astype(np.float64)
NRM = acc(js, b, 1).astype(np.float64)
prim = js['meshes'][0]['primitives'][0]
I = acc(js, b, prim['indices']).reshape(-1, 3).astype(np.int64)
JW0 = acc(js, b, 3).astype(np.int64)
W0 = acc(js, b, 4).astype(np.float64)
key = np.round(P / 1e-5).astype(np.int64)
_, wid, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
inv = inv.ravel()
U = P[wid]                     # welded positions (weights are per welded position: no seam splits)
NU = len(U)
TU = inv[I]
E = np.concatenate([TU[:, [0, 1]], TU[:, [1, 2]], TU[:, [2, 0]]])
E = E[E[:, 0] != E[:, 1]]
E = np.unique(np.sort(E, 1), axis=0)
EL = np.linalg.norm(U[E[:, 0]] - U[E[:, 1]], axis=1)
GA = sp.coo_matrix((np.r_[EL, EL], (np.r_[E[:, 0], E[:, 1]], np.r_[E[:, 1], E[:, 0]])), shape=(NU, NU)).tocsr()
ncomp, lab = cg.connected_components(GA, directed=False)
MAIN = np.argmax(np.bincount(lab))
nbrs = [[] for _ in range(NU)]
for a, c in E:
    nbrs[a].append(c); nbrs[c].append(a)
x, y, z = U[:, 0], U[:, 1], U[:, 2]
ax = np.abs(x)
inmain = lab == MAIN
AXIS_Z = 0.08                                   # body axis (x=0, z=AXIS_Z)
phi = np.degrees(np.arctan2(x, z - AXIS_Z))    # azimuth, 0 = front, +90 = figure's left

# the auto-rig's head weights (hood) are usable: fold them to welded verts
orig_head = np.zeros(NU); cnt = np.zeros(NU)
is_head = np.array([any(k in n for k in ['Neck', 'Head', 'Facial', 'Eye']) for n in names0])
for k in range(4):
    np.add.at(orig_head, inv, is_head[JW0[:, k]] * W0[:, k])
np.add.at(cnt, inv, 1)
orig_head /= cnt

# ------------------------------------------------------------------ body skeleton (T-pose joint positions)
def mirror(p): return (-p[0], p[1], p[2])
BODY = [
    ('BoneRoot', None, (0.0, 0.412, 0.084)),
    ('Hip', 'BoneRoot', (0.0, 0.413, 0.085)),
    ('Pelvis', 'Hip', (0.0, 0.434, 0.084)),
    ('L_Thigh', 'Pelvis', (0.055, 0.395, 0.084)),
    ('L_Calf', 'L_Thigh', (0.058, 0.225, 0.092)),
    ('L_Foot', 'L_Calf', (0.060, 0.060, 0.080)),
    ('L_ToeBase', 'L_Foot', (0.060, 0.015, 0.150)),
    ('R_Thigh', 'Pelvis', mirror((0.055, 0.395, 0.084))),
    ('R_Calf', 'R_Thigh', mirror((0.058, 0.225, 0.092))),
    ('R_Foot', 'R_Calf', mirror((0.060, 0.060, 0.080))),
    ('R_ToeBase', 'R_Foot', mirror((0.060, 0.015, 0.150))),
    ('Waist', 'Hip', (0.0, 0.498, 0.088)),
    ('Spine01', 'Waist', (0.0, 0.552, 0.092)),
    ('Spine02', 'Spine01', (0.0, 0.631, 0.084)),
    ('NeckTwist01', 'Spine02', (0.0, 0.744, 0.080)),
    ('NeckTwist02', 'NeckTwist01', (0.0, 0.763, 0.086)),
    ('Head', 'NeckTwist02', (0.0, 0.783, 0.092)),
    ('L_Clavicle', 'Spine02', (0.014, 0.712, 0.076)),
    ('L_Upperarm', 'L_Clavicle', (0.075, 0.728, 0.075)),
    ('L_Forearm', 'L_Upperarm', (0.215, 0.740, 0.073)),
    ('L_Hand', 'L_Forearm', (0.350, 0.742, 0.085)),
    ('R_Clavicle', 'Spine02', mirror((0.014, 0.712, 0.076))),
    ('R_Upperarm', 'R_Clavicle', mirror((0.075, 0.728, 0.075))),
    ('R_Forearm', 'R_Upperarm', mirror((0.215, 0.740, 0.073))),
    ('R_Hand', 'R_Forearm', mirror((0.350, 0.742, 0.085))),
]
LEAF_TIP = {'Head': (0.0, 0.95, 0.09), 'L_Hand': (0.44, 0.742, 0.09), 'R_Hand': (-0.44, 0.742, 0.09),
            'L_ToeBase': (0.06, 0.015, 0.22), 'R_ToeBase': (-0.06, 0.015, 0.22)}
PRIMARY = {'BoneRoot': 'Hip', 'Hip': 'Waist', 'Pelvis': None, 'Spine02': 'NeckTwist01'}

bones = []
bidx = {}
def add_bone(n, parent, pos, **kw):
    bidx[n] = len(bones)
    d = dict(name=n, parent=parent, pos=np.array(pos, float)); d.update(kw)
    bones.append(d)
for n, p, pos in BODY:
    add_bone(n, p, pos)
NBODY = len(bones)

# ------------------------------------------------------------------ regions
head_m = np.where(inmain, np.clip(orig_head * 1.15, 0, 1) * ss(0.70, 0.76, y), 0.0)
head_m = np.where(ax > 0.17, 0.0, head_m)
arm_m = np.maximum(ss(0.085, 0.15, ax) * ss(0.56, 0.66, y), ss(0.19, 0.235, ax) * ss(0.30, 0.36, y))
arm_m = np.where(inmain, arm_m * (1 - head_m), 0.0)
skirt_root_y = 0.40

# ------------------------------------------------------------------ strip finding helpers
def bfs_region(seed, mask):
    seen = {seed}; q = collections.deque([seed])
    while q:
        a = q.popleft()
        for c in nbrs[a]:
            if c not in seen and mask[c]:
                seen.add(c); q.append(c)
    return np.fromiter(seen, int)

def xz_extent(ids):
    p = U[ids][:, [0, 2]]
    if len(p) < 2: return 0.0
    c = p - p.mean(0)
    ev, evec = np.linalg.eigh(c.T @ c)
    proj = c @ evec[:, -1]
    return proj.max() - proj.min()

def strip_profile(t, maxh=0.30, step=0.015, maxw=0.075):
    """grow the region hanging above tip t while it stays narrow (a tatter strip):
    returns the strip length and its medial polyline (centroid of each height band, bottom -> top)"""
    yt = y[t]; L = 0.0; pts = [U[t].copy()]
    for h in np.arange(step, maxh + 1e-9, step):
        reg = bfs_region(t, inmain & (y < yt + h))
        band = reg[y[reg] > yt + h - step * 1.5]
        w = xz_extent(band) if len(band) > 2 else 0.0
        if w > maxw or len(reg) > 400: break
        L = h
        if len(band): pts.append(np.r_[U[band, 0].mean(), yt + h - step * 0.5, U[band, 2].mean()])
    return L, np.array(pts)

tri_main = TU[inmain[TU[:, 0]]]
T0, T1, T2 = U[tri_main[:, 0]], U[tri_main[:, 1]], U[tri_main[:, 2]]
def ray_far(o, d):
    """farthest hit of the ray o + t d (t > 0) on the main component (Moller-Trumbore)"""
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

def surf_point(phi_deg, yy, inset=0.006):
    d = np.array([np.sin(np.radians(phi_deg)), 0.0, np.cos(np.radians(phi_deg))])
    o = np.array([0.0, yy, AXIS_Z])
    t = ray_far(o, d)
    return None if t is None else o + d * max(t - inset, 0.0)

def resample_by_y(poly, ys):
    o = np.argsort(poly[:, 1]); p = poly[o]
    keep = np.r_[True, np.diff(p[:, 1]) > 1e-4]; p = p[keep]
    return np.c_[np.interp(ys, p[:, 1], p[:, 0]), ys, np.interp(ys, p[:, 1], p[:, 2])]

def smooth_poly(p, it=2):
    p = p.copy()
    for _ in range(it):
        p[1:-1] = 0.25 * p[:-2] + 0.5 * p[1:-1] + 0.25 * p[2:]
    return p

def local_minima(mask):
    return np.array([i for i in np.where(mask)[0] if nbrs[i] and all(y[j] > y[i] for j in nbrs[i])])

chains = []
def add_chain(name, kind, parent, joints, **kw):
    c = dict(name=name, kind=kind, parent=parent, joints=np.asarray(joints, float)); c.update(kw)
    chains.append(c)

# ------------------------------------------------------------------ hem chains (8, mostly sides / back)
hem_tips = local_minima(inmain & (y < 0.16) & (arm_m < 0.5))
prof = {t: strip_profile(t) for t in hem_tips}
SECTORS = [25, 68, 112, 155]           # azimuth sector centres per side (0 = front)
NB_HEM = 4
report = collections.OrderedDict(hem=[], sleeve=[], scarf=[])
for sgn in (1, -1):
    for sc in SECTORS:
        c = sgn * sc
        cand = [t for t in hem_tips if abs(((phi[t] - c + 180) % 360) - 180) < 21]
        if not cand: continue
        score = [prof[t][0] + 0.6 * (0.16 - y[t]) for t in cand]      # long strip + low tip
        t = cand[int(np.argmax(score))]
        L, med = prof[t]
        top = med[-1]
        ph_top = np.degrees(np.arctan2(top[0], top[2] - AXIS_Z))
        ups = [p_ for p_ in (surf_point(ph_top, yy) for yy in np.linspace(top[1] + 0.03, skirt_root_y, 6)) if p_ is not None]
        poly = np.vstack([med] + ([np.array(ups)] if ups else []))
        jts = smooth_poly(resample_by_y(poly, np.linspace(skirt_root_y, y[t], NB_HEM + 1)), 1)
        jts[-1] = U[t]
        side = 'L' if c > 0 else 'R'
        nm = 'Hem%s%d' % (side, SECTORS.index(sc))
        add_chain(nm, 'hem', 'Pelvis', jts, side=side)
        report['hem'].append(dict(chain=nm, azimuth=round(float(phi[t]), 1), strip_len=round(float(L), 3), tip=np.round(U[t], 3).tolist()))

# ------------------------------------------------------------------ sleeve chains (2-3 per sleeve)
SLEEVE_ROOT_Y = 0.645
for side, sg in (('L', 1), ('R', -1)):
    tips = local_minima(inmain & (arm_m > 0.6) & (y < 0.60) & (x * sg > 0.2))
    tips = tips[np.argsort(y[tips])]
    picked = []
    for t in tips:
        if all(np.linalg.norm(U[t, [0, 2]] - U[q, [0, 2]]) > 0.04 for q in picked): picked.append(t)
        if len(picked) == 3: break
    picked.sort(key=lambda t: ax[t])
    for k, t in enumerate(picked):
        L, med = strip_profile(t, maxh=0.25, step=0.012, maxw=0.06)
        top = med[-1]
        ups = [np.r_[top[0], yy, top[2]] for yy in np.linspace(top[1] + 0.02, SLEEVE_ROOT_Y, 4) if yy > top[1]]
        poly = np.vstack([med] + ([np.array(ups)] if ups else []))
        jts = smooth_poly(resample_by_y(poly, np.linspace(SLEEVE_ROOT_Y, y[t], 4)), 1)
        jts[-1] = U[t]
        nm = 'Sleeve%s%d' % (side, k)
        add_chain(nm, 'sleeve', side + '_Forearm', jts, side=side)
        report['sleeve'].append(dict(chain=nm, strip_len=round(float(L), 3), tip=np.round(U[t], 3).tolist()))

# ------------------------------------------------------------------ scarf chains (separate mesh pieces)
comp_sizes = np.bincount(lab)
scarf_comps = [c for c in np.argsort(-comp_sizes) if c != MAIN]
def comp_medial(c, n_b):
    """medial curve of a scarf piece: centroids of geodesic-distance bands from its neck end"""
    ids = np.where(lab == c)[0]
    neck = np.array([0.0, 0.79, AXIS_Z])
    r = ids[np.argmin(np.linalg.norm(U[ids] - neck, axis=1))]
    sub = GA[ids][:, ids]
    d = cg.dijkstra(sub, indices=int(np.where(ids == r)[0][0]))
    d[~np.isfinite(d)] = 0
    tip = ids[np.argmax(d)]
    tot = d.max()
    pts = []
    for s0 in np.linspace(0, tot, 14):
        m = np.abs(d - s0) < tot / 14
        if m.any(): pts.append(U[ids[m]].mean(0))
    pts = np.array(pts); pts[0] = U[r]; pts[-1] = U[tip]
    pts = smooth_poly(pts, 2); pts[-1] = U[tip]
    seg = np.linalg.norm(np.diff(pts, axis=0), axis=1); cum = np.r_[0, np.cumsum(seg)]
    tt = np.linspace(0, cum[-1], n_b + 1)
    return np.c_[[np.interp(tt, cum, pts[:, k]) for k in range(3)]].T
right = [c for c in scarf_comps if U[lab == c, 0].mean() < 0]
left = [c for c in scarf_comps if U[lab == c, 0].mean() > 0]
# the long right tail, the second right tail (its torn-off tip and the short strip ride on it), the left tail
SCARF = [('ScarfR0', right[0], 4), ('ScarfR1', right[1], 3), ('ScarfL0', left[0], 4)]
for nm, c, nb_ in SCARF:
    jts = comp_medial(c, nb_)
    add_chain(nm, 'scarf', 'Spine02', jts, comp=int(c))
    L = np.linalg.norm(np.diff(jts, axis=0), axis=1).sum()
    report['scarf'].append(dict(chain=nm, piece_verts=int((lab == c).sum()), length=round(float(L), 3), tip=np.round(jts[-1], 3).tolist()))

for ch in chains:
    n = len(ch['joints']) - 1
    ch['bones'] = []
    par = ch['parent']
    for k in range(n):
        bn = '%s_%d' % (ch['name'], k)
        add_bone(bn, par, ch['joints'][k], chain=ch['name'])
        ch['bones'].append(bn)
        par = bn
NB = len(bones)

# ------------------------------------------------------------------ weights
Wt = np.zeros((NU, NB))
def tents(s, n):
    """1D chain skinning. s in bone units along a chain (0 = root joint).
    Tents centred on the segment middles -> smooth bends; returns (NU, n+1): [parent, b0..b(n-1)]"""
    c = np.arange(-1, n) + 0.5
    w = np.clip(1 - np.abs(s[:, None] - c[None, :]), 0, 1)
    w[:, 0] = np.where(s < -0.5, 1.0, w[:, 0])
    w[:, -1] = np.where(s > n - 0.5, 1.0, w[:, -1])
    return w / w.sum(1, keepdims=True)

tor_b = ['Pelvis', 'Waist', 'Spine01', 'Spine02']
tor_y = [0.43, 0.52, 0.585, 0.67]
def height_blend(yy):
    out = np.zeros((len(yy), len(tor_b)))
    for i in range(len(tor_b)):
        lo = tor_y[i - 1] if i > 0 else -1e9
        hi = tor_y[i + 1] if i < len(tor_b) - 1 else 1e9
        c = tor_y[i]
        up = np.clip((yy - lo) / (c - lo), 0, 1) if i > 0 else np.ones_like(yy)
        dn = np.clip((hi - yy) / (hi - c), 0, 1) if i < len(tor_b) - 1 else np.ones_like(yy)
        out[:, i] = np.minimum(up, dn)
    return out / out.sum(1, keepdims=True)

body_m = np.where(inmain, 1 - head_m - arm_m, 0.0).clip(0, 1)
hb = height_blend(y)
# --- skirt: ring of hem chains (smooth angular blend), Pelvis in the front gap
hem_ch = [c for c in chains if c['kind'] == 'hem']
hem_phi = [float(np.degrees(np.arctan2(c['joints'][1][0], c['joints'][1][2] - AXIS_Z))) for c in hem_ch]
anchors = sorted([(0.0, None)] + list(zip(hem_phi, hem_ch)), key=lambda a: a[0])
ang_w = {c['name']: np.zeros(NU) for c in hem_ch}
none_w = np.zeros(NU)
for i in range(len(anchors)):
    a0, c0 = anchors[i]; a1, c1 = anchors[(i + 1) % len(anchors)]
    span = (a1 - a0) % 360
    rel = (phi - a0) % 360
    m = rel <= span
    t = np.where(m, rel / span, 0)
    t = t * t * (3 - 2 * t)
    for cc, ww in ((c0, 1 - t), (c1, t)):
        wv = np.where(m, ww, 0)
        if cc is None: none_w += wv
        else: ang_w[cc['name']] += wv
skirt_w = np.zeros((NU, NB))
for c in hem_ch:
    n = len(c['bones']); yr = c['joints'][0][1]; yt = c['joints'][-1][1]
    tw = tents((yr - y) / (yr - yt) * n, n)
    skirt_w[:, bidx['Pelvis']] += ang_w[c['name']] * tw[:, 0]
    for k, bn in enumerate(c['bones']):
        skirt_w[:, bidx[bn]] += ang_w[c['name']] * tw[:, k + 1]
skirt_w[:, bidx['Pelvis']] += none_w
sk_m = ss(skirt_root_y + 0.06, skirt_root_y - 0.02, y)
tor_w = np.zeros((NU, NB))
for i, bn in enumerate(tor_b):
    tor_w[:, bidx[bn]] = hb[:, i]
lower = skirt_w * sk_m[:, None] + tor_w * (1 - sk_m[:, None])
# soft leg share (front > back), wide smooth L/R split so nothing tears between the legs
front = ss(-0.6, 0.7, np.cos(np.radians(phi)))
k_leg = ss(skirt_root_y, 0.12, y) * (0.08 + 0.15 * front)
lr = np.clip(0.5 + x / 0.22, 0, 1)
knee_t = ss(0.27, 0.18, y)
legw = np.zeros((NU, NB))
for side, f in (('L', lr), ('R', 1 - lr)):
    legw[:, bidx[side + '_Thigh']] = k_leg * f * (1 - knee_t)
    legw[:, bidx[side + '_Calf']] = k_leg * f * knee_t
lower = lower * (1 - k_leg)[:, None] + legw
Wt += lower * body_m[:, None]

# --- hood / head
neck_t = ss(0.76, 0.81, y)
Wt[:, bidx['Head']] += head_m * neck_t
Wt[:, bidx['NeckTwist01']] += head_m * (1 - neck_t) * 0.5
Wt[:, bidx['Spine02']] += head_m * (1 - neck_t) * 0.5

# --- arms: envelope along the sleeve axis + sleeve chains for the hanging drapes
for side, sg in (('L', 1), ('R', -1)):
    am = arm_m * ((x * sg) > 0)
    cen = np.array([0.03, 0.145, 0.2825, 0.40])
    bn = [side + '_Clavicle', side + '_Upperarm', side + '_Forearm', side + '_Hand']
    wa = np.zeros((NU, 4))
    for i in range(4):
        lo = cen[i - 1] if i > 0 else -1e9; hi = cen[i + 1] if i < 3 else 1e9
        up = np.clip((ax - lo) / (cen[i] - lo), 0, 1) if i > 0 else np.ones(NU)
        dn = np.clip((hi - ax) / (hi - cen[i]), 0, 1) if i < 3 else np.ones(NU)
        wa[:, i] = np.minimum(up, dn)
    wa /= wa.sum(1, keepdims=True)
    sh = ss(0.13, 0.06, ax)                       # shoulder top cloth shares Spine02: no crease
    arm_w = np.zeros((NU, NB))
    for i in range(4):
        arm_w[:, bidx[bn[i]]] = wa[:, i] * (1 - 0.5 * sh)
    arm_w[:, bidx['Spine02']] += 0.5 * sh
    sch = [c for c in chains if c['kind'] == 'sleeve' and c['side'] == side]
    if sch:
        lat = np.zeros((NU, len(sch)))
        for i, c in enumerate(sch):           # Shepard blend by xz distance to each chain at that height
            jj = c['joints'][np.argsort(c['joints'][:, 1])]
            cxp = np.interp(y, jj[:, 1], jj[:, 0]); czp = np.interp(y, jj[:, 1], jj[:, 2])
            lat[:, i] = 1.0 / (((x - cxp) ** 2 + (z - czp) ** 2) + 0.02 ** 2) ** 1.5
        lat /= lat.sum(1, keepdims=True)
        drape = ss(0.68, 0.60, y) * ss(0.22, 0.26, ax)
        dw = np.zeros((NU, NB))
        for i, c in enumerate(sch):
            n = len(c['bones']); yr = c['joints'][0][1]; yt = c['joints'][-1][1]
            tw = tents((yr - y) / (yr - yt) * n, n)
            dw[:, bidx[side + '_Forearm']] += lat[:, i] * tw[:, 0]
            for k, bnm in enumerate(c['bones']):
                dw[:, bidx[bnm]] += lat[:, i] * tw[:, k + 1]
        arm_w = arm_w * (1 - drape)[:, None] + dw * drape[:, None]
    Wt += arm_w * am[:, None]

# --- scarf pieces: own chain, or ride the nearest chain (torn-off tip, short strip)
sch_all = [c for c in chains if c['kind'] == 'scarf']
def poly_param(pts, poly):
    best = np.full(len(pts), np.inf); par = np.zeros(len(pts))
    for k in range(len(poly) - 1):
        a, bb = poly[k], poly[k + 1]; d = bb - a
        t = np.clip(((pts - a) @ d) / (d @ d), 0, 1)
        dist = np.linalg.norm(pts - (a + t[:, None] * d), axis=1)
        m = dist < best; best[m] = dist[m]; par[m] = k + t[m]
    return par, best
scarf_ride = {}
for c in np.unique(lab):
    if c == MAIN: continue
    ids = np.where(lab == c)[0]
    own = [ch for ch in sch_all if ch['comp'] == c]
    if own:
        ch = own[0]; par, _ = poly_param(U[ids], ch['joints'])
    elif np.abs(U[ids, 0].mean()) > 0.28:
        # a torn-off fragment lying inside the sleeve's bell (hidden there in the T-pose): it rides the
        # nearest sleeve strip so it stays tucked behind the sleeve instead of floating free in the A-pose
        sl = [c_ for c_ in chains if c_['kind'] == 'sleeve' and (c_['side'] == 'L') == (U[ids, 0].mean() > 0)]
        ch = min(sl, key=lambda c_: poly_param(U[ids], c_['joints'])[1].mean())
        n = len(ch['bones'])
        tw = tents(np.full(len(ids), n - 0.6), n)
        Wt[ids, bidx[ch['parent']]] += tw[:, 0]
        for k, bnm in enumerate(ch['bones']):
            Wt[ids, bidx[bnm]] += tw[:, k + 1]
        scarf_ride[int(c)] = ch['name']
        continue
    else:
        best = None
        for ch_ in sch_all:
            par_, dist = poly_param(U[ids], ch_['joints'])
            if best is None or dist.mean() < best[2]: best = (ch_, par_, dist.mean())
        ch, par = best[0], best[1]
    scarf_ride[int(c)] = ch['name']
    n = len(ch['bones'])
    tw = tents(par - 0.15, n)
    Wt[ids, bidx['Spine02']] += tw[:, 0]
    for k, bnm in enumerate(ch['bones']):
        Wt[ids, bidx[bnm]] += tw[:, k + 1]

z0 = Wt.sum(1) < 1e-6
Wt[z0, bidx['Spine01']] = 1
Wt /= Wt.sum(1, keepdims=True)

# ------------------------------------------------------------------ smooth (edge-length weighted Laplacian), prune to 4, normalise
iw = 1.0 / np.maximum(EL, 1e-4)
Lm = sp.coo_matrix((np.r_[iw, iw], (np.r_[E[:, 0], E[:, 1]], np.r_[E[:, 1], E[:, 0]])), shape=(NU, NU)).tocsr()
deg = np.asarray(Lm.sum(1)).ravel(); deg[deg == 0] = 1
Wsm = Wt.copy()
for it in range(6):
    Wsm = 0.5 * Wsm + 0.5 * (Lm @ Wsm) / deg[:, None]
Wsm[~inmain] = 0.6 * Wsm[~inmain] + 0.4 * Wt[~inmain]
o = np.argsort(-Wsm, 1)[:, :4]
WWu = np.take_along_axis(Wsm, o, 1)
WWu[WWu < 0.01] = 0
WWu /= WWu.sum(1, keepdims=True)
JWu = o

if __name__ == '__main__':
    print('bones: body', NBODY, '+ cloth', NB - NBODY, '=', NB, ' (source skeleton: %d)' % len(J0))
    print('unassigned', int(z0.sum()), ' scarf pieces ->', scarf_ride)
    print(json.dumps(report, indent=1))
