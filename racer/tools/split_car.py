# Split a Tripo car GLB (single mesh, wheels = separate connected components) into:
#   <name>_body.bin, <name>_wheel_front.bin, <name>_wheel_rear.bin  (raw buffers -> tools/build_car_meshes.gd -> .res)
#   <name>_meta.json  (wheel anchors = axle centres, radius)
#   <name>_albedo_<colour>.jpg (1024) per colour variant, shared <name>_normal.jpg + <name>_orm.jpg
# Wheels are centred on their axle (tread centre, so hub/axle stubs don't skew it). The kept
# front/rear wheels are the x<0 ones; the x>0 side reuses them rotated 180 deg about Y.
#
# python3 split_car.py <src.glb> <variants_dir> <variant_prefix> <out_assets_dir> <bin_dir> <name>
import json, struct, sys, io, os, glob
import numpy as np
from PIL import Image

SRC, VAR_DIR, VAR_PREFIX, OUT, BIN, NAME = sys.argv[1:7]
os.makedirs(OUT, exist_ok=True); os.makedirs(BIN, exist_ok=True)

def load_glb(path):
    d = open(path, 'rb').read()
    jl = struct.unpack('<I', d[12:16])[0]
    j = json.loads(d[20:20 + jl])
    off = 20 + jl
    bl = struct.unpack('<I', d[off:off + 4])[0]
    return j, d[off + 8: off + 8 + bl]

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

j, b = load_glb(SRC)
p = j['meshes'][0]['primitives'][0]
P = acc(j, b, p['attributes']['POSITION']).astype(np.float64)
N = acc(j, b, p['attributes']['NORMAL']).astype(np.float64)
UV = acc(j, b, p['attributes']['TEXCOORD_0']).astype(np.float64)
I = acc(j, b, p['indices']).astype(np.int64).reshape(-1, 3)
print('verts', len(P), 'tris', len(I), 'bounds', P.min(0).round(3), P.max(0).round(3))

# connected components over welded positions (UV seams duplicate vertices)
_, weld = np.unique(np.round(P * 2000).astype(np.int64), axis=0, return_inverse=True)
weld = weld.ravel()
parent = np.arange(weld.max() + 1)
def find(x):
    r = x
    while parent[r] != r: r = parent[r]
    while parent[x] != r: parent[x], x = r, parent[x]
    return r
for a_, b_, c_ in weld[I]:
    ra = find(a_); parent[find(b_)] = ra; parent[find(c_)] = ra
root = np.array([find(x) for x in range(len(parent))])
tri_comp = root[weld[I[:, 0]]]

# wheels: big components touching the ground (min y ~ 0), one per quadrant
wheels = {}
for c in np.unique(tri_comp):
    t = np.where(tri_comp == c)[0]
    v = P[I[t].ravel()]
    mn, mx = v.min(0), v.max(0)
    if len(t) < 300 or mn[1] > 0.02 or mx[1] > 0.3: continue
    key = ('F' if (mn[2] + mx[2]) > 0 else 'R') + ('L' if (mn[0] + mx[0]) < 0 else 'R')
    if key not in wheels or len(t) > len(wheels[key]): wheels[key] = t
assert sorted(wheels) == ['FL', 'FR', 'RL', 'RR'], wheels.keys()

anchors, radius = {}, {}
for k, t in wheels.items():
    v = P[np.unique(I[t].ravel())]
    cy = (v[:, 1].min() + v[:, 1].max()) / 2; cz = (v[:, 2].min() + v[:, 2].max()) / 2
    r = max(v[:, 1].max() - v[:, 1].min(), v[:, 2].max() - v[:, 2].min()) / 2
    tread = v[np.hypot(v[:, 1] - cy, v[:, 2] - cz) > r * 0.85]   # outer ring = tyre tread
    cx = (tread[:, 0].min() + tread[:, 0].max()) / 2
    anchors[k] = [float(cx), float(cy), float(cz)]
    radius[k] = float(r)
    print(k, len(t), 'tris anchor', np.round(anchors[k], 4), 'r', round(r, 4), 'tread width', round(float(np.ptp(tread[:, 0])), 3))

def write_mesh(name, tris, centre=np.zeros(3)):
    sub = I[tris]
    vids, inv = np.unique(sub.ravel(), return_inverse=True)
    with open(os.path.join(BIN, name + '.bin'), 'wb') as f:
        f.write(struct.pack('<ii', len(vids), len(sub) * 3))
        f.write((P[vids] - centre).astype(np.float32).tobytes())
        f.write(N[vids].astype(np.float32).tobytes())
        f.write(UV[vids].astype(np.float32).tobytes())
        f.write(inv.reshape(-1).astype(np.int32).tobytes())
    print(name, len(vids), 'verts', len(sub), 'tris')

used = np.zeros(len(I), bool)
for t in wheels.values(): used[t] = True

# roof launcher: everything sitting on the roof rack between the tubes (so it can recoil on its own)
launcher = []
tubes = []
for c in np.unique(tri_comp):
    t = np.where(tri_comp == c)[0]
    v = P[I[t].ravel()]
    mn, mx = v.min(0), v.max(0)
    if mn[1] >= 0.465 and abs((mn[0] + mx[0]) / 2) < 0.14 and mn[2] > -0.34 and mx[2] < 0.04:
        launcher.extend(t.tolist())
        if len(t) > 200:
            front = v[v[:, 2] > mx[2] - 0.03]   # mouth = centre of the front-most slice of the tube
            tubes.append([float((front[:, 0].min() + front[:, 0].max()) / 2), float((front[:, 1].min() + front[:, 1].max()) / 2), float(mx[2])])
launcher = np.array(launcher)
used[launcher] = True
lv = P[I[launcher].ravel()]
pivot = np.array([0.0, lv[:, 1].min(), (lv[:, 2].min() + lv[:, 2].max()) / 2])
muzzles = sorted(tubes)
print('launcher', len(launcher), 'tris pivot', pivot.round(3), 'muzzles', np.round(muzzles, 3))
write_mesh(NAME + '_launcher', launcher, pivot)
write_mesh(NAME + '_body', np.where(~used)[0])
write_mesh(NAME + '_wheel_front', wheels['FL'], np.array(anchors['FL']))
write_mesh(NAME + '_wheel_rear', wheels['RL'], np.array(anchors['RL']))
json.dump({'launcher_pivot': pivot.tolist(), 'muzzles': muzzles, 'anchors': anchors, 'radius_front': radius['FL'], 'radius_rear': radius['RL'],
           'bounds_min': P.min(0).tolist(), 'bounds_max': P.max(0).tolist()},
          open(os.path.join(OUT, NAME + '_meta.json'), 'w'), indent=1)

S = 1024
mat = j['materials'][0]
image(j, b, mat['normalTexture']['index']).convert('RGB').resize((S, S), Image.LANCZOS).save(os.path.join(OUT, NAME + '_normal.jpg'), quality=90)
mr = np.array(image(j, b, mat['pbrMetallicRoughness']['metallicRoughnessTexture']['index']).convert('RGB').resize((S, S), Image.LANCZOS))
mr[:, :, 0] = 255  # ORM: R = AO (none), G = roughness, B = metallic
Image.fromarray(mr).save(os.path.join(OUT, NAME + '_orm.jpg'), quality=90)
for fn in sorted(glob.glob(os.path.join(VAR_DIR, VAR_PREFIX + '*.glb'))):
    col = os.path.basename(fn)[len(VAR_PREFIX):-4]
    jj, bb = load_glb(fn)
    assert jj['accessors'][0]['count'] == len(P), 'variant mesh differs: ' + fn
    im = image(jj, bb, jj['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['index']).convert('RGB')
    im.resize((S, S), Image.LANCZOS).save(os.path.join(OUT, '%s_albedo_%s.jpg' % (NAME, col)), quality=88)
    print('albedo', col)
