"""The back of a statue's head before the eye, blurred, for a level's lower corner (the fourth level's lower right, the
owner, 23/11: "at the lower right in 4 put the back of a statue's head, blurred"). Our own goddess (props/
statue_goddess.glb, which faces its own +x) seen from behind and a little to one side and above, her hair and its knot,
lit from the upper right as the level's low sun; rendered alone on a transparent ground, then brought into the level's
colours (its marble's light and shade kept, from `dark` to `light`) and blurred as a thing close to the eye is.

  python3.11 -I tools/go/fg_head.py -- render <out raw.png> [turn degrees] [from above degrees] [model] [focus] [scale] [behind 1|0]
    (model: another of our statues, props/<name>.glb; focus: where the frame's middle is, down from its top as a share of
    its height; scale: the share of its height the frame holds; behind 0: from its front, which is its own +x)

The fifth level's, offered 23/11 (the owner: "put something else for the blurred one in 5"):
  python3.11 -I tools/go/fg_head.py -- render <raw> -35 12 props/observer_veiled.glb 0.24 0.5 1      (a veiled woman from behind)
  python3.11 -I tools/go/fg_head.py -- render <raw> 35 10 props/statue_unfinished.glb 0.3 0.62 0     (the statue half out of its block)
  python3.11 -I tools/go/fg_head.py -- render <raw> 20 16 props/amphora.glb 0.3 0.62 0               (an amphora)
  then soften each with the fifth level's plum: ... 1100 9 463a4f a8949f
  python3 -I tools/go/fg_head.py soften <raw.png> <out.png> <height px> <blur px> [dark hex] [light hex]
"""
import sys, math


def render(out, turn=28.0, above=14.0, model='props/statue_goddess.glb', focus=0.085, scale=0.3, behind=1.0):
    import bpy
    from mathutils import Vector, Euler
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=model)
    obs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    pts = [o.matrix_world @ Vector(c) for o in obs for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    H = hi.z - lo.z
    head = Vector(((lo.x + hi.x) * 0.5, (lo.y + hi.y) * 0.5, hi.z - H * focus))      # (about the middle of her head, or what the frame holds)
    sc = bpy.context.scene
    mat = bpy.data.materials.new('marble'); mat.use_nodes = True
    bs = mat.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value = (0.82, 0.8, 0.84, 1); bs.inputs['Roughness'].default_value = 0.6
    for o in obs:
        o.data.materials.clear(); o.data.materials.append(mat)
        for p in o.data.polygons: p.use_smooth = True
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 48; sc.cycles.device = 'CPU'
    sc.render.film_transparent = True; sc.render.resolution_percentage = 100
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.55, 0.56, 0.66, 1); w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.32
    cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'; cam.ortho_scale = H * scale
    co = bpy.data.objects.new('cam', cam); sc.collection.objects.link(co); sc.camera = co
    a = math.radians((180.0 if behind else 0.0) + turn); e = math.radians(above)      # (behind her: she faces +x, so from -x, turned a little and from a little above)
    d = Vector((math.cos(a) * math.cos(e), math.sin(a) * math.cos(e), math.sin(e)))
    co.location = head + d * (H * 2.0)
    co.rotation_euler = (head - co.location).to_track_quat('-Z', 'Y').to_euler()
    view = (head - co.location).normalized(); right = view.cross(Vector((0, 0, 1))).normalized(); up = right.cross(view).normalized()
    sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 4.2; sun.angle = math.radians(10)
    so = bpy.data.objects.new('sun', sun); sc.collection.objects.link(so)
    ld = -(right * 0.85 + up * 0.75 + view * 0.45).normalized()      # (the light from the picture's upper right and a little beyond her, as the level's low sun: her right edge and her hair's top catch it)
    so.rotation_euler = ld.to_track_quat('-Z', 'Y').to_euler()
    co.location += Vector((0, 0, -H * 0.04))      # (the head a little high in the frame: her neck and shoulders' top below it)
    sc.render.resolution_x = 900; sc.render.resolution_y = 1100; sc.render.filepath = out
    bpy.ops.render.render(write_still=True)
    print('rendered', out)


def soften(raw, out, height, blur, dark='4d4a66', light='b9b6cf'):
    import numpy as np
    from PIL import Image
    from scipy.ndimage import gaussian_filter
    a = np.asarray(Image.open(raw).convert('RGBA')).astype(np.float32) / 255.0
    al = a[..., 3]
    ys, xs = np.nonzero(al > 0.02); a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]; al = a[..., 3]
    L = (a[..., :3] @ np.array([0.3, 0.55, 0.15], np.float32))
    lo = np.array([int(dark[i:i + 2], 16) for i in (0, 2, 4)], np.float32) / 255.0
    hi = np.array([int(light[i:i + 2], 16) for i in (0, 2, 4)], np.float32) / 255.0
    Ln = np.clip((L - L[al > 0.5].min()) / max(L[al > 0.5].max() - L[al > 0.5].min(), 1e-3), 0, 1)
    c = lo + (hi - lo) * Ln[..., None] ** 0.9
    pad = int(blur * 3) + 2; Hh, Ww = al.shape
    sc = height / float(Hh + 2 * pad); size = (max(1, int((Ww + 2 * pad) * sc)), int(height))
    cp = np.zeros((Hh + 2 * pad, Ww + 2 * pad, 3), np.float32); ap = np.zeros((Hh + 2 * pad, Ww + 2 * pad), np.float32)
    cp[pad:pad + Hh, pad:pad + Ww] = c * al[..., None]; ap[pad:pad + Hh, pad:pad + Ww] = al
    def bl(ch): return gaussian_filter(np.asarray(Image.fromarray(ch.astype(np.float32), 'F').resize(size, Image.LANCZOS)).astype(np.float32), blur)
    A = np.clip(bl(ap), 0, 1)
    C = np.stack([bl(cp[..., i]) for i in range(3)], -1) / np.maximum(A, 1e-3)[..., None]
    Image.fromarray(np.dstack([np.clip(C * 255, 0, 255), A * 255]).round().astype(np.uint8), 'RGBA').save(out)
    print('softened', raw, '->', out, size, 'blur', blur)


if __name__ == '__main__':
    if '--' in sys.argv:
        v = sys.argv[sys.argv.index('--') + 1:]
        if v and v[0] == 'render':
            r = [float(x) for x in v[2:4]]
            if len(v) > 4: r += [v[4]] + [float(x) for x in v[5:8]]
            render(v[1], *r); sys.exit(0)
    v = sys.argv[1:]
    if len(v) >= 5 and v[0] == 'soften': soften(v[1], v[2], int(v[3]), float(v[4]), *v[5:7]); sys.exit(0)
    print(__doc__)
