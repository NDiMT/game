extends Node
## (Agent A, dev) Act 3 in place: the Pool of Halves' fog and its lift, the bridge giving way, the Gate of the Four's
## runes and sinking, the First Shrine's writing, eye and the "beyond". --tag=before: W3's build as is; --tag=after: with
## A's hooks applied here (FogBank, FxBurst.crumble, OmenFx.rune_wake / gate_sink, Dress.beyond_colossus) as W3 will.
##   xvfb-run godot --path . --rendering-driver opengl3 --resolution 780x1688 res://dev_fx/act3_probe.tscn -- --shots=/abs --tag=after [--only=fog,lift,...]
const STEPS := ["fog", "lift", "bridge", "gate", "shrine"]
var game: Node
var shots := ""
var tag := "before"
var only: PackedStringArray = []
var i := -1
var t := 0.0
var _begun := false
var _fired := false
var _k := 0
var fog: FogBank
var after := false
var _hide_tests: Array = []
var _ht := 0.0

func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shots="): shots = a.get_slice("=", 1)
		if a.begins_with("--tag="): tag = a.get_slice("=", 1)
		if a.begins_with("--only="): only = a.get_slice("=", 1).split(",")
	after = tag != "before"
	Map2.labels_on = false
	Game.autotest = true
	game = load("res://scenes/main.tscn").instantiate()
	add_child(game)

func _shot(n: String) -> void:
	var nm := "a3-%s-%s" % [tag, n]
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
		if t > 7.0:
			if after: _apply_hooks()
			_next()
		return
	if not _hide_tests.is_empty():
		_ht += dt
		if _ht > 0.6:
			_ht = 0.0
			var what: String = _hide_tests.pop_front()
			match what:
				"halo": for n in game.find_children("Batch_halo*", "Node3D", true, false): n.visible = false
				"pillar": for n in game.find_children("*", "MeshInstance3D", true, false):
					var m = (n as MeshInstance3D).material_override
					if m is ShaderMaterial and (m as ShaderMaterial).shader and (m as ShaderMaterial).shader.resource_path.ends_with("beam.gdshader"): n.visible = false
				"beyond": game.level.beyond.visible = false
			await get_tree().process_frame
			await get_tree().process_frame
			_shot("hide-" + what)
		return
	if i >= STEPS.size():
		get_tree().quit(); return
	match STEPS[i]:
		"fog":
			if not _fired: _fired = true; game.cmd("tp:-7.0:16.1"); t = 0.0
			elif t > 3.0: _shot("fog"); _next()
		"lift":
			if not _fired:
				_fired = true; t = 0.0
				game.chapter.act3._on_open()
				if fog: fog.lift(4.5)
			elif _k == 0 and t > 1.4: _shot("lift-1"); _k = 1
			elif _k == 1 and t > 3.0: _shot("lift-2"); _k = 2
			elif _k == 2 and t > 7.5: _shot("lift-3"); _next()
		"bridge":
			var a3: Node = game.chapter.act3
			if not _fired:
				_fired = true; t = 0.0
				var x: float = a3._span_x(a3.LURCH + 1)
				game.cmd("tp:%f:%f" % [x, 18.85])
			elif _k == 0 and t > 2.5:
				_k = 1; t = 2.5
				a3._lurch(false)
				a3._fall(1, false)
				if after:
					var p: Vector3 = a3.lurch_node.global_position
					for sx in [-1.0, 1.0]: FxBurst.crumble(game.juice, p + Vector3(sx * 0.95, -0.25, 0), 1.0)
					var c: Node3D = a3.chunks[1]
					FxBurst.crumble(game.juice, c.global_position + Vector3(0, -0.1, 0), 0.6)
			elif _k == 1 and t > 2.9: _shot("bridge-1"); _k = 2
			elif _k == 2 and t > 3.6: _shot("bridge-2"); _next()
		"gate":
			var ch: Node = game.chapter
			if not _fired:
				_fired = true; t = 0.0
				game.cmd("tp:-44.6:16.4")            # (between the near plinths, the gate in view)
			elif _k == 0 and t > 2.5:
				_k = 1; t = 2.5
				for r in 4:
					var rp: Vector3 = ch.four_pos(r) + Vector3(0, Map2.PLINTH_H * 0.5, 0.505)
					get_tree().create_timer(0.6 * r).timeout.connect(func() -> void:
						(ch.four_mats[r] as ShaderMaterial).set_shader_parameter("lit", 1.0)
						if after: OmenFx.rune_wake(ch, rp, Vector3.BACK, 0.7))
				get_tree().create_timer(2.6).timeout.connect(func() -> void:
					ch.open_four(false)
					var d: Node3D = ch._four_gate()
					if after and d: OmenFx.gate_sink(ch, d.global_position, Vector3.RIGHT, 3.7, 3.4, Vector3.FORWARD))
			elif _k == 1 and t > 4.0: _shot("gate-runes"); _k = 2
			elif _k == 2 and t > 6.6: _shot("gate-sink"); _k = 3
			elif _k == 3 and t > 9.5: _shot("gate-open"); _next()
		"shrine":
			if not _fired:
				_fired = true; t = 0.0
				game.cmd("tp:%f:%f" % [Map2.SHRINE_STAND.x, Map2.SHRINE_STAND.z])
			elif _k == 0 and t > 2.0:
				_k = 1
				game.start_finale()
			elif _k >= 1 and game.cine:
				var ct: float = game.cine.t
				var P: float = Chapter.CINE_P
				if _k == 1 and ct > P + 26.5: _shot("write"); _k = 2
				elif _k == 2 and ct > P + 31.0: _shot("eye"); _k = 3
				elif _k == 3 and ct > P + 54.0:
					_shot("beyond"); _k = 4
					if OS.get_cmdline_user_args().has("--dbg"):
						_dbg_big()
						_hide_tests = ["halo", "pillar", "beyond"]
					_next()
			elif _k >= 1 and t > 90.0: _next()

func _next() -> void:
	i += 1; t = 0.0; _fired = false; _k = 0
	while i < STEPS.size() and only.size() > 0 and not only.has(STEPS[i]): i += 1

## what W3 wires (HANDOFF): here for the shots
func _apply_hooks() -> void:
	var a3: Node = game.chapter.act3
	# the pool: a fog bank over the water, the light murk W3 keeps under it
	var e: Array = Map2.WATER[0]
	var r := Map2.wr(e[0], e[1], e[2], e[3])
	fog = FogBank.make(a3, r, float(e[4]))
	for m in a3.mists: if is_instance_valid(m): (m as FxBurst).stop()
	a3.mists.clear()
	OmenFx.murk(game.chapter.act1.pool_water, 0.4, 0.01)
	# the beyond: the colossal veiled figure in place of the primitive one
	var lv: Level = game.level
	for c in lv.beyond.get_children():
		if c is MeshInstance3D and (c as MeshInstance3D).material_override is StandardMaterial3D: (c as MeshInstance3D).visible = false
	var at := Vector3(Level.SHRINE_C.x, -6.0, Level.SHRINE_C.z) + Level.BEYOND_FWD * 40.0 + Level.BEYOND_RIGHT * 3.0
	Dress.beyond_colossus(lv.beyond, at, 26.0, 20.0)

## (debug) the big things on screen at the "beyond"
func _dbg_big() -> void:
	var cam := get_viewport().get_camera_3d()
	var vs := get_viewport().get_visible_rect().size
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
		if r.size.x * r.size.y > vs.x * vs.y * 0.15:
			var mat = g.material_override
			print("BIG ", g.get_path(), " ", r, " ", mat.shader.resource_path if mat is ShaderMaterial and mat.shader else str(mat))
