"""EIDOLON a10 (Agent A): contact sheet of Tripo heroine candidates (front / side / back / wireframe, red pole = 1.8 m).
Each candidate is scaled to 1.70 m (as her rig source is), feet on the floor, centred.
  python3.11 dev_rig/a10/render_candidates.py --out sheet.png --cand label1=a.glb label2=b.glb ...
Also prints per-candidate numbers: tris, arm angle below horizontal, armpit gap, hem height above the floor."""
import bpy, sys, os, math, argparse, tempfile
import numpy as np
from mathutils import Vector, Matrix

ap = argparse.ArgumentParser()
ap.add_argument('--out', required=True)
ap.add_argument('--cand', nargs='+', required=True)
ap.add_argument('--res', type=int, default=300)
ap.add_argument('--samples', type=int, default=24)
args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:])


def setup_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = args.samples
    sc.cycles.use_denoising = False
    sc.render.resolution_x = args.res
    sc.render.resolution_y = int(args.res * 1.35)
    sc.render.film_transparent = False
    w = bpy.data.worlds.new('w'); sc.world = w
    w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (0.30, 0.30, 0.33, 1)
    w.node_tree.nodes['Background'].inputs[1].default_value = 0.9
    sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 3.0
    so = bpy.data.objects.new('sun', sun); sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(50), 0, math.radians(30))
    bpy.ops.mesh.primitive_plane_add(size=20)
    fl = bpy.context.active_object
    m = bpy.data.materials.new('floor'); m.use_nodes = True
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.25, 0.25, 0.27, 1)
    fl.data.materials.append(m)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.02, depth=1.8, location=(-0.68, 0.35, 0.9))
    pole = bpy.context.active_object
    pm = bpy.data.materials.new('pole'); pm.use_nodes = True
    pm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.8, 0.15, 0.08, 1)
    pole.data.materials.append(pm)
    cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'; cam.ortho_scale = 2.0
    co = bpy.data.objects.new('cam', cam); sc.collection.objects.link(co); sc.camera = co
    return co, pole


def load(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == 'MESH']
    for o in new:
        if o.type != 'MESH':
            o.select_set(False)
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    ob = bpy.context.active_object
    for o in new:
        if o is not ob and o.name in bpy.data.objects:
            if o.type != 'MESH':
                mw = ob.matrix_world.copy(); ob.parent = None; ob.matrix_world = mw
                bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    me = ob.data
    co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
    if np.ptp(co[:, 1]) > np.ptp(co[:, 0]):        # (Tripo's v3.1 GLBs face +x here: turned to face -y, her left +x)
        co = co[:, [1, 0, 2]] * [1, -1, 1]
    h = co[:, 2].max() - co[:, 2].min()
    s = 1.70 / h
    co = (co - [0.5 * (co[:, 0].max() + co[:, 0].min()), 0.5 * (co[:, 1].max() + co[:, 1].min()), co[:, 2].min()]) * s
    me.vertices.foreach_set('co', co.ravel()); me.update()
    me.calc_loop_triangles()
    return ob, co, len(me.loop_triangles), h


def stats(co):
    x, y, z = co[:, 0], co[:, 1], co[:, 2]
    # arm line: the farthest-out points per height above 0.9 m
    out = []
    for zz in np.arange(0.85, 1.40, 0.05):
        m = (z > zz - 0.025) & (z < zz + 0.025) & (x > 0)
        if m.any():
            out.append((zz, float(x[m].max())))
    out = np.array(out)
    # hand tip = the lowest point with x > 0.3
    hm = (x > 0.25) & (z > 0.55)
    hand = co[hm][np.argmin(z[hm])] if hm.any() else None
    sh = co[(z > 1.25) & (z < 1.40) & (x > 0)]
    shx = float(np.percentile(sh[:, 0], 90)) if len(sh) else 0.0
    ang = math.degrees(math.atan2(1.33 - hand[2], hand[0] - 0.17)) if hand is not None else float('nan')
    # torso width at 1.0 m (|x| < 0.2) and the gap to the arm at the same height
    gap = []
    for zz in (1.0, 1.1, 1.2):
        m = (np.abs(z - zz) < 0.02) & (x > 0)
        xs = np.sort(x[m])
        if len(xs) > 2:
            d = np.diff(xs); k = int(np.argmax(d)); gap.append(round(float(d[k]), 3))
    # hem: the lowest gown height at |x| > 0.12 (outside the feet)
    hem = co[(np.abs(x) > 0.13) & (z < 0.5)]
    hz = float(hem[:, 2].min()) if len(hem) else float('nan')
    return dict(arm_deg_below_horizontal=round(ang, 1), hand=None if hand is None else tuple(np.round(hand, 3)),
                arm_gap_m_at_1_0_1_1_1_2=gap, hem_min_z_outside_feet=round(hz, 3), width=round(float(x.max() - x.min()), 3),
                depth=round(float(y.max() - y.min()), 3))


def render(cam, view, path):
    d = {'front': (0, -1), 'side': (1, 0), 'back': (0, 1)}[view]
    cam.location = (d[0] * 6, d[1] * 6, 0.86)
    cam.rotation_euler = (math.radians(90), 0, math.atan2(d[0], -d[1]))
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def main():
    import subprocess
    cam, pole = setup_scene()
    tmp = tempfile.mkdtemp()
    rows = []
    for spec in args.cand:
        label, path = spec.split('=', 1)
        ob, co, ntri, h0 = load(path)
        st = stats(co)
        print('CAND', label, 'tris', ntri, 'src height', round(h0, 3), st)
        imgs = []
        for v in ('front', 'side', 'back'):
            p = os.path.join(tmp, '%s_%s.png' % (label, v)); render(cam, v, p); imgs.append(p)
        # wireframe: front, gown in light grey with dark wires
        mats = list(ob.data.materials)
        wm = bpy.data.materials.new('wire'); wm.use_nodes = True
        nt = wm.node_tree; bs = nt.nodes['Principled BSDF']
        wf = nt.nodes.new('ShaderNodeWireframe'); wf.inputs[0].default_value = 0.004; wf.use_pixel_size = False
        mx = nt.nodes.new('ShaderNodeMixRGB')
        mx.inputs[1].default_value = (0.85, 0.85, 0.85, 1); mx.inputs[2].default_value = (0.05, 0.05, 0.05, 1)
        nt.links.new(wf.outputs[0], mx.inputs[0]); nt.links.new(mx.outputs[0], bs.inputs['Base Color'])
        ob.data.materials.clear(); ob.data.materials.append(wm)
        for poly in ob.data.polygons:
            poly.material_index = 0
        p = os.path.join(tmp, '%s_wire.png' % label); render(cam, 'front', p); imgs.append(p)
        rows.append((label, ntri, st, imgs))
        bpy.data.objects.remove(ob, do_unlink=True)
    # assemble with PIL if present, else ffmpeg tile
    from PIL import Image, ImageDraw
    W = args.res; H = int(args.res * 1.35)
    bar = 26
    sheet = Image.new('RGB', (W * 4, (H + bar) * len(rows) + bar), (30, 30, 34))
    dr = ImageDraw.Draw(sheet)
    dr.text((8, 6), 'EIDOLON a10 heroine candidates (Tripo v3.1 smart low-poly; h1, h2 = the old Oct-25 tasks, re-downloaded) - front / side / back / wireframe; red pole = 1.8 m; each scaled to 1.70 m', fill=(235, 235, 235))
    for r, (label, ntri, st, imgs) in enumerate(rows):
        y0 = bar + r * (H + bar)
        for c, p in enumerate(imgs):
            sheet.paste(Image.open(p).convert('RGB'), (c * W, y0))
        dr.text((8, y0 + H + 6), '%s  %.1fk tris  arm %.0f deg below horizontal  hem %.0f cm off the floor' % (
            label, ntri / 1000.0, st['arm_deg_below_horizontal'], st['hem_min_z_outside_feet'] * 100), fill=(235, 235, 235))
    sheet.save(args.out)
    print('wrote', args.out)


main()
