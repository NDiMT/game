extends Node
## (Agent A, dev) v2.0 effects IN THE GAME: loads main.tscn, goes to real places and fires the v2 builders (OmenFx,
## PassThrough, BeaconFire, WardenRig glass, IntroCard) on the game's own nodes, with its camera, fog and tier.
##   xvfb-run godot --path . --rendering-driver opengl3 --resolution 780x1688 res://dev_fx/v2_fx_ingame.tscn -- --shots=/abs/dir [--low] [--only=name,name]
## Each step: [name, "jump" room or "", tp xz (or null), what to fire, [seconds after firing to shoot, ...]]
const STEPS := [
	["palm", "waking_pool", Vector2(-3.2, 1.0), "palm", [0.6, 1.95, 2.35]],
	["warden", "waking_pool", Vector2(-3.2, 1.0), "warden", [1.2, 2.4, 4.0]],
	["murk", "waking_pool", Vector2(-3.2, 1.0), "murk", [2.4]],
	["comb", "waking_pool", Vector2(-3.2, 1.0), "comb", [0.55, 0.9, 1.5, 2.6]],
	["shard", "hall_glass", Vector2(0.6, -16.8), "shard", [0.35, 0.9, 3.5]],
	["frost", "hall_glass", Vector2(0.6, -16.8), "frost", [0.45, 1.3, 3.0]],
	["beacon", "atrium", Vector2(5.0, 16.4), "beacon", [0.25, 0.9, 4.0]],
	["write", "first_shrine", null, "write", [1.4, 3.2, 5.0]],
	["eye", "first_shrine", null, "eye", [0.5, 1.4, 2.6]],
	["card", "", null, "card", [0.5, 1.1, 1.7, 2.1, 2.8, 4.3]],
]
var game: Node
var shots := ""
var only: PackedStringArray = []
var i := -1
var t := 0.0
var fired := false
var shot_i := 0
var _tp := -1
var _fx: Array = []

func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shots="): shots = a.get_slice("=", 1)
		if a.begins_with("--only="): only = a.get_slice("=", 1).split(",")
	Game.autotest = true
	game = load("res://scenes/main.tscn").instantiate()
	add_child(game)

func _next() -> void:
	for n in _fx: if is_instance_valid(n): n.queue_free()
	_fx.clear()
	i += 1; t = 0.0; fired = false; shot_i = 0
	while i < STEPS.size() and only.size() > 0 and not only.has(STEPS[i][0]): i += 1

func _process(dt: float) -> void:
	t += dt
	if i == -1:
		if t > 2.0:
			game.cmd("begin")
			if OS.get_cmdline_user_args().has("--low"): game.set_quality("low")
			i = -1; _next()
		return
	if i >= STEPS.size():
		get_tree().quit(); return
	var s: Array = STEPS[i]
	if _tp != i:          # (once per step, by flag)
		_tp = i
		if s[1] != "": game.cmd("jump:" + s[1])
		if s[2] != null: game.cmd("tp:%f:%f" % [s[2].x, s[2].y])
		game.cmd("zoom:%f" % (4.2 if s[1] == "first_shrine" else World.FIXED_SIZE))      # (the shrine finale is shot close, as W's cinematic does)
		t = 0.0
	if t > 2.5 and not fired:
		fired = true; t = 0.0
		_fire(s[3])
		return
	if fired:
		var times: Array = s[4]
		if shot_i < times.size() and t > float(times[shot_i]):
			var nm := "v2fx-%s-%d" % [s[0], shot_i]
			if shots != "": get_viewport().get_texture().get_image().save_png("%s/%s.png" % [shots, nm])
			print("shot ", nm)
			shot_i += 1
			if shot_i >= times.size(): _next()

## the point on the horizontal plane at height y under a screen pixel (of the 780 x 1688 shot)
func _at(sx: float, sy: float, y: float) -> Vector3:
	var cam := get_viewport().get_camera_3d()
	var vs := get_viewport().get_visible_rect().size
	var sp := Vector2(sx, sy) * vs / Vector2(780, 1688)
	var o := cam.project_ray_origin(sp)
	var d := cam.project_ray_normal(sp)
	return o + d * ((y - o.y) / d.y)

func _fire(what: String) -> void:
	var cam := get_viewport().get_camera_3d()
	print("cam ", what, " ", cam.global_transform, " size ", cam.size, " vp ", get_viewport().get_visible_rect().size)
	for q in [Vector3(-2.6, 1.15, -20.5), Vector3(2.6, 5.6, -20.5), Vector3(1.7, 2.1, -20.46), Vector3(-0.6, 2.8, -20.46)]:
		print("  ", q, " -> ", cam.unproject_position(q))
	var j: Node = game.juice
	var pp: Vector3 = game.player.global_position
	var wy := Ch1Geo.WATER_Y
	match what:
		"palm":
			_fx.append(OmenFx.palm_press(j, _at(190, 1150, wy), 0.3, game.puzzles.pool_fx, 2))
		"warden":
			var w := WardenRig.new()
			j.add_child(w)
			w.global_position = _at(150, 1090, wy) + Vector3(0, -0.55, 0)
			w.rotation.y = 0.4
			w.set_look("glass")
			w.rise_from(wy, 3.2, NAN, game.puzzles.pool_fx)
			_fx.append(w)
		"murk":
			OmenFx.murk(game.puzzles.water_mat, 1.0, 2.0)
			get_tree().create_timer(2.6).timeout.connect(func() -> void: game.puzzles.water_mat.set_shader_parameter("murk", 0.0))
		"comb":
			var c: Node3D = (load("res://assets/models/items/item_comb.glb") as PackedScene).instantiate()
			c.scale = Vector3.ONE * 2.2          # (the hero's scale: items are shown bigger in the world)
			j.add_child(c)
			var at := _at(250, 1190, wy)
			c.global_position = at
			PassThrough.water(j, at, c, game.puzzles.pool_fx, 0.35, 1.6, at + Vector3(0.3, 0.02, 0.3))
			_fx.append(c)
		"shard":
			var sh: Node3D = (load("res://assets/models/items/item_shard.glb") as PackedScene).instantiate()
			sh.scale = Vector3.ONE * 2.5
			j.add_child(sh)
			sh.global_position = Vector3(1.7, 2.1, -20.0)
			PassThrough.mirror(j, Vector3(1.7, 2.1, -20.46), Vector3.BACK, sh, 1.6, true)
			_fx.append(sh)
		"frost":
			_fx.append(OmenFx.frost(j, Vector3(-0.6, 2.8, -20.46), Vector3.BACK, Vector2(3.6, 3.6), 1.6))
		"beacon":
			var xs := [2.0, 5.0, 8.0]
			for k in 3:
				var base := Vector3(xs[k], 0.0, 13.4 if k == 1 else 14.2)
				var col := MeshInstance3D.new()
				var cy := CylinderMesh.new(); cy.top_radius = 0.38; cy.bottom_radius = 0.45; cy.height = 1.3
				col.mesh = cy
				var pmat := StandardMaterial3D.new(); pmat.albedo_color = Color(0.86, 0.83, 0.79); col.material_override = pmat
				j.add_child(col)
				col.global_position = base + Vector3(0, 0.65, 0)
				var bf := BeaconFire.new()
				col.add_child(bf)
				bf.position = Vector3(0, 0.66, 0)
				_fx.append(col)
				if k == 1: bf.set_lit(true)            # one already burning: ignition next to the idle loop
				else: get_tree().create_timer(0.05 * k).timeout.connect(bf.ignite)
		"write":
			_fx.append(OmenFx.write_in_water(j, Chapter.POOL_C, cam.global_rotation.y, "ΒΡΕΣ ΜΕ", 4.2, 0.36, 3.0))
		"eye":
			_fx.append(OmenFx.glass_eye(j, Chapter.POOL_C + Vector3(0, 0, -0.1), 1.5, 1.1, 2.4, cam.global_rotation.y))
		"card":
			var cl := CanvasLayer.new(); cl.layer = 50
			add_child(cl)
			var ic := IntroCard.new()
			cl.add_child(ic)
			ic.play("Η Αφροδίτη της έδωσε ζωή, με έναν όρο:\n*«Άφησε το πρόσωπό της λείο.\nΤο πρόσωπο το σκαλίζει η ζωή, από μέσα.»*", 1.2)
			_fx.append(cl)
