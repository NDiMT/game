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
		var why := ""
		var pt := Vector2(x, z)
		for o in game.level.obstacles + game.level.solid_obs:
			var ob: Level.Obstacle = o
			if not ob.enabled: continue
			var hit := pt.distance_to(ob.c) < ob.rad + Player.RADIUS if ob.circle else pt.distance_to(Vector2(clampf(pt.x, ob.r.position.x, ob.r.end.x), clampf(pt.y, ob.r.position.y, ob.r.end.y))) < Player.RADIUS
			if hit: why += " " + ob.name + " " + ((str(ob.c) + " r" + str(ob.rad)) if ob.circle else str(ob.r))
		if not game.level.circle_ok(pt, Player.RADIUS): why += " not circle_ok"
		ok("test teleport lands on free ground (%.2f, %.2f)" % [x, z], false, why)
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

## v0.7 the Pool of Halves: one press of interact on real slab ri
func _pool_press(ri: int, label: String) -> void:
	step_do(func() -> void: ok(label, _focus() == "pool_turn%d" % ri and game.try_interact(), _focus()))
	step_until(label + " (turned)", func() -> bool: return not C()._pool_tw.has(ri), 3.0)
	step_wait(0.15)

## the gallery map: slot (top-left, top-right, bottom-left, bottom-right) -> brazier, read two ways
func _gallery_read(mirrored: bool) -> Array:
	var marks: Vector4 = C().gl_map.get_shader_parameter("marks")
	var m := [marks.x, marks.y, marks.z, marks.w]
	var order := [-1, -1, -1]
	for slot in 4:
		var top := slot < 2                  # top = east
		var left := slot % 2 == 0            # left = north as drawn; from her side, south
		var north := left != mirrored
		var b := (1 if top else 0) + (0 if north else 2)
		var n := int(m[slot])
		if n > 0: order[n - 1] = b
	return order
func _gallery_naive() -> Array: return _gallery_read(false)
func _gallery_mirrored() -> Array: return _gallery_read(true)

## ---- v0.7 collision audit helpers
var _sgrid := {}
func _solid_grid() -> Dictionary:
	if _sgrid.is_empty():
		for sd in game.level.audit["solids"]:
			if sd[4]: continue                       # moving things: their own obstacles move with them
			var r: Rect2 = sd[0]
			for gx in range(floori(r.position.x / 3.0), floori(r.end.x / 3.0) + 1):
				for gz in range(floori(r.position.y / 3.0), floori(r.end.y / 3.0) + 1):
					var k := Vector2i(gx, gz)
					if not _sgrid.has(k): _sgrid[k] = []
					_sgrid[k].append(sd)
	return _sgrid

## does a body at p (feet at height y) overlap this solid's footprint (inset by `tol`)?
static func _overlaps_solid(sd: Array, p: Vector2, y: float, rad: float, tol := 0.03) -> bool:
	if float(sd[3]) <= y + 0.18 or float(sd[2]) >= y + 1.7: return false
	var r: Rect2 = sd[0]
	if sd.size() > 6 and not (sd[6] as Array).is_empty():
		for cc: Vector3 in sd[6]:
			if p.distance_to(Vector2(cc.x, cc.y)) < cc.z + rad - tol: return true
		return false
	if sd[1]:
		return p.distance_to(r.get_center()) < (r.size.x + r.size.y) * 0.25 + rad - tol
	var q := Vector2(clampf(p.x, r.position.x, r.end.x), clampf(p.y, r.position.y, r.end.y))
	return p.distance_to(q) < rad - tol

func _solid_hit(p: Vector3) -> String:
	var g := _solid_grid()
	var k := Vector2i(floori(p.x / 3.0), floori(p.z / 3.0))
	for dx in [-1, 0, 1]:
		for dz in [-1, 0, 1]:
			for sd in g.get(k + Vector2i(dx, dz), []):
				if _overlaps_solid(sd, Vector2(p.x, p.z), p.y, Player.RADIUS): return str(sd[5]) + " " + str(sd[0])
	return ""

## walk into every solid (and every obstacle) from 4 sides through the real movement code
func _collision_audit() -> Dictionary:
	var lv: Level = game.level
	var rad := Player.RADIUS
	var targets := []
	for sd in lv.audit["solids"]:
		if not sd[4]: targets.append(sd)
	for o in lv.obstacles:
		var ob: Level.Obstacle = o
		if not ob.enabled: continue
		var r := Rect2(ob.c - Vector2(ob.rad, ob.rad), Vector2(ob.rad, ob.rad) * 2.0) if ob.circle else ob.r
		targets.append([r, ob.circle, -INF, INF, false, "obstacle:" + ob.name])
	var approaches := 0
	var bad := []
	var dirs := [Vector2(1, 0), Vector2(-1, 0), Vector2(0, 1), Vector2(0, -1)]
	for sd in targets:
		var r: Rect2 = sd[0]
		var c := r.get_center()
		for d: Vector2 in dirs:
			var ext := (r.size.x if d.x != 0.0 else r.size.y) * 0.5
			var st := c + d * (ext + rad + 0.45)
			if not lv.on_ground(st) or not lv.circle_ok(st, rad) or lv.blocked(st, rad): continue
			var h := lv.height_at(st)
			var band: Array = (sd as Array).duplicate()
			if is_inf(float(sd[2])):
				band[2] = h; band[3] = h + 1.0             # (an obstacle: solid at whatever floor you are on)
			if float(band[3]) <= h + 0.18 or float(band[2]) >= h + 1.7: continue
			approaches += 1
			var pos := Vector3(st.x, h, st.y)
			for k in 30:
				pos = lv.move(pos, Vector3(-d.x, 0, -d.y) * 0.04, rad)
				if _overlaps_solid(band, Vector2(pos.x, pos.z), pos.y, rad):
					bad.append("%s %s from %s at %s" % [sd[5], r, d, pos])
					break
	return {"targets": targets.size(), "approaches": approaches, "bad": bad}

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
	# v0.7 "The Pool of Halves": a broken path of slabs; some exist only in the reflection (hers), four are
	# real and turn on pivots. Turn yours until real and reflected make one unbroken path: hers become stone.
	step_do(func() -> void:
		# (a straight slab turned twice is the same slab: settings are compared by the shapes they make)
		var shapes := {}
		var best := 99
		for sol in Chapter.pool_solutions():
			var key := ""
			var presses := 0
			for i in 4:
				var cs: String = Ch1Geo.rot_conn(Ch1Geo.POOL_REALS[i][1], int(sol[i]))
				var arr := cs.split("")
				arr.sort()
				key += "".join(arr) + "|"
				presses += posmod(int(sol[i]) - int(Ch1Geo.POOL_START[i]), 4)
			shapes[key] = true
			best = mini(best, presses)
		ok("solver: exactly one arrangement of the four slabs makes the path whole", shapes.size() == 1, str(shapes.keys()))
		ok("solver: the pool starts broken", not Ch1Geo.pool_path(Ch1Geo.POOL_START))
		ok("solver: it takes more than one turn (at least %d presses)" % best, best > 1)
		var single := false
		for i in 4:
			var tt: Array = Ch1Geo.POOL_START.duplicate()
			tt[i] = (int(tt[i]) + 1) % 4
			single = single or Ch1Geo.pool_path(tt)
		ok("solver: no single turn makes it whole (no trivial path)", not single)
		var info: PackedVector4Array = C().pool_mat.get_shader_parameter("arm_info")
		var hers := 0
		for v in info: hers += 1 if v.z > 0.5 else 0
		ok("the water shows her slabs (reflection only) beside yours", int(C().pool_mat.get_shader_parameter("count")) == info.size() and hers == Ch1Geo.POOL_GHOSTS.size() * 2, "%d arms, %d hers" % [info.size(), hers])
		var seams := true
		for c in C().pool_pieces: seams = seams and (C().pool_pieces[c]["seams"] as Array).size() == (C().pool_pieces[c]["base"] as String).length()
		ok("every slab carries glowing connector inlays", seams)
		ok("her slabs are not in your world (no ground there)", not game.level.on_ground(Ch1Geo.cell_pos(Vector2i(4, 2))) and not (C().pool_pieces[Vector2i(4, 2)]["node"] as Node3D).visible)
		ok("no waiting mechanic: the water is always still", C().calm > 0.8)
		walk_to(-0.35, 1.7))
	step_until("to the water's edge", func() -> bool: return game.auto_target == Vector3.INF, 8.0)
	_pool_press(0, "turn the first slab from the shore")
	step_do(func() -> void:
		var ry: float = (C().pool_pieces[Vector2i(0, 1)]["node"] as Node3D).rotation.y
		ok("a turn is a quarter, snapped", C().state["pool_turns"][0] == 1 and absf(ry + PI * 0.5) < 0.01, "%.3f" % ry)
		ok("turning grinds", game.sfx.played.get("grind", 0) > 0)
		walk_to(-1.6, 1.7))
	step_until("out onto your slab", func() -> bool: return game.auto_target == Vector3.INF, 6.0)
	step_do(func() -> void: ok("standing on your slab over the water", P().x < -1.5 and absf(P().y) < 0.01, str(P())))
	for k in 3: _pool_press(1, "turn the second slab from the first (%d)" % (k + 1))
	walk_path("back ashore and round to the north rim", [[-0.35, 1.7], [-0.25, -0.5], [-3.75, -0.5], [-3.75, -0.4]])
	_pool_press(2, "turn the third slab from the north rim")
	walk_path("round to the south rim", [[-0.25, -0.5], [-0.25, 3.75], [-0.5, 4.05], [-4.5, 4.05]])
	step_do(func() -> void: ok("still broken: hers are not stone yet", not C().state["stones"]))
	for k in 3: _pool_press(3, "turn the fourth slab from the south rim (%d)" % (k + 1))
	step_until("the path is whole: her slabs rise as stone", func() -> bool: return C().state["stones"], 2.0)
	step_wait(2.6)
	step_do(func() -> void:
		ok("her slabs are solid now", game.level.on_ground(Ch1Geo.cell_pos(Vector2i(4, 2))) and (C().pool_pieces[Vector2i(4, 2)]["node"] as Node3D).visible)
		var info: PackedVector4Array = C().pool_mat.get_shader_parameter("arm_info")
		var hers := 0
		for v in info: hers += 1 if v.z > 0.5 else 0
		ok("...and the reflection no longer marks any as hers", hers == 0)
		ok("solving plays its cue", game.sfx.played.get("cue:solve_waking_pool", 0) >= 1))
	walk_path("across the pool on the whole path", [[-0.5, 4.05], [-0.25, 3.75], [-0.35, 1.7], [-1.275, 1.7], [-2.525, 1.7], [-2.525, 0.5],
		[-3.775, 0.5], [-5.025, 0.5], [-5.025, 2.9], [-8.775, 2.9], [-10.4, 2.4]])
	step_do(func() -> void:
		ok("crossed the pool", C().state["stones"] and P().x < -9.5 and absf(P().y) < 0.01, str(P()))
		ok("footsteps on the slabs splash", game.sfx.played.get("step_wet", 0) > 0)
		ok("reached the Stair of Breath", game.area == "stair_breath", game.area))

	# ================================================================ 2. the stair of breath
	step_do(func() -> void:
		var rw := C().stair_rune
		var rm := rw.material_override as ShaderMaterial
		ok("the whole rune is carved large beside the stair, glowing faintly", rw.visible and (rw.mesh as QuadMesh).size.x >= 1.2 and int(rm.get_shader_parameter("count")) > 8 and float(rm.get_shader_parameter("lit")) > 0.3))
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
	# "An Answer on the Glass": the close-up of the pane; she writes, then waits for your answer
	step_do(func() -> void: ok("breathe on the glass", _focus() == "breathe_stair" and game.try_interact(), _focus()))
	step_wait(0.5)
	step_do(func() -> void:
		var gt: GlassTalk = game.ui.glass_talk
		ok("the close-up of the pane opens", game.mode == "glass" and gt.visible and gt.size.x > 100.0, str(gt.size))
		ok("nothing to answer while she writes", not game.cmd("glass_try:right")))
	# the x closes it, consuming the tap (the camera does not turn), nothing solved
	step_do(func() -> void:
		_yaw0 = game.world.yaw_index
		var gt: GlassTalk = game.ui.glass_talk
		var p: Vector2 = gt.get_global_transform_with_canvas() * gt.close_r.get_center()
		var mb := InputEventMouseButton.new(); mb.button_index = MOUSE_BUTTON_LEFT; mb.pressed = true; mb.position = p; mb.global_position = p; mb.device = InputEvent.DEVICE_ID_EMULATION
		game.get_viewport().push_input(mb, true)
		var tch := InputEventScreenTouch.new(); tch.index = 0; tch.pressed = true; tch.position = p
		game.get_viewport().push_input(tch, true)
		var mr := mb.duplicate(); mr.pressed = false
		game.get_viewport().push_input(mr, true)
		var tr := tch.duplicate(); tr.pressed = false
		game.get_viewport().push_input(tr, true))
	step_wait(0.8)
	step_do(func() -> void:
		ok("x closes the pane", game.mode == "play" and not game.ui.glass_talk.visible and not C().state["breath"])
		ok("the closing tap does not turn the camera", game.world.yaw_index == _yaw0))
	step_wait(0.5)
	step_do(func() -> void: ok("breathe again", _focus() == "breathe_stair" and game.try_interact(), _focus()))
	step_until("she writes her rune, then half of a second, and waits", func() -> bool: return game.ui.glass_talk.phase == "waiting", 12.0)
	step_do(func() -> void:
		var gt: GlassTalk = game.ui.glass_talk
		ok("her writing is mirrored for you (her half on the left, the answer on the right)", gt.her_half[0][2].x < 0.0 and gt.target[0][2].x > 0.0)
		ok("recogniser: her half copied is wrong", not game.cmd("glass_try:left") and gt.tries == 1))
	step_wait(1.0)
	step_do(func() -> void:
		var gt: GlassTalk = game.ui.glass_talk
		var dotted := gt.ink.hint.size() > 0
		for h in gt.ink.hint: dotted = dotted and h.size() > 3 and h[3]
		ok("after one wrong try: a faint dotted ghost of the missing stroke", dotted, str(gt.ink.hint.size())))
	step_do(func() -> void:
		var gt: GlassTalk = game.ui.glass_talk
		ok("recogniser: a straight stroke is wrong", not game.cmd("glass_try:line") and gt.tries == 2))
	step_wait(5.5)
	step_do(func() -> void:
		var gt: GlassTalk = game.ui.glass_talk
		ok("after two wrong tries she traces the missing part, faintly", gt.ink.hint.size() > 0)
		ok("the fog crept back over your strokes", float(gt.ink.mine[0][1]) < 0.05))
	step_wait(5.0)
	step_do(func() -> void:
		ok("recogniser: the mirrored stroke, drawn backwards with a shaky hand, is right", game.cmd("glass_try:right_rev")))
	step_until("her palm, the glow; the veil dissolves", func() -> bool: return C().state["breath"], 4.0)
	step_until("the close-up fades back to the stair", func() -> bool: return game.mode == "play" and not game.ui.glass_talk.visible, 8.0)
	step_do(func() -> void:
		var m: ShaderMaterial = C().breath_mats["stair"]
		ok("her writing stays on the fogged glass", float(m.get_shader_parameter("write")) > 0.99 and float(m.get_shader_parameter("fog")) > 0.9)
		ok("breath cue played", game.sfx.played.get("cue:breath", 0) >= 1)
		ok("her answer rings her song (the motif A-D-E-F-E)", game.sfx.played.get("motif", 0) >= 1 and game.sfx.played.get("note_E", 0) >= 2)
		ok("her 'follow' rune is a letter of the script, one calligraphic stroke", GlassTalk.TEMPLATES["follow"].size() == 1 and GlassTalk.TEMPLATES["follow"][0].size() >= 8)
		ok("recogniser unit: resample keeps 32 points", GlassTalk.resample(PackedVector2Array([Vector2.ZERO, Vector2(1, 0)])).size() == GlassTalk.N))
	walk_path("up the second flight", [[-11.3, -9.0], [-11.3, -13.5], [-6.0, -13.5], [-2.0, -13.5]])
	step_do(func() -> void:
		ok("reached the Hall of Glass by the corridor", absf(P().y - 1.0) < 0.01 and game.area == "hall_glass", str(P()) + " " + game.area)
		ok("area name shown on entering the hall", game.ui.area_label.text == Names.area("hall_glass").to_upper(), game.ui.area_label.text))

	# ================================================================ 3. hall of glass: "What the Glass Remembers"
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
		var twin_ok := true
		for t in C().twins: twin_ok = twin_ok and t.visible and (t.get_child(0) as MeshInstance3D).layers == PlanarMirror.LAYER_DOUBLE
		ok("the glass remembers a drum, a brazier and a bust where they were (only in the glass)", twin_ok and C().twins.size() == 3)
		ok("today's hall is not in the glass", (C().drum_node.get_child(0) as MeshInstance3D).layers == PlanarMirror.LAYER_MAIN_FX)
		ok("no touching the glass any more", game.level.interact_by_id("touch_glass") == null))
	# the bust: it faces you; the glass shows its face, so the bust must face the glass
	step_do(func() -> void: tp(1.0, -17.3, PI))
	step_wait(0.3)
	step_do(func() -> void: ok("the veiled bust turns", _focus() == "hall_turn" and game.try_interact(), _focus()))
	step_wait(0.9)
	step_do(func() -> void: ok("a quarter turn is not as the glass remembers", not C()._locked(2)))
	step_do(func() -> void:
		_mark = game.sfx.played.get("chime_hall", 0)
		ok("turn it again", game.try_interact()))
	step_wait(0.25)
	step_do(func() -> void: ok("a visible arc sweeps the quarter turn on the floor", float(C().bust_arc_mat.get_shader_parameter("sweep")) > 0.2 and float(C().bust_arc_mat.get_shader_parameter("intensity")) > 0.3))
	step_wait(2.4)
	step_do(func() -> void:
		ok("facing the glass (its face in the glass): set right", C()._locked(2) and not C().twins[2].visible)
		ok("matched: a chime and a glow", game.sfx.played.get("chime_hall", 0) > _mark and float((C().match_glows[2] as ShaderMaterial).get_shader_parameter("intensity")) > 0.2)
		ok("matched: its floor cell lights", float((C().goal_mats[2] as ShaderMaterial).get_shader_parameter("intensity")) > 0.2)
		ok("set right, it appears in the glass", (C().bust_pivot.get_child(0) as MeshInstance3D).layers & 1 == 1))
	# the drum: one push east, six north (the glass shows it one step from the glass, left of the bust)
	step_do(func() -> void: tp(-1.8, -13.0, PI * 0.5))
	step_wait(0.3)
	step_do(func() -> void:
		ok("standing square to the drum: an arrow shows which way it will slide", float(C().push_arrow_mat.get_shader_parameter("intensity")) > 0.5 and C()._push_dir() == Vector2i(1, 0)))
	step_do(func() -> void: ok("push the drum once", _focus() == "hall_push" and game.try_interact(), _focus()))
	step_wait(0.3)
	step_do(func() -> void: ok("it slides (never rolls or turns)", is_zero_approx(C().drum_node.rotation.y) and is_zero_approx(C().drum_node.rotation.x) and is_zero_approx(C().drum_node.rotation.z)))
	step_wait(0.6)
	step_do(func() -> void: ok("one cell per push, snapped to the grid", C().state["hall"]["drum"] == [0, -13] and C().drum_node.position.is_equal_approx(Vector3(0, 1, -13)), str(C().drum_node.position)))
	# the reset altar: what is not yet set right goes back (the bust, set right, stays)
	step_do(func() -> void: tp(-3.9, -16.65, 0.0))
	step_wait(0.3)
	step_do(func() -> void: ok("the reset altar", _focus() == "hall_reset" and game.try_interact(), _focus()))
	step_wait(0.3)
	step_do(func() -> void: ok("reset: the drum is back where it was found, the bust stays set", C().state["hall"]["drum"] == [Chapter.DRUM_START.x, Chapter.DRUM_START.y] and C()._locked(2), str(C().state["hall"])))
	var drum_pushes := [[-1.8, -13.0], [0.0, -12.2], [0.0, -13.2], [0.0, -14.2], [0.0, -15.2], [0.0, -16.2], [0.0, -17.2]]
	for i in drum_pushes.size():
		var sp: Array = drum_pushes[i]
		step_do(func() -> void: tp(sp[0], sp[1], 0.0))
		step_wait(0.25)
		step_do(func() -> void: ok("push the drum (%d)" % (i + 1), _focus() == "hall_push" and game.try_interact(), _focus()))
		step_wait(0.8)
		if i == 4:
			step_do(func() -> void: ok("a cell short of where it was: not yet", not C()._locked(0), str(C().state["hall"]["drum"])))
	step_do(func() -> void: ok("the drum lies where the glass remembers it", C()._locked(0), str(C().state["hall"]["drum"])))
	# the brazier: carry it; set it down in the wrong place first, then where the glass shows it
	step_do(func() -> void: tp(3.0, -12.3, PI))
	step_wait(0.3)
	step_do(func() -> void: ok("take the brazier", _focus() == "hall_take" and game.try_interact(), _focus()))
	step_do(func() -> void: tp(2.0, -16.05, 0.0))
	step_wait(0.4)
	step_do(func() -> void: ok("set it down", _focus() == "hall_place" and game.try_interact() and not C().carrying, _focus()))
	step_wait(0.6)
	step_do(func() -> void: ok("a brazier in the wrong place stays unremembered", not C()._locked(1)))
	step_do(func() -> void: tp(2.0, -16.3, 0.0))
	step_wait(0.3)
	step_do(func() -> void: ok("take it again", _focus() == "hall_take" and game.try_interact(), _focus()))
	step_do(func() -> void: tp(2.0, -18.05, 0.0))
	step_wait(0.4)
	step_do(func() -> void: ok("set it down where it stood", game.try_interact() and not C().carrying, _focus()))
	step_until("all three as the glass remembers: the doorway opens", func() -> bool: return C().state["hall_door"] and game.level.named["hdoor"].enabled, 4.0)
	step_do(func() -> void:
		ok("solver: each goal cell is free, and the drum starts away from it", C().hall_free(Chapter.DRUM_GOAL, 0.42, 0) or C()._locked(0))
		ok("the Mirror Shard lies on the threshold", C().shard_node.visible and not C().state["shard"])
		walk_to(4.0, -17.5))
	step_until("to the threshold", func() -> bool: return game.auto_target == Vector3.INF, 8.0)
	step_do(func() -> void: ok("take the shard", _focus() == "take_shard" and game.try_interact(), _focus()))
	step_wait(1.0)
	step_do(func() -> void: ok("the shard is in the inventory", C().state["shard"] and game.controls.inv_has and not game.controls.inv_on))
	walk_path("walk to the tablet", [[2.0, -18.0], [3.85, -18.2], [3.85, -19.15]])
	step_do(func() -> void: ok("tablet readable", game.try_interact() and game.puzzles.state["tablet"], _focus()))
	walk_path("through the remembered door", [[3.6, -17.5], [5.6, -17.5], [6.0, -16.0]])
	step_do(func() -> void: ok("reached the Shard Gallery", game.area == "shard_gallery" and P().x > 5.0, str(P()) + " " + game.area))

	# ================================================================ 4. the shard gallery: "The Other Side's Map"
	walk_path("down the gallery", [[6.0, -12.0], [6.0, -8.6]])
	step_do(func() -> void:
		ok("no way on: the wall is whole", game.level.named["gallery_secret"].enabled)
		walk_to(7.8, -8.5))
	step_wait(0.7)
	step_until("the wall", func() -> bool: return game.player.still_time > 0.3 or game.auto_target == Vector3.INF, 4.0)
	step_do(func() -> void:
		game.cmd("stop")
		ok("the wall is solid", P().x < 6.6, str(P()))
		tp(5.95, -10.6, PI * 0.5))
	step_do(func() -> void:
		game.controls.shard.emit()           # the inventory slot tapped
		ok("raise the shard from the inventory", C().lens_on and game.controls.inv_on))
	step_wait(0.4)
	step_do(func() -> void:
		var L: Vector4 = C().lens_px
		ok("the lens follows you on screen; her map shows in it", L.w > 0.5 and L.z > 10.0 and game.ui.lens_rect.visible, str(L))
		ok("her map is drawn from her side: the true arch and the way in at the wrong ends", C().gl_map.get_shader_parameter("marks") == Vector4(1, 3, 0, 2))
		ok("solver: read as drawn (not mirrored) the map gives a different, wrong order", _gallery_naive() != Chapter.GL_ORDER and _gallery_mirrored() == Chapter.GL_ORDER, "%s vs %s" % [_gallery_naive(), _gallery_mirrored()]))
	step_do(func() -> void:
		var vis := true
		for i in 4: vis = vis and float(C().gl_flames[i].get_shader_parameter("intensity")) == 0.0
		ok("four veiled busts, their votive lamps cold", C().gl_lamps.size() == 4 and vis))
	var spots := {}
	for i in 4:
		var bw: Vector3 = Chapter.gl_bowl(i)
		spots[i] = [5.92 if bw.x < 6.0 else 5.93, bw.z]
	for attempt in [[1, 2, 3], [0, 1, 2]]:
		for bi in attempt:
			var sp2: Array = spots[bi]
			step_do(func() -> void: tp(sp2[0], sp2[1], PI))
			step_wait(0.25)
			step_do(func() -> void: ok("light lamp %d" % bi, _focus() == "light%d" % bi and game.try_interact(), _focus()))
			step_wait(0.6)
			step_do(func() -> void:
				var lp: Dictionary = C().gl_lamps[bi]
				ok("a teal flame burns in its bowl, lighting the face from below", float(C().gl_flames[bi].get_shader_parameter("intensity")) > 0.5 and (lp["light"] as OmniLight3D).visible and (lp["light"] as OmniLight3D).light_energy > 0.3))
		step_until("a wrong order: the flames gutter out", func() -> bool: return (C().state["gallery_lit"] as Array).is_empty() and not C()._gl_busy, 5.0)
		step_do(func() -> void:
			var out := true
			for i in 4: out = out and not (C().gl_lamps[i]["light"] as OmniLight3D).visible
			ok("guttered: every lamp out", out))
	step_do(func() -> void:
		ok("still shut after wrong orders", not C().state["gallery"] and C().gl_fails == 2)
		ok("hint after two wrong orders: the map's clues shine", float(C().gl_map.get_shader_parameter("pulse")) > 0.5))
	for bi in Chapter.GL_ORDER:
		var sp3: Array = spots[bi]
		step_do(func() -> void: tp(sp3[0], sp3[1], PI))
		step_wait(0.25)
		step_do(func() -> void: ok("light lamp %d (her order, read from your side)" % bi, _focus() == "light%d" % bi and game.try_interact(), _focus()))
		step_wait(0.4)
	step_until("the true arch opens", func() -> bool: return C().state["gallery"] and not game.level.named["gallery_secret"].enabled, 4.0)
	step_wait(1.9)
	step_do(func() -> void:
		var veils := true
		for i in 4: veils = veils and (float((C().gl_lamps[i]["veil"] as ShaderMaterial).get_shader_parameter("intensity")) > 0.5) == (i in Chapter.GL_ORDER)
		ok("her busts' veils glow", veils))
	step_wait(2.6)
	walk_path("to the arch", [[5.95, -11.0], [5.95, -9.0]])
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
	step_do(func() -> void: walk_to(16.0, -14.1))
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
	step_do(func() -> void:
		var sv: Dictionary = Chapter.solve_hollows()
		ok("solver: the hollows' paths interfere: no single spot solves it, the shortest plan is long", sv["one_spot"] == 0 and sv["min_steps"] >= 10, str(sv)))
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

	# ================================================================ 7. court of light: "Two Worlds of Light"
	step_do(func() -> void:
		ok("beam not lit at start", not game.puzzles.beam_lit)
		var sol: Array = game.puzzles.solve_court()
		var goods := []
		var bads := 0
		for e in sol:
			if e[2]: goods.append(e[0])
			else: bads += 1
		ok("solver: exactly one setting lights the mural, through her world", goods.size() == 1 and goods[0] == Puzzles.MIRROR_SOLUTION, str(goods))
		ok("solver: the near way lights the crystal the wrong way (a decoy)", bads >= 1, "%d decoys" % bads)
		var one := false
		for e in sol:
			var dsum := 0
			for i in 4: dsum += posmod(int(e[0][i]) - int(Puzzles.MIRROR_START[i]), 4)
			if dsum <= 1: one = true
		ok("solver: no single turn from the start lights anything", not one)
		ok("her glass is a real reflection here", game.puzzles.court_refl.planar != null))
	var mstand := [Vector2(10.62, -22.6), Vector2(10.62, -24.1), Vector2(14.75, -24.1), Vector2(14.75, -22.6)]   # (v0.7: the stands sweep wider; stand clear of them)
	var to_decoy := [2, 3, 1, 0]
	for i in 4:
		var presses: int = to_decoy[i]
		if presses == 0: continue
		step_do(func() -> void: tp(mstand[i].x, mstand[i].y, -PI * 0.5))
		step_wait(0.2)
		step_do(func() -> void: ok("mirror %d in reach" % (i + 1), _focus() == "mirror%d" % (i + 1), _focus()))
		interact_n(presses, 0.7)
	step_wait(0.6)
	step_do(func() -> void:
		ok("the near way: the crystal lights...", game.puzzles.beam_lit and not game.puzzles.beam_good)
		ok("...but its light runs away from the mural", not game.puzzles.state["bridge"] and float(C().mural_mat.get_shader_parameter("lit")) < 0.05)
		game.puzzles.decoy_t = 13.0)
	step_wait(0.5)
	step_do(func() -> void: ok("hint: her own glasses shimmer in the great glass", float(game.puzzles.her_glows[0].get_shader_parameter("intensity")) > 0.05))
	for i in [2, 3]:
		var presses2: int = [0, 0, 2, 3][i]
		step_do(func() -> void: tp(mstand[i].x, mstand[i].y, -PI * 0.5))
		step_wait(0.2)
		step_do(func() -> void: ok("mirror %d in reach" % (i + 1), _focus() == "mirror%d" % (i + 1), _focus()))
		interact_n(presses2, 0.7)
	step_until("the beam goes into her world and out again to the crystal", func() -> bool: return game.puzzles.beam_good, 3.0)
	step_do(func() -> void:
		var w: Array = game.puzzles.beam_world
		ok("part of the beam runs in her world (seen only in the glass)", 1 in w and game.puzzles.beam_segs[w.find(1)].layers == PlanarMirror.LAYER_DOUBLE)
		ok("the stands are set as the solver says", game.puzzles.state["mirrors"] == Puzzles.MIRROR_SOLUTION, str(game.puzzles.state["mirrors"]))
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
	step_do(func() -> void:
		ok("in the Mist Maze", game.area == "mist_maze", game.area)
		var n0 := 0
		for f in C().maze_feet: if f.visible: n0 += 1
		ok("walking: no footprints", n0 == 0, "%d" % n0))
	step_wait(2.5)
	step_do(func() -> void:
		var n := 0
		var far := 0
		for i in C().maze_feet.size():
			if C().maze_feet[i].visible:
				n += 1
				if C().maze_feet_seg[i] > C().maze_prog + 3: far += 1
		ok("standing still: her petrol footprints show the next stretch of her path, mirrored in the pool", n > 0 and far == 0 and C().maze_feet[0].global_position.x < 8.8, "%d visible" % n)
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

	# ================================================================ 9. the echo corridor: "Her Song"
	step_do(func() -> void: _mark = game.sfx.played.get("step_hall", 0))
	walk_path("down the corridor", [[10.0, -45.4], [14.0, -45.4]])
	step_wait(3.0)
	step_do(func() -> void:
		ok("footsteps echo in the corridor", game.sfx.played.get("step_hall", 0) > _mark + 4, "%d" % (game.sfx.played.get("step_hall", 0) - _mark))
		ok("the corridor remembers her song, faintly", game.sfx.played.get("motif", 0) >= 2)
		ok("the see-through: the corridor's near wall opens round you", game.world.reveal_k > 0.9, "%.2f" % game.world.reveal_k)
		ok("solver: four stones, five notes: the song returns to a stone", Sfx.MOTIF.size() == 5 and Sfx.MOTIF.count("E") == 2 and Chapter.SONG_NOTES.size() == 4))
	var song_x := {}
	for i in 4: song_x[Chapter.SONG_NOTES[i]] = Chapter.SONG_X[i]
	for seq in [["A", "E"], ["D"]]:
		for nt in seq:
			var x: float = song_x[nt]
			step_do(func() -> void: tp(x, -45.6, PI))
			step_wait(0.25)
			step_do(func() -> void: ok("strike the %s stone" % nt, _focus().begins_with("song") and game.try_interact(), _focus()))
			step_wait(0.5)
	step_wait(2.0)
	step_do(func() -> void:
		ok("wrong notes sour and the song starts over", C().song_fails == 2 and C().song_buf.is_empty() and not C().state["echo_room"], "%d %s" % [C().song_fails, str(C().song_buf)])
		ok("after two soured songs it is remembered once more", game.sfx.played.get("motif", 0) >= 3))
	for nt2 in Sfx.MOTIF:
		var x2: float = song_x[nt2]
		step_do(func() -> void: tp(x2, -45.6, PI))
		step_wait(0.25)
		step_do(func() -> void: ok("sing %s" % nt2, _focus().begins_with("song") and game.try_interact(), _focus()))
		step_wait(0.45)
	step_until("her song, sung back: the hollow wall gives way", func() -> bool: return C().state["echo_room"], 3.0)
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

	# ================================================================ 10. the scales: "Weight of a Reflection"
	step_do(func() -> void:
		var sols: Array = Chapter.solve_scales()
		var need_her := true
		for e in sols: need_her = need_her and int(e[1]) > 0
		ok("solver: several ways to level it, and every one needs her", sols.size() >= 3 and need_her, "%d" % sols.size())
		ok("left: the urn, 15", C().scale_torque(0) == Vector2i(15, 0)))
	walk_path("onto the lift", [[29.2, -45.9], [31.4, -45.6]])
	step_wait(2.0)
	step_do(func() -> void: ok("the lift does not move: the balance is not won", C().lift_h < 0.01 and absf(P().y - 2.0) < 0.01, "lift %.2f" % C().lift_h))
	var hang := [[2, 5, 3], [1, 4, 3], [0, 3, 3]]       # weight 3 -> R3, weight 2 -> R2, weight 1 -> R1
	for h in hang:
		var wi: int = h[0]
		var pk: int = h[1]
		step_do(func() -> void: tp(Chapter.SC_RACK[wi].x, Chapter.SC_RACK[wi].z - 0.6, PI))
		step_wait(0.25)
		step_do(func() -> void: ok("take weight %d" % (wi + 1), _focus() == "weight%d" % wi and game.try_interact(), _focus()))
		step_do(func() -> void:
			var pp := Chapter.pan_pos(pk)
			tp(pp.x, pp.z + 0.05, 0.0))
		step_wait(0.3)
		step_do(func() -> void: ok("hang it (pan %d)" % pk, _focus() == "pan%d" % pk and game.try_interact(), _focus()))
		step_wait(0.3)
	step_do(func() -> void:
		var tq: Vector2i = C().scale_torque(0)
		ok("all three on the right: 14 against 15, still tipped", tq == Vector2i(15, 14) and not C().state["scales"], str(tq)))
	step_do(func() -> void:
		C().sc_tries = 30.0
		var tp1 := Vector3(Chapter.SC_X - Chapter.SC_UNIT, 2.0, Chapter.SC_TILE_Z)
		tp(tp1.x, tp1.z, 0.0))
	step_wait(0.5)
	step_do(func() -> void:
		ok("on her tile, her weight counts on the RIGHT: 16, tipped the other way", C().scale_torque() == Vector2i(15, 16) and C().scale_tile() == 1, str(C().scale_torque()))
		ok("hint after a while: the tiles shine", C().sc_hint > 0.9))
	# take the 1 off (back to the bench): 13 + her 2 = 15
	step_do(func() -> void:
		var pp := Chapter.pan_pos(3)
		tp(pp.x, pp.z + 0.05, 0.0))
	step_wait(0.3)
	step_do(func() -> void: ok("take the 1 back", _focus() == "pan3" and game.try_interact() and C().sc_carry == 0, _focus()))
	step_do(func() -> void: tp(Chapter.SC_RACK[0].x, Chapter.SC_RACK[0].z - 0.6, PI))
	step_wait(0.3)
	step_do(func() -> void: ok("put it on the bench", _focus() == "weight0" and game.try_interact() and C().sc_carry == -1, _focus()))
	step_do(func() -> void:
		var tp2 := Vector3(Chapter.SC_X - Chapter.SC_UNIT, 2.0, Chapter.SC_TILE_Z)
		tp(tp2.x, tp2.z, 0.0))
	step_until("level: 15 = 13 + her 2; it locks", func() -> bool: return C().state["scales"], 8.0)
	step_do(func() -> void: ok("the balance is level", C().scale_torque() == Vector2i(15, 15) and absf(C().sc_angle) < 0.02, str(C().scale_torque())))
	walk_path("onto the lift", [[29.2, -45.9], [31.4, -45.6]])
	step_until("the lift carries you up", func() -> bool: return C().lift_h > 0.99, 10.0)
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
	step_until("stand where the reflection stands on her plate", func() -> bool: return game.auto_target == Vector3.INF, 10.0)
	step_wait(3.0)
	step_do(func() -> void:
		ok("hers alone is not enough: your plate is empty", not game.puzzles.state["plate"] and game.puzzles.plate_charge < 0.05)
		var pc := Chapter.lcell(Chapter.LEDGE_PLATE)
		tp(pc.x, pc.z, PI))
	step_wait(2.0)
	step_do(func() -> void:
		ok("standing on yours, your reflection is far from hers", C().plate_a_down() and not game.puzzles.state["plate"]))
	var pushes := [[24.75, -20.5, -PI * 0.5], [26.5, -19.75, 0.0], [26.5, -20.75, 0.0]]
	for pi in pushes.size():
		var ps2: Array = pushes[pi]
		step_do(func() -> void: tp(ps2[0], ps2[1], ps2[2]))
		step_wait(0.25)
		step_do(func() -> void: ok("push the statue (%d)" % (pi + 1), _focus() == "ledge_push" and game.try_interact(), _focus()))
		step_wait(0.9)
	step_do(func() -> void:
		ok("the statue holds your plate", C()._statue_cell() == Chapter.LEDGE_PLATE and C().plate_a_down())
		walk_to(23.6, -20.3))
	step_until("back where your reflection stands on hers", func() -> bool: return game.auto_target == Vector3.INF, 10.0)
	step_until("both plates held at once: hers answers", func() -> bool: return game.puzzles.state["plate"], 4.0)
	step_until("the bridge rises", func() -> bool: return not game.puzzles.busy, 8.0)
	step_do(func() -> void: walk_to(22.2, -22.2))
	step_until("to the lever", func() -> bool: return game.auto_target == Vector3.INF, 6.0)
	step_do(func() -> void: ok("the drawbridge lever (a way back)", _focus() == "drawbridge" and game.try_interact(), _focus()))
	step_until("the drawbridge falls", func() -> bool: return game.level.named["LB"].enabled, 4.0)
	walk_path("to the risen bridge", [[27.7, -21.3], [27.7, -24.4], [27.7, -28.6]])

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
	walk_path("into the shrine", [[20.35, -33.93], [20.35, -29.0], [25.0, -29.0], [25.0, -30.8]])
	step_do(func() -> void: ok("reached the First Shrine", game.area == "first_shrine", game.area))

	# ================================================================ 13. the first shrine + "The Hand in the Water"
	step_do(func() -> void:
		ok("shrine is dark", game.world.awaken == 0.0)
		ok("wake the shrine", _focus() == "shrine" and game.try_interact(), _focus())
		_mark = int(t * 10.0))
	step_wait(6.0)
	step_do(func() -> void:
		ok("cinematic: letterbox", game.mode == "cine" and game.ui.letterbox > 0.99)
		ok("cinematic: the shrine wakes", float(game.puzzles.shrine_ring.get_shader_parameter("lit")) > 0.9)
		ok("cinematic: near geometry cut away, the crystal lifted out of the shot", game.world.cam.near > 30.0 and game.puzzles.crystal_lift > 1.0))
	step_wait(9.0)
	step_do(func() -> void:
		ok("cinematic: her reflection in the shrine pool", C().her.visible and float(C().her.body_mat.get_shader_parameter("vis")) > 0.5)
		ok("cinematic: camera looks down into the water", -game.world.pitch_node.rotation.x > deg_to_rad(47.0), "%.1f deg" % rad_to_deg(-game.world.pitch_node.rotation.x)))
	step_wait(7.0)           # t = 22 (the score: hands touch at 16.5 + 4.5)
	step_do(func() -> void:
		ok("cinematic: palm to palm", game.player.extra_reach > 0.9 and C().her.pose.reach > 0.9)
		ok("cinematic: Katoptron lights on you both", game.player.fig.runes_awake == 1 and C().her.runes_awake == 1))
	step_wait(16.0)          # t = 38 (veil lift swell)
	step_do(func() -> void: ok("cinematic: her veil lifts", C().her.veil.rotation.x < -1.5, "%.2f" % C().her.veil.rotation.x))
	step_wait(16.0)          # t = 54
	step_do(func() -> void: ok("cinematic: she is gone; the pool shows only you", not C().her.visible and C().mine.visible))
	step_wait(3.0)
	step_do(func() -> void: ok("memory fragment shows", game.ui.memory.modulate.a > 0.3 and game.ui.memory_line.text == Game.MEMORY_LINE))
	step_until("shrine counter I / VII shows", func() -> bool: return game.ui.end_b.modulate.a > 0.5 and game.ui.end_b.text == "I  /  VII", 12.0)
	step_until("the cinematic ends", func() -> bool: return game.mode == "play", 10.0)
	step_do(func() -> void:
		var secs := t - _mark / 10.0
		ok("cinematic: ~4.5 s awakening + the 59 s score", secs > 62.0 and secs < 66.0, "%.1f s" % secs)
		ok("music cues: shrine_awaken, then cinematic_hand", game.sfx.played.get("cue:shrine_awaken", 0) >= 1 and game.sfx.played.get("cue:cinematic_hand", 0) >= 1)
		ok("the room beds come back after the scene", game.sfx.duck == 0.0)
		ok("the world beyond is revealed", game.level.beyond.visible and game.world.awaken >= 0.999)
		ok("first shrine lights one cloak rune and brightens the hem", game.player.fig.runes_awake == 1 and game.player.fig.hem > 1.5)
		ok("the shrine leaves its light on", float(game.puzzles.shrine_pillar.get_shader_parameter("fade")) > 0.5)
		ok("milestone text names the chapter", game.ui.end_a.text == "The Veiled Gate — awakened", game.ui.end_a.text)
		ok("still playable, controls back, no letterbox", game.mode == "play" and not game.player.locked and game.controls.enabled and game.ui.letterbox < 0.01)
		ok("camera back to normal", is_equal_approx(game.world.pitch_node.rotation.x, -World.PITCH) and game.world.follow == game.player and game.world.cam.near == 1.0)
		ok("fog receded", game.world.env.fog_depth_end > World.DIST + 50.0)
		ok("score cues played", game.sfx.played.get("cue:cinematic_hand", 0) >= 1 and game.sfx.played.get("swell", 0) >= 1))

	# ---- cannot fall: random walks in every space + the sealed way
	walk_path("to the sealed way", [[25.0, -29.3], [29.6, -29.3], [29.6, -35.6], [28.0, -36.6], [28.0, -38.6]])
	step_do(func() -> void: ok("the way on is sealed", P().z > -38.9 and _focus() == "sealed" and game.try_interact(), str(P())))
	for zone in [[28.0, -37.5], [0.0, 0.0], [-5.0, 1.7], [-11.3, -2.0], [-11.3, -9.0], [-7.0, -13.5], [0.0, -16.0], [6.0, -12.0], [12.0, -10.0],
			[21.0, -10.0], [12.0, -22.0], [13.0, -34.0], [17.0, -45.4], [18.3, -48.5], [29.0, -49.0], [31.4, -32.0], [19.0, -20.4], [25.0, -22.0], [22.0, -29.0], [0.0, 6.5]]:
		step_do(func() -> void: tp(zone[0], zone[1]))
		step_walk(14.0)
	step_do(func() -> void:
		ok("random walk: always on walkable ground", walk_violations == 0, "%d samples, %d violations, max step dy %.3f" % [walk_samples, walk_violations, max_dy])
		ok("random walk: never inside a solid prop's footprint", solid_hits == 0, "%d samples, %d hits" % [walk_samples, solid_hits]))
	# ---- v0.7 collisions: every prop and piece of architecture is solid
	step_do(func() -> void:
		var au: Dictionary = game.level.audit
		var n_static := 0
		for sd in au["solids"]: n_static += 0 if sd[4] else 1
		ok("collision audit: every primitive classified", au["parts"] > 1000 and au["solids"].size() > 500, "%d primitives, %d solid footprints (%d static), %d obstacles added" % [au["parts"], au["solids"].size(), n_static, au["added"]])
		var res := _collision_audit()
		for b in (res["bad"] as Array).slice(0, 12): print("  overlap: ", b)
		notes.append("collision audit: %d primitives, %d solid footprints, %d obstacles added; %d targets walked into from 4 sides (%d approaches), %d overlaps" % [au["parts"], au["solids"].size(), au["added"], res["targets"], res["approaches"], (res["bad"] as Array).size()])
		print("  ", notes[-1])
		ok("collision: walking into every solid prop and obstacle from 4 sides never overlaps it", (res["bad"] as Array).is_empty() and res["approaches"] > 1000, "%d targets, %d approaches, %d overlaps" % [res["targets"], res["approaches"], (res["bad"] as Array).size()])
		tp(-11.3, -1.0, 0.0))
	step_do(func() -> void: game.cmd("input:-1:0"))
	step_wait(1.5)
	step_do(func() -> void:
		game.cmd("stop")
		ok("the first flight: its open side's balustrade stops you", P().x > -12.35 + 0.2, str(P()))
		var lo := game.level.height_at(Vector2(-11.3, -0.5))
		var hi := game.level.height_at(Vector2(-11.3, -3.8))
		ok("the first flight rises the way its steps are drawn (no walking through raised steps)", hi > lo + 0.4 and not str(game.level.audit["solids"]).contains(":floor"), "%.2f -> %.2f" % [lo, hi])
		tp(1.0, -16.6, PI))
	step_do(func() -> void: game.cmd("input:0:-1"))
	step_wait(1.5)
	step_do(func() -> void:
		game.cmd("stop")
		var hit := _solid_hit(P())
		ok("walking at the hall's bust and the mirror: never inside them", hit == "" and not game.level.blocked(Vector2(P().x, P().z), Player.RADIUS - 0.02), hit + " " + str(P())))

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
		ok("restored regions", game.level.named["pool4_2_0"].enabled and not game.level.named["breath_gate"].enabled and game.level.named["hdoor"].enabled
			and game.level.named["g_door"].enabled and not game.level.named["hw_gate"].enabled and game.level.named["MZ_door"].enabled
			and game.level.named["EC_room"].enabled and not game.level.named["tholos_front"].enabled and game.level.named["EB"].enabled)
		ok("restored inventory", game.controls.inv_has)
		ok("restored the won balance", C().state["scales"] and C().state["hall"]["locks"] == [true, true, true])
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
		ok("new game: regions reset", not game.level.named["pool4_2_0"].enabled and not cs["stones"] and cs["pool_turns"] == Ch1Geo.POOL_START and game.level.named["breath_gate"].enabled and not game.level.named["hdoor"].enabled
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
var solid_hits := 0
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
	if bad == "":
		var hit := _solid_hit(p)
		if hit != "":
			solid_hits += 1
			if solid_hits < 12: print("  solid overlap: ", hit, " at ", p, " step ", si)
	if bad != "":
		walk_violations += 1
		if walk_violations < 12: print("  violation: ", bad, " at ", p, " step ", si)

func _finish() -> void:
	print("PLAYTHROUGH %s  checks=%d  failed=%d  sim_time=%.1fs  ground_samples=%d" % ["OK" if errors == 0 else "FAILED", checks, errors, t, walk_samples])
	get_tree().quit(0 if errors == 0 else 1)
