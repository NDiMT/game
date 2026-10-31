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

var _mark := 0
var _feet_seen := false

func C() -> Chapter:
	return game.chapter

## v0.8.1 "Where Her Shadow Fell": every lit set whose shadows are exactly the outlined ones
func _shadow_solutions() -> Array:
	var out := []
	var nb: int = Chapter.SH_BRAZ.size()
	for mask in range(1, 1 << nb):
		var lit := []
		for i in nb:
			if mask & (1 << i): lit.append(i)
		if lit == Chapter.SH_SOLUTION: out.append(lit)
	# (the game's own rule: sorted lit set == the outlined set; also check no two braziers cast the same shadow)
	var seen := {}
	for i in nb:
		var sh: Array = Chapter.shadow_of(i)
		var key := "%.2f,%.2f,%.2f" % [sh[1].x, sh[1].y, sh[2]]
		if seen.has(key): out.append([-1])
		seen[key] = true
	return out
func _shadow_geometry_ok() -> bool:
	var ok2 := true
	var nb: int = Chapter.SH_BRAZ.size()
	for i in nb:
		var b: Vector3 = Chapter.SH_BRAZ[i]
		var sh: Array = Chapter.shadow_of(i)
		var away := Vector2(Chapter.SH_STATUE.x - b.x, Chapter.SH_STATUE.z - b.z)
		ok2 = ok2 and (sh[1] as Vector2).dot(away.normalized()) > 0.999
		for j in nb:
			var b2: Vector3 = Chapter.SH_BRAZ[j]
			var d1 := away.length()
			var d2 := Vector2(Chapter.SH_STATUE.x - b2.x, Chapter.SH_STATUE.z - b2.z).length()
			if d1 < d2 - 0.3: ok2 = ok2 and float(sh[2]) >= float(Chapter.shadow_of(j)[2])
	return ok2
func _shadow_hint_ok() -> bool:
	var was_g: bool = C().state["gallery"]
	var was_a := game.area
	C().state["gallery"] = false
	game.area = "shard_gallery"
	C().hint_t = Game.HINT_AFTER + 1.0
	C()._update_gallery(0.016)
	var h := float(C().sh_eye_mats[0].get_shader_parameter("pulse"))
	C().state["gallery"] = was_g
	game.area = was_a
	C().hint_t = 0.0
	C()._update_gallery(0.016)
	return h > 0.5

## v0.7 the Pool of Halves: one press of interact on real slab ri
func _pool_press(ri: int, label: String) -> void:
	step_do(func() -> void: ok(label, _focus() == "pool_turn%d" % ri and game.try_interact(), _focus()))
	step_until(label + " (turned)", func() -> bool: return not C()._pool_tw.has(ri), 3.0)
	step_wait(0.15)

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

## v0.8: every key place still reachable on foot from the gate (props must not close a path)
func _reach(goals: Array) -> Array:
	var lv: Level = game.level
	var st := 0.25
	var org := Vector2(-14.0, -54.0)
	var nx := int(50.0 / st)
	var nz := int(63.0 / st)
	var seen := {}
	var start := Vector2i(int((Level.WAKE_POS.x - org.x) / st), int((Level.WAKE_POS.z - org.y) / st))
	var q := [start]
	seen[start] = lv.height_at(Vector2(Level.WAKE_POS.x, Level.WAKE_POS.z))
	while not q.is_empty():
		var c: Vector2i = q.pop_back()
		var h: float = seen[c]
		for d in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
			var n: Vector2i = c + d
			if seen.has(n) or n.x < 0 or n.y < 0 or n.x >= nx or n.y >= nz: continue
			var p := org + Vector2(n) * st
			if not lv.circle_ok(p, Player.RADIUS - 0.02) or lv.blocked(p, Player.RADIUS - 0.02): continue
			var hn := lv.height_at(p)
			if absf(hn - h) > 0.3: continue
			seen[n] = hn
			q.append(n)
	var missing := []
	for g in goals:
		var gp := Vector2i(int(round((g[0] - org.x) / st)), int(round((g[1] - org.y) / st)))
		var ok2 := false
		for dx in range(-2, 3):
			for dz in range(-2, 3):
				if seen.has(gp + Vector2i(dx, dz)): ok2 = true
		if not ok2: missing.append(g)
	return missing

## (v1.0) the touch stick, through the real input events (pushed into the viewport, as the platform does): a thumb down on the left of the screen, dragged
## toward a WORLD direction as the screen shows it, `err` degrees off true
const _STICK_ID := 7
var _stick_on := false
func _stick_dir(world_dir: Vector3, err: float) -> void:
	var axes: Array = game.world.ground_axes()
	var sv := Vector2(world_dir.dot(axes[0]), -world_dir.dot(axes[1])).normalized().rotated(deg_to_rad(err))
	var vs: Vector2 = game.get_viewport().get_visible_rect().size
	var base := Vector2(vs.x * 0.22, vs.y * 0.72)
	if _stick_on: _stick_up()
	var t := InputEventScreenTouch.new()
	t.index = _STICK_ID; t.position = base; t.pressed = true
	get_viewport().push_input(t, true)
	var dr := InputEventScreenDrag.new()
	dr.index = _STICK_ID; dr.position = base + sv * Controls.JOY_R * 0.85
	get_viewport().push_input(dr, true)
	_stick_on = true

func _stick_grid(d: Vector2i, err: float) -> void:
	_stick_dir(OurSteps.dir_world(d), err)

func _stick_up() -> void:
	var t := InputEventScreenTouch.new()
	t.index = _STICK_ID; t.position = Vector2(10, 10); t.pressed = false
	get_viewport().push_input(t, true)
	_stick_on = false

## one Our Steps step by the stick: push, wait for the step to start, let go, wait for it to end
func _stick_step(d: Vector2i, err: float) -> void:
	step_do(func() -> void:
		_mark = C().steps.moves
		_stick_grid(d, err))
	step_until("a stick step %s" % d, func() -> bool: return C().steps.moves > _mark or not C().steps.active, 3.0)
	step_do(func() -> void: _stick_up())
	step_until("the step ends", func() -> bool: return not C().steps.moving, 4.0)

## v0.5: Chapter I, all thirteen spaces, in order, through the real game code
func _plan() -> void:
	step_until("title", func() -> bool: return game.mode == "title" and game.sfx.ready_ok, 20.0)
	step_do(func() -> void: game.cmd("reset_save"); game.cmd("anew"))
	step_until("wake -> play", func() -> bool: return game.mode == "play", 12.0)
	step_do(func() -> void:
		ok("woke at the veiled gate", P().distance_to(Level.WAKE_POS) < 0.2, str(P()))
		ok("chapter title on the title screen", Names.CHAPTER == "The Veiled Gate"))

	# ================================================================ 0. v1.0 M3: the Atrium (the hub) and its ways out
	walk_path("down the stub", [[0.0, 4.6], [0.0, 7.0]])
	walk_path("over the Crumbling Bridge", [[0.0, 8.4], [0.0, 10.4]])
	step_do(func() -> void:
		ok("(v1.0) the Atrium of a Thousand Faces, over the Crumbling Bridge", game.area == "atrium" and game.visited.has("t:T1") and absf(P().y - WorldGeo.A_Y) < 0.02, str(P()) + " " + game.area)
		ok("(v1.0) the bridge's loose slabs settled under you, a corner fell away", C().hub._settled == [true, true, true] and int(game.juice.fired.get("grit", 0)) >= 3, str(C().hub._settled)))
	# the undercroft is dark: no way in without a light
	walk_path("to the undercroft's mouth", [[5.6, 10.3], [13.4, 10.6], [13.5, 11.4]])
	step_do(func() -> void:
		ok("(v1.0) too dark to go in without a light", _focus() == "uc_dark" and game.try_interact() and game.ui.text.text.begins_with("Too dark"), _focus())
		walk_to(16.0, 11.4))
	step_wait(1.0)
	step_do(func() -> void:
		ok("(v1.0) the dark stops you at its mouth", P().x < 14.0, str(P()))
		game.cmd("stop"))
	# up Theron's scaffold for the lamp
	walk_path("across the Atrium", [[10.6, 12.6], [10.6, 16.0], [8.6, 19.5], [8.6, 22.3], [11.9, 22.55]])
	walk_path("up the scaffold", [[11.9, 17.8], [12.3, 15.0]])
	step_do(func() -> void:
		ok("(v1.0) on Theron's gallery, by his workbench", absf(P().y - WorldGeo.GAL_Y) < 0.02 and game.visited.has("t:A_scaf"), str(P()))
		ok("(v1.0) take the oil lamp", _focus() == "lamp_take" and game.try_interact(), _focus()))
	step_wait(0.4)
	step_do(func() -> void:
		ok("(v1.0) the lamp is carried: in her hand, its own light", C().hub.has_item("lamp") and C().hub.lamp_held.is_inside_tree() and C().hub.lamp_held.get_parent() == game.player.fig and C().hub.lamp_light.visible))
	walk_path("down the scaffold", [[11.9, 22.55], [8.6, 22.3], [8.6, 19.5], [10.6, 16.0], [10.6, 12.6], [11.5, 10.2]])
	# T4: the flooded colonnade; her reflection walks the hidden stones ahead of you
	var t4: Array = [[11.5, 9.1]]
	for c in WorldGeo.T4_STONES: t4.append([c.x, c.y])
	t4.append_array([[12.15, 4.6], [12.15, 3.6]])
	step_do(func() -> void: walk_to(11.5, 9.1))
	step_until("down into the water", func() -> bool: return game.auto_target == Vector3.INF, 6.0)
	step_wait(1.2)
	step_do(func() -> void:
		ok("(v1.0) the Flooded Colonnade: her reflection walks the stones ahead of you", C().hub.t4_refl.active and C().hub.t4_s > 1.0, "s %.2f" % C().hub.t4_s))
	walk_path("the hidden stones", t4.slice(1))
	step_do(func() -> void:
		ok("(v1.0) up onto the colossus' stones: the Garden wing and the Colossus beyond", absf(P().y - 1.0) < 0.02 and game.visited.has("t:T4"), str(P())))
	step_wait(0.8)
	step_do(func() -> void:
		ok("(v1.0) the Colossus named the first time it is reached, from the Atrium side too", game.visited.has("w:CO") and game.ui.area_label.text == "THE SUNKEN COLOSSUS", game.ui.area_label.text))
	var back: Array = t4.duplicate()
	back.reverse()
	walk_path("back over the hidden stones", back.slice(1) + [[11.5, 10.2]])
	# T5 and T3: the lamp parts the dark; the balcony runs to the Eidolon Ledge
	walk_path("into the undercroft, lamp in hand", [[13.5, 11.4], [15.2, 11.4], [17.6, 11.4], [20.2, 11.4], [23.0, 11.4]])
	step_do(func() -> void:
		ok("(v1.0) the lamp parts the Undercroft's dark", game.visited.has("t:UC") and P().x > 22.0 and float(C().hub.uc_veil.get_shader_parameter("density")) < 0.05, str(P())))
	walk_path("up to the Wind-swept Balcony", [[26.9, 11.4], [28.0, 10.6], [28.0, 0.0], [27.6, -12.0], [27.6, -18.4], [27.4, -20.2]])
	step_do(func() -> void:
		ok("(v1.0) the balcony brings you to the Eidolon Ledge", game.visited.has("t:BAL") and game.area == "eidolon_ledge" and absf(P().y - 2.0) < 0.02, str(P()) + " " + game.area))
	step_do(func() -> void: tp(0.0, 4.4, PI))
	step_wait(0.5)

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
		ok("the first turn answers the shore: its joint lights at once", C().pool_joints_lit.has("0,1,E") and C().pool_joints_lit.size() >= 1, str(C().pool_joints_lit.keys()))
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
	step_wait(3.5)
	step_do(func() -> void:
		var f: Dictionary = game.juice.fired
		ok("(v1.0 juice) her slabs rise heavily: the water bulges and rings, sheets off their edges, the wet stone dries",
			int(f.get("ring", 0)) >= 4 and int(f.get("sheet", 0)) >= 4 and int(f.get("wet", 0)) >= 1 and int(f.get("bubbles", 0)) >= 1, str(f)))
	step_do(func() -> void:
		var all_lit := true
		for c in C().pool_pieces:
			var pc: Dictionary = C().pool_pieces[c]
			if pc["real"] < 0: continue
			for k in (pc["seams"] as Array).size():
				all_lit = all_lit and C()._joint_ok(c, Ch1Geo.rot_conn(pc["dirs"][k], int(C().state["pool_turns"][pc["real"]])))
		ok("every joint of the whole path is answered (its seam lit)", all_lit and C().pool_joints_lit.size() >= 14, str(C().pool_joints_lit.size()))
		ok("a joint lighting chimes", game.sfx.played.get("chime", 0) > 0)
		ok("her stones break the surface: spray and a deep rumble", game.sfx.played.get("grind", 0) > 4))
	step_wait(2.6)
	step_do(func() -> void:
		ok("her slabs are solid now", game.level.on_ground(Ch1Geo.cell_pos(Vector2i(4, 2))) and (C().pool_pieces[Vector2i(4, 2)]["node"] as Node3D).visible)
		var info: PackedVector4Array = C().pool_mat.get_shader_parameter("arm_info")
		var hers := 0
		for v in info: hers += 1 if v.z > 0.5 else 0
		ok("...and the reflection no longer marks any as hers", hers == 0)
		ok("solving plays the solve jingle (one motif for every solve)", game.sfx.played.get("cue:solve_jingle", 0) >= 1 and game.sfx.played.get("cue:solve_waking_pool", 0) == 0)
		ok("the music bed steps back under the jingle, then returns", game.sfx.jingle_duck > -6.01 and ResourceLoader.exists("res://assets/audio/v5/cues/solve_jingle.ogg")))
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
		ok("the whole rune is carved large beside the stair, invisible until you pass it (v0.9.4)", rw.visible and (rw.mesh as QuadMesh).size.x >= 1.2 and int(rm.get_shader_parameter("count")) > 8 and float(rm.get_shader_parameter("lit")) < 0.05, str(P()))
		_mark = int(P().z * 100.0))
	walk_path("past the carved rune", [[-11.3, -1.0], [-11.2, -2.6]])
	step_wait(0.8)
	step_do(func() -> void:
		var rm := C().stair_rune.material_override as ShaderMaterial
		ok("(v0.9.1) passing before it, the rune lights", float(rm.get_shader_parameter("lit")) > 0.7, str(rm.get_shader_parameter("lit"))))
	walk_path("on up the stair", [[-11.2, -4.6]])
	step_wait(2.0)
	step_do(func() -> void:
		var rm := C().stair_rune.material_override as ShaderMaterial
		ok("(v0.9.1) left behind, it fades away again", float(rm.get_shader_parameter("lit")) < 0.05, str(rm.get_shader_parameter("lit"))))
	step_do(func() -> void:
		var m: ShaderMaterial = C().breath_mats["stair"]
		var sz: Vector2 = m.get_shader_parameter("size")
		var gs := minf(sz.x, sz.y) * 0.42              # (the shader's glyph scale; the glyph spans +-0.55 of it)
		ok("the breath glass is back in the stair wall (v0.8)", game.level.interact_by_id("breathe_stair").pos.is_equal_approx(Vector3(-11.1, 0.5, -5.3)))
		ok("the whole glyph fits on the pane with a margin", gs * 0.6 < sz.x * 0.5 - 0.1 and gs * 0.6 < sz.y * 0.5 - 0.1, str(gs)))
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
	step_do(func() -> void: ok("a quarter turn is not as the glass remembers", not C().hall_matches()[2]))
	step_do(func() -> void:
		_mark = game.sfx.played.get("chime_hall", 0)
		ok("turn it again", game.try_interact()))
	step_wait(0.25)
	step_do(func() -> void: ok("a visible arc sweeps the quarter turn on the floor", float(C().bust_arc_mat.get_shader_parameter("sweep")) > 0.2 and float(C().bust_arc_mat.get_shader_parameter("intensity")) > 0.3))
	step_wait(2.4)
	step_do(func() -> void:
		ok("facing the glass: right (the solver sees it)", C().hall_matches()[2])
		ok("but nothing tells you so: no chime, no glow, no lock, it stays out of the glass", game.sfx.played.get("chime_hall", 0) == _mark and not C()._locked(2) and C().twins[2].visible and (C().bust_pivot.get_child(0) as MeshInstance3D).layers & 1 == 0)
		ok("no target outlines or markers on the floor", C().goal_mats.is_empty() and C().match_glows.is_empty()))
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
	step_do(func() -> void: ok("reset: everything goes back where it was found (nothing is locked before the whole set)", C().state["hall"]["drum"] == [Chapter.DRUM_START.x, Chapter.DRUM_START.y] and int(C().state["hall"]["bust"]) == Chapter.BUST_START, str(C().state["hall"])))
	# the bust again (reset turned it back)
	step_do(func() -> void: tp(1.0, -17.3, PI))
	step_wait(0.3)
	for i in 2:
		step_do(func() -> void: ok("turn the bust back to the glass (%d)" % (i + 1), _focus() == "hall_turn" and game.try_interact(), _focus()))
		step_wait(1.6)
	step_do(func() -> void: ok("the bust faces the glass again", C().hall_matches()[2], str(C().state["hall"])))
	var drum_pushes := [[-1.8, -13.0], [0.0, -12.2], [0.0, -13.2], [0.0, -14.2], [0.0, -15.2], [0.0, -16.2], [0.0, -17.2]]
	for i in drum_pushes.size():
		var sp: Array = drum_pushes[i]
		step_do(func() -> void: tp(sp[0], sp[1], 0.0))
		step_wait(0.25)
		step_do(func() -> void: ok("push the drum (%d)" % (i + 1), _focus() == "hall_push" and game.try_interact(), _focus()))
		step_wait(0.8)
		if i == 4:
			step_do(func() -> void: ok("a cell short of where it was: not yet", not C().hall_matches()[0], str(C().state["hall"]["drum"])))
	step_do(func() -> void:
		ok("the drum lies where the glass remembers it", C().hall_matches()[0], str(C().state["hall"]["drum"]))
		ok("two of three right: still nothing, still movable", not C().state["hall_door"] and not C()._locked(0) and not C()._locked(2)))
	# (v0.8.1) the 110 s hint: the remembered things pulse in the glass
	step_do(func() -> void: C().hint_t = Game.HINT_AFTER + 3.5)
	step_wait(0.6)
	step_do(func() -> void:
		var gi := 0.0
		for k in [0, 2]: gi = maxf(gi, float((C().twin_mats[k] as ShaderMaterial).get_shader_parameter("intensity")))
		ok("hint after 110 s: the memories pulse in the glass", gi > 0.05, str(gi))
		C().hint_t = 0.0)
	# the brazier: carry it; set it down in the wrong place first, then where the glass shows it
	step_do(func() -> void: tp(3.0, -12.3, PI))
	step_wait(0.3)
	step_do(func() -> void: ok("take the brazier", _focus() == "hall_take" and game.try_interact(), _focus()))
	# (QA P1-1) carried out of the Hall, it goes back; the place prompt never follows you out
	step_do(func() -> void: tp(-6.0, -13.5, 0.0))
	step_wait(0.8)
	step_do(func() -> void:
		ok("the brazier does not leave the Hall: it returns", not C().carrying and _focus() != "hall_place", _focus())
		tp(3.0, -12.3, PI))
	step_wait(0.6)
	step_do(func() -> void: ok("take the brazier again", _focus() == "hall_take" and game.try_interact(), _focus()))
	step_do(func() -> void: tp(2.0, -16.05, 0.0))
	step_wait(0.4)
	step_do(func() -> void: ok("set it down", _focus() == "hall_place" and game.try_interact() and not C().carrying, _focus()))
	step_wait(0.6)
	step_do(func() -> void: ok("a brazier in the wrong place: nothing happens", not C().hall_matches()[1] and not C().state["hall_door"]))
	step_do(func() -> void: tp(2.0, -16.3, 0.0))
	step_wait(0.3)
	step_do(func() -> void: ok("take it again", _focus() == "hall_take" and game.try_interact(), _focus()))
	step_do(func() -> void: tp(2.0, -18.05, 0.0))
	step_wait(0.4)
	step_do(func() -> void: ok("set it down where it stood", game.try_interact() and not C().carrying, _focus()))
	step_until("all three as the glass remembers: the doorway opens", func() -> bool: return C().state["hall_door"] and game.level.named["hdoor"].enabled, 4.0)
	step_do(func() -> void:
		ok("solver: each goal cell is free, and the drum starts away from it", C().hall_free(Chapter.DRUM_GOAL, 0.42, 0) or C()._locked(0))
		ok("only the whole set answers: all three locked at once, one chime", C()._locked(0) and C()._locked(1) and C()._locked(2))
		ok("the Mirror Shard lies on the threshold", C().shard_node.visible and not C().state["shard"])
		walk_to(4.0, -17.5))
	step_until("to the threshold", func() -> bool: return game.auto_target == Vector3.INF, 8.0)
	step_do(func() -> void: ok("take the shard", _focus() == "take_shard" and game.try_interact(), _focus()))
	step_wait(1.0)
	step_do(func() -> void: ok("the shard is in the inventory", C().state["shard"] and game.controls.inv_has and not game.controls.inv_on))
	walk_path("walk to the tablet", [[2.0, -18.0], [3.85, -18.2], [3.85, -19.15]])
	step_do(func() -> void: ok("tablet readable", game.try_interact() and game.puzzles.state["tablet"], _focus()))
	walk_path("through the remembered door", [[3.6, -17.5], [5.6, -17.5], [5.7, -15.2]])
	step_do(func() -> void: ok("reached the Shard Gallery", game.area == "shard_gallery" and P().x > 5.0, str(P()) + " " + game.area))

	# ================================================================ 4. "Where Her Shadow Fell" (v0.8.1)
	step_do(func() -> void:
		ok("the chamber is named for it", Names.area("shard_gallery") == "Where Her Shadow Fell")
		ok("no way on: the wall is whole", game.level.named["gallery_secret"].enabled)
		var cold := true
		for i in C().sh_flames.size():
			if i != Chapter.SH_PRELIT: cold = cold and C().sh_flames[i].level() < 0.01
		ok("her veiled statue in the middle, five braziers round her", C().sh_flames.size() == 5 and cold and C().sh_shadows.size() == 5)
		ok("(v0.9) one already burns as you come in, and it is not one of hers", C().sh_flames[Chapter.SH_PRELIT].level() > 0.5 and float(C().sh_shadows[Chapter.SH_PRELIT].get_shader_parameter("k")) > 0.5 and not (Chapter.SH_PRELIT in Chapter.SH_SOLUTION))
		ok("(v0.9.2) no shard here: its slot does not call", not game.controls.inv_pulse)
		ok("(v0.9.2) on the floor before her, pairs of glowing eyes, one pair per shadow of hers", C().sh_eye_mats.size() == Chapter.SH_SOLUTION.size() * 2)
		var good := true
		for i in Chapter.SH_BRAZ.size():
			for j in Chapter.SH_SOLUTION:
				# a pair is worn only by its own brazier's shadow: no other shadow's head lies on it
				var dd: float = C().eye_pos(i, 1.0).distance_to(C().eye_pos(j, 1.0))
				if i != j and dd < 0.25: good = false
		ok("(v0.9.2) each eye-pair sits exactly at one shadow's head, and at no other's", good)
		ok("(v0.9) a solution of 2-3 among 4-5 braziers", Chapter.SH_SOLUTION.size() >= 2 and Chapter.SH_SOLUTION.size() <= 3 and Chapter.SH_BRAZ.size() >= 4 and Chapter.SH_BRAZ.size() <= 5)
		ok("solver: exactly one set of braziers casts her shadow into the outlines", _shadow_solutions().size() == 1 and _shadow_solutions()[0] == Chapter.SH_SOLUTION, str(_shadow_solutions()))
		ok("solver: each brazier throws her shadow straight away from it, longer when nearer", _shadow_geometry_ok()))
	walk_path("into the chamber", [[6.5, -15.2], [6.6, -10.6], [8.4, -10.6]])
	step_do(func() -> void:
		ok("walking about the chamber", game.area == "shard_gallery", str(P()) + " " + game.area)
		walk_to(8.1, -8.4))
	step_wait(0.7)
	step_until("the wall", func() -> bool: return game.player.still_time > 0.3 or game.auto_target == Vector3.INF, 4.0)
	step_do(func() -> void:
		game.cmd("stop")
		ok("the gate is a wall in your world", P().z < -9.55, str(P()))
		tp(6.8, -11.2, PI))
	step_do(func() -> void:
		ok("(v0.9.2) the lit one that is not hers casts a shadow without eyes", float(C().sh_shadows[Chapter.SH_PRELIT].get_shader_parameter("eyes")) < 0.01 and C().sh_flames[Chapter.SH_PRELIT].level() > 0.5))
	# lighting EVERY brazier is not the answer (and nothing answers brazier by brazier)
	var bspots := []
	var nbz: int = Chapter.SH_BRAZ.size()
	for i in nbz:
		var b: Vector3 = Chapter.SH_BRAZ[i]
		var away := Vector2(b.x - Chapter.SH_STATUE.x, b.z - Chapter.SH_STATUE.z).normalized()
		bspots.append([b.x - away.x * 0.75, b.z - away.y * 0.75])
	for i in nbz:
		if i == Chapter.SH_PRELIT: continue          # (already burning)
		var sp: Array = bspots[i]
		var bi: int = i
		step_do(func() -> void: tp(sp[0], sp[1], 0.0))
		step_wait(0.25)
		step_do(func() -> void:
			_mark = game.sfx.played.get("chime", 0) + game.sfx.played.get("chime_hall", 0)
			ok("light brazier %d" % bi, _focus() == "brazier%d" % bi and game.try_interact(), _focus()))
		step_wait(0.7)
		step_do(func() -> void:
			var f: Flame = C().sh_flames[bi]
			ok("brazier %d: real fire and light; her shadow falls away from it" % bi, f.level() > 0.5 and float(C().sh_shadows[bi].get_shader_parameter("k")) > 0.5)
			ok("no answer brazier by brazier", game.sfx.played.get("chime", 0) + game.sfx.played.get("chime_hall", 0) == _mark))
	step_wait(1.2)
	step_do(func() -> void: ok("all five lit: NOT the answer", not C().state["gallery"] and game.level.named["gallery_secret"].enabled))
	# put out the three that are not hers (each a toggle)
	var others := []
	for i in nbz:
		if not (i in Chapter.SH_SOLUTION): others.append(i)
	for i in others:
		var sp: Array = bspots[i]
		var bi: int = i
		step_do(func() -> void: tp(sp[0], sp[1], 0.0))
		step_wait(0.25)
		step_do(func() -> void: ok("put out brazier %d" % bi, _focus() == "brazier%d" % bi and game.try_interact(), _focus()))
		step_wait(0.9)
		if i == others[0]:
			step_do(func() -> void:
				ok("put out: its fire dies, its shadow goes", C().sh_flames[bi].level() < 0.05 and float(C().sh_shadows[bi].get_shader_parameter("k")) < 0.05)
				ok("still shut with the wrong set", not C().state["gallery"]))
	step_until("only her shadows: the true arch opens", func() -> bool: return C().state["gallery"] and not game.level.named["gallery_secret"].enabled, 4.0)
	step_do(func() -> void:
		ok("the lore line, in the third person", game.ui.text.text.begins_with("On Milos, in the evening,") and game.ui.text.text.contains("he moved the lamps"), game.ui.text.text)
		ok("the solve jingle", game.sfx.played.get("cue:solve_jingle", 0) >= 3))
	step_wait(1.8)
	step_do(func() -> void:
		ok("her shadows darken; her veil stirs", float(C().sh_shadows[0].get_shader_parameter("dark")) > 0.85 and float(C().sh_veil.get_shader_parameter("intensity")) > 0.3))
	step_wait(1.0)
	walk_path("through the true gate", [[6.6, -11.4], [8.1, -10.2], [8.1, -8.4], [8.85, -8.6]])
	step_do(func() -> void:
		ok("(v1.0) the West wing's Veil Seal has risen beyond the arch", C().hub._seal_up["W"] and _focus() == "seal_W" and game.try_interact(), _focus()))
	step_do(func() -> void: ok("(v1.0) the Seal of the Glass Wing, in the satchel", "W" in C().state["inv"]["seals"]))
	walk_path("on, down toward the colossus", [[8.5, -3.0]])
	step_do(func() -> void:
		ok("(v0.9) the gate opens onto the way down, not the garden", game.area == "shard_gallery" and game.wonders.here == "", str(P()) + " " + game.area))
	var co_path := []
	for c in Ch1Geo.CO_STONES: co_path.append([c.x, c.y])
	walk_path("along the colossus' cheek", co_path)
	step_do(func() -> void:
		ok("(v0.9) the Sunken Colossus: named on arrival, the music swells", game.visited.has("w:CO") and game.sfx.played.get("swell", 0) >= 1, game.ui.area_label.text)      # (v1.0: named once, already from the Atrium side)
		ok("(v0.9) the camera leans toward the head (a pan, never a zoom)", game.world.look_offset.length() > 0.5 and is_equal_approx(game.world.cam_size_target, World.FIXED_SIZE)))
	walk_path("up into the garden", [[15.5, -4.4], [15.5, -6.4], [14.8, -7.9], [13.0, -8.3], [12.8, -10.0]])
	step_do(func() -> void:
		ok("reached the Garden of the Veiled", game.area == "garden_veiled" and P().x > 10.3, str(P()) + " " + game.area)
		ok("the shard stays lowered", not C().lens_on))
	step_do(func() -> void:
		# the hint at 110 s: the outlines glow faintly even without the shard (checked on a fresh state)
		ok("hint (110 s): the eyes on the floor pulse", _shadow_hint_ok()))

	# ================================================================ 5. garden: the turned ones
	step_do(func() -> void:
		var bad := []
		for k in 3: bad.append_array(Chapter.garden_mirror_view(Vector3(Chapter.TURN_X[k], 1.0, Chapter.TURN_Z + 1.05), World.FIXED_SIZE))
		ok("(v0.9.1) the great glass shows all three turned ones' north faces whole, from every step", bad.is_empty(), str(bad)))
	step_do(func() -> void:
		ok("the old rune door panel is gone", game.ui.door_overlay.visible == false and game.puzzles.door == null)
		walk_to(16.4, -11.8))
	step_wait(0.7)
	step_until("the east door is shut", func() -> bool: return game.player.still_time > 0.4 or game.auto_target == Vector3.INF, 8.0)
	step_do(func() -> void:
		game.cmd("stop")
		ok("the garden door is closed", P().x < 16.6, str(P())))
	step_do(func() -> void: walk_to(Chapter.GARDEN_SMALL.x - 0.68, Chapter.GARDEN_SMALL.z))
	step_until("to her small glass", func() -> bool: return game.auto_target == Vector3.INF, 10.0)
	step_do(func() -> void:
		var m: ShaderMaterial = C().breath_mats["garden"]
		ok("(v0.9.4) her small glass is clear at rest", float(m.get_shader_parameter("fog")) < 0.05)
		ok("breathe on her small glass", _focus() == "breathe_garden" and game.try_interact(), _focus()))
	step_do(func() -> void:
		ok("(v0.9.4) the close-up opens, as on the stair", game.mode == "glass" and game.ui.glass_talk.write_only)
		# (v1.0 M1: the stale-fog bug) the pane opened after the stair's shows nothing of the stair's glass
		var gt: GlassTalk = game.ui.glass_talk
		var clean := gt.modulate.a < 0.01 and gt.fresh > 0 and gt.ink.mine.is_empty() and gt.ink.hint.is_empty() and gt.ink.palm_k == 0.0
		for h in gt.ink.her: clean = clean and float(h[1]) == 0.0
		for k in ["palm_k", "finger_k", "press_t", "glow"]: clean = clean and float(gt.glass_mat.get_shader_parameter(k)) == 0.0
		ok("(v1.0) a new pane opens clean: no fog, strokes or palm left from the last glass, hidden until its masks render", clean,
			"a %.2f fresh %d" % [gt.modulate.a, gt.fresh]))
	step_until("her hand writes her three runes in the close-up", func() -> bool: return C().state["garden_breath"], 14.0)
	step_until("the close-up ends by itself", func() -> bool: return game.mode == "play", 8.0)
	step_wait(2.0)
	step_do(func() -> void:
		var m: ShaderMaterial = C().breath_mats["garden"]
		ok("her message: three asymmetric runes, written from her side (mirrored for you)", m.get_shader_parameter("glyphs") == Vector3(6, 7, 8) and float(m.get_shader_parameter("flip")) == 1.0)
		ok("(v0.9.4) her small glass keeps her writing a while", float(m.get_shader_parameter("fog")) > 0.5 and float(m.get_shader_parameter("write")) > 0.99))
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
	# "Our Steps" (v1.0): the floor before a true mirror; played through the REAL input path (a thumb on the
	# touch stick, never quite straight), not the dev command
	step_do(func() -> void:
		var sv: Dictionary = OurSteps.solve()
		ok("solver: one shortest way onto both plates, 8..14 steps", int(sv["length"]) >= 8 and int(sv["length"]) <= 14 and int(sv["ways"]) == 1,
			"len %d ways %d states %d" % [sv["length"], sv["ways"], sv["states"]])
		ok("solver: no softlock: every reachable state can still leave the floor", int(sv["trapped"]) == 0, str(sv["trapped"]))
		ok("the plates are not mirror and mirror (her stones must part you)", OurSteps.Y_PLATE != OurSteps.H_PLATE)
		ok("the teaching drum stands one step before her entry, and the first step of the answer is that step",
			Vector2i(2, 1) in OurSteps.H_OBS and sv["path"][0] == Vector2i(0, 1))
		ok("(v1.0) a 5 x 3 floor along a tall planar mirror; her room only in the glass", OurSteps.C == 5 and OurSteps.R == 3 and C().steps.refl.planar != null and C().steps.refl.hold)
		ok("the floor starts unsolved and off", not C().steps.active and not C().state["hollow_done"]))
	var near_e := OurSteps.at(0.0, OurSteps.EDGE_V - 0.9)
	walk_path("to the landing", [[18.2, -10.5], [near_e.x, near_e.z]])
	# on (the stick pushed up): the teaching moment: you step forward, she is held by her drum
	step_do(func() -> void: _stick_dir(OurSteps.V, 0.0))
	step_until("onto the floor (by the stick)", func() -> bool: return C().steps.active, 6.0)
	step_do(func() -> void: _stick_up())
	step_until("the teaching moment plays", func() -> bool: return C().steps.taught and not C().steps.moving, 6.0)
	step_do(func() -> void:
		ok("teach: you stepped forward, she was held by the drum", C().steps.p == Vector2i(2, 1) and C().steps.h == OurSteps.ENTRY,
			"p %s h %s" % [C().steps.p, C().steps.h])
		ok("(v1.0) she stands, for the glass, on her entry slab", C().steps.refl.hold_xf.origin.distance_to(OurSteps.tile(OurSteps.ENTRY)) < 0.1, str(C().steps.refl.hold_xf.origin))
		ok("you stand on your slab", Vector2(P().x, P().z).distance_to(Vector2(OurSteps.tile(Vector2i(2, 1)).x, OurSteps.tile(Vector2i(2, 1)).z)) < 0.3, str(P())))
	# refused: your stone; a nudge out and back, and you are where you were
	step_do(func() -> void:
		_mark = C().steps.blocked_n
		_stick_grid(Vector2i(-1, 0), 18.0))
	step_until("the stone refuses", func() -> bool: return C().steps.blocked_n > _mark, 3.0)
	step_do(func() -> void: _stick_up())
	step_until("the nudge settles", func() -> bool: return not C().steps.moving and C().steps._cool <= 0.0, 3.0)
	step_do(func() -> void:
		ok("your stone refuses the step (no move, a nudge, back on your slab)", C().steps.p == Vector2i(2, 1) and C().steps.h == OurSteps.ENTRY and
			Vector2(P().x, P().z).distance_to(Vector2(OurSteps.tile(Vector2i(2, 1)).x, OurSteps.tile(Vector2i(2, 1)).z)) < 0.12, str(P())))
	# off: back to the entry and off the edge (the stick, down twice); she comes back to your mirror
	_stick_step(Vector2i(0, -1), -15.0)
	step_do(func() -> void: ok("back on the entry slab", C().steps.p == OurSteps.ENTRY and C().steps.active, str(C().steps.p)))
	step_do(func() -> void: _stick_grid(Vector2i(0, -1), 10.0))
	step_until("stepped off", func() -> bool: return not C().steps.active, 3.0)
	step_do(func() -> void: _stick_up())
	step_until("off and still", func() -> bool: return not C().steps._leaving and game.auto_target == Vector3.INF, 5.0)
	step_wait(0.5)
	step_do(func() -> void:
		ok("off: you are on the landing, she is back at your mirror", OurSteps.local(P()).y < OurSteps.EDGE_V and C().steps.h == OurSteps.ENTRY and not C().steps.active,
			str(P()) + " " + str(C().steps.her_pos)))
	# on again (no teaching now), one step, and the reset stone
	step_do(func() -> void: _stick_dir(OurSteps.V, 12.0))
	step_until("onto the floor again", func() -> bool: return C().steps.active, 6.0)
	step_do(func() -> void: _stick_up())
	step_until("settled on the entry", func() -> bool: return not C().steps.moving, 4.0)
	step_do(func() -> void: ok("no teaching the second time", C().steps.p == OurSteps.ENTRY and C().steps.taught, str(C().steps.p)))
	_stick_step(Vector2i(0, 1), 0.0)
	step_do(func() -> void:
		ok("the reset is offered on the floor", _focus() == "steps_reset", _focus())
		ok("reset (the interact button)", game.try_interact())
		ok("reset: both of you back at the entry", C().steps.p == OurSteps.ENTRY and C().steps.h == OurSteps.ENTRY and C().steps.active))
	step_wait(0.4)
	# the whole answer by the stick, each push a little off true (a thumb), the BFS path
	var path: Array = OurSteps.solve()["path"]
	var noise := [17.0, -22.0, 9.0, -14.0, 24.0, -6.0, 19.0, -25.0, 3.0, -18.0, 12.0, -9.0, 21.0, -3.0]
	for i in path.size():
		_stick_step(path[i], noise[i % noise.size()])
		if i == 4:
			step_do(func() -> void:
				ok("mid-way you and she have drifted apart", C().steps.p != C().steps.h, "p %s h %s" % [C().steps.p, C().steps.h]))
	step_until("both plates lit: solved", func() -> bool: return C().state["hollow_done"], 4.0)
	step_do(func() -> void:
		ok("(v1.0) solved through the stick, on the BFS path", C().steps.p == OurSteps.Y_PLATE and C().steps.h == OurSteps.H_PLATE and not C().steps.active, "p %s h %s" % [C().steps.p, C().steps.h])
		ok("both plates lit", float(C().steps.plate_y.get_shader_parameter("lit")) > 0.9 and float(C().steps.plate_h.get_shader_parameter("lit")) > 0.9))
	step_wait(0.5)
	var t40 := OurSteps.tile(OurSteps.Y_PLATE)
	var t20 := OurSteps.tile(OurSteps.ENTRY)
	walk_path("off the floor (free now)", [[t40.x, t40.z], [t20.x, t20.z], [near_e.x, near_e.z], [17.85, -10.3], [17.85, -11.8]])
	step_until("the gate rises", func() -> bool: return not game.level.named["hw_gate"].enabled, 3.0)
	step_wait(2.0)
	walk_path("up the ramp to the court", [[18.3, -13.0], [18.5, -16.2], [17.6, -17.8], [15.0, -18.4]])
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
	walk_path("through the mural door", [[12.0, -26.4], [12.0, -28.2]])
	step_wait(0.6)
	step_do(func() -> void:
		ok("(v0.9) beyond the mural door: the Tree of Shards, named, the music swells; the camera leans to it", game.visited.has("w:TS") and game.world.look_offset.length() > 0.3, str(game.world.look_offset))
		ok("(v0.9) the Tree of Shards: hundreds of shards, one multimesh", game.wonders.shard_mm.multimesh.instance_count >= 200))
	walk_path("into the maze", [[12.0, -30.0]])
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
	step_until("(v1.0) the Garden wing's Veil Seal rises", func() -> bool: return C().hub._seal_up["N"] and C().hub.seal_nodes["N"].position.y > 1.99, 4.0)
	walk_path("to the seal", [[10.3, -39.7]])
	step_do(func() -> void:
		ok("(v1.0) take the Seal of the Garden wing", _focus() == "seal_N" and game.try_interact(), _focus()))
	step_do(func() -> void:
		ok("(v1.0) the way on into the Echo Corridor is bolted from the other side", game.level.named["ec_bars"].enabled)
		walk_to(10.0, -42.0))
	step_wait(1.0)
	step_do(func() -> void:
		ok("(v1.0) the bars hold", P().z > -40.9, str(P()))
		game.cmd("stop"))
	# the North wing's way back: the Court's lever lowers the drawbridge to the Ledge
	step_do(func() -> void: tp(16.0, -20.4, -PI * 0.5))
	step_wait(0.3)
	step_do(func() -> void: ok("(v1.0) the Court's lever for the drawbridge (a way back)", _focus() == "drawbridge_w" and game.try_interact(), _focus()))
	step_until("the drawbridge falls", func() -> bool: return game.level.named["LB"].enabled, 4.0)
	walk_path("over the drawbridge to the Ledge", [[19.0, -20.4], [22.0, -20.4]])
	step_do(func() -> void: ok("(v1.0) on the Eidolon Ledge (the High wing's foot)", game.area == "eidolon_ledge", game.area))

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
	walk_path("up onto the high walkway", [[27.8, -22.4], [29.6, -22.4], [31.4, -22.4]])
	step_do(func() -> void: ok("(v1.0) up on the Mirror Walk", absf(P().y - 4.0) < 0.02, str(P())))
	walk_path("along the high walkway", [[31.4, -32.0]])
	step_wait(0.6)
	step_do(func() -> void: ok("(v0.9) on the walkway: the Upward Spring, named, the camera leans up toward the temple", game.visited.has("w:SP") and game.world.look_offset.y > 1.0, str(game.world.look_offset)))
	walk_path("on to the lift", [[31.4, -43.5], [31.4, -45.6]])
	step_until("(v1.0) from the top the lift takes you down", func() -> bool: return C().lift_h < 0.01 and absf(P().y - 2.0) < 0.02, 12.0)
	walk_path("off the lift", [[29.2, -45.9]])

	# ================================================================ 10. the scales: "Weight of a Reflection"
	step_do(func() -> void:
		var sols: Array = Chapter.solve_scales()
		var need_her := true
		for e in sols: need_her = need_her and int(e[1]) > 0
		ok("solver: several ways to level it, and every one needs her", sols.size() >= 3 and need_her, "%d" % sols.size())
		ok("left: the urn, 15", C().scale_torque(0) == Vector2i(15, 0)))
	step_do(func() -> void:
		ok("(v1.0) the bars to the Echo Corridor are down until the balance is won", game.level.named["sc_bars"].enabled)
		ok("(v1.0) down here, the lift stays down: the balance is not won", C().lift_h < 0.01))
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
	step_until("(v1.0) the balance won, the bars to the Echo Corridor rise", func() -> bool: return not game.level.named["sc_bars"].enabled, 4.0)
	walk_path("west into the Echo Corridor", [[27.0, -45.4], [24.0, -45.4]])
	# ================================================================ 9. the echo corridor: "Her Song"
	step_do(func() -> void: _mark = game.sfx.played.get("step_hall", 0))
	walk_path("down the corridor", [[10.4, -44.9], [14.0, -45.4]])
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
	walk_path("to the seal", [[17.7, -49.3]])
	step_do(func() -> void:
		ok("(v1.0) take the Seal of the High wing", _focus() == "seal_E" and game.try_interact(), _focus()))
	walk_path("to the bars at the corridor's end", [[18.3, -47.4], [18.3, -45.4], [10.4, -45.0], [10.0, -41.7]])
	step_do(func() -> void: ok("(v1.0) unbolt the bars: a way back through the Maze (the High wing's shortcut)", _focus() == "ec_unbolt" and game.try_interact(), _focus()))
	step_until("the bars rise", func() -> bool: return not game.level.named["ec_bars"].enabled, 3.0)
	step_do(func() -> void:
		ok("(v1.0) three seals in the satchel", (C().state["inv"]["seals"] as Array).size() == 3, str(C().state["inv"]["seals"]))
		tp(27.7, -21.3, PI))
	step_wait(0.4)
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
	step_do(func() -> void: ok("(v1.0) the gate will not count you before the seals are set", not C().hub.sockets_full()))
	for si in 3:
		var sk: int = si
		step_do(func() -> void:
			var fp: Vector3 = C().four_pos(sk)
			var away := Vector3(fp.x - Puzzles.SHRINE_C.x, 0.0, fp.z - Puzzles.SHRINE_C.z).normalized()
			var at := fp + away * 1.0
			var tang := Vector3(-away.z, 0.0, away.x)
			for cand in [fp + away * 1.0, fp + away * 0.8, fp + tang * 0.9, fp - tang * 0.9, fp + (away + tang).normalized() * 0.9, fp + (away - tang).normalized() * 0.9]:
				if not game.level.blocked(Vector2(cand.x, cand.z), Player.RADIUS) and game.level.circle_ok(Vector2(cand.x, cand.z), Player.RADIUS):
					at = cand
					break
			tp(at.x, at.z, atan2(away.x, away.z)))
		step_wait(0.25)
		step_do(func() -> void: ok("(v1.0) set a seal in the %s statue's socket" % ["first", "second", "third"][sk], _focus() == "socket%d" % sk and game.try_interact(), _focus()))
		step_wait(0.4)
	step_do(func() -> void: ok("(v1.0) the three seals are set: their statues' runes lit", C().hub.sockets_full() and float(C().four_mats[2].get_shader_parameter("lit")) > 0.9))
	step_do(func() -> void: tp(25.0, -28.9, PI))
	walk_path("round to the empty plinth", [[25.0, -28.9], [20.35, -28.9], [20.35, -33.93], [21.34, -33.93]])
	step_do(func() -> void:
		ok("standing on the empty plinth", C().on_four_plinth(), str(P()))
		var sc := Puzzles.SHRINE_C
		game.cmd("face:%f" % atan2(-(sc.x - P().x), -(sc.z - P().z)))       # (v0.8: you turn to face it yourself)
		ok("wait", _focus() == "four_wait" and game.try_interact(), _focus()))
	step_wait(1.8)
	step_do(func() -> void: ok("the plinths light one by one", float(C().four_mats[0].get_shader_parameter("lit")) > 0.9 and float(C().four_mats[3].get_shader_parameter("lit")) < 0.5))
	step_until("the gate counts you as the fourth", func() -> bool: return C().state["four"], 4.0)
	step_do(func() -> void:
		ok("the veil before the shrine is gone", not game.level.named["tholos_front"].enabled)
		ok("the solve jingle again", game.sfx.played.get("jingle", 0) >= 8))
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
		ok("cinematic: near geometry cut away, the crystal lifted out of the shot", game.world.cam.near > World.DIST - 10.0 and game.puzzles.crystal_lift > 1.0))
	step_wait(9.0)
	step_do(func() -> void:
		ok("cinematic: her reflection in the shrine pool", C().her.visible and float(C().her.body_mat.get_shader_parameter("vis")) > 0.5)
		ok("cinematic: camera looks down into the water", -game.world.pitch_node.rotation.x > deg_to_rad(47.0), "%.1f deg" % rad_to_deg(-game.world.pitch_node.rotation.x)))
	step_wait(7.0)           # t = 22 (the score: hands touch at 16.5 + 4.5)
	step_do(func() -> void:
		ok("cinematic: palm to palm", game.player.extra_reach > 0.9 and C().her.pose.reach > 0.9)
		ok("cinematic: Katoptron lights on you both", game.player.fig.runes_awake == 1 and C().her.runes_awake == 1))
	step_wait(16.0)          # t = 38 (veil lift swell)
	step_do(func() -> void: ok("cinematic: her veil lifts", C().her.veil_lift > 0.8 and C().her.veil.transform != C().her.rig.veil_base, "%.2f" % C().her.veil_lift))
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

	step_do(func() -> void:
		var f: Dictionary = game.juice.fired
		ok("(v1.0 juice) the chapter's physical moments all played (dust, grit, sparks, rings, wet stone, glints...)",
			f.size() >= 8 and int(f.get("dust_fall", 0)) >= 3 and int(f.get("grit", 0)) >= 3 and int(f.get("sparks", 0)) >= 2, str(f.keys()))
		ok("(v1.0 juice) no burst is left alive for long", game.juice.live < 40, str(game.juice.live)))
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
	# ---- v0.8.1 the interaction highlight follows the prompt's target, every frame of the chapter
	step_do(func() -> void:
		ok("interaction highlight: always on the target the button resolves to", hl_bad == 0 and hl_frames > 1000 and hl_on > 200, "%d frames, %d with a target, %d mismatches" % [hl_frames, hl_on, hl_bad])
		ok("interaction highlight: something visibly lit for every target (a mesh glow, or the floor ring)", hl_empty < 5, "%d" % hl_empty))
	# ---- v0.8 props: loaded, solid, and no required path closed
	step_do(func() -> void:
		var pr: Props = game.props
		var ok_load := pr.placed.size() == Props.PLACE.size()
		for e in pr.placed: ok_load = ok_load and (e[1] as MeshInstance3D).mesh != null and (e[1] as MeshInstance3D).mesh.get_surface_count() > 0
		ok("props: every placement loaded, on the marble", ok_load, "%d placed" % pr.placed.size())
		var solid := true
		for e in pr.placed:
			var c: Vector2 = (e[2] as Rect2).get_center()
			solid = solid and game.level.blocked(c, 0.05)
		ok("props: each one is solid (its centre blocked)", solid)
		var goals := [[-10.6, 1.7], [-11.3, -13.5], [0.0, -16.0], [3.85, -19.15], [8.4, -13.0], [8.6, -7.0], [12.0, -10.0], [11.15, -14.3], [21.0, -10.0],
			[12.0, -22.0], [13.0, -34.0], [17.0, -45.4], [29.0, -49.0], [25.5, -21.6], [21.34, -33.93], [28.0, -38.6], [25.0, -30.8]]
		var miss := _reach(goals)
		ok("props: every key place still reachable on foot from the gate", miss.is_empty(), str(miss)))
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
		ok("new game: the lift waits at the top (v1.0: you first meet it from the Ledge)", C().lift_h == 1.0)
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
var hl_frames := 0
var hl_bad := 0
var hl_on := 0
var hl_empty := 0
func _process(dt: float) -> void:
	t += dt
	# v0.8.1: the highlight is always on the prompt's own target (both are set together, last frame)
	if game and game.highlight and game.mode == "play":
		hl_frames += 1
		var fid: String = game.focus.id if game.focus else ""
		if game.highlight.id != fid: hl_bad += 1
		elif fid != "":
			hl_on += 1
			if game.highlight.meshes.is_empty() and not game.highlight._ring.visible and float(game.highlight._ring_mat.get_shader_parameter("k")) <= 0.0: hl_empty += 1
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
