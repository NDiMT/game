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

const DIR := "res://assets/models/props/"
## [asset, position (y = the floor), yaw (degrees: the model faces +Z), uniform scale or Vector3, note]
const PLACE := []          # (v3: no free placements; the spaces are dressed by A's recipes, fx/dress.gd, and Kit3)
## (v0.8.1: walls and architecture only: statues are never cut by the see-through)
const OCCLUDE := ["column_doric", "archway_ruined", "pylon_ashlar", "pylon_ashlar_niche", "wall_ashlar_window"]
const SMALL := ["rubble_pile", "pediment_fragment", "column_fallen"]       # (dropped on the Low tier)
## (v1.0: the kit's timber pieces wear A's wood, not the carved marble)
const MAT := {"kit_scaffold": 0.97, "kit_ladder": 0.97, "kit_awning_post": 0.97}
## the marble shader's material ids for wood and bronze (vertex colour g)
const WOOD := 0.97
const BRONZE := 0.91

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
	for e in placements():
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

## (v2 rebuild) what stands: with the new world, the old Atrium's and the old waking pool's pieces are gone (Act 1
## lives in the new world; the GL buffer of the marble's per-instance values holds 256 instances in all)
static func placements() -> Array:
	return PLACE

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
