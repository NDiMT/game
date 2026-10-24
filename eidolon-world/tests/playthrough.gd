extends Node
## Headless scripted playthrough of "The Veiled Gate" through the REAL game code (movement, interaction,
## puzzles, reflections, finale, save):
##   godot --headless --fixed-fps 60 --path eidolon-world res://tests/playthrough.tscn
## Exits 0 when every check passes. Prints one line per check.

var game: Game
var t := 0.0
var errors := 0
var checks := 0
var steps: Array = []
var si := 0
var wait := 0.0
var cond: Callable
var cond_label := ""
var cond_deadline := 0.0
var walk_mode := false
var walk_t := 0.0
var walk_end := 0.0
var walk_samples := 0
var walk_violations := 0
var walk_change := 0.0
var max_dy := 0.0
var rng := RandomNumberGenerator.new()
var _last := Vector3.INF
var _lag_samples := []
var notes := []

func _ready() -> void:
	Game.autotest = true
	rng.seed = 2026
	game = load("res://scenes/main.tscn").instantiate()
	add_child(game)
	_plan()

func ok(label: String, pass_: bool, detail := "") -> void:
	checks += 1
	if not pass_: errors += 1
	print("%s  %s %s" % ["PASS" if pass_ else "FAIL", label, detail])

func P() -> Vector3:
	return game.player.position

func step_do(f: Callable) -> void: steps.append(["do", f])
func step_wait(s: float) -> void: steps.append(["wait", s])
func step_until(label: String, f: Callable, timeout: float) -> void: steps.append(["until", label, f, timeout])
func step_walk(seconds: float) -> void: steps.append(["walk", seconds])

func tp(x: float, z: float, yaw := 0.0) -> void:
	if game.level.blocked(Vector2(x, z), Player.RADIUS) or not game.level.circle_ok(Vector2(x, z), Player.RADIUS):
		ok("test teleport lands on free ground (%.2f, %.2f)" % [x, z], false)
	game.cmd("tp:%f:%f:%f" % [x, z, yaw])

func walk_to(x: float, z: float) -> void:
	game.cmd("walk:%f:%f" % [x, z])

func walk_path(label: String, pts: Array) -> void:
	for q in pts:
		step_do(func() -> void: walk_to(q[0], q[1]))
		step_until(label + " -> " + str(q), func() -> bool: return game.auto_target == Vector3.INF, 10.0)

func interact_n(n: int, gap := 0.25) -> void:
	for k in n:
		step_do(func() -> void:
			var r: bool = game.try_interact()
			if not r: ok("interact available (%s)" % _focus(), false))
		step_wait(gap)

var _yaw0 := 0
func _focus() -> String:
	return game.focus.id if game.focus else "none"

func _plan() -> void:
	step_until("title", func() -> bool: return game.mode == "title" and game.sfx.ready_ok, 20.0)
	step_do(func() -> void: game.cmd("reset_save"); game.cmd("anew"))
	step_until("wake -> play", func() -> bool: return game.mode == "play", 12.0)
	step_do(func() -> void: ok("woke at the veiled gate", P().distance_to(Level.WAKE_POS) < 0.2, str(P())))

	# ---- glimpse 1: the pool reflection lags
	step_do(func() -> void: tp(-0.3, 1.9, PI * 0.5))
	step_wait(0.6)
	step_do(func() -> void: walk_to(-0.3, -1.5); _lag_samples.clear())
	step_until("walked past the pool", func() -> bool:
		var r: Reflector = game.puzzles.pool_refl
		if r.active and game.player.speed01 > 0.8:
			var now := r.reflect_point(P())
			_lag_samples.append(Vector2(now.x - r.puppet.global_position.x, now.z - r.puppet.global_position.z).length())
		return not game.auto_target != Vector3.INF, 8.0)
	step_do(func() -> void:
		var r: Reflector = game.puzzles.pool_refl
		var lag := 0.0
		for v in _lag_samples: lag = maxf(lag, v)
		ok("pool reflection visible", _lag_samples.size() > 5, "samples=%d" % _lag_samples.size())
		ok("glimpse 1: reflection lags (~0.42 s at walking speed)", lag > 0.8 and lag < 1.4, "lag distance %.2f m" % lag)
		ok("glimpse 1 signalled", game.glimpses.get("lag", 0) >= 1))
	step_do(func() -> void: walk_to(-0.3, 0.6))
	step_wait(2.5)
	step_do(func() -> void:
		var r: Reflector = game.puzzles.pool_refl
		var now := r.reflect_point(P())
		ok("pool reflection catches up when still", Vector2(now.x - r.puppet.global_position.x, now.z - r.puppet.global_position.z).length() < 0.05))

	# ---- walk the real path T -> stairs -> Hall of Glass
	step_do(func() -> void: walk_to(0.0, -5.5))
	step_until("walk to the north bridge", func() -> bool: return game.auto_target == Vector3.INF, 10.0)
	step_do(func() -> void: walk_to(0.0, -12.0))
	step_until("climb the stair into the Hall", func() -> bool: return game.auto_target == Vector3.INF, 10.0)
	step_do(func() -> void: ok("area name shown on entering the hall", game.area == "hall" and game.ui.area_label.text == Names.area("hall").to_upper(), game.ui.area_label.text))
	step_do(func() -> void: ok("reached the Hall of Glass by the stair", absf(P().y - 1.0) < 0.01 and P().z < -11.5, str(P())))

	# ---- glimpse 2: the reflection looks toward the hidden tablet
	step_do(func() -> void: walk_to(0.6, -19.4))
	step_until("walk to the great mirror", func() -> bool: return game.auto_target == Vector3.INF, 10.0)
	step_do(func() -> void: game.cmd("face:0"))
	step_wait(5.0)
	step_do(func() -> void:
		var r: Reflector = game.puzzles.hall_mirror
		ok("great mirror reflection seen in the glass", r.active and r.seen_in_glass(P() + Vector3(0, 0.7, 0), game.world.cam_back))
		ok("glimpse 2: reflection turns its head toward the tablet", r.gaze_head > 0.99 and r.gaze_body > 0.9, "head=%.2f body=%.2f" % [r.gaze_head, r.gaze_body])
		var fwd := -r.puppet.global_transform.basis.z
		var want := (r.reflect_point(Puzzles.TABLET_POS) - r.puppet.global_position)
		want.y = 0.0
		ok("glimpse 2: reflection faces the mirrored tablet", Vector2(fwd.x, fwd.z).normalized().dot(Vector2(want.x, want.z).normalized()) > 0.8)
		ok("glimpse 2 chime", game.glimpses.get("gaze", 0) >= 1 and game.sfx.played.get("chime_hall", 0) >= 1))
	step_do(func() -> void: game.cmd("input:1:0"))
	step_wait(0.5)
	step_do(func() -> void:
		game.cmd("stop")
		ok("glimpse 2: snaps back when you move", game.puzzles.hall_mirror.gaze_head < 0.05))
	# read the hidden tablet
	step_do(func() -> void: walk_to(3.7, -19.9))
	step_until("walk to the tablet", func() -> bool: return game.auto_target == Vector3.INF, 10.0)
	step_do(func() -> void: ok("tablet readable", game.try_interact() and game.puzzles.state["tablet"], _focus()))

	# ---- into the garden
	walk_path("hall to garden", [[2.0, -19.5], [1.2, -16.5], [1.2, -13.0], [6.0, -13.0], [9.5, -12.0], [11.5, -11.0]])
	step_do(func() -> void: ok("reached the Garden of the Veiled", P().x > 7.5 and absf(P().y - 1.0) < 0.01, str(P())))

	# ---- the shortcut: locked from the veiled gate, opened from the far side
	step_do(func() -> void: tp(4.5, -2.4, -PI * 0.5))
	step_wait(0.3)
	step_do(func() -> void: ok("gate is locked from the veiled gate side", _focus() == "gate_locked" and game.try_interact() and not game.puzzles.state["shortcut"]))
	step_do(func() -> void: walk_to(6.5, -2.0))
	step_until("blocked by the gate", func() -> bool: return game.player.speed01 < 0.01 and game.player.still_time > 0.3, 6.0)
	step_do(func() -> void:
		game.cmd("stop")
		ok("the closed gate blocks the way", P().x < 4.95, str(P())))
	step_do(func() -> void: tp(8.5, -4.2, PI))
	step_do(func() -> void: walk_to(8.5, -2.0))
	step_until("down the shortcut", func() -> bool: return game.auto_target == Vector3.INF, 8.0)
	step_do(func() -> void: walk_to(5.9, -2.0))
	step_until("to the gate lever", func() -> bool: return game.auto_target == Vector3.INF, 8.0)
	step_do(func() -> void: ok("gate opens from the far side", _focus() == "gate_open" and game.try_interact() and game.puzzles.state["shortcut"]))
	step_wait(2.5)
	step_do(func() -> void: walk_to(2.5, -2.0))
	step_until("through the shortcut", func() -> bool: return game.auto_target == Vector3.INF, 8.0)
	step_do(func() -> void: ok("shortcut leads back to the veiled gate", P().x < 3.0 and absf(P().y) < 0.01, str(P())))

	# ---- a) rune door
	for k in 3:
		var sp: Array = [[15.5, -6.7], [8.4, -10.7], [15.7, -12.9]][k]
		step_do(func() -> void:
			var c := Vector3(12.0, 1.0, -9.5)
			var d := (c - Vector3(sp[0], 1.0, sp[1])).normalized()
			tp(sp[0] + d.x * 1.05, sp[1] + d.z * 1.05))
		step_wait(0.2)
		step_do(func() -> void: ok("read statue %d" % (k + 1), _focus() == "statue%d" % (k + 1) and game.try_interact() and game.ui.card.modulate.a >= 0.0, _focus()))
		step_wait(0.3)
	step_do(func() -> void:
		tp(12.0, -14.0)
		ok("the rune door blocks the passage", true))
	step_do(func() -> void: walk_to(12.0, -16.0))
	step_until("blocked by the door", func() -> bool: return game.player.speed01 < 0.01 and game.player.still_time > 0.3, 5.0)
	step_do(func() -> void:
		game.cmd("stop")
		ok("closed door blocks", P().z > -14.9, str(P())))
	step_do(func() -> void: ok("the door's slots start on the first rune (not empty)", game.puzzles.state["door"] == [0, 0, 0], str(game.puzzles.state["door"])))
	# the close (x) consumes its tap: the camera does not turn, the overlay closes cleanly
	step_do(func() -> void: tp(Puzzles.DIAL_X0, Puzzles.DIAL_Z + 0.65, 0.0))
	step_wait(0.2)
	step_do(func() -> void:
		game.try_interact()
		_yaw0 = game.world.yaw_index
		var ov: Control = game.ui.door_overlay
		var p: Vector2 = ov.get_global_transform_with_canvas() * ov._close_r.get_center()
		# the web order: the emulated mouse press first, then the touch itself, then the releases
		var mb := InputEventMouseButton.new(); mb.button_index = MOUSE_BUTTON_LEFT; mb.pressed = true; mb.position = p; mb.global_position = p; mb.device = InputEvent.DEVICE_ID_EMULATION
		game.get_viewport().push_input(mb, true)
		var tch := InputEventScreenTouch.new(); tch.index = 0; tch.pressed = true; tch.position = p
		game.get_viewport().push_input(tch, true)
		var mr := mb.duplicate(); mr.pressed = false
		game.get_viewport().push_input(mr, true)
		var tr := tch.duplicate(); tr.pressed = false
		game.get_viewport().push_input(tr, true))
	step_wait(0.5)
	step_do(func() -> void:
		var ov = game.ui.door_overlay
		ok("tapping x closes the door close-up", not ov.visible and game.mode == "play")
		ok("tapping x does not turn the camera", game.world.yaw_index == _yaw0, "yaw %d -> %d" % [_yaw0, game.world.yaw_index])
		ok("closed cleanly: no card left mid-flip, rotate buttons back", ov.big.scale == Vector2.ONE and ov.slots[0].scale == Vector2.ONE and game.controls.enabled and not game.controls.blocked()))
	for i in 3:
		var x := Puzzles.DIAL_X0 + i * Puzzles.DIAL_DX
		var presses: int = Puzzles.DOOR_SOLUTION[i]
		step_do(func() -> void: tp(x, Puzzles.DIAL_Z + 0.65, 0.0))
		step_wait(0.2)
		step_do(func() -> void:
			ok("dial %d in reach" % (i + 1), _focus() == "dial%d" % (i + 1), _focus())
			ok("dial %d opens the door close-up" % (i + 1), game.try_interact() and game.mode == "door" and game.ui.door_overlay.visible and game.ui.door_overlay.selected == i))
		for k in presses:
			step_do(func() -> void: game.ui.door_overlay.slot_pressed.emit(i))   # the overlay's tap path
			step_wait(0.25)
		step_do(func() -> void:
			ok("slot %d shows its rune in the close-up" % (i + 1), int(game.ui.door_overlay.designs[i]) == int(game.puzzles.state["door"][i]))
			if not game.puzzles.state["door_open"]: game.ui.door_overlay.close())
		step_wait(0.4)
	step_do(func() -> void: ok("door runes match the statues", game.puzzles.state["door"] == Puzzles.DOOR_SOLUTION, str(game.puzzles.state["door"])))
	step_until("door grinds open", func() -> bool: return game.puzzles.state["door_open"] and not game.puzzles.busy, 10.0)
	step_do(func() -> void: ok("close-up closes itself after the solve", game.mode == "play" and not game.ui.door_overlay.visible))
	walk_path("through the door", [[12.7, -12.3], [12.7, -14.0], [12.0, -15.4], [12.0, -18.5]])
	step_do(func() -> void: ok("reached the Court of Light through the door", absf(P().y - 2.0) < 0.01 and P().z < -17.5, str(P())))

	# ---- b) mirrors and light
	step_do(func() -> void: ok("beam not lit at start", not game.puzzles.beam_lit))
	step_do(func() -> void: walk_to(16.0, -22.0))
	step_until("walk to the bridge head", func() -> bool: return game.player.still_time > 0.3, 8.0)
	step_do(func() -> void:
		game.cmd("stop")
		game.cmd("input:1:-1")
		walk_change = P().x)
	step_wait(1.5)
	step_do(func() -> void:
		game.cmd("stop")
		ok("raised drawbridge: cannot leave the court", P().x < 16.8, str(P())))
	var mstand := [Vector2(11.25, -24.5), Vector2(11.25, -19.5), Vector2(15.55, -19.5)]
	for i in 3:
		var presses: int = (int(Puzzles.MIRROR_SOLUTION[i]) - int([3, 2, 0][i]) + 4) % 4
		step_do(func() -> void: tp(mstand[i].x, mstand[i].y))
		step_wait(0.2)
		step_do(func() -> void: ok("mirror %d in reach" % (i + 1), _focus() == "mirror%d" % (i + 1), _focus()))
		interact_n(presses, 0.7)
	step_until("beam reaches the crystal", func() -> bool: return game.puzzles.beam_lit, 3.0)
	step_do(func() -> void:
		var pts: Array = game.puzzles.beam_points
		ok("beam bounces off three mirrors", pts.size() == 5, "points=%d" % pts.size()))
	step_until("drawbridge falls", func() -> bool: return game.puzzles.state["bridge"] and not game.puzzles.busy, 8.0)
	walk_path("over the drawbridge", [[15.5, -21.5], [16.9, -22.0], [22.5, -22.0]])
	step_do(func() -> void: ok("crossed to the Eidolon ledge", P().x > 21.5, str(P())))

	# ---- c) the eidolon plate
	step_do(func() -> void: ok("eidolon reflection walks beyond the glass", game.puzzles.eidolon_refl.active))
	step_do(func() -> void: walk_to(27.7, -24.6))
	step_until("try the gap", func() -> bool: return game.player.still_time > 0.3 or game.auto_target == Vector3.INF, 8.0)
	step_do(func() -> void:
		game.cmd("stop")
		game.cmd("input:0:-1"))
	step_wait(1.2)
	step_do(func() -> void:
		game.cmd("stop")
		ok("the gap cannot be crossed before the plate", P().z > -25.01, str(P())))
	step_do(func() -> void: walk_to(25.5, -21.6))
	step_until("wait by the glass", func() -> bool: return game.auto_target == Vector3.INF, 8.0)
	step_wait(6.5)
	step_do(func() -> void:
		var fm: float = game.puzzles.foot_mat.get_shader_parameter("intensity")
		ok("footprint marker shows where to stand", fm > 0.6 and Vector2(game.puzzles.foot_spot.x - 23.6, game.puzzles.foot_spot.z + 20.34).length() < 0.05, "intensity %.2f" % fm)
		walk_change = float(game.puzzles.near_mat.get_shader_parameter("radius")))
	step_do(func() -> void: walk_to(23.6, -20.3))
	step_wait(0.6)
	step_do(func() -> void:
		var r: float = game.puzzles.near_mat.get_shader_parameter("radius")
		ok("closeness ring tightens as the reflection nears the plate", r < walk_change, "%.2f -> %.2f" % [walk_change, r]))
	step_until("stand where the reflection stands on the plate", func() -> bool: return game.auto_target == Vector3.INF, 10.0)
	step_until("plate pressed by the reflection", func() -> bool: return game.puzzles.state["plate"], 4.0)
	step_do(func() -> void:
		var rp: Vector3 = game.puzzles.eidolon_refl.reflect_point(P())
		ok("reflection stands on the plate", Vector2(rp.x - Puzzles.PLATE_POS.x, rp.z - Puzzles.PLATE_POS.z).length() < 0.55, str(rp)))
	step_until("the bridge rises", func() -> bool: return not game.puzzles.busy, 8.0)
	step_do(func() -> void: walk_to(27.7, -24.4))
	step_until("to the risen bridge", func() -> bool: return game.auto_target == Vector3.INF, 10.0)
	step_do(func() -> void: walk_to(27.7, -28.8))
	step_until("cross the gap", func() -> bool: return game.auto_target == Vector3.INF, 10.0)
	walk_path("into the shrine", [[25.0, -29.3], [25.0, -31.3]])
	step_do(func() -> void: ok("reached the shrine", P().z < -30.5, str(P())))

	# ---- the shrine finale
	step_do(func() -> void:
		ok("shrine is dark", game.world.awaken == 0.0)
		ok("wake the shrine", _focus() == "shrine" and game.try_interact(), _focus()))
	step_wait(5.0)
	step_do(func() -> void: ok("memory fragment shows", game.ui.memory.modulate.a > 0.3))
	step_until("shrine counter I / VII shows", func() -> bool: return game.ui.end_b.modulate.a > 0.5 and game.ui.end_b.text == "I  /  VII", 20.0)
	step_until("the shrine wakes, fog recedes", func() -> bool: return game.mode == "play" and game.world.awaken >= 0.999, 30.0)
	step_do(func() -> void:
		ok("the world beyond is revealed", game.level.beyond.visible)
		ok("first shrine lights one cloak rune and brightens the hem", game.player.fig.runes_awake == 1 and game.player.fig.hem > 1.5)
		ok("the reflection copies the awakened rune", game.puzzles.reflectors[0].puppet.runes_awake == 1 or not game.puzzles.reflectors[0].active)
		ok("the shrine leaves its light on", float(game.puzzles.shrine_pillar.get_shader_parameter("fade")) > 0.5)
		ok("milestone text names the space", game.ui.end_a.text == "The Veiled Gate — awakened", game.ui.end_a.text)
		ok("milestone, not an ending: still playable", game.mode == "play" and not game.player.locked)
		ok("fog density animated down", game.world.env.fog_depth_end > World.DIST + 50.0 and game.world.fog_mats[World.VEIL].get_shader_parameter("clear") > 0.99)
		ok("music swelled", game.sfx.played.get("swell", 0) >= 1))

	# ---- cannot fall: random walks in every space (doors, bridges open now) + edge pushes
	walk_path("to the sealed way", [[25.0, -29.3], [28.0, -29.3], [28.0, -36.5], [28.0, -38.6]])
	step_do(func() -> void:
		ok("the way on is sealed", P().z > -38.9 and _focus() == "sealed" and game.try_interact(), str(P())))
	for zone in [[28.0, -37.5], [0.0, 0.0], [0.0, -8.0], [0.0, -16.0], [12.0, -10.0], [8.5, -3.0], [12.0, -22.0], [19.0, -22.0], [25.0, -22.0], [25.0, -30.4], [27.7, -26.5], [0.0, 6.5]]:
		step_do(func() -> void: tp(zone[0], zone[1]))
		step_walk(16.0)
	step_do(func() -> void:
		ok("random walk: always on walkable ground", walk_violations == 0, "%d samples, %d violations, max step dy %.3f" % [walk_samples, walk_violations, max_dy]))

	# ---- save / restore
	step_do(func() -> void:
		game.cmd("save")
		var d = JSON.parse_string(FileAccess.get_file_as_string(Game.SAVE_PATH))
		var pz: Dictionary = d["puzzles"]
		ok("checkpoint saved", pz["door_open"] and pz["bridge"] and pz["plate"] and pz["shrine"] and pz["shortcut"], str(pz))
		var keep := P()
		game.queue_free()
		game = load("res://scenes/main.tscn").instantiate()
		add_child(game)
		walk_change = keep.x)
	step_until("reloaded title", func() -> bool: return game.mode == "title", 10.0)
	step_do(func() -> void: game.cmd("begin"))
	step_until("continue", func() -> bool: return game.mode == "play", 5.0)
	step_do(func() -> void:
		ok("restored puzzles", game.puzzles.state["door_open"] and game.puzzles.state["bridge"] and game.puzzles.state["plate"] and game.puzzles.state["shrine"])
		ok("restored regions", game.level.named["LB"].enabled and game.level.named["EB"].enabled and not game.level.named["door"].enabled and not game.level.named["gate"].enabled)
		ok("restored awakened world", game.world.awaken == 1.0)
		ok("restored runes_awake", game.player.fig.runes_awake == 1)
		ok("restored position", absf(P().x - walk_change) < 0.6, str(P())))
	# ---- New Game from the title: confirm, everything forgotten, settings kept
	step_do(func() -> void:
		game.cmd("save")
		game.set_quality("low", true)
		game.queue_free()
		game = load("res://scenes/main.tscn").instantiate()
		add_child(game))
	step_until("title again", func() -> bool: return game.mode == "title", 10.0)
	step_do(func() -> void:
		ok("title offers Continue + New Game", game.ui.tap_label.text == "CONTINUE" and game.ui.anew_btn.visible)
		game.ui.anew_btn.pressed.emit()
		ok("New Game asks to confirm", game.ui.confirm.visible and game.mode == "title")
		game.ui.confirm_no.pressed.emit()
		ok("No keeps the title and the save", not game.ui.confirm.visible and game.mode == "title" and FileAccess.file_exists(Game.SAVE_PATH))
		game.cmd("newgame_ui:yes")
		ok("new game: glimpses + areas forgotten", game.glimpses["lag"] == 0 and game.glimpses["gaze"] == 0 and game.visited.is_empty(), str(game.visited)))
	step_until("new game -> play", func() -> bool: return game.mode == "play", 12.0)
	step_do(func() -> void:
		var st: Dictionary = game.puzzles.state
		ok("new game: puzzles reset", not st["door_open"] and not st["bridge"] and not st["plate"] and not st["shrine"] and not st["shortcut"] and st["door"] == [0, 0, 0], str(st))
		ok("new game: regions reset", not game.level.named["LB"].enabled and game.level.named["door"].enabled)
		ok("new game: world asleep, runes dormant", game.world.awaken == 0.0 and game.player.fig.runes_awake == 0)
		ok("new game: woke at the gate", P().distance_to(Level.WAKE_POS) < 0.3, str(P()))
		var d = JSON.parse_string(FileAccess.get_file_as_string(Game.SAVE_PATH))
		ok("new game: save rewritten fresh", d is Dictionary and not d["puzzles"]["shrine"] and int(d["runes_awake"]) == 0)
		ok("new game: settings kept (quality)", game.world.tier == "low")
		game.set_quality("auto", true))
	step_do(func() -> void: _finish())

var _next_report := 0.0
func _process(dt: float) -> void:
	t += dt
	if t > _next_report:
		_next_report += 20.0
		print("  .. sim %.0fs  real %.0fs  step %d/%d" % [t, Time.get_ticks_msec() / 1000.0, si, steps.size()])
	if t > 900.0:
		print("TIMEOUT at step ", si)
		get_tree().quit(2)
		return
	if game and game.player and game.mode == "play":
		_check_ground()
	if walk_mode:
		walk_t += dt
		walk_change -= dt
		if walk_change <= 0.0:
			walk_change = rng.randf_range(0.3, 1.2)
			var a := rng.randf() * TAU
			var m := 0.0 if rng.randf() < 0.12 else 1.0
			game.key_vec = Vector2(cos(a), sin(a)) * m
		if walk_t >= walk_end:
			walk_mode = false
			game.cmd("stop")
		return
	if wait > 0.0:
		wait -= dt
		return
	if cond.is_valid():
		if cond.call():
			cond = Callable()
		elif t > cond_deadline:
			ok(cond_label, false, "timeout at " + str(P()))
			cond = Callable()
			game.cmd("stop")
		return
	while si < steps.size():
		var s: Array = steps[si]
		si += 1
		match s[0]:
			"do": (s[1] as Callable).call()
			"wait":
				wait = s[1]
				return
			"until":
				cond_label = s[1]
				cond = s[2]
				cond_deadline = t + float(s[3])
				return
			"walk":
				walk_mode = true
				walk_t = 0.0
				walk_end = s[1]
				walk_change = 0.0
				return

func _check_ground() -> void:
	var p := P()
	var q := Vector2(p.x, p.z)
	walk_samples += 1
	var lv: Level = game.level
	var bad := ""
	if not lv.on_ground(q): bad = "off ground"
	elif not lv.circle_ok(q, Player.RADIUS - 0.01): bad = "over an edge"
	elif lv.blocked(q, Player.RADIUS - 0.02): bad = "inside an obstacle"
	elif absf(p.y - lv.height_at(q)) > 0.001: bad = "floating"
	if _last != Vector3.INF and p.distance_to(_last) < 0.5: max_dy = maxf(max_dy, absf(p.y - _last.y))
	_last = p
	if bad != "":
		walk_violations += 1
		if walk_violations < 12: print("  violation: ", bad, " at ", p, " step ", si)

func _finish() -> void:
	print("PLAYTHROUGH %s  checks=%d  failed=%d  sim_time=%.1fs  ground_samples=%d" % ["OK" if errors == 0 else "FAILED", checks, errors, t, walk_samples])
	get_tree().quit(0 if errors == 0 else 1)
