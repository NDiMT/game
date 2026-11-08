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
	var v3 := OS.get_environment("EIDOLON_V3") == "1"
	var game: Game = load("res://scenes/main3.tscn" if v3 else "res://scenes/main.tscn").instantiate()
	add_child(game)
	await get_tree().process_frame
	await get_tree().process_frame
	var lv: Level = game.level
	if v3:
		await _v3(game, lv)
		return
	# (v2 rebuild, phase 3: the world with its beats answered: every door, gate and sealed wall open, as you find it
	# when you walk on through it; the route check below walks the whole way)
	var cs: Dictionary = game.chapter.state
	for k in ["breath", "hall_door", "shard", "gallery", "turned_done", "garden_breath", "hollow_done", "mural", "maze", "ledge_song", "scales", "stones", "four"]: cs[k] = true
	cs["beacons"] = ["W", "N", "E"]          # (phase 4: Act 3 open: the Veiled Way, the pool's road, the Gate)
	cs["hub"]["w_seen"] = true
	cs["hub"]["e_open"] = true
	game.puzzles.state["plate"] = true
	game.puzzles.state["bridge"] = true
	game.puzzles.apply_state(game.puzzles.state)
	game.chapter.apply_state()
	await get_tree().process_frame
	var body := StaticBody3D.new()
	add_child(body)
	occ_body = StaticBody3D.new()          # (the see-through's occluders: they fade round her as she passes behind them)
	occ_body.collision_layer = 2
	add_child(occ_body)
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
			var nm: String = _nm(names, r)
			hid.append("%s <- %s (hit at %.1f, %.1f, %.1f)" % [e[0], nm, r.position.x, r.position.y, r.position.z])
		if not hid.is_empty(): fails += 1
		print("ROOM %-15s %-26s %s" % [k, Names.area(k), "clear" if hid.is_empty() else "HIDDEN: " + "; ".join(hid)])
	# (v0.9) the wonder spaces: the way through each must stay in sight too (you walk it)
	var ways := []
	for c in Map2.W7_STONES: ways.append(["colossus stone", Map2.w(c[0], c[1], c[2])])
	ways.append_array([["tree nook", Map2.GN + Vector3(15.0, 2.0, -28.5)], ["spring balcony", Map2.GE + Vector3(33.4, 4.0, -32.0)]])
	var hidw: Array = []
	for e in ways:
		total += 1
		var p: Vector3 = e[1] + Vector3(0, LIFT, 0)
		var r := space.intersect_ray(PhysicsRayQueryParameters3D.create(p + back * OWN, p + back * REACH))
		if not r.is_empty(): hidw.append("%s %s <- %s at %s" % [e[0], e[1], _nm(names, r), r.position])
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
	# (v1.1d, the owner) the Shadow Chamber's floor eyes: every pair whole in sight (both eyes, end to end:
	# nothing, no brazier, no statue, no prop, between them and the camera)
	var ch: Chapter = game.chapter
	var hide_e: Array = []
	for j in Chapter.SH_SOLUTION:
		var so: Array = Chapter.shadow_of(j)
		var dn: Vector2 = so[1]
		for s in [-1.0, -0.6, -0.2, 0.2, 0.6, 1.0]:
			for t in [-0.08, 0.08]:
				total += 1
				var e: Vector3 = ch.eye_head(j) + ch.eye_axis(j) * s * 0.5 + Vector3(dn.x, 0, dn.y) * t + Vector3(0, 0.03, 0)
				var r := space.intersect_ray(PhysicsRayQueryParameters3D.create(e + back * 0.02, e + back * REACH))
				if not r.is_empty(): hide_e.append("pair %d at %s <- %s" % [j, e, _nm(names, r)])
	if not hide_e.is_empty(): fails += 1
	print("SHADOW EYES %s" % ("every pair in full sight" if hide_e.is_empty() else "HIDDEN: " + "; ".join(hide_e.slice(0, 6))))
	# (v2 rebuild) the new world: her whole way in sight: every metre of the play route (Map2.ROUTE) and every space's
	# centre, with nothing between it and the camera
	if Map2.enabled:
		var hid2: Array = []
		var pts2: Array = []
		for i in Map2.ROUTE.size() - 1:
			var a := Vector2(Map2.ROUTE[i][0], Map2.ROUTE[i][1])
			var b := Vector2(Map2.ROUTE[i + 1][0], Map2.ROUTE[i + 1][1])
			var n := maxi(1, int(a.distance_to(b)))
			for k in n: pts2.append(["route leg %d (%s)" % [i + 1, Map2.ROUTE[i + 1][2]], a.lerp(b, float(k) / n)])
		for s in Map2.SPACES:
			var c: Vector2 = Map2.space_rect(s[0]).get_center() - Vector2(Map2.O.x, Map2.O.z)
			pts2.append(["space %s centre" % s[0], c])
		for e in pts2:
			var q: Vector2 = e[1] + Vector2(Map2.O.x, Map2.O.z)
			if not lv.on_ground(q) or lv.blocked(q, 0.05): continue          # (where she can stand)
			total += 1
			var p := Vector3(q.x, lv.height_at(q) + LIFT, q.y)
			var r := space.intersect_ray(PhysicsRayQueryParameters3D.create(p + back * OWN, p + back * REACH, 1))
			if not r.is_empty(): hid2.append("%s at %s <- %s (hit at %s)" % [e[0], _v2(p - Map2.O), _nm(names, r), _v2(r.position - Map2.O)])
		if not hid2.is_empty(): fails += 1
		print("V2 WORLD %s (%d points)" % ["the whole way in sight" if hid2.is_empty() else "HIDDEN %d: " % hid2.size() + "; ".join(hid2.slice(0, 30)), pts2.size()])
	print("OCCLUSION %s (%d of %d rooms with a hidden piece; %d pieces, %d meshes)" % ["PASS" if fails == 0 else "FAIL", fails, Framing.ROOMS.size(), total, nshapes[0]])
	get_tree().quit()

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

## (v3, EIDOLON_V3=1) the built parts of Chapter I: every interact point and every metre of the walked route
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
