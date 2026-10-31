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

func _ready() -> void:
	Game.autotest = true
	var game: Game = load("res://scenes/main.tscn").instantiate()
	add_child(game)
	await get_tree().process_frame
	await get_tree().process_frame
	var lv: Level = game.level
	var body := StaticBody3D.new()
	add_child(body)
	var names := {}
	var nshapes := [0]
	lv_ref = lv
	_collect(game, game.player, body, names, nshapes)
	await get_tree().physics_frame
	await get_tree().physics_frame
	var space := body.get_world_3d().direct_space_state
	var back := Framing.basis().z.normalized()
	var fails := 0
	var total := 0
	for k in Framing.ROOMS:
		var hid: Array = []
		for e in Framing.points(k, lv):
			total += 1
			var p: Vector3 = e[1] + Vector3(0, LIFT, 0)
			if (e[0] as String).begins_with("interact pan"): p.y = Chapter.SC_PAN_Y + 0.1     # (the pan hangs overhead: it is the piece)
			var own := OWN
			# an inscription: its carved face is the piece (it must face the camera, and be in clear sight)
			for mk in lv.markers:
				if (mk[3] as Vector3) == e[1]:
					var mx: Transform3D = mk[0]
					var nrm := mx.basis.z.normalized()
					p = mx.origin + nrm * 0.03
					own = 0.05
					if nrm.dot(back) < 0.05:
						hid.append("%s faces away from the camera" % e[0])
			var q := PhysicsRayQueryParameters3D.create(p + back * own, p + back * REACH)
			var r := space.intersect_ray(q)
			if r.is_empty(): continue
			var nm: String = names.get(r["shape"], "?")
			hid.append("%s <- %s (hit at %.1f, %.1f, %.1f)" % [e[0], nm, r.position.x, r.position.y, r.position.z])
		if not hid.is_empty(): fails += 1
		print("ROOM %-15s %-26s %s" % [k, Names.area(k), "clear" if hid.is_empty() else "HIDDEN: " + "; ".join(hid)])
	# (v0.9) the wonder spaces: the way through each must stay in sight too (you walk it)
	var ways := []
	for c in Ch1Geo.CO_STONES: ways.append(["colossus stone", Vector3(c.x, 1.0, c.y)])
	ways.append_array([["tree nook", Vector3(15.0, 2.0, -28.5)], ["spring balcony", Vector3(33.4, 4.0, -32.0)]])
	var hidw: Array = []
	for e in ways:
		total += 1
		var p: Vector3 = e[1] + Vector3(0, LIFT, 0)
		var r := space.intersect_ray(PhysicsRayQueryParameters3D.create(p + back * OWN, p + back * REACH))
		if not r.is_empty(): hidw.append("%s %s <- %s at %s" % [e[0], e[1], names.get(r["shape"], "?"), r.position])
	if not hidw.is_empty(): fails += 1
	print("WONDERS %s" % ("clear" if hidw.is_empty() else "HIDDEN: " + "; ".join(hidw)))
	# (v0.9.1) the garden's great glass: each turned one's north rune face, seen in it from the fixed view:
	# nothing between the face and the glass (along the reflected view ray), nothing between the glass and you
	var bm := Vector3(back.x, back.y, -back.z)
	var hidm: Array = []
	for i in 3:
		for p: Vector3 in Chapter.turn_north_corners(i):
			var g := Chapter.garden_glass_point(p)
			var r1 := space.intersect_ray(PhysicsRayQueryParameters3D.create(p + bm * 0.05, g - bm * 0.05))
			var r2 := space.intersect_ray(PhysicsRayQueryParameters3D.create(g + back * 0.05, g + back * REACH))
			if not r1.is_empty(): hidm.append("statue %d face <- %s (before the glass)" % [i, names.get(r1["shape"], "?")])
			if not r2.is_empty(): hidm.append("statue %d in the glass <- %s" % [i, names.get(r2["shape"], "?")])
		for k in 3:
			for e in Chapter.garden_mirror_view(Vector3(Chapter.TURN_X[k], 1.0, Chapter.TURN_Z + 1.05), World.FIXED_SIZE): hidm.append(e)
	total += 12
	if not hidm.is_empty(): fails += 1
	print("GARDEN GLASS %s" % ("all three north faces whole in it" if hidm.is_empty() else "HIDDEN: " + "; ".join(hidm)))
	print("OCCLUSION %s (%d of %d rooms with a hidden piece; %d pieces, %d meshes)" % ["PASS" if fails == 0 else "FAIL", fails, Framing.ROOMS.size(), total, nshapes[0]])
	get_tree().quit()

## every visible, solid mesh the main camera sees (not the player, not flat sheets: fog, water, shadows,
## light, glass writing)
func _collect(n: Node, skip: Node, body: StaticBody3D, names: Dictionary, count: Array) -> void:
	if n == skip: return
	if n is Node3D and not (n as Node3D).visible: return
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
			if faces.size() >= 3:
				for xf: Transform3D in xfs:
					var sh := ConcavePolygonShape3D.new()
					var tf := PackedVector3Array()
					tf.resize(faces.size())
					for i in faces.size(): tf[i] = xf * faces[i]
					sh.set_faces(tf)
					var cs := CollisionShape3D.new()
					cs.shape = sh
					body.add_child(cs)
					var mat = (n as GeometryInstance3D).material_override
					if mat == null and n is MeshInstance3D and mesh.get_surface_count() > 0: mat = mesh.surface_get_material(0)
					names[count[0]] = "%s in %s [aabb %s, %s]" % [n.name, n.get_parent().name if n.get_parent() else "-", str(xf * ab), (mat.shader.resource_path.get_file() if mat is ShaderMaterial and mat.shader else str(mat))]
					count[0] += 1
	for c in n.get_children(): _collect(c, skip, body, names, count)
