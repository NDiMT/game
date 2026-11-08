extends Node
## v0.9 OCCLUSION test (headless): from the one fixed camera (orthographic: only its direction matters),
## every puzzle piece and interactable must be in clear sight: no wall, column or prop between it and the
## camera. Builds a ray-test copy of every visible solid mesh in the world (meshes and multimeshes: walls,
## columns, props, puzzle objects) and casts from each piece (half a metre above its foot) back toward the
## camera, as far as the near plane. Prints OCCLUSION PASS / OCCLUSION FAIL and what hides what.
const LIFT := 0.5            # the piece's body, not its foot
const OWN := 0.5             # hits this close are the piece's own body
const REACH := 22.0          # (the camera stands 24 m back, near plane 1 m)
var lv_ref: Level
var occ_body: StaticBody3D
var _per_surface := false        # (v3: a zone's see-through walls are a surface of its split mesh)

func _ready() -> void:
	Game.autotest = true
	var game: Game = load("res://scenes/main3.tscn").instantiate()
	add_child(game)
	await get_tree().process_frame
	await get_tree().process_frame
	await _v3(game, game.level)

## every visible, solid mesh the main camera sees (not the player, not flat sheets: fog, water, shadows,
## light, glass writing)
func _collect(n: Node, skip: Node, body: StaticBody3D, names: Dictionary, count: Array) -> void:
	if n == skip: return
	if n is Node3D and not (n as Node3D).visible: return
	# (QA_V11: the tholos's dome fades out wherever it would stand over the view: on the Mirror Walk, at the sealed door)
	if n.name == "Zone_Sdome": return
	# (v2.0: the crypt's vault fades whenever you are under it or on the way to it: stub, bridge)
	if n.name == "CryptRoof": return
	# (v2 rebuild: the doors and gates in their doorways fade in the see-through as you pass them, as walls do)
	if str(n.name).begins_with("V2Door_"): return
	if n is CanvasItem or n is CanvasLayer: return
	if n is GeometryInstance3D and ((n as VisualInstance3D).layers & PlanarMirror.MAIN_MASK) != 0:
		var xfs: Array = []
		var mesh: Mesh = null
		if n is MeshInstance3D:
			mesh = (n as MeshInstance3D).mesh
			xfs = [(n as MeshInstance3D).global_transform]
		elif n is MultiMeshInstance3D and (n as MultiMeshInstance3D).multimesh:
			# (headless, the rendering server keeps no instance transforms: take them from the level's lists;
			# only the solid stone ones: columns, stumps, rubble)
			var mm := (n as MultiMeshInstance3D).multimesh
			var src: Array = {"Columns": lv_ref.col_full, "Stumps": lv_ref.col_stump, "Debris": lv_ref.debris}.get(str(n.get_parent().name), [])
			if not src.is_empty():
				mesh = mm.mesh
				for x: Transform3D in src: xfs.append((n.get_parent() as Node3D).global_transform * x)
		# (v1.1: light, not matter: an additive beam never hides anything)
		var om = (n as GeometryInstance3D).material_override
		if om is StandardMaterial3D and (om as StandardMaterial3D).blend_mode == BaseMaterial3D.BLEND_MODE_ADD: mesh = null
		if mesh and not (mesh is PlaneMesh or mesh is QuadMesh):
			var ab := mesh.get_aabb()
			var thin := minf(ab.size.x, minf(ab.size.y, ab.size.z)) < 0.003
			var faces := mesh.get_faces() if not thin else PackedVector3Array()
			if _per_surface and n is MeshInstance3D and mesh is ArrayMesh and mesh.get_surface_count() > 1:
				_surfaces(n as MeshInstance3D, body, names, count)
				faces = PackedVector3Array()
			if faces.size() >= 3:
				for xf: Transform3D in xfs:
					var sh := ConcavePolygonShape3D.new()
					var tf := PackedVector3Array()
					tf.resize(faces.size())
					for i in faces.size(): tf[i] = xf * faces[i]
					sh.set_faces(tf)
					var cs := CollisionShape3D.new()
					cs.shape = sh
					var mat = (n as GeometryInstance3D).material_override
					if mat == null and n is MeshInstance3D and mesh.get_surface_count() > 0: mat = (n as MeshInstance3D).get_surface_override_material(0)
					if mat == null and n is MeshInstance3D and mesh.get_surface_count() > 0: mat = mesh.surface_get_material(0)
					var occ: bool = mat is ShaderMaterial and (mat as ShaderMaterial).shader and (mat as ShaderMaterial).shader.resource_path.get_file() == "marble_occ.gdshader"
					var ob: StaticBody3D = occ_body if occ else body
					ob.add_child(cs)
					names[("o" if occ else "b") + str(ob.get_child_count() - 1)] = "%s in %s [aabb %s, %s]" % [n.name, n.get_parent().name if n.get_parent() else "-", str(xf * ab), (mat.shader.resource_path.get_file() if mat is ShaderMaterial and mat.shader else str(mat))]
					count[0] += 1
	for c in n.get_children(): _collect(c, skip, body, names, count)

func _nm(names: Dictionary, r: Dictionary) -> String:
	return names.get(("o" if r["collider"] == occ_body else "b") + str(r["shape"]), "?")

func _v2(v: Vector3) -> String:
	return "(%.1f, %.1f, %.1f)" % [v.x, v.y, v.z]

## (v3) the built parts of Chapter I: every interact point and every metre of the walked route
## (Map3.route, Act 1 + the hub's mouths) in clear sight of the fixed camera; the occluders that fade round her
## (the see-through) are not counted, as in v2
func _v3(game: Game, lv: Level) -> void:
	var body := StaticBody3D.new()
	add_child(body)
	occ_body = StaticBody3D.new()
	occ_body.collision_layer = 2
	add_child(occ_body)
	var names := {}
	var nshapes := [0]
	lv_ref = lv
	_per_surface = true
	for fz in lv.fade_zones:
		var zm: MeshInstance3D = fz[0]
		zm.mesh = fz[2]
		for si in zm.mesh.get_surface_count():
			zm.set_surface_override_material(si, lv.marble_occ_mat if zm.mesh.surface_get_name(si) == "occ" else lv.marble_mat)
	for id in game.get("ch").pz: game.cmd("pz_solve:" + id)          # (every gate open: the way as walked)
	await get_tree().create_timer(2.0).timeout
	_collect(game, game.player, body, names, nshapes)
	await get_tree().physics_frame
	await get_tree().physics_frame
	var space := body.get_world_3d().direct_space_state
	var back := Framing.basis().z.normalized()
	print("back ", back)
	var pts: Array = []
	for it: Level.Interact in lv.interacts: pts.append(["interact " + it.id, it.pos])
	var rt: Array = Map3.route("act1")
	for i in rt.size() - 1:
		var a := Vector2(rt[i][0], rt[i][1])
		var b := Vector2(rt[i + 1][0], rt[i + 1][1])
		var n := maxi(1, int(a.distance_to(b) / 0.5))
		for k in n:
			var q := a.lerp(b, float(k) / n)
			pts.append(["route to %s" % rt[i + 1][2], Vector3(q.x, lv.height_at(q), q.y)])
	var hid: Array = []
	for e in pts:
		var p: Vector3 = e[1] + Vector3(0, LIFT, 0)
		var r := space.intersect_ray(PhysicsRayQueryParameters3D.create(p + back * OWN, p + back * REACH, 1))
		if not r.is_empty(): hid.append("%s at %s <- %s (hit at %s)" % [e[0], e[1], _nm(names, r).get_slice(" [", 0), r.position])
	for h in hid.slice(0, 30): print("HIDDEN ", h)
	print("OCCLUSION %s (v3: %d points, %d hidden, %d meshes)" % ["PASS" if hid.is_empty() else "FAIL", pts.size(), hid.size(), nshapes[0]])
	get_tree().quit()

## (v3) one shape per surface, each on the body its own material says (see-through occluders on layer 2)
func _surfaces(mi: MeshInstance3D, body: StaticBody3D, names: Dictionary, count: Array) -> void:
	var am := mi.mesh as ArrayMesh
	for si in am.get_surface_count():
		var a := am.surface_get_arrays(si)
		var v: PackedVector3Array = a[Mesh.ARRAY_VERTEX]
		var idx: PackedInt32Array = a[Mesh.ARRAY_INDEX] if a[Mesh.ARRAY_INDEX] != null else PackedInt32Array()
		var tf := PackedVector3Array()
		if idx.is_empty():
			for p in v: tf.append(mi.global_transform * p)
		else:
			for i in idx: tf.append(mi.global_transform * v[i])
		if tf.size() < 3: continue
		var sh := ConcavePolygonShape3D.new()
		sh.set_faces(tf)
		var cs := CollisionShape3D.new()
		cs.shape = sh
		var occ := am.surface_get_name(si) == "occ"
		var ob: StaticBody3D = occ_body if occ else body
		ob.add_child(cs)
		names[("o" if occ else "b") + str(ob.get_child_count() - 1)] = "%s/%s in %s" % [mi.name, am.surface_get_name(si), mi.get_parent().name]
		count[0] += 1
