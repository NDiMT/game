"""Gives the low-poly shrouded mirror three materials, by what each piece of it is: the sheet, the rope, the stone base.
The game then paints each with a colour of its own palette.

usage: python3.11 -I colour_shroud.py -- <in.glb> <out.glb>
The model has no texture. Its faces fall into loose pieces; the rope is the small pieces that lie in the two bands
where it is tied, the base is whatever lies in the lowest slab, the rest is cloth.
"""
import bpy, sys, bmesh
a = sys.argv[sys.argv.index('--') + 1:]
src, out = a[0], a[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
for o in bpy.context.scene.objects: o.select_set(o.type == 'MESH')
bpy.context.view_layer.objects.active = objs[0]
if len(objs) > 1: bpy.ops.object.join()
o = bpy.context.view_layer.objects.active
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
o.data.materials.clear()
for n in ('cloth', 'rope', 'base'): o.data.materials.append(bpy.data.materials.new(n))
bm = bmesh.new(); bm.from_mesh(o.data); bm.faces.ensure_lookup_table()
zmin = min(v.co.z for v in bm.verts); zmax = max(v.co.z for v in bm.verts); H = zmax - zmin
# loose pieces
seen = set(); count = {'cloth': 0, 'rope': 0, 'base': 0}
for f0 in bm.faces:
    if f0.index in seen: continue
    stack = [f0]; isl = []
    while stack:
        f = stack.pop()
        if f.index in seen: continue
        seen.add(f.index); isl.append(f)
        for e in f.edges:
            for g in e.link_faces:
                if g.index not in seen: stack.append(g)
    zs = [v.co.z for f in isl for v in f.verts]; z0, z1 = (min(zs) - zmin) / H, (max(zs) - zmin) / H
    kind = 'cloth'
    if z1 < 0.075: kind = 'base'
    elif len(isl) <= 46 and (z1 - z0) < 0.13 and ((0.36 < z0 and z1 < 0.52) or (0.58 < z0 and z1 < 0.72)): kind = 'rope'
    for f in isl: f.material_index = ('cloth', 'rope', 'base').index(kind)
    count[kind] += len(isl)
# what is left of the base: single faces of bigger pieces that lie flat in the lowest slab
for f in bm.faces:
    if f.material_index == 0 and max((v.co.z - zmin) / H for v in f.verts) < 0.06: f.material_index = 2
bm.to_mesh(o.data); bm.free()
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True)
print('FACES', count)
