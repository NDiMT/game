# the Observer's folds made to read: ambient occlusion baked into its vertex colours (R=G=B), so the game's shader can
# shade the hollows of its veil and robe softly, as the concepts' statues are. usage: python3.11 -I tools/go/bake_ao.py -- in.glb out.glb [samples] [distance] [--weld]
import bpy, sys
a = sys.argv[sys.argv.index('--') + 1:]
src, out = a[0], a[1]; a = [x for x in a if not x.startswith('--')]
samples = int(a[2]) if len(a) > 2 else 96; dist = float(a[3]) if len(a) > 3 else 0.09
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
ob = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
bpy.context.view_layer.objects.active = ob; ob.select_set(True)
me = ob.data
if '--weld' in sys.argv:      # (a model straight from the generator: its vertices split at every seam; welded, it shades as one smooth stone)
    import bmesh
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4); bm.to_mesh(me); bm.free()
    for f in me.polygons: f.use_smooth = True
    for uv in list(me.uv_layers): me.uv_layers.remove(uv)
if not me.materials:
    m = bpy.data.materials.new('stone'); m.use_nodes = True; me.materials.append(m)
ca = me.color_attributes.new(name='ao', type='BYTE_COLOR', domain='POINT')
me.color_attributes.active_color = ca
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = samples
sc.world = bpy.data.worlds.new('w'); sc.world.light_settings.distance = dist
bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')
vals = [c.color[0] for c in ca.data]
print('AO baked: min %.2f mean %.2f max %.2f over %d verts' % (min(vals), sum(vals) / len(vals), max(vals), len(vals)))
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_vertex_color='ACTIVE', export_normals=True, export_materials='NONE')
print('SAVED', out)
