# Split the Tripo Car1 GLB into body + one wheel mesh (centred on its axle) + anchor positions,
# and export 1024px textures (albedo per colour, shared normal + ORM).
# Output: raw float/int buffers (.bin) + car_meta.json, converted to Godot .res by tools/build_car_meshes.gd
import json, struct, sys, io, os
import numpy as np
from PIL import Image

REF = sys.argv[1]
OUT = sys.argv[2]
os.makedirs(OUT, exist_ok=True)

def load_glb(path):
    d = open(path, 'rb').read()
    jl = struct.unpack('<I', d[12:16])[0]
    j = json.loads(d[20:20 + jl])
    off = 20 + jl
    bl = struct.unpack('<I', d[off:off + 4])[0]
    b = d[off + 8: off + 8 + bl]
    return j, b

def acc(j, b, i):
    a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]
    n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
    dt = {5126: np.float32, 5123: np.uint16, 5125: np.uint32}[a['componentType']]
    o = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    arr = np.frombuffer(b, dtype=dt, count=a['count'] * n, offset=o)
    return arr.reshape(a['count'], n) if n > 1 else arr

def image(j, b, tex_index):
    img = j['images'][j['textures'][tex_index]['source']]
    bv = j['bufferViews'][img['bufferView']]
    o = bv.get('byteOffset', 0)
    return Image.open(io.BytesIO(b[o:o + bv['byteLength']]))

j, b = load_glb(os.path.join(REF, 'Car1_pbr.glb'))
p = j['meshes'][0]['primitives'][0]
P = acc(j, b, p['attributes']['POSITION']).astype(np.float64)
N = acc(j, b, p['attributes']['NORMAL']).astype(np.float64)
UV = acc(j, b, p['attributes']['TEXCOORD_0']).astype(np.float64)
I = acc(j, b, p['indices']).astype(np.int64).reshape(-1, 3)
print('verts', len(P), 'tris', len(I))

# --- connected components over welded positions (UV seams duplicate vertices)
key = np.round(P * 2000).astype(np.int64)
_, weld = np.unique(key, axis=0, return_inverse=True)
weld = weld.ravel()
parent = np.arange(weld.max() + 1)
def find(x):
    r = x
    while parent[r] != r: r = parent[r]
    while parent[x] != r: parent[x], x = r, parent[x]
    return r
for a_, b_, c_ in weld[I]:
    ra, rb, rc = find(a_), find(b_), find(c_)
    parent[rb] = ra; parent[find(rc)] = ra
root = np.array([find(x) for x in range(len(parent))])
tri_comp = root[weld[I[:, 0]]]
comps = np.unique(tri_comp)
print('components', len(comps))

BOXES = {  # wheel boxes (model units), slightly padded
    'FL': ((-0.33, -0.18), (0.17, 0.43)),
    'FR': ((0.18, 0.33), (0.17, 0.43)),
    'RL': ((-0.33, -0.18), (-0.39, -0.14)),
    'RR': ((0.18, 0.33), (-0.39, -0.14)),
}
wheel_tris = {k: [] for k in BOXES}
for c in comps:
    t = np.where(tri_comp == c)[0]
    v = P[I[t].ravel()]
    mn, mx = v.min(0), v.max(0)
    if mx[1] > 0.26: continue
    for k, ((x0, x1), (z0, z1)) in BOXES.items():
        if mn[0] >= x0 and mx[0] <= x1 and mn[2] >= z0 and mx[2] <= z1:
            wheel_tris[k].extend(t.tolist())
for k in BOXES: print(k, 'tris', len(wheel_tris[k]))
assert all(len(v) > 300 for v in wheel_tris.values()), 'wheel split failed'

used = np.zeros(len(I), bool)
anchors = {}
for k, t in wheel_tris.items():
    used[t] = True
    v = P[I[t].ravel()]
    mn, mx = v.min(0), v.max(0)
    anchors[k] = [float((mn[0] + mx[0]) / 2), float((mn[1] + mx[1]) / 2), float((mn[2] + mx[2]) / 2)]
    anchors[k + '_size'] = [float(x) for x in (mx - mn)]
print(json.dumps(anchors, indent=1))

def write_mesh(name, tris, centre=np.zeros(3)):
    sub = I[tris]
    vids, inv = np.unique(sub.ravel(), return_inverse=True)
    pos = (P[vids] - centre).astype(np.float32)
    nrm = N[vids].astype(np.float32)
    uv = UV[vids].astype(np.float32)
    idx = inv.reshape(-1, 3).astype(np.int32)
    with open(os.path.join(OUT, name + '.bin'), 'wb') as f:
        f.write(struct.pack('<ii', len(vids), len(idx) * 3))
        f.write(pos.tobytes()); f.write(nrm.tobytes()); f.write(uv.tobytes()); f.write(idx.tobytes())
    print(name, len(vids), 'verts', len(idx), 'tris')

write_mesh('car1_body', np.where(~used)[0])
# one wheel: the front-left one, centred on its axle (axle = X axis). Right side reuses it rotated 180deg about Y.
c = np.array(anchors['FL'])
write_mesh('car1_wheel', np.array(wheel_tris['FL']), c)
r = max(anchors['FL_size'][1], anchors['FL_size'][2]) / 2
meta = {'anchors': {k: anchors[k] for k in BOXES}, 'wheel_radius': r, 'wheel_width': anchors['FL_size'][0],
        'bounds_min': P.min(0).tolist(), 'bounds_max': P.max(0).tolist()}
json.dump(meta, open(os.path.join(OUT, 'car1_meta.json'), 'w'), indent=1)

# --- textures (1024): albedo per colour, normal shared, ORM (R=AO 1, G=rough, B=metal) shared
S = 1024
image(j, b, j['materials'][0]['normalTexture']['index']).convert('RGB').resize((S, S), Image.LANCZOS).save(os.path.join(OUT, 'car1_normal.jpg'), quality=90)
mr = np.array(image(j, b, j['materials'][0]['pbrMetallicRoughness']['metallicRoughnessTexture']['index']).convert('RGB').resize((S, S), Image.LANCZOS))
mr[:, :, 0] = 255
Image.fromarray(mr).save(os.path.join(OUT, 'car1_orm.jpg'), quality=90)
for col, fn in [('original', 'Car1_pbr.glb'), ('yellow', 'Car1_yellow.glb'), ('red', 'Car1_red.glb'), ('blue', 'Car1_blue.glb'), ('teal', 'Car1_teal.glb'),
                ('purple', 'Car1_purple.glb'), ('white', 'Car1_white.glb'), ('black', 'Car1_black.glb'), ('green', 'Car1_green.glb')]:
    jj, bb = load_glb(os.path.join(REF, fn))
    im = image(jj, bb, jj['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['index']).convert('RGB')
    im.resize((S, S), Image.LANCZOS).save(os.path.join(OUT, 'car1_albedo_%s.jpg' % col), quality=88)
    print('albedo', col, im.size)
