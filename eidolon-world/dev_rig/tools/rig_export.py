"""Stage 2: A-pose bake + GLB export.  python3 rig_export.py <out.glb>
env ARM_DOWN (deg, default 52), ARM_FWD (deg, default 14)"""
import sys, io, os, json, runpy
import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image
from glbw import W as GW

R = runpy.run_path(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'rig_build.py'), run_name='lib')
bones, bidx, chains = R['bones'], R['bidx'], R['chains']
JWu, WWu, inv = R['JWu'], R['WWu'], R['inv']
P, NRM, I, js, b, acc = R['P'], R['NRM'], R['I'], R['js'], R['b'], R['acc']
NB = len(bones)
OUTGLB = sys.argv[1]
ARM_DOWN = float(os.environ.get('ARM_DOWN', '52'))
ARM_FWD = float(os.environ.get('ARM_FWD', '14'))

def normalize(v): return v / np.linalg.norm(v)
def arc(a, c):
    a = normalize(a); c = normalize(c)
    v = np.cross(a, c); s = np.linalg.norm(v)
    if s < 1e-9: return np.eye(3)
    k = v / s; K = np.array([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]])
    ang = np.arctan2(s, a @ c)
    return np.eye(3) + np.sin(ang) * K + (1 - np.cos(ang)) * K @ K

children = {bb['name']: [] for bb in bones}
for bb in bones:
    if bb['parent']: children[bb['parent']].append(bb['name'])
PRIMARY = R['PRIMARY']; LEAF_TIP = R['LEAF_TIP']
chain_of = {c['name']: c for c in chains}

def tail_T(bb):
    n = bb['name']
    if 'chain' in bb:
        c = chain_of[bb['chain']]; return c['joints'][c['bones'].index(n) + 1]
    if n in LEAF_TIP: return np.array(LEAF_TIP[n])
    if n in PRIMARY and PRIMARY[n] is None: return bb['pos'] + np.array([0, -0.05, 0])
    kid = PRIMARY.get(n) or (children[n][0] if children[n] else None)
    return bones[bidx[kid]]['pos'] if kid else bb['pos'] + np.array([0, 0.05, 0])

def basis_y(d, fwd=np.array([0, 0, 1.0])):
    """bone frame: +Y along the bone, Z toward the model's front (Blender-like roll)"""
    yv = normalize(d)
    zr = fwd if abs(yv @ fwd) < 0.95 else np.array([0, 1.0, 0])
    xv = normalize(np.cross(yv, zr)); zv = np.cross(xv, yv)
    return np.c_[xv, yv, zv]

GT = np.zeros((NB, 4, 4))
for i, bb in enumerate(bones):
    GT[i] = np.eye(4)
    GT[i][:3, :3] = np.eye(3) if bb['name'] == 'BoneRoot' else basis_y(tail_T(bb) - bb['pos'])
    GT[i][:3, 3] = bb['pos']

# A-pose: arms rotate about the shoulder; the sleeve chains only TRANSLATE with the arm (so the
# sleeve tatters keep hanging under gravity instead of swinging into the body)
GA = GT.copy()
for side, sg in (('L', 1), ('R', -1)):
    S = bones[bidx[side + '_Upperarm']]['pos']; H = bones[bidx[side + '_Hand']]['pos']
    a, f = np.radians(ARM_DOWN), np.radians(ARM_FWD)
    Rm = arc(H - S, np.array([sg * np.cos(a) * np.cos(f), -np.sin(a), np.cos(a) * np.sin(f)]))
    for n in ('_Upperarm', '_Forearm', '_Hand'):
        i = bidx[side + n]
        GA[i][:3, :3] = Rm @ GT[i][:3, :3]
        GA[i][:3, 3] = S + Rm @ (GT[i][:3, 3] - S)
    for c in chains:
        if c['kind'] == 'sleeve' and c['side'] == side:
            r0 = c['joints'][0]; dlt = S + Rm @ (r0 - S) - r0
            for bn in c['bones']: GA[bidx[bn]][:3, 3] += dlt
            c['joints_A'] = c['joints'] + dlt
for c in chains:
    c.setdefault('joints_A', c['joints'].copy())

# bake the mesh into the A-pose with the new weights (LBS), normals likewise
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

w = GW()
nodes = []
for i, bb in enumerate(bones):
    par = bb['parent']
    L = GA[i] if par is None else np.linalg.inv(GA[bidx[par]]) @ GA[i]
    nd = {'name': bb['name'], 'translation': [float(v) for v in L[:3, 3]], 'rotation': [float(v) for v in mat2q(L[:3, :3])]}
    kids = [bidx[c] for c in children[bb['name']]]
    if kids: nd['children'] = kids
    nodes.append(nd)
mesh_node = len(nodes); nodes.append({'name': 'Wanderer', 'mesh': 0, 'skin': 0})
arm_node = len(nodes); nodes.append({'name': 'Armature', 'children': [mesh_node, bidx['BoneRoot']]})
ibm = np.linalg.inv(GA).transpose(0, 2, 1).reshape(NB, 16).astype(np.float32)
attrs = {
    'POSITION': w.acc(PA.astype(np.float32), 5126, 'VEC3', 34962, True),
    'NORMAL': w.acc(NA.astype(np.float32), 5126, 'VEC3', 34962),
    'TEXCOORD_0': w.acc(acc(js, b, 2).astype(np.float32), 5126, 'VEC2', 34962),
    'JOINTS_0': w.acc(JW.astype(np.uint8), 5121, 'VEC4', 34962),
    'WEIGHTS_0': w.acc(WW.astype(np.float32), 5126, 'VEC4', 34962),
}
ind = w.acc(I.reshape(-1).astype(np.uint16), 5123, 'SCALAR', 34963)
ibm_a = w.acc(ibm, 5126, 'MAT4')
imgs = []
for im in js['images']:
    bv = js['bufferViews'][im['bufferView']]
    d = b[bv.get('byteOffset', 0): bv.get('byteOffset', 0) + bv['byteLength']]
    pic = Image.open(io.BytesIO(d))
    if max(pic.size) > 1024 or im['mimeType'] != 'image/jpeg':
        pic = pic.convert('RGB').resize((1024, 1024), Image.LANCZOS)
        o = io.BytesIO(); pic.save(o, 'JPEG', quality=90, optimize=True); d = o.getvalue()
    nm = im['name'].replace('hooded_cloak_figure_3d_model_metallic-hooded_cloak_figure_3d_model_roughness', 'wanderer_metal_rough').replace('tripo_', 'wanderer_')
    imgs.append({'bufferView': w.view(bytes(d)), 'mimeType': 'image/jpeg', 'name': nm})
mat = json.loads(json.dumps(js['materials'][0])); mat['name'] = 'wanderer_cloak'
w.js.update({
    'scene': 0, 'scenes': [{'name': 'Scene', 'nodes': [arm_node]}], 'nodes': nodes,
    'meshes': [{'name': 'Wanderer', 'primitives': [{'attributes': attrs, 'indices': ind, 'material': 0}]}],
    'skins': [{'name': 'Armature', 'joints': list(range(NB)), 'inverseBindMatrices': ibm_a, 'skeleton': bidx['BoneRoot']}],
    'materials': [mat], 'images': imgs, 'samplers': js['samplers'], 'textures': js['textures'],
    'extras': {'eidolon_rig': {'bind': 'A-pose', 'arm_down_deg': ARM_DOWN, 'arm_fwd_deg': ARM_FWD,
               'chains': [{'name': c['name'], 'kind': c['kind'], 'parent': c['parent'], 'bones': c['bones'],
                           'tip': [round(float(v), 4) for v in c['joints_A'][-1]]} for c in chains]}},
})
w.save(OUTGLB)
print('wrote', OUTGLB, os.path.getsize(OUTGLB), 'bytes; bones', NB, '; A-pose bounds', PA.min(0).round(3), PA.max(0).round(3))
json.dump({'bones': [bb['name'] for bb in bones],
           'chains': [{'name': c['name'], 'kind': c['kind'], 'parent': c['parent'], 'bones': c['bones'],
                       'joints_A': c['joints_A'].round(4).tolist()} for c in chains]},
          open(os.path.splitext(OUTGLB)[0] + '_chains.json' if os.environ.get('CHAINS_JSON') else os.devnull, 'w'), indent=1)
