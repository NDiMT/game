class_name Props
extends Node3D
## v0.8: the owner's Tripo props (assets/models/props/, manifest.json) set into Chapter I as set dressing.
##  * every prop wears the game's marble (marble.gdshader): its GLB mesh is re-baked once with the vertex
##    COLOR the marble reads (r random tint, g 0.25 carved marble, b 1 on pieces that may stand between
##    the camera and the wanderer, a 0); those occluder pieces fade in the see-through (marble_occ).
##  * one mesh per asset, shared by every placement (instanced draws).
##  * each placement gets a footprint in the level's obstacles (a circle, a box, or a chain of circles
##    for a turned long piece) and, if it may hide you, an occluder box for the see-through.
##  * the small dressing (rubble, fragments) is left out on the Low tier.
## Placements avoid every required path; the playthrough walks them and checks they stay clear.

const DIR := "res://assets/models/props/"
## [asset, position (y = the floor), yaw (degrees: the model faces +Z), uniform scale or Vector3, note]
const PLACE := [
	# the Waking Pool: a kneeling veiled figure reaching toward the water; a fallen gable in the far corner
	["statue_veiled_kneeling", Vector3(-3.8, 0.0, -3.7), 0.0, 1.0, "pool"],
	["pediment_fragment", Vector3(3.45, 0.0, -3.95), 15.0, 1.0, "pool"],      # (v1.0: clear of the rail)
	# the Hall of Glass: two mourners keep the far corners ("a thousand faces, all wrong")
	["statue_veiled_mourning", Vector3(-3.55, 1.0, -19.95), 45.0, 1.0, "hall"],      # (v1.0: clear of the column and the wall)
	["statue_veiled_mourning", Vector3(4.05, 1.0, -11.6), -135.0, 1.0, "hall"],
	# the Garden of the Veiled: a ruined corner, a low broken wall line, a collapse heap
	["statue_veiled_broken", Vector3(13.9, 1.0, -6.9), 30.0, 1.0, "garden"],
	# (v1.0, the overlap audit: the low wall ruin ran through a statue and the rail; the rubble heap into the
	# rail and a tree: both gone)
	# the Court of Light: a collapse heap in the far corner
	# (v1.0: its heap of rubble lay over a stump and into the rail: gone)
	# the Scales: a praying figure watches the balance; a broken column
	["statue_veiled_praying", Vector3(27.45, 2.0, -51.35), 45.0, 1.0, "scales"],      # (v1.0: beside the column, not in it)
	["column_stump", Vector3(30.3, 2.0, -51.55), 0.0, 1.0, "scales"],      # (v1.0: clear of the weights' shelf)
	# the Gate of the Four Veiled: the unfinished one, half out of her block, beside the tholos where the
	# eidolon is half-carved too
	["statue_veiled_unfinished", Vector3(20.9, 2.0, -35.2), 40.0, 1.0, "shrine"],
	# (v1.0 M4, QA P1-8: A's kit dresses the Atrium, the scaffold, the bridge, the Balcony)
	# the thousand faces on their plinths (WorldGeo.KIT_FACES), turned toward the fountain; two left plain blocks
	["kit_face1", Vector3(4.60, 1.4, 11.40), -3.8, 1.0, "atrium"],
	["kit_face2", Vector3(8.60, 1.4, 11.40), -55.5, 1.0, "atrium"],
	["kit_face3", Vector3(-2.60, 1.4, 14.00), 82.8, 1.0, "atrium"],
	["kit_face4", Vector3(-2.60, 1.4, 18.80), 88.8, 1.0, "atrium"],
	["kit_face5", Vector3(2.40, 1.4, 13.60), 49.1, 1.0, "atrium"],
	["kit_face6", Vector3(7.60, 1.4, 13.60), -54.0, 1.0, "atrium"],
	["kit_face1", Vector3(2.40, 1.4, 18.40), 110.6, 1.0, "atrium"],
	["kit_face4", Vector3(7.60, 1.4, 18.40), -132.3, 1.0, "atrium"],
	["kit_fountain", Vector3(5.0, 0.5, 16.0), 0.0, 1.0, "atrium"],
	# (v1.0: more of his thousand attempts: a row on the low shelf by the south rail (chapter Life builds the
	# shelf), and some on the floor where they were left, a few toppled on their sides)
	["kit_face3", Vector3(2.6, 0.95, 22.25), 170.0, 0.9, "atrium"],
	["kit_face5", Vector3(3.9, 0.95, 22.25), 195.0, 0.9, "atrium"],
	["kit_face2", Vector3(5.2, 0.95, 22.25), 180.0, 0.9, "atrium"],
	["kit_face6", Vector3(6.5, 0.95, 22.25), 160.0, 0.9, "atrium"],
	["kit_face1", Vector3(7.7, 0.95, 22.25), 200.0, 0.9, "atrium"],
	["kit_face4", Vector3(0.6, 0.5, 12.6), 140.0, 1.0, "atrium"],
	["kit_face3", Vector3(-1.2, 0.65, 13.0), 60.0, 1.0, "atrium", -90.0],
	["kit_face6", Vector3(3.6, 0.67, 21.0), 20.0, 1.0, "atrium", 90.0],
	["kit_face2", Vector3(9.6, 0.67, 21.2), -40.0, 1.0, "atrium", -90.0],
	# Theron's workshop: his ladder by the crane arm (the scaffold towers cannot stand under his gallery:
	# a footprint is 2D, it would wall off the gallery's own floor above them)
	["kit_ladder", Vector3(-0.5, 0.5, 19.7), 0.0, 0.85, "atrium"],
	# the Crumbling Bridge: a broken walkway end beside it, fallen from the old span
	["kit_bridge_end", Vector3(2.15, 0.0, 8.2), 0.0, 1.0, "atrium"],
	# the Balcony: urns on the outer edge, awning posts with their torn cloth (the veils: chapter Life)
	["kit_urns", Vector3(28.95, 2.0, 9.0), 90.0, 1.0, "balcony"],
	["kit_urns", Vector3(28.95, 2.0, 2.0), 80.0, 1.0, "balcony"],
	["kit_urns", Vector3(28.95, 2.0, -6.0), 100.0, 1.0, "balcony"],
	["kit_urns", Vector3(28.95, 2.0, -13.6), 90.0, 1.0, "balcony"],
	["kit_awning_post", Vector3(28.95, 2.0, 6.0), 90.0, 1.0, "balcony"],
	["kit_awning_post", Vector3(28.95, 2.0, -2.0), 90.0, 1.0, "balcony"],
	["kit_awning_post", Vector3(28.95, 2.0, -10.0), 90.0, 1.0, "balcony"],
]
## (v0.8.1: walls and architecture only: statues are never cut by the see-through)
const OCCLUDE := ["column_doric", "archway_ruined", "pylon_ashlar", "pylon_ashlar_niche", "wall_ashlar_window"]
const SMALL := ["rubble_pile", "pediment_fragment", "column_fallen"]       # (dropped on the Low tier)
## (v1.0: the kit's timber pieces wear A's wood, not the carved marble)
const MAT := {"kit_scaffold": 0.97, "kit_ladder": 0.97, "kit_awning_post": 0.97}

static var meshes := {}           # asset -> [ArrayMesh, AABB]
var level: Level
var placed: Array = []            # [asset, MeshInstance3D, footprint Rect2, space]
var small: Array[MeshInstance3D] = []

func build(lv: Level) -> void:
	level = lv
	name = "Props"
	var rng := RandomNumberGenerator.new()
	rng.seed = 808
	var blob_x: Array[Transform3D] = []
	for e in PLACE:
		var asset: String = e[0]
		var m := _mesh(asset)
		if m.is_empty(): continue
		var mesh: ArrayMesh = m[0]
		var bb: AABB = m[1]
		var sc: Vector3 = e[3] if e[3] is Vector3 else Vector3.ONE * float(e[3])
		var tilt := deg_to_rad(float(e[5])) if e.size() > 5 else 0.0          # (v1.0: a toppled piece lies on its side)
		var b := Basis(Vector3.UP, deg_to_rad(float(e[2]))) * Basis(Vector3.BACK, tilt) * Basis.from_scale(sc)
		var mi := MeshInstance3D.new()
		mi.name = "Prop_%s_%d" % [asset, placed.size()]
		mi.mesh = mesh
		mi.transform = Transform3D(b, e[1])
		mi.layers = PlanarMirror.LAYER_MAIN_FX          # (QA P1-15: the mirrors' cameras skip the props)
		for si in mesh.get_surface_count():
			mi.set_surface_override_material(si, lv.marble_occ_mat if mesh.surface_get_name(si) == "occ" else lv.marble_mat)
		add_child(mi)
		if asset in SMALL: small.append(mi)
		var wb: AABB = mi.transform * bb
		var fr := Rect2(wb.position.x, wb.position.z, wb.size.x, wb.size.z)
		placed.append([asset, mi, fr, e[4]])
		var bc := mi.transform * bb.get_center()
		blob_x.append(Transform3D(Basis(Vector3.UP, deg_to_rad(float(e[2]))) * Basis.from_scale(Vector3(bb.size.x * sc.x * 1.15, 1.0, bb.size.z * sc.z * 1.15)),
			Vector3(bc.x, wb.position.y + 0.012, bc.z)))       # (v1.0 A: a soft contact shadow under it, at its lowest point)
		# the footprint: statues and stumps are round; a turned long piece is a chain of circles
		var foot := Transform3D(b * Basis.from_scale(Vector3(bb.size.x, 1.0, bb.size.z)), mi.transform * Vector3(bb.get_center().x, 0.0, bb.get_center().z))
		var chain := Level._turned_footprint(foot)
		if asset.begins_with("statue") or asset == "column_stump" or asset == "column_doric":
			lv.ob_circle(fr.get_center(), minf(bb.size.x * sc.x, bb.size.z * sc.z) * 0.5 + 0.03, "prop:" + asset)
		elif chain.is_empty():
			lv.ob_rect(fr, "prop:" + asset)
		else:
			for cc in chain: lv.ob_circle(Vector2(cc.x, cc.y), cc.z, "prop:" + asset)
		if asset in OCCLUDE: lv.occluders.append(wb)

	if not blob_x.is_empty():                       # (v1.0 A) soft contact shadows under every prop, one draw call
		var pm := PlaneMesh.new()
		pm.size = Vector2.ONE
		var bm := ShaderMaterial.new()
		bm.shader = preload("res://shaders/blob.gdshader")
		bm.set_shader_parameter("strength", 0.45)
		pm.material = bm
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = pm
		mm.instance_count = blob_x.size()
		for i in blob_x.size(): mm.set_instance_transform(i, blob_x[i])
		var mmi := MultiMeshInstance3D.new()
		mmi.name = "PropBlobs"
		mmi.multimesh = mm
		mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mmi.layers = PlanarMirror.LAYER_MAIN_FX
		add_child(mmi)

## the Low tier leaves the small dressing out
func set_quality(high: bool) -> void:
	for mi in small: mi.visible = high

## the asset's mesh, re-baked for the marble (cached)
static func _mesh(asset: String) -> Array:
	if meshes.has(asset): return meshes[asset]
	var ps := load(DIR + asset + ".glb") as PackedScene
	if ps == null:
		push_warning("props: missing " + asset)
		meshes[asset] = []
		return []
	var root := ps.instantiate()
	var occ := asset in OCCLUDE
	var rng := RandomNumberGenerator.new()
	rng.seed = asset.hash()
	var v := PackedVector3Array()
	var n := PackedVector3Array()
	var c := PackedColorArray()
	var uv := PackedVector2Array()
	var idx := PackedInt32Array()
	for mi: MeshInstance3D in root.find_children("*", "MeshInstance3D", true, false):
		var xf := Transform3D()
		var node: Node = mi
		while node != root and node is Node3D:
			xf = (node as Node3D).transform * xf
			node = node.get_parent()
		var nb := xf.basis.inverse().transposed()
		for s in mi.mesh.get_surface_count():
			var a := mi.mesh.surface_get_arrays(s)
			var pv: PackedVector3Array = a[Mesh.ARRAY_VERTEX]
			var pn = a[Mesh.ARRAY_NORMAL]
			var pu = a[Mesh.ARRAY_TEX_UV]
			var pi = a[Mesh.ARRAY_INDEX]
			var base := v.size()
			var tint := rng.randf()
			for i in pv.size():
				v.append(xf * pv[i])
				n.append((nb * (pn[i] if pn != null else Vector3.UP)).normalized())
				c.append(Color(tint, MAT.get(asset, 0.25), 1.0 if occ else 0.0, 0.0))
				uv.append(pu[i] if pu != null else Vector2.ZERO)
			if pi == null:
				for i in pv.size(): idx.append(base + i)
			else:
				for i in (pi as PackedInt32Array): idx.append(base + i)
	root.free()
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = v
	arr[Mesh.ARRAY_NORMAL] = n
	arr[Mesh.ARRAY_COLOR] = c
	arr[Mesh.ARRAY_TEX_UV] = uv
	arr[Mesh.ARRAY_INDEX] = idx
	var one := ArrayMesh.new()
	one.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	var bb := one.get_aabb()
	# (an occluder is one "occ" surface: it fades in the see-through)
	var m: ArrayMesh = MB.split_occ(one) if occ else one
	if not occ: m.surface_set_name(0, "stone")
	meshes[asset] = [m, bb]
	return meshes[asset]
