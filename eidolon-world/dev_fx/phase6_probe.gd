extends Node
## (Agent A, dev) phase 6 in the real game, as W4 wired it: the Gate of the Four's runes waking in the hold (rune_wake),
## the Atrium's TurnedHead, the beyond colossus at cine t 58.5 (W4's framing). --dbg: hide tests at the beyond.
##   xvfb-run godot --path . --rendering-driver opengl3 --resolution 780x1688 res://dev_fx/phase6_probe.tscn -- --shots=/abs --tag=x [--only=runes,atrium,beyond]
const STEPS := ["runes", "atrium", "beyond"]
var game: Node
var shots := ""
var tag := "x"
var only: PackedStringArray = []
var i := -1
var t := 0.0
var _begun := false
var _fired := false
var _k := 0
var _hide: Array = []
var _ht := 0.0

func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shots="): shots = a.get_slice("=", 1)
		if a.begins_with("--tag="): tag = a.get_slice("=", 1)
		if a.begins_with("--only="): only = a.get_slice("=", 1).split(",")
	Map2.labels_on = false
	Game.autotest = true
	game = load("res://scenes/main.tscn").instantiate()
	add_child(game)

func _shot(n: String) -> void:
	var nm := "p6-%s-%s" % [tag, n]
	if shots != "": get_viewport().get_texture().get_image().save_png("%s/%s.png" % [shots, nm])
	print("shot ", nm)

func _process(dt: float) -> void:
	t += dt
	if i == -1:
		if t > 2.0 and not _begun:
			_begun = true
			game.cmd("begin")
		if _begun and t > 3.0 and t < 3.5: game.cmd("skip")
		if _begun and t > 5.0 and t < 5.5: game.cmd("skip")
		if t > 7.0: _next()
		return
	if not _hide.is_empty():
		_ht += dt
		if _ht > 0.5:
			_ht = 0.0
			var what: String = _hide.pop_front()
			match what:
				"colossus": for n in game.find_children("BeyondColossus", "", true, false): (n as Node3D).visible = false
				"beyondmesh": for c in game.level.beyond.get_children(): if c is GeometryInstance3D: (c as Node3D).visible = false
				"beyond": game.level.beyond.visible = false
				"farest": for n in game.level.get_children(): if str(n.name).begins_with("Far"): (n as Node3D).visible = false
				"all3d": for n in game.level.get_children(): if n is Node3D and n != game.level.beyond: (n as Node3D).visible = false
			await get_tree().process_frame
			await get_tree().process_frame
			_shot("hide-" + what)
			if _hide.is_empty(): _next()
		return
	if i >= STEPS.size():
		get_tree().quit(); return
	var ch: Node = game.chapter
	match STEPS[i]:
		"runes":
			if not _fired:
				_fired = true; t = 0.0
				game.jump("gate_four")
			elif _k == 0 and t > 2.0:
				_k = 1; t = 2.0
				var q: Vector3 = ch.four_pos(3)
				game.cmd("tp:%f:%f" % [q.x, q.z + 1.2])
			elif _k == 1 and t > 3.5:
				_k = 2; t = 3.5
				var q2: Vector3 = ch.four_pos(3)
				game.cmd("walk:%f:%f" % [q2.x, q2.z])
			elif _k >= 2 and _k < 20 and t > 4.5 + (_k - 2) * 0.35:
				_shot("runes-%02d" % (_k - 2)); _k += 1
				if ch.four_hold > 0.0 and _k == 3: print("HOLD started at shot 0")
			elif _k == 20: _next()
		"atrium":
			var d: Node = game.find_child("Dress_atrium", true, false)
			if not _fired:
				_fired = true; t = 0.0
				game.jump("stair_breath")
			elif _k == 0 and t > 1.5:
				_k = 1; t = 1.5
				d = game.find_child("Dress_atrium", true, false)
				var hp: Vector3 = (d.get_node("TurnedHead") as Node3D).global_position
				game.cmd("tp:%f:%f" % [hp.x + 1.2, hp.z + 2.6])
			elif _k == 1 and t > 3.5:
				var th: Node3D = d.get_node_or_null("TurnedHead")
				print("TURNEDHEAD ", th, " ", th.global_position if th else Vector3.ZERO, " rot ", th.rotation_degrees if th else Vector3.ZERO)
				_shot("atrium"); _k = 2
				if th: th.rotation.y += deg_to_rad(70.0)
			elif _k == 2 and t > 4.2: _shot("atrium-turned"); _k = 3
			elif _k == 3 and t > 4.6:
				var th2: Node3D = d.get_node_or_null("TurnedHead")
				var cam := get_viewport().get_camera_3d()
				if th2: print("HEAD SCREEN ", cam.unproject_position(th2.global_position))
				_next()
		"beyond":
			if not _fired:
				_fired = true; t = 0.0
				game.cmd("tp:%f:%f" % [Map2.SHRINE_STAND.x, Map2.SHRINE_STAND.z])
			elif _k == 0 and t > 2.0:
				_k = 1
				game.start_finale()
			elif _k >= 1 and game.cine:
				var ct: float = game.cine.t
				if _k == 1 and ct > 54.5: _shot("beyond-54.5"); _k = 2
				elif _k == 2 and ct > 58.5:
					_shot("beyond-58.5"); _k = 3
					if OS.get_cmdline_user_args().has("--dbg"):
						game.cine.set_process(false)
						get_tree().paused = false
						_dbg()
						_hide = ["colossus", "farest", "beyondmesh", "all3d"]
					else: _next()
			elif _k >= 1 and t > 90.0: _next()

func _next() -> void:
	i += 1; t = 0.0; _fired = false; _k = 0
	while i < STEPS.size() and only.size() > 0 and not only.has(STEPS[i]): i += 1

func _dbg() -> void:
	var cam := get_viewport().get_camera_3d()
	var vs := get_viewport().get_visible_rect().size
	for fnm in ["FarRuins", "FarestRuins"]:
		var fr := game.level.get_node_or_null(fnm) as MeshInstance3D
		if fr == null: continue
		var f := fr.mesh.get_faces()
		var lo := Vector3(INF, INF, INF); var hi := -lo; var n := 0
		var box := Rect2(vs.x * 0.3, vs.y * 0.24, vs.x * 0.28, vs.y * 0.18)
		for k in range(0, f.size(), 3):
			var inb := false
			for j in 3:
				var v: Vector3 = fr.global_transform * f[k + j]
				if not cam.is_position_behind(v) and box.has_point(cam.unproject_position(v)): inb = true
			if inb:
				for j in 3:
					var v2: Vector3 = fr.global_transform * f[k + j]
					lo = lo.min(v2); hi = hi.max(v2)
				n += 1
		print("%s in the box: %d tris, world %s .. %s" % [fnm, n, lo, hi])
		var col: Vector3 = (game.find_children("BeyondColossus", "", true, false)[0] as Node3D).global_position
		print("COLOSSUS at ", col, " screen ", cam.unproject_position(col), " cam ", cam.global_position, " size ", cam.size)
	for n in game.find_children("*", "GeometryInstance3D", true, false):
		var g := n as GeometryInstance3D
		if not g.is_visible_in_tree(): continue
		var ab: AABB = g.global_transform * g.get_aabb()
		var lo := Vector2(INF, INF); var hi := Vector2(-INF, -INF)
		for c in 8:
			var q := ab.get_endpoint(c)
			if cam.is_position_behind(q): continue
			var sp := cam.unproject_position(q)
			lo = lo.min(sp); hi = hi.max(sp)
		var r := Rect2(lo, hi - lo).intersection(Rect2(Vector2.ZERO, vs))
		# what covers the area left of the colossus's head (screen ~ 0.33..0.55 x, 0.25..0.4 y)
		if r.intersects(Rect2(vs.x * 0.33, vs.y * 0.25, vs.x * 0.22, vs.y * 0.15)) and r.size.x * r.size.y < vs.x * vs.y * 0.6:
			var mat = g.material_override
			print("NEAR-HEAD ", g.get_path(), " ", r, " ", mat.shader.resource_path if mat is ShaderMaterial and mat.shader else str(mat))
