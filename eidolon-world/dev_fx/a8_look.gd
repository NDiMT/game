extends Node
## (Agent A, a8) fx / lighting look harness. Rendered, not headless:
##   xvfb-run -a godot --path . --resolution 390x844 res://dev_fx/a8_look.tscn -- <label> <high|low> [spaces...]
## One shot per space: dev/shots/a8-<label>-<tier>-<space>.png. Prints the worst script frame (ms).
var game: Game
var _t0 := 0
var worst := 0.0
var _count := false
const LOOK := ["WS", "I1", "I2", "I3", "IB1", "I4", "I5", "A", "WR", "W1", "W3", "W4", "W5", "W6", "WB", "W7", "N1", "NG", "N2", "N3", "N4", "IBN", "N5",
	"N6", "N7", "NB", "ER", "E1", "E2", "IBE", "E3", "E4", "E5", "EB", "EH", "VW", "P", "I21", "I22", "I23"]

func _ready() -> void:
	Game.autotest = true
	game = load("res://scenes/main3.tscn").instantiate()
	add_child(game)
	var b1 := Br.new(); b1.host = self; b1.first = true; b1.process_priority = -100000; add_child(b1)
	var b2 := Br.new(); b2.host = self; b2.first = false; b2.process_priority = 100000; add_child(b2)
	var args := OS.get_cmdline_user_args()
	var label := args[0] if args.size() > 0 else "x"
	var tier := args[1] if args.size() > 1 else "high"
	var only := args.slice(2)
	await _w(2.5)
	game.cmd("quality:" + tier)
	_count = true
	if label == "pick":          # pick SPACE px py floor_y: what is drawn at that pixel's floor point
		game.cmd("v3jump:" + tier); await _w(1.0)
		var cam := get_viewport().get_camera_3d()
		var px := Vector2(float(only[0]), float(only[1]))
		var o := cam.project_ray_origin(px); var d := cam.project_ray_normal(px)
		if only[2] == "screen":
			for n in game.find_children("*", "GeometryInstance3D", true, false):
				var g := n as GeometryInstance3D
				if not g.is_visible_in_tree(): continue
				var ab: AABB = g.global_transform * g.get_aabb()
				if ab.size.length() > 60.0: continue
				var r := Rect2(); var first := true; var bad := false
				for k in 8:
					var q: Vector3 = ab.get_endpoint(k)
					if cam.is_position_behind(q): bad = true; break
					var sp := cam.unproject_position(q)
					if first: r = Rect2(sp, Vector2.ZERO); first = false
					else: r = r.expand(sp)
				if not bad and r.has_point(px):
					var ms := ""
					var mat: Material = g.material_override
					if mat is ShaderMaterial and (mat as ShaderMaterial).shader: ms = (mat as ShaderMaterial).shader.resource_path.get_file() + (mat as ShaderMaterial).shader.code.substr(0, 60).replace("\n", " ")
					elif mat: ms = str(mat)
					print("PICKS ", g.get_path(), " ", ab, " ", ms)
			get_tree().quit(); return
		var fy := float(only[2])
		var hit := o + d * ((fy - o.y) / d.y)
		print("PICK at ", hit)
		for n in game.find_children("*", "GeometryInstance3D", true, false):
			var g := n as GeometryInstance3D
			if not g.is_visible_in_tree(): continue
			if g is MultiMeshInstance3D:
				var mm := (g as MultiMeshInstance3D).multimesh
				for i in mm.instance_count:
					var xf: Transform3D = g.global_transform * mm.get_instance_transform(i)
					var ab: AABB = xf * mm.mesh.get_aabb()
					if ab.grow(0.05).has_point(hit): print("PICK MM ", g.get_path(), " #", i, " ", mm.mesh.get_class(), " ", ab, " ", g.material_override, " ", mm.mesh.surface_get_material(0) if mm.mesh.get_surface_count() > 0 else null)
			else:
				var ab: AABB = g.global_transform * g.get_aabb()
				if ab.grow(0.05).has_point(hit) and ab.size.length() < 30.0: print("PICK ", g.get_path(), " ", ab, " ", g.material_override)
		get_tree().quit(); return
	if label == "reveal":        # walk the route; shoot the first few places the see-through opens
		game.cmd("quality:" + tier)
		var rt: Array = Map3.route("all")
		var shots := 0; var skip := 0.0
		for i in rt.size() - 1:
			var a := Vector2(rt[i][0], rt[i][1]); var b := Vector2(rt[i + 1][0], rt[i + 1][1])
			var n := int(a.distance_to(b) / 0.7) + 1
			for j in n:
				var q := a.lerp(b, float(j) / n)
				if skip > 0.0: skip -= 0.7; continue
				game.cmd("tp:%f:%f" % [q.x, q.y])
				await get_tree().process_frame; await get_tree().process_frame
				if game.world._hid_hold > 0.0:
					await _w(0.5)
					await RenderingServer.frame_post_draw
					get_viewport().get_texture().get_image().save_png("res://dev/shots/a8-%s-reveal-%d.png" % [only[0] if only.size() > 0 else "x", shots])
					print("REVEAL shot %d at %s (%s)" % [shots, q, rt[i + 1][2]])
					shots += 1; skip = 25.0
					if shots >= int(only[1]) if only.size() > 1 else 4: get_tree().quit(); return
		get_tree().quit(); return
	if label == "scan":
		for s in LOOK:
			game.cmd("v3jump:" + s); await _w(0.6); _scan(s)
		get_tree().quit(); return
	for s in LOOK:
		if not only.is_empty() and only[0] == "-": break
		if not only.is_empty() and not s in only: continue
		game.cmd("v3jump:" + s)
		await _w(1.8)
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png("res://dev/shots/a8-%s-%s-%s.png" % [label, tier, s])
	for s in only:
		if "@" in s:          # SPACE@x,z: a teleport in it
			var p: PackedStringArray = s.split("@"); var q: PackedStringArray = p[1].split(",")
			game.cmd("v3jump:" + p[0]); await _w(0.3)
			game.cmd("tp:%s:%s" % [q[0], q[1]]); await _w(1.6)
			await RenderingServer.frame_post_draw
			get_viewport().get_texture().get_image().save_png("res://dev/shots/a8-%s-%s-%s.png" % [label, tier, s.replace("@", "_").replace(",", "_")])
	print("A8 worst script frame %.2f ms" % worst)
	get_tree().quit()

func _w(s: float) -> void:
	await get_tree().create_timer(s).timeout

class Br extends Node:
	var first := true
	var host
	func _process(_dt: float) -> void:
		if first: host._t0 = Time.get_ticks_usec()
		elif host._count: host.worst = maxf(host.worst, (Time.get_ticks_usec() - host._t0) / 1000.0)

## list the visible flat things on the floor near her (disc / decal hunt): name, mesh, material
var _seen := {}
func _scan(sp: String) -> void:
	var pp: Vector3 = game.player.global_position
	for n in game.find_children("*", "GeometryInstance3D", true, false):
		var g := n as GeometryInstance3D
		if not g.is_visible_in_tree(): continue
		var ab: AABB = g.global_transform * g.get_aabb()
		if ab.size.y > 0.15 or ab.size.x < 0.2 or ab.size.x > 6.0: continue
		var c := ab.get_center()
		if Vector2(c.x - pp.x, c.z - pp.z).length() > 9.0: continue
		var key := str(g.get_path())
		if _seen.has(key): continue
		_seen[key] = true
		var mat: Material = g.material_override
		var ms := ""
		if mat is ShaderMaterial and (mat as ShaderMaterial).shader: ms = (mat as ShaderMaterial).shader.resource_path.get_file()
		elif mat is StandardMaterial3D: ms = "std " + str((mat as StandardMaterial3D).albedo_color)
		var mn := ""
		if g is MeshInstance3D and (g as MeshInstance3D).mesh: mn = (g as MeshInstance3D).mesh.get_class()
		if g is MultiMeshInstance3D: mn = "MM%d" % (g as MultiMeshInstance3D).multimesh.instance_count
		print("SCAN %s %s [%s] %s size=%.2fx%.2fx%.2f at %.1f,%.1f,%.1f" % [sp, String(g.name), mn, ms, ab.size.x, ab.size.y, ab.size.z, c.x, c.y, c.z])
