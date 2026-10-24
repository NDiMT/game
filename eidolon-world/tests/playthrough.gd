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

var _hw_prev := ""
var _mark := 0
var _feet_seen := false

func C() -> Chapter:
	return game.chapter

func hw_key() -> String:
	return str(C().state["hollows"]) + str(C().state["hollow_lock"])

## v0.5: Chapter I, all thirteen spaces, in order, through the real game code
func _plan() -> void:
	step_until("title", func() -> bool: return game.mode == "title" and game.sfx.ready_ok, 20.0)
	step_do(func() -> void: game.cmd("reset_save"); game.cmd("anew"))
	step_until("wake -> play", func() -> bool: return game.mode == "play", 12.0)
	step_do(func() -> void:
		ok("woke at the veiled gate", P().distance_to(Level.WAKE_POS) < 0.2, str(P()))
		ok("chapter title on the title screen", Names.CHAPTER == "The Veiled Gate"))

	# ================================================================ 1. the waking pool
	# glimpse 1: the pool reflection lags
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
		var lag := 0.0
		for v in _lag_samples: lag = maxf(lag, v)
		ok("pool reflection visible", _lag_samples.size() > 5, "samples=%d" % _lag_samples.size())
		ok("glimpse 1: reflection lags (~0.42 s at walking speed)", lag > 0.8 and lag < 1.4, "lag distance %.2f m" % lag)
		ok("glimpse 1 signalled", game.glimpses.get("lag", 0) >= 1))
	# ripples: walking stirs the water; the stones are not there
	step_do(func() -> void: walk_to(-0.35, 1.7))
	step_until("to the water's edge", func() -> bool: return game.auto_target == Vector3.INF, 8.0)
	step_do(func() -> void:
		ok("no way across the pool at first", not game.level.on_ground(Vector2(-1.25, 1.7)))
		game.cmd("input:-1:0"))
	step_wait(0.8)
	step_do(func() -> void:
		game.cmd("stop")
		ok("cannot walk into the pool", P().x > -0.66, str(P()))
		ok("moving keeps the water stirred", C().calm < 0.6, "calm %.2f" % C().calm))
	step_wait(1.5)
	step_do(func() -> void: ok("standing still calms the pool", C().calm > 0.3 and not C().state["stones"], "calm %.2f" % C().calm))
	step_until("the still water shows the stepping stones", func() -> bool: return C().state["stones"], 6.0)
	step_do(func() -> void:
		ok("stones are walkable now", game.level.on_ground(Vector2(-1.25, 1.7)) and game.level.on_ground(Vector2(-8.95, 1.75)))
		ok("solving plays its cue", game.sfx.played.get("cue:solve_waking_pool", 0) >= 1))
	var stones: Array = []
	for c in Ch1Geo.STONES: stones.append([c.x, c.y])
	stones.append([-10.6, 1.7])
	walk_path("over the stones", stones)
	step_do(func() -> void:
		ok("crossed the pool on the stones", P().x < -9.5 and absf(P().y) < 0.01, str(P()))
		ok("footsteps on the stones splash", game.sfx.played.get("step_wet", 0) > 0)
		ok("reached the Stair of Breath", game.area == "stair_breath", game.area))

	# ================================================================ 2. the stair of breath
	walk_path("up the first flight", [[-11.3, 0.6], [-11.3, -3.0], [-11.3, -5.3]])
	step_do(func() -> void:
		ok("on the breath landing", absf(P().y - 0.5) < 0.01, str(P()))
		walk_to(-11.3, -8.5))
	step_wait(0.7)
	step_until("blocked by the veil of mist", func() -> bool: return game.player.still_time > 0.4 or game.auto_target == Vector3.INF, 6.0)
	step_do(func() -> void:
		game.cmd("stop")
		ok("the mist veil blocks the stair", P().z > -6.7, str(P())))
	# a gentle hint after minutes without progress (fast-forwarded): a wisp, no words
	step_do(func() -> void:
		C().hint_t = Game.HINT_AFTER - 0.5
		_mark = game.sfx.played.get("glass_tink", 0))
	step_wait(1.0)
	step_do(func() -> void:
		ok("hint wisp drifts toward the small glass", C().wisp.visible and game.ui.text.modulate.a < 0.05)
		walk_to(-11.3, -5.3))
	step_until("back to the glass", func() -> bool: return game.auto_target == Vector3.INF, 5.0)
	step_do(func() -> void: ok("breathe on the glass", _focus() == "breathe_stair" and game.try_interact(), _focus()))
	step_until("she writes from the other side; the veil dissolves", func() -> bool: return C().state["breath"], 8.0)
	step_do(func() -> void:
		var m: ShaderMaterial = C().breath_mats["stair"]
		ok("her writing is on the fogged glass", float(m.get_shader_parameter("write")) > 0.99 and float(m.get_shader_parameter("fog")) > 0.9)
		ok("breath cue played", game.sfx.played.get("cue:breath", 0) >= 1))
	walk_path("up the second flight", [[-11.3, -9.0], [-11.3, -13.5], [-6.0, -13.5], [-2.0, -13.5]])
	step_do(func() -> void:
		ok("reached the Hall of Glass by the corridor", absf(P().y - 1.0) < 0.01 and game.area == "hall_glass", str(P()) + " " + game.area)
		ok("area name shown on entering the hall", game.ui.area_label.text == Names.area("hall_glass").to_upper(), game.ui.area_label.text))

	# ================================================================ 3. hall of glass
	step_do(func() -> void: walk_to(0.6, -19.4))
	step_until("walk to the great mirror", func() -> bool: return game.auto_target == Vector3.INF, 10.0)
	step_do(func() -> void: game.cmd("face:0"))
	step_wait(5.0)
	step_do(func() -> void:
		var r: Reflector = game.puzzles.hall_mirror
		ok("great mirror reflection seen in the glass", r.active and r.seen_in_glass(P() + Vector3(0, 0.7, 0), game.world.cam_back))
		ok("glimpse 2: reflection turns its head toward the tablet", r.gaze_head > 0.99 and r.gaze_body > 0.9, "head=%.2f body=%.2f" % [r.gaze_head, r.gaze_body]))
	step_do(func() -> void: game.cmd("input:1:0"))
	step_wait(0.5)
	step_do(func() -> void:
		game.cmd("stop")
		ok("glimpse 2: snaps back when you move", game.puzzles.hall_mirror.gaze_head < 0.05))
	step_do(func() -> void:
		var hd := game.level.get_node("Zone_Hdoor") as MeshInstance3D
		ok("the remembered door: a wall in your world, an opening in the glass", hd.visible and hd.layers == PlanarMirror.LAYER_MAIN_FX and not game.level.named["hdoor"].enabled)
		walk_to(0.0, -19.6))
	step_until("to the glass", func() -> bool: return game.auto_target == Vector3.INF, 6.0)
	step_do(func() -> void: ok("touch the glass", _focus() == "touch_glass" and game.try_interact(), _focus()))
	step_wait(1.0)
	step_do(func() -> void:
		ok("you reach for the glass, and so does she", game.player.extra_reach > 0.9 and game.puzzles.hall_mirror.reach_override > 0.9, "%.2f %.2f" % [game.player.extra_reach, game.puzzles.hall_mirror.reach_override]))
	step_until("she gives you the mirror shard", func() -> bool: return C().state["shard"], 5.0)
	step_do(func() -> void: ok("the shard is in the inventory", game.controls.inv_has and not game.controls.inv_on))
	step_until("the remembered door opens", func() -> bool: return C().state["hall_door"] and game.level.named["hdoor"].enabled and not game.player.locked, 5.0)
	walk_path("walk to the tablet", [[2.0, -18.0], [3.85, -18.2], [3.85, -19.15]])
	step_do(func() -> void: ok("tablet readable", game.try_interact() and game.puzzles.state["tablet"], _focus()))
	walk_path("through the remembered door", [[3.6, -17.5], [5.6, -17.5], [6.0, -16.0]])
	step_do(func() -> void: ok("reached the Shard Gallery", game.area == "shard_gallery" and P().x > 5.0, str(P()) + " " + game.area))

	# ================================================================ 4. the shard gallery
	walk_path("down the gallery", [[6.0, -12.0], [6.3, -8.5]])
	step_do(func() -> void:
		ok("the hidden passage is shut without the shard", _focus() != "gallery_secret", _focus())
		walk_to(7.8, -8.5))
	step_wait(0.7)
	step_until("the wall", func() -> bool: return game.player.still_time > 0.3 or game.auto_target == Vector3.INF, 4.0)
	step_do(func() -> void:
		game.cmd("stop")
		ok("the wall is solid", P().x < 6.6, str(P())))
	step_do(func() -> void:
		game.controls.shard.emit()           # the inventory slot tapped
		ok("raise the shard from the inventory", C().lens_on and game.controls.inv_on))
	step_wait(0.3)
	step_do(func() -> void:
		var L: Vector4 = C().lens_px
		ok("the lens follows you on screen", L.w > 0.5 and L.z > 10.0 and game.ui.lens_rect.visible, str(L))
		ok("through the shard: touch the true passage", _focus() == "gallery_secret" and game.try_interact(), _focus()))
	step_until("the passage opens", func() -> bool: return C().state["gallery"] and not game.level.named["gallery_secret"].enabled, 3.0)
	step_wait(2.6)
	walk_path("through the passage", [[8.4, -8.5], [9.0, -10.0]])
	step_do(func() -> void:
		ok("reached the Garden of the Veiled", game.area == "garden_veiled" and P().x > 7.5, str(P()) + " " + game.area)
		ok("the shard is lowered outside the gallery", not C().lens_on))

	# ================================================================ 5. garden: the turned ones
	step_do(func() -> void:
		ok("the old rune door panel is gone", game.ui.door_overlay.visible == false and game.puzzles.door == null)
		walk_to(16.4, -11.8))
	step_wait(0.7)
	step_until("the east door is shut", func() -> bool: return game.player.still_time > 0.4 or game.auto_target == Vector3.INF, 8.0)
	step_do(func() -> void:
		game.cmd("stop")
		ok("the garden door is closed", P().x < 16.6, str(P())))
	step_do(func() -> void: walk_to(7.9, -11.4))
	step_until("to her small glass", func() -> bool: return game.auto_target == Vector3.INF, 10.0)
	step_do(func() -> void: ok("breathe on the garden glass", _focus() == "breathe_garden" and game.try_interact(), _focus()))
	step_until("she writes three runes", func() -> bool: return C().state["garden_breath"], 9.0)
	step_do(func() -> void:
		var m: ShaderMaterial = C().breath_mats["garden"]
		ok("her message: three asymmetric runes, written from her side (mirrored for you)", m.get_shader_parameter("glyphs") == Vector3(6, 7, 8) and float(m.get_shader_parameter("flip")) == 1.0))
	for i in 3:
		var presses: int = (int(Chapter.TURN_SOLUTION[i]) - int(Chapter.TURN_START[i]) + 4) % 4
		step_do(func() -> void: tp(Chapter.TURN_X[i], Chapter.TURN_Z + 1.05, 0.0))
		step_wait(0.2)
		step_do(func() -> void: ok("statue %d in reach" % (i + 1), _focus() == "turn%d" % (i + 1), _focus()))
		interact_n(presses, 0.9)
	step_do(func() -> void:
		# the face toward the glass is the one her message names, as she wrote it (the glass reverses it)
		var good := true
		for i in 3:
			var north := int(C().state["turned"][i]) % 4
			var pv: Node3D = C().turn_pivots[i]
			var n: Vector3 = pv.global_transform.basis * [Vector3(0, 0, -1), Vector3(1, 0, 0), Vector3(0, 0, 1), Vector3(-1, 0, 0)][north]
			var f: Array = Chapter.TURN_FACES[i][north]
			good = good and n.z < -0.99 and int(f[0]) == [6, 7, 8][i] and float(f[1]) == 0.0
		ok("each statue turns her rune to the mirror (reversed in the glass = as she wrote it)", good, str(C().state["turned"])))
	step_until("the turned ones are right", func() -> bool: return C().state["turned_done"], 3.0)
	step_wait(2.0)
	step_do(func() -> void:
		ok("the door opens in the reflection first", absf(C().door_refl[0].rotation.y) > 0.3 and absf(C().door_real[0].rotation.y) < 0.05,
			"refl %.2f real %.2f" % [C().door_refl[0].rotation.y, C().door_real[0].rotation.y])
		ok("the reflection's door is only in the glass", (C().door_refl[0].get_child(0) as MeshInstance3D).layers == PlanarMirror.LAYER_DOUBLE))
	step_until("then in your world", func() -> bool: return game.level.named["g_door"].enabled and absf(C().door_real[0].rotation.y) > 1.5, 6.0)
	walk_path("through the garden door", [[16.4, -11.8], [18.2, -11.8]])
	step_do(func() -> void: ok("reached the Hollow Walk", game.area == "hollow_walk", str(P()) + " " + game.area))

	# ================================================================ 6. the hollow walk
	step_do(func() -> void:
		walk_to(18.5, -15.6))
	step_wait(0.7)
	step_until("the gate is shut", func() -> bool: return game.player.still_time > 0.4 or game.auto_target == Vector3.INF, 6.0)
	step_do(func() -> void:
		game.cmd("stop")
		ok("the hollow walk's gate is closed", P().z > -15.05, str(P())))
	# moving: they never move
	step_do(func() -> void: _hw_prev = hw_key(); tp(24.0, -6.5, PI); game.cmd("walk:19.5:-6.5"))
	step_until("walk across", func() -> bool: return game.auto_target == Vector3.INF, 6.0)
	step_do(func() -> void: ok("the hollows do not move while you walk", hw_key() == _hw_prev, hw_key()))
	# watched: they hold still
	step_do(func() -> void:
		tp(18.0, -12.5, -PI * 0.5 - 0.35)      # looking east toward the first hollow
		_hw_prev = hw_key())
	step_wait(2.5)
	step_do(func() -> void:
		ok("a hollow you are looking at holds still", str(C().state["hollows"][0]) == str([5, 2]), hw_key())
		ok("the one you do not look at steps toward you", str(C().state["hollows"][1]) != str([1, 1]), hw_key()))
	step_do(func() -> void:
		C().state["hollows"] = [[5, 2], [1, 1]]
		C().state["hollow_lock"] = [false, false]
		C()._place_hollows())
	# the solution (BFS-verified, 13 ticks): stand on a cell, face a way, be still for one step
	var plan := [[7, 7, "N"], [7, 5, "N"], [5, 1, "E"], [5, 0, "E"], [0, 0, "N"], [0, 8, "N"]]
	var yaw_of := {"N": PI, "E": -PI * 0.5, "S": 0.0, "W": PI * 0.5}
	for st in plan:
		step_do(func() -> void:
			_hw_prev = hw_key()
			var p := Ch1Geo.hw_cell(Vector2i(st[0], st[1]))
			tp(p.x, p.z, yaw_of[st[2]]))
		if st[0] == 0 and st[1] == 8:
			step_until("the last hollow comes to you, onto its plate", func() -> bool: return C().state["hollow_done"], 20.0)
		else:
			step_until("one step at (%d,%d) %s" % [st[0], st[1], st[2]], func() -> bool: return hw_key() != _hw_prev, 4.0)
		if st[0] == 0 and st[1] == 0:
			step_until("hollow on the first plate", func() -> bool: return C().state["hollow_lock"][0], 3.0)
	step_do(func() -> void:
		ok("both plates held by hollows", C().state["hollow_lock"] == [true, true] and C()._plate_taken(0) and C()._plate_taken(1), hw_key()))
	step_until("the gate rises", func() -> bool: return not game.level.named["hw_gate"].enabled, 3.0)
	step_wait(2.0)
	walk_path("up the ramp to the court", [[18.5, -13.0], [18.5, -16.2], [17.6, -17.8], [15.0, -18.4]])
	step_do(func() -> void: ok("reached the Court of Light", game.area == "court_light" and absf(P().y - 2.0) < 0.01, str(P()) + " " + game.area))

	# ================================================================ 7. court of light: beam + the veil's shadow
	step_do(func() -> void: ok("beam not lit at start", not game.puzzles.beam_lit))
	var mstand := [Vector2(11.25, -24.5), Vector2(11.25, -19.5), Vector2(15.55, -19.5)]
	for i in 3:
		var presses: int = (int(Puzzles.MIRROR_SOLUTION[i]) - int([3, 2, 0][i]) + 4) % 4
		step_do(func() -> void: tp(mstand[i].x, mstand[i].y))
		step_wait(0.2)
		step_do(func() -> void: ok("mirror %d in reach" % (i + 1), _focus() == "mirror%d" % (i + 1), _focus()))
		interact_n(presses, 0.7)
	step_until("beam reaches the crystal", func() -> bool: return game.puzzles.beam_lit, 3.0)
	step_do(func() -> void:
		ok("beam bounces off three mirrors", game.puzzles.beam_points.size() == 5)
		ok("the drawbridge stays up (the way on is the mural)", not game.level.named["LB"].enabled))
	step_until("the crystal lights the mural", func() -> bool: return game.puzzles.state["bridge"] and not game.puzzles.busy, 5.0)
	step_do(func() -> void: walk_to(12.0, -26.4))
	step_until("to the mural", func() -> bool: return game.auto_target == Vector3.INF, 8.0)
	step_do(func() -> void:
		ok("your veil's shadow falls on the mural", C().veil_shadow() != Vector3.INF)
		ok("standing anywhere does not complete it", not C().state["mural"])
		var sp := Chapter.mural_spot()
		walk_to(sp.x, sp.z))
	step_until("stand where her head was bowed", func() -> bool: return game.auto_target == Vector3.INF, 8.0)
	step_do(func() -> void:
		var s: Vector3 = C().veil_shadow()
		ok("the shadow of your veil fills the missing head", Vector2(s.x - Chapter.MURAL_HEAD.x, s.y - Chapter.MURAL_HEAD.y).length() < 0.32, str(s)))
	step_until("the mural is complete, the wall opens", func() -> bool: return C().state["mural"] and game.level.named["MZ_door"].enabled, 4.0)
	step_wait(2.8)

	# ================================================================ 8. the mist maze
	walk_path("through the mural door", [[12.0, -26.4], [12.0, -28.2], [12.0, -30.0]])
	step_do(func() -> void: ok("in the Mist Maze", game.area == "mist_maze", game.area))
	step_wait(2.0)
	step_do(func() -> void:
		var n := 0
		for f in C().maze_feet: if f.visible: n += 1
		ok("her petrol footprints walk the mirrored path in the pool", n > 0 and C().maze_feet[0].global_position.x < 8.8, "%d visible" % n)
		_mark = game.sfx.played.get("glass_tink", 0)
		walk_to(12.0, -32.5))
	step_wait(0.7)
	step_until("an invisible wall", func() -> bool: return game.player.still_time > 0.3 or game.auto_target == Vector3.INF, 5.0)
	step_do(func() -> void:
		ok("the mist hides a wall", P().z > -31.0, str(P()))
		ok("bumping into it, it shimmers", game.sfx.played.get("glass_tink", 0) > _mark)
		game.cmd("stop"))
	var mpath: Array = []
	for rc in Ch1Geo.MZ_PATH:
		var c3 := Ch1Geo.mz_cell(rc)
		mpath.append([c3.x, c3.z])
	mpath.append([10.0, -40.2])
	walk_path("follow her steps", mpath)
	step_do(func() -> void:
		ok("out of the maze", C().state["maze"] and game.area == "echo_corridor", str(P()) + " " + game.area))

	# ================================================================ 9. the echo corridor
	step_do(func() -> void: _mark = game.sfx.played.get("step_hall", 0))
	walk_path("down the corridor", [[10.0, -45.4], [14.0, -45.4]])
	step_do(func() -> void:
		ok("footsteps echo in the corridor", game.sfx.played.get("step_hall", 0) > _mark + 4, "%d" % (game.sfx.played.get("step_hall", 0) - _mark))
		ok("no hollow echo yet", C().echo_heard == 0))
	walk_path("past the hollow wall", [[20.0, -45.4], [16.8, -45.4], [19.8, -45.4]])
	step_do(func() -> void: ok("the echo comes back hollow by one wall", C().echo_heard >= 2, "%d" % C().echo_heard))
	step_do(func() -> void: walk_to(18.3, -45.6))
	step_until("to the hollow wall", func() -> bool: return game.auto_target == Vector3.INF, 5.0)
	step_do(func() -> void: ok("touch the hollow wall", _focus() == "echo_wall" and game.try_interact(), _focus()))
	step_until("the wall gives way", func() -> bool: return C().state["echo_room"], 2.0)
	step_wait(2.2)
	walk_path("into the hidden room", [[18.3, -47.4], [18.3, -49.1]])
	step_do(func() -> void: ok("the hidden memory", _focus() == "memory1" and game.try_interact(), _focus()))
	step_wait(2.5)
	step_do(func() -> void:
		ok("hidden memory #1 kept", "m1" in C().state["memories"])
		ok("its line shows", game.ui.memory.modulate.a > 0.3 and game.ui.memory_line.text == Chapter.MEMORY_1)
		var d = JSON.parse_string(FileAccess.get_file_as_string(Game.SAVE_PATH))
		ok("the memory is saved", d is Dictionary and "m1" in d["chapter"]["memories"]))
	walk_path("on to the scales", [[18.3, -45.4], [26.8, -45.4], [27.6, -46.0]])
	step_do(func() -> void: ok("reached the Scales", game.area == "scales", game.area))

	# ================================================================ 10. the scales
	walk_path("onto the lift", [[29.8, -45.4], [31.4, -45.6]])
	step_wait(3.0)
	step_do(func() -> void:
		ok("your weight does not lift the platform while the glass looks away", C().lift_h < 0.01 and absf(P().y - 2.0) < 0.01, "lift %.2f" % C().lift_h)
		ok("the scale groans under you", game.sfx.played.get("rattle", 0) > 0))
	step_do(func() -> void: walk_to(29.0, -45.7))
	step_until("to the glass", func() -> bool: return game.auto_target == Vector3.INF, 5.0)
	interact_n(1, 0.8)
	step_do(func() -> void: ok("the glass now sees the stone's pan", C().glass_sees() == "B"))
	interact_n(1, 0.8)
	step_do(func() -> void: ok("the glass sees the lift", C().glass_sees() == "A"))
	walk_path("back onto the lift", [[30.4, -45.6], [31.4, -45.6]])
	step_until("in the glass you weigh nothing: the stone lifts you", func() -> bool: return C().state["scales"], 8.0)
	step_do(func() -> void: ok("risen to the high walkway", absf(P().y - 4.0) < 0.02, str(P())))
	walk_path("along the high walkway", [[31.4, -43.5], [31.4, -22.4], [29.6, -22.4], [27.8, -22.4]])
	step_do(func() -> void: ok("down onto the Eidolon Ledge", game.area == "eidolon_ledge" and absf(P().y - 2.0) < 0.01, str(P()) + " " + game.area))

	# ================================================================ 11. the eidolon ledge
	step_do(func() -> void: ok("eidolon reflection walks beyond the glass", game.puzzles.eidolon_refl.active))
	step_wait(2.0)
	step_do(func() -> void:
		var n := 0
		for f in C().ledge_feet: if f.visible: n += 1
		ok("her footprints lead toward the plate", n > 0, "%d" % n))
	step_do(func() -> void: walk_to(25.5, -21.6))
	step_until("wait by the glass", func() -> bool: return game.auto_target == Vector3.INF, 8.0)
	step_wait(6.5)
	step_do(func() -> void:
		var fm: float = game.puzzles.foot_mat.get_shader_parameter("intensity")
		ok("footprint marker shows where to stand", fm > 0.6, "intensity %.2f" % fm))
	step_do(func() -> void: walk_to(23.6, -20.3))
	step_until("stand where the reflection stands on the plate", func() -> bool: return game.auto_target == Vector3.INF, 10.0)
	step_until("plate pressed by the reflection", func() -> bool: return game.puzzles.state["plate"], 4.0)
	step_until("the bridge rises", func() -> bool: return not game.puzzles.busy, 8.0)
	step_do(func() -> void: walk_to(22.2, -22.9))
	step_until("to the lever", func() -> bool: return game.auto_target == Vector3.INF, 6.0)
	step_do(func() -> void: ok("the drawbridge lever (a way back)", _focus() == "drawbridge" and game.try_interact(), _focus()))
	step_until("the drawbridge falls", func() -> bool: return game.level.named["LB"].enabled, 4.0)
	walk_path("to the risen bridge", [[27.7, -24.4], [27.7, -28.6]])

	# ================================================================ 12. gate of the four veiled
	step_do(func() -> void:
		ok("reached the Gate of the Four Veiled", game.area == "gate_four", game.area)
		walk_to(25.0, -29.1))
	step_until("before the veiled gate", func() -> bool: return game.auto_target == Vector3.INF, 6.0)
	step_do(func() -> void: walk_to(25.0, -31.3))
	step_wait(0.7)
	step_until("the veil", func() -> bool: return game.player.still_time > 0.3 or game.auto_target == Vector3.INF, 4.0)
	step_do(func() -> void:
		game.cmd("stop")
		ok("the tholos is closed by veils", P().z > -29.7, str(P())))
	walk_path("round to the empty plinth", [[25.0, -28.9], [20.35, -28.9], [20.35, -33.93], [21.34, -33.93]])
	step_do(func() -> void:
		ok("standing on the empty plinth", C().on_four_plinth(), str(P()))
		ok("wait", _focus() == "four_wait" and game.try_interact(), _focus()))
	step_wait(1.8)
	step_do(func() -> void: ok("the plinths light one by one", float(C().four_mats[0].get_shader_parameter("lit")) > 0.9 and float(C().four_mats[3].get_shader_parameter("lit")) < 0.5))
	step_until("the gate counts you as the fourth", func() -> bool: return C().state["four"], 4.0)
	step_do(func() -> void:
		ok("the veil before the shrine is gone", not game.level.named["tholos_front"].enabled)
		ok("a deep chord", game.sfx.played.get("cue:solve_gate_four", 0) >= 1))
	step_wait(1.0)
	walk_path("into the shrine", [[20.35, -33.93], [20.35, -29.0], [25.0, -29.0], [25.0, -31.1]])
	step_do(func() -> void: ok("reached the First Shrine", game.area == "first_shrine", game.area))

	# ================================================================ 13. the first shrine + "The Hand in the Water"
	step_do(func() -> void:
		ok("shrine is dark", game.world.awaken == 0.0)
		ok("wake the shrine", _focus() == "shrine" and game.try_interact(), _focus()))
	step_wait(3.0)
	step_do(func() -> void:
		ok("cinematic: letterbox", game.mode == "cine" and game.ui.letterbox > 0.99)
		ok("cinematic: the shrine wakes", float(game.puzzles.shrine_pillar.get_shader_parameter("fade")) > 0.4))
	step_wait(9.0)
	step_do(func() -> void:
		ok("cinematic: her reflection in the shrine pool", C().her.visible and float(C().her.body_mat.get_shader_parameter("vis")) > 0.5)
		ok("cinematic: camera looks down into the water", -game.world.pitch_node.rotation.x > deg_to_rad(55.0), "%.1f deg" % rad_to_deg(-game.world.pitch_node.rotation.x)))
	step_wait(12.5)          # t = 24.5
	step_do(func() -> void:
		ok("cinematic: palm to palm", game.player.extra_reach > 0.9 and C().her.pose.reach > 0.9)
		ok("cinematic: Katoptron lights on you both", game.player.fig.runes_awake == 1 and C().her.runes_awake == 1))
	step_wait(6.5)           # t = 31
	step_do(func() -> void: ok("cinematic: her veil lifts", C().her.veil.rotation.x < -1.5, "%.2f" % C().her.veil.rotation.x))
	step_wait(16.0)          # t = 44.5
	step_do(func() -> void: ok("cinematic: she is gone; the pool shows only you", not C().her.visible and C().mine.visible))
	step_wait(4.0)
	step_do(func() -> void: ok("memory fragment shows", game.ui.memory.modulate.a > 0.3 and game.ui.memory_line.text == Game.MEMORY_LINE))
	step_until("shrine counter I / VII shows", func() -> bool: return game.ui.end_b.modulate.a > 0.5 and game.ui.end_b.text == "I  /  VII", 12.0)
	step_until("the cinematic ends", func() -> bool: return game.mode == "play", 10.0)
	step_do(func() -> void:
		ok("cinematic length 40-60 s", game.chapter != null and t > 0.0)
		ok("the world beyond is revealed", game.level.beyond.visible and game.world.awaken >= 0.999)
		ok("first shrine lights one cloak rune and brightens the hem", game.player.fig.runes_awake == 1 and game.player.fig.hem > 1.5)
		ok("the shrine leaves its light on", float(game.puzzles.shrine_pillar.get_shader_parameter("fade")) > 0.5)
		ok("milestone text names the chapter", game.ui.end_a.text == "The Veiled Gate — awakened", game.ui.end_a.text)
		ok("still playable, controls back, no letterbox", game.mode == "play" and not game.player.locked and game.controls.enabled and game.ui.letterbox < 0.01)
		ok("camera back to normal", is_equal_approx(game.world.pitch_node.rotation.x, -World.PITCH) and game.world.follow == game.player)
		ok("fog receded", game.world.env.fog_depth_end > World.DIST + 50.0)
		ok("score cues played", game.sfx.played.get("cue:cinematic_hand", 0) >= 1 and game.sfx.played.get("swell", 0) >= 1))

	# ---- cannot fall: random walks in every space + the sealed way
	walk_path("to the sealed way", [[25.0, -29.3], [29.6, -29.3], [29.6, -35.6], [28.0, -36.6], [28.0, -38.6]])
	step_do(func() -> void: ok("the way on is sealed", P().z > -38.9 and _focus() == "sealed" and game.try_interact(), str(P())))
	for zone in [[28.0, -37.5], [0.0, 0.0], [-5.0, 1.7], [-11.3, -2.0], [-11.3, -9.0], [-7.0, -13.5], [0.0, -16.0], [6.0, -12.0], [12.0, -10.0],
			[21.0, -10.0], [12.0, -22.0], [13.0, -34.0], [17.0, -45.4], [18.3, -48.5], [29.0, -49.0], [31.4, -32.0], [19.0, -22.0], [25.0, -22.0], [22.0, -29.0], [0.0, 6.5]]:
		step_do(func() -> void: tp(zone[0], zone[1]))
		step_walk(14.0)
	step_do(func() -> void:
		ok("random walk: always on walkable ground", walk_violations == 0, "%d samples, %d violations, max step dy %.3f" % [walk_samples, walk_violations, max_dy]))

	# ---- save / restore
	step_do(func() -> void:
		game.cmd("save")
		var d = JSON.parse_string(FileAccess.get_file_as_string(Game.SAVE_PATH))
		var cz: Dictionary = d["chapter"]
		ok("checkpoint saved (chapter)", cz["stones"] and cz["breath"] and cz["shard"] and cz["gallery"] and cz["turned_done"] and cz["hollow_done"] and cz["mural"] and cz["maze"] and cz["echo_room"] and cz["scales"] and cz["four"], str(cz))
		ok("checkpoint saved (puzzles)", d["puzzles"]["bridge"] and d["puzzles"]["plate"] and d["puzzles"]["shrine"])
		var keep := P()
		game.queue_free()
		game = load("res://scenes/main.tscn").instantiate()
		add_child(game)
		walk_change = keep.x)
	step_until("reloaded title", func() -> bool: return game.mode == "title", 10.0)
	step_do(func() -> void: game.cmd("begin"))
	step_until("continue", func() -> bool: return game.mode == "play", 5.0)
	step_do(func() -> void:
		ok("restored chapter", C().state["four"] and C().state["scales"] and "m1" in C().state["memories"] and C().state["shard"])
		ok("restored regions", game.level.named["stone0"].enabled and not game.level.named["breath_gate"].enabled and game.level.named["hdoor"].enabled
			and game.level.named["g_door"].enabled and not game.level.named["hw_gate"].enabled and game.level.named["MZ_door"].enabled
			and game.level.named["EC_room"].enabled and not game.level.named["tholos_front"].enabled and game.level.named["EB"].enabled)
		ok("restored inventory", game.controls.inv_has)
		ok("restored the raised lift", C().lift_h >= 1.0)
		ok("restored awakened world", game.world.awaken == 1.0 and game.player.fig.runes_awake == 1)
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
		ok("new game: puzzles reset", not st["bridge"] and not st["plate"] and not st["shrine"] and not st.get("drawbridge", false), str(st))
		var cs: Dictionary = C().state
		ok("new game: chapter reset", not cs["stones"] and not cs["shard"] and not cs["turned_done"] and cs["turned"] == Chapter.TURN_START and not cs["four"] and cs["memories"].is_empty(), str(cs))
		ok("new game: regions reset", not game.level.named["stone0"].enabled and game.level.named["breath_gate"].enabled and not game.level.named["hdoor"].enabled
			and game.level.named["hw_gate"].enabled and not game.level.named["MZ_door"].enabled and game.level.named["tholos_front"].enabled and not game.level.named["LB"].enabled)
		ok("new game: no shard", not game.controls.inv_has and not C().lens_on)
		ok("new game: lift down", C().lift_h == 0.0)
		ok("new game: world asleep, runes dormant", game.world.awaken == 0.0 and game.player.fig.runes_awake == 0)
		ok("new game: woke at the gate", P().distance_to(Level.WAKE_POS) < 0.3, str(P()))
		var d = JSON.parse_string(FileAccess.get_file_as_string(Game.SAVE_PATH))
		ok("new game: save rewritten fresh", d is Dictionary and not d["puzzles"]["shrine"] and not d["chapter"]["stones"])
		ok("new game: settings kept (quality)", game.world.tier == "low")
		game.set_quality("auto", true))
	# ---- the cinematic can be skipped with a long press
	step_do(func() -> void:
		game.cmd("jump:first_shrine")
		ok("jump to the shrine (everything before it solved)", C().state["four"] and game.puzzles.state["plate"]))
	step_wait(0.5)
	step_do(func() -> void: ok("wake the shrine again", _focus() == "shrine" and game.try_interact(), _focus()))
	step_wait(4.0)
	step_do(func() -> void:
		var mb := InputEventMouseButton.new(); mb.button_index = MOUSE_BUTTON_LEFT; mb.pressed = true; mb.position = Vector2(200, 400)
		game.get_viewport().push_input(mb, true))
	step_wait(0.5)
	step_do(func() -> void: ok("a short press does not skip", game.mode == "cine" and game.ui.skip_ring.k > 0.2))
	step_wait(1.0)
	step_do(func() -> void:
		var mr := InputEventMouseButton.new(); mr.button_index = MOUSE_BUTTON_LEFT; mr.pressed = false; mr.position = Vector2(200, 400)
		game.get_viewport().push_input(mr, true))
	step_wait(0.3)
	step_do(func() -> void:
		ok("a long press skips the cinematic", game.mode == "play" and not game.player.locked)
		ok("skipped: the end state is reached anyway", game.world.awaken >= 0.999 and game.player.fig.runes_awake == 1 and game.ui.letterbox < 0.01 and not C().her.visible)
		ok("skipped: the shrine counter still shows", game.ui.end_b.text == "I  /  VII"))
	step_do(func() -> void: _finish())

var _next_report := 0.0
func _process(dt: float) -> void:
	t += dt
	if t > _next_report:
		_next_report += 20.0
		print("  .. sim %.0fs  real %.0fs  step %d/%d" % [t, Time.get_ticks_msec() / 1000.0, si, steps.size()])
	if t > 1500.0:
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
