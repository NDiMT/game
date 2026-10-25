"""Quantitative deformation check: pose the original and the new rig the same way (big stride with a
bent knee, arms hanging) by LBS, and measure edge stretch / compression.   python3 stress.py <new.glb>"""
import sys
import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from glb import load, acc, globals_

def rot(axis, ang):
    a = np.asarray(axis, float); a /= np.linalg.norm(a)
    K = np.array([[0, -a[2], a[1]], [a[2], 0, -a[0]], [-a[1], a[0], 0]])
    return np.eye(3) + np.sin(ang) * K + (1 - np.cos(ang)) * K @ K

def arc(a, c):
    a = a / np.linalg.norm(a); c = c / np.linalg.norm(c)
    v = np.cross(a, c)
    if np.linalg.norm(v) < 1e-9: return np.eye(3)
    return rot(v, np.arctan2(np.linalg.norm(v), a @ c))

def analyse(path, label, stride=0.36):
    js, b = load(path)
    sk = js['skins'][0]; J = sk['joints']
    names = [js['nodes'][j]['name'] for j in J]
    G, par = globals_(js)
    IBM = acc(js, b, sk['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
    pr = js['meshes'][0]['primitives'][0]
    P = acc(js, b, pr['attributes']['POSITION']).astype(float)
    JW = acc(js, b, pr['attributes']['JOINTS_0']).astype(int)
    W = acc(js, b, pr['attributes']['WEIGHTS_0']).astype(float)
    I = acc(js, b, pr['indices']).reshape(-1, 3)
    nid = {n: J[i] for i, n in enumerate(names)}
    pos = lambda n: G[nid[n]][:3, 3]
    kids = {}
    for i, n in enumerate(js['nodes']):
        for c in n.get('children', []): kids.setdefault(i, []).append(c)
    def desc(i):
        out = [i]
        for c in kids.get(i, []): out += desc(c)
        return out
    Mpose = {j: np.eye(4) for j in range(len(js['nodes']))}
    def apply(root, R, pivot):
        T = np.eye(4); T[:3, :3] = R; T[:3, 3] = pivot - R @ pivot
        for d in desc(nid[root]): Mpose[d] = T @ Mpose[d]
    apply('L_Thigh', rot([1, 0, 0], -stride), pos('L_Thigh'))
    apply('R_Thigh', rot([1, 0, 0], stride), pos('R_Thigh'))
    kp = Mpose[nid['R_Calf']] @ np.r_[pos('R_Calf'), 1]
    apply('R_Calf', rot([1, 0, 0], 0.5), kp[:3])
    for s, sg in (('L', 1), ('R', -1)):
        d0 = pos(s + '_Forearm') - pos(s + '_Upperarm')
        apply(s + '_Upperarm', arc(d0, np.array([0.24 * sg, -0.95, 0.18])), pos(s + '_Upperarm'))
    Mx = np.array([Mpose[J[k]] @ G[J[k]] @ IBM[k] for k in range(len(J))])
    Ph = np.c_[P, np.ones(len(P))]
    Q = np.zeros_like(P)
    for k in range(4):
        Q += W[:, k:k + 1] * np.einsum('nij,nj->ni', Mx[JW[:, k]], Ph)[:, :3]
    E = np.concatenate([I[:, [0, 1]], I[:, [1, 2]], I[:, [2, 0]]])
    l0 = np.linalg.norm(P[E[:, 0]] - P[E[:, 1]], axis=1); l1 = np.linalg.norm(Q[E[:, 0]] - Q[E[:, 1]], axis=1)
    ok = l0 > 1e-6
    r = l1[ok] / l0[ok]
    mid = (P[E[:, 0]] + P[E[:, 1]])[ok] / 2
    reg = {'skirt (y<0.40)': mid[:, 1] < 0.40, 'shoulders/sleeves': (np.abs(mid[:, 0]) > 0.08) & (mid[:, 1] > 0.45)}
    out = '%-7s' % label
    for k, m in reg.items():
        rr = r[m]
        out += ' | %s: edges >25%% off %.1f%%, >50%% off %.2f%%, max stretch x%.2f' % (k, 100 * (np.abs(rr - 1) > 0.25).mean(), 100 * (np.abs(rr - 1) > 0.5).mean(), rr.max())
    print(out)

analyse(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../assets/models/wanderer.glb'), 'before')
analyse(sys.argv[1], 'after')
