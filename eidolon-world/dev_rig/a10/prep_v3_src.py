"""EIDOLON a10 (Agent A): the v3 heroine's rig source from the raw Tripo mesh (task 685c8a46, v3.1 smart low-poly,
built for animation: A-pose ~45 deg, bare arms apart from the body, real legs to the hips under a separate skirt shell,
a short hood).
  python3.11 dev_rig/a10/prep_v3_src.py [--src dev_rig/tools/heroine_v3_tripo.glb] [--out assets/models/heroine_v3_src.glb]
- turned to face -Y (Blender; the Tripo GLB faces +X), centred, feet on z = 0, scaled to 1.70 m (her rig's UNIT);
- COLOR_0.r = her bare skin (arms, hands, legs, feet, face, chest above the neckline) from the albedo's warm texels;
- no images in the GLB (the game loads assets/models/heroine_v3_basecolor.jpg / heroine_v3_normal.jpg, written here)."""
import bpy, sys, os, argparse, json, struct, io
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
ap = argparse.ArgumentParser()
ap.add_argument('--src', default=os.path.join(ROOT, 'dev_rig/tools/heroine_v3_tripo.glb'))
ap.add_argument('--out', default=os.path.join(ROOT, 'assets/models/heroine_v3_src.glb'))
ap.add_argument('--tex', type=int, default=1024)
args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=args.src)
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
ob = bpy.context.active_object
for o in list(bpy.data.objects):
    if o is not ob:
        mw = ob.matrix_world.copy()
        if ob.parent is o:
            ob.parent = None; ob.matrix_world = mw
        bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
me = ob.data
co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
if np.ptp(co[:, 1]) > np.ptp(co[:, 0]):          # facing +x: turn -90 deg about z (x -> -y)
    co = co[:, [1, 0, 2]] * [1, -1, 1]
co = co - [0.5 * (co[:, 0].max() + co[:, 0].min()), 0.5 * (co[:, 1].max() + co[:, 1].min()), co[:, 2].min()]
co *= 1.70 / co[:, 2].max()
me.vertices.foreach_set('co', co.ravel()); me.update()
ob.name = 'Heroine'; me.name = 'Heroine'

# her skin: the albedo's warm, saturated texels (Tripo paints the bare skin flesh-toned, the cloth neutral grey)
bc = None
for n in me.materials[0].node_tree.nodes:
    if n.type == 'TEX_IMAGE' and any(l.to_socket.name == 'Base Color' for l in n.outputs[0].links):
        bc = n.image
W, H = bc.size
px = np.empty(W * H * 4, np.float32); bc.pixels.foreach_get(px); px = px.reshape(H, W, 4)[:, :, :3]
uv = np.empty(len(me.loops) * 2); me.uv_layers[0].data.foreach_get('uv', uv); uv = uv.reshape(-1, 2)
lv = np.empty(len(me.loops), np.int64); me.loops.foreach_get('vertex_index', lv)
c = px[np.clip((uv[:, 1] * H).astype(int), 0, H - 1), np.clip((uv[:, 0] * W).astype(int), 0, W - 1)] ** (1 / 2.2)
sat = c.max(1) - c.min(1)
skin_l = ((sat > 0.10) & (c[:, 0] > c[:, 2] + 0.02)).astype(float)
skin = np.zeros(len(co)); cnt = np.zeros(len(co))
np.add.at(skin, lv, skin_l); np.add.at(cnt, lv, 1)
skin = (skin / np.maximum(cnt, 1) > 0.5).astype(float)
# (one ring of smoothing on the welded surface: no lone flecks)
import scipy.spatial as sps, scipy.sparse as sp, scipy.sparse.csgraph as cg
pr = sps.cKDTree(co).query_pairs(1e-5, output_type='ndarray')
nc, lab = cg.connected_components(sp.coo_matrix((np.ones(len(pr)), (pr[:, 0], pr[:, 1])), shape=(len(co),) * 2), directed=False)
su = np.zeros(nc); np.maximum.at(su, lab, skin)
me.calc_loop_triangles()
tri = np.empty(len(me.loop_triangles) * 3, np.int64); me.loop_triangles.foreach_get('vertices', tri); tu = lab[tri.reshape(-1, 3)]
E = np.r_[tu[:, [0, 1]], tu[:, [1, 2]], tu[:, [2, 0]]]
A = sp.coo_matrix((np.ones(len(E)), (E[:, 0], E[:, 1])), shape=(nc, nc)).tocsr(); A = ((A + A.T) > 0).astype(float)
deg = np.asarray(A.sum(1)).ravel()
nb = (A @ su) / np.maximum(deg, 1)
su = np.where(nb > 0.75, 1.0, np.where(nb < 0.25, 0.0, su))
skin = su[lab]
if 'Color' in me.color_attributes:
    me.color_attributes.remove(me.color_attributes['Color'])
ca = me.color_attributes.new('Color', 'FLOAT_COLOR', 'POINT')
col = np.c_[skin, np.zeros(len(co)), np.zeros(len(co)), np.ones(len(co))]
ca.data.foreach_set('color', col.ravel())
me.color_attributes.active_color = ca
print('verts', len(co), 'welded', nc, 'tris', len(tri) // 3, 'skin verts', int(skin.sum()))

bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=args.out, export_format='GLB', use_selection=True, export_image_format='NONE',
                          export_vertex_color='ACTIVE', export_yup=True, export_apply=True)
print('wrote', args.out, os.path.getsize(args.out) // 1024, 'KB')

# her maps, from the raw GLB's own images (albedo + OpenGL normal), at args.tex px
from PIL import Image
raw = open(args.src, 'rb').read()
jl = struct.unpack('<I', raw[12:16])[0]
gj = json.loads(raw[20:20 + jl])
bin0 = 20 + jl + 8
mat = gj['materials'][0]
def img_bytes(tex_i):
    im = gj['images'][gj['textures'][tex_i]['source']]
    bv = gj['bufferViews'][im['bufferView']]
    return raw[bin0 + bv.get('byteOffset', 0): bin0 + bv.get('byteOffset', 0) + bv['byteLength']]
for key, ti in (('basecolor', mat['pbrMetallicRoughness']['baseColorTexture']['index']), ('normal', mat['normalTexture']['index'])):
    im = Image.open(io.BytesIO(img_bytes(ti))).convert('RGB')
    if key == 'basecolor':
        # (her atlas is many small islands: at the mip levels the game samples, the dark texels - the hair under the
        # hood, a few deep creases - bleed into the skirt's islands as black flecks. They are lifted to the cloth grey.)
        a = np.asarray(im).astype(np.float32) / 255.0
        lum = a @ np.array([0.3, 0.59, 0.11], np.float32)
        k = np.clip((lum - 0.25) / (0.45 - 0.25), 0, 1); k = (k * k * (3 - 2 * k))[:, :, None]
        a = a * k + np.array([0.60, 0.60, 0.62], np.float32) * (1 - k)
        im = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
    im = im.resize((args.tex, args.tex), Image.LANCZOS)
    p = os.path.join(ROOT, 'assets/models/heroine_v3_%s.jpg' % key)
    im.save(p, quality=90)
    print('wrote', p, os.path.getsize(p) // 1024, 'KB')
