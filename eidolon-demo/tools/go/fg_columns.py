"""Two broken fluted marble columns before the eye, blurred, for the fifth level (goguard/col_l.png, col_r.png; the
owner, 22/11: "can we have blurred columns at the front of the screen?"). Our own columns, as the far island's: a few
drums each, fluted, the last broken off in a jagged break; seen from the game's eye (yaw 45, pitch 35 down), lit from
behind at the upper right as the level's low sun, each alone on a transparent ground; then darkened toward the rocks
before the eye and blurred.

usage: python3.11 -I tools/go/fg_columns.py -- <raw dir>            (Blender: col_l.png, col_r.png as rendered)
       python3 -I tools/go/fg_columns.py soften <raw dir> <out dir> (darkened and blurred, cropped: col_l.png, col_r.png)
"""
import sys, math, random


def render(out_dir):
    import bpy, bmesh
    from mathutils import Vector, Matrix
    rnd = random.Random(5)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 48; sc.cycles.device = 'CPU'
    sc.render.film_transparent = True; sc.render.resolution_percentage = 100
    sc.view_settings.view_transform = 'Standard'
    world = bpy.data.worlds.new('w'); sc.world = world; world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (0.78, 0.72, 0.86, 1.0); world.node_tree.nodes['Background'].inputs[1].default_value = 0.55
    mat = bpy.data.materials.new('marble'); mat.use_nodes = True
    bsdf = mat.node_tree.nodes['Principled BSDF']; bsdf.inputs['Base Color'].default_value = (0.86, 0.82, 0.88, 1.0); bsdf.inputs['Roughness'].default_value = 0.85

    def flutes(r, n=40):
        return [(math.cos(2 * math.pi * k / n) * (r if k % 2 == 0 else r * 0.84), math.sin(2 * math.pi * k / n) * (r if k % 2 == 0 else r * 0.84)) for k in range(n)]

    def drum(bm, r, z0, z1, rot, dx=0.0, dy=0.0):
        pts = flutes(r); a = rot
        lo = [bm.verts.new((x * math.cos(a) - y * math.sin(a) + dx, x * math.sin(a) + y * math.cos(a) + dy, z0)) for (x, y) in pts]
        hi = [bm.verts.new((x * math.cos(a) - y * math.sin(a) + dx, x * math.sin(a) + y * math.cos(a) + dy, z1)) for (x, y) in pts]
        n = len(pts)
        for i in range(n):
            bm.faces.new((lo[i], lo[(i + 1) % n], hi[(i + 1) % n], hi[i]))
        bm.faces.new(list(reversed(lo))); bm.faces.new(hi)

    def column(name, r, drums, lean=(0.0, 0.0), chips=0):
        bm = bmesh.new(); z = 0.0
        for k, h in enumerate(drums):
            drum(bm, r * (1.0 - 0.012 * k), z + (0.012 if k else 0.0), z + h, rnd.uniform(-0.06, 0.06), rnd.uniform(-0.02, 0.02), rnd.uniform(-0.02, 0.02)); z += h
        top = z
        for j, (d_, k_) in enumerate(((0.35, 0.9), (0.75, 0.6), (1.1, 0.45))):      # (its last drum broken off aslant, in a jagged break: a few planes)
            aa = rnd.uniform(0, 2 * math.pi)
            nrm = Vector((math.cos(aa) * k_, math.sin(aa) * k_, 1.0)).normalized()
            bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(math.cos(aa) * r * 0.3, math.sin(aa) * r * 0.3, top - r * d_), plane_no=nrm, clear_outer=True)
            bmesh.ops.holes_fill(bm, edges=bm.edges[:], sides=0)
        for _ in range(chips):      # (a few chips off its edges)
            aa = rnd.uniform(0, 2 * math.pi); zz = rnd.uniform(0.15, 0.9) * top
            nn = Vector((math.cos(aa), math.sin(aa), rnd.uniform(-0.6, 0.6))).normalized()
            bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=Vector((math.cos(aa) * r * 0.93, math.sin(aa) * r * 0.93, zz)), plane_no=nn, clear_outer=True)
            bmesh.ops.holes_fill(bm, edges=bm.edges[:], sides=0)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
        for p in me.polygons: p.use_smooth = False
        ob = bpy.data.objects.new(name, me); sc.collection.objects.link(ob); ob.data.materials.append(mat)
        ob.rotation_euler = (lean[0], lean[1], 0.0)
        return ob, top

    sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 3.2; sun.angle = math.radians(6)
    so = bpy.data.objects.new('sun', sun); sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(58), 0.0, math.radians(105))      # (from the right of the picture and a little behind: the flutes and the round of each read even blurred; from behind they were flat)
    cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'
    co = bpy.data.objects.new('cam', cam); sc.collection.objects.link(co); sc.camera = co
    co.rotation_euler = (math.radians(55), 0.0, math.radians(45))      # (the game's eye: 35 degrees down, along the diagonal)
    fwd = co.rotation_euler.to_matrix() @ Vector((0, 0, -1))

    def shot(ob, top, name, w, h, scale):
        for o in sc.objects:
            if o.type == 'MESH': o.hide_render = (o != ob)
        c = Vector((0, 0, top * 0.5)); co.location = c - fwd * 40.0
        cam.ortho_scale = scale; sc.render.resolution_x = w; sc.render.resolution_y = h
        sc.render.filepath = out_dir + '/' + name + '.png'; bpy.ops.render.render(write_still=True)

    L, tl = column('colL', 1.0, [1.7, 1.6, 1.7, 1.5], lean=(math.radians(-2.5), math.radians(1.5)))
    R, tr = column('colR', 0.95, [1.6, 1.4, 1.3], lean=(math.radians(2.0), math.radians(-3.0)))
    L.location = (0, 0, -1.0); R.location = (0, 0, -1.0)
    shot(L, tl, 'col_l', 520, 1300, 9.2)
    shot(R, tr, 'col_r', 560, 1100, 8.2)
    print('DONE')



def soften(raw, out):
    from PIL import Image, ImageFilter
    import numpy as np
    for f, w2 in (('col_l.png', 380), ('col_r.png', 350)):      # (twice the size they are drawn at, 720 wide)
        a = np.asarray(Image.open(raw + '/' + f).convert('RGBA')).astype(np.float32) / 255.0
        ys, xs = np.where(a[..., 3] > 0.08); a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        k = w2 / a.shape[1]; blur2 = 14; pad = blur2 * 3
        a = np.asarray(Image.fromarray((a * 255).astype(np.uint8), 'RGBA').resize((w2, int(a.shape[0] * k)), Image.LANCZOS)).astype(np.float32) / 255.0
        rgb = a[..., :3] * np.array((0.6, 0.54, 0.64)); al = a[..., 3:4]      # (darker, toward the plum of the rocks before the eye, still marble)
        pm = np.concatenate([rgb * al, al], 2); H, W = pm.shape[:2]
        big = np.zeros((H + 2 * pad, W + 2 * pad, 4), np.float32); big[pad:pad + H, pad:pad + W] = pm
        p = np.asarray(Image.fromarray((np.clip(big, 0, 1) * 255).astype(np.uint8), 'RGBA').filter(ImageFilter.GaussianBlur(blur2))).astype(np.float32) / 255.0
        al2 = p[..., 3:4]; rgb2 = np.where(al2 > 1e-3, p[..., :3] / np.maximum(al2, 1e-3), 0)      # (blurred premultiplied: no dark fringe)
        Image.fromarray((np.clip(np.concatenate([rgb2, al2], 2), 0, 1) * 255).astype(np.uint8), 'RGBA').save(out + '/' + f)
        print(f, 'size', W + 2 * pad, H + 2 * pad)


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'soften': soften(sys.argv[2], sys.argv[3])
    else: render(sys.argv[sys.argv.index('--') + 1])
