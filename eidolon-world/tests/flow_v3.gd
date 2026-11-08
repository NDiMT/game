extends Node
## v3 FLOW (headless): Chapter I's v3 world (Map3) walked door to door with the real movement, in the PATH's order.
## Checks: Map3.audit() is clean; every leg is walkable straight (auto-walk) and lands in the space the route names;
## no frame pops the floor more than 0.4 m; every space of the walked part(s) is visited; the marble buffer holds.
## Puzzles stand solved (their gates open): they have their own test (tests/pz_test.tscn).
##   godot --headless --fixed-fps 60 --path . res://tests/flow_v3.tscn [-- --area=<part>]   (act1 west north east act3)
## Prints FLOW3 PASS / FLOW3 FAIL.

var game: Game3
var route: Array = []
var area := "all"
var i := 0
var leg_t := 0.0
var errors := 0
var checks := 0
var visited := {}
var last_y := NAN
var max_dy := 0.0
var max_at := ""
var started := false
var t := 0.0
# (phase 5) frame cost while walking: per space [frames, sum ms, worst ms], the frames over 4 ms (and those in the
# first second after a space is entered: the room-enter hitch); report only (headless timings are not the web's)
var perf := {}
var spikes: Array = []
var _sp_prev := ""
var _enter_n := 0
var _enter_worst := {}
var _last_p := {}
var _fr_t0 := 0
var _fr_us := 0
## brackets every node's _process in a frame (first / last by process_priority): that frame's script time
class Bracket extends Node:
	var first := true
	var host
	func _process(_dt: float) -> void:
		if first: host._fr_t0 = Time.get_ticks_usec()
		else: host._fr_us = Time.get_ticks_usec() - host._fr_t0

func ok(label: String, pass_: bool, detail := "") -> void:
	checks += 1
	if not pass_: errors += 1
	if not pass_ or OS.get_cmdline_user_args().has("--verbose"): print("%s  %s %s" % ["PASS" if pass_ else "FAIL", label, detail])

func _ready() -> void:
	Game.autotest = true
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--area="): area = a.substr(7)
	if area != "all" and not (area in Map3.PARTS):
		print("FLOW3 FAIL  unknown area '%s'" % area)
		set_process(false)
		get_tree().quit(1)
		return
	for p in Map3.audit(): ok("map3 audit", false, p)
	route = Map3.route(area)
	game = load("res://scenes/main3.tscn").instantiate()
	add_child(game)
	game.prof_on = true
	for f in [true, false]:
		var b := Bracket.new()
		b.first = f
		b.host = self
		b.process_priority = -100000 if f else 100000
		add_child(b)

func _space_here() -> String:
	var g := game.level.region_at(Vector2(game.player.position.x, game.player.position.z))
	return Map3.key_of_region(g.name) if g else ""

func _process(dt: float) -> void:
	t += dt
	if not started:
		if t < 0.5: return
		# (the bridge stands while unwalked: it falls behind her as she crosses; its stagger and look are a story
		# moment, not the walk's; the shrine's film is the chapter's end, not the walk's)
		for id in game.ch.pz: if not (id in ["I21", "I23"]): game.cmd("pz_solve:" + id)
		game.ch.pz["I21"].set("_sagged", true)
		game.cmd("pool_road:1")                       # (phase 2: the pool is water and the wing roads barred; walk the whole map)
		game.ch.pz["A"].open_roads(true)
		var s: Array = route[0]
		game.cmd("tp:%f:%f" % [s[0], s[1]])
		started = true
		i = 1
		_go()
		return
	var p := game.player.position
	if not is_nan(last_y):
		if absf(p.y - last_y) > max_dy:
			max_dy = absf(p.y - last_y)
			max_at = "%s (%.1f, %.1f)" % [_space_here(), p.x, p.z]
		if absf(p.y - last_y) > 0.4: ok("no floor pop on leg %d" % i, false, "dy %.2f at %s" % [p.y - last_y, p])
	last_y = p.y
	var sp := _space_here()
	if sp != "" and not sp.contains("~"): visited[sp] = true
	var ms := _fr_us / 1000.0          # (the frame before: this node runs mid-frame)
	if sp != "":
		var k := sp.get_slice("~", 0)
		if k != _sp_prev:
			_sp_prev = k
			_enter_n = 60
		var pe: Array = perf.get(k, [0, 0.0, 0.0])
		pe[0] += 1; pe[1] += ms; pe[2] = maxf(pe[2], ms)
		perf[k] = pe
		if _enter_n > 0:
			_enter_n -= 1
			_enter_worst[k] = maxf(float(_enter_worst.get(k, 0.0)), ms)
		if ms > 4.0:
			var top := ""
			var d := []
			for q in game.prof: d.append([(int(game.prof[q]) - int(_last_p.get(q, 0))) / 1000.0, q])
			d.sort_custom(func(a: Array, b: Array) -> bool: return a[0] > b[0])
			for q in d.slice(0, 3): top += " %s %.1f" % [q[1], q[0]]
			spikes.append("%s %.1f ms%s |%s" % [k, ms, " (entering)" if _enter_n > 0 else "", top])
	_last_p = game.prof.duplicate()
	leg_t += dt
	var e: Array = route[i]
	var goal := Vector2(e[0], e[1])
	var d := Vector2(p.x, p.z).distance_to(goal)
	if game.auto_target == Vector3.INF or d < 0.15:
		ok("leg %d -> %s (%.1f, %.1f)" % [i, e[2], e[0], e[1]], d < 0.6, "stopped %.2f m short at %s" % [d, p])
		var here := _space_here()
		ok("waypoint %d is in %s" % [i, e[2]], here == e[2], "in '%s'" % here)
		if d >= 0.6: game.cmd("tp:%f:%f" % [goal.x, goal.y])
		_next()
	elif leg_t > _limit():
		ok("leg %d -> %s reached in time" % [i, e[2]], false, "%.1f m left at %s" % [d, p])
		game.cmd("tp:%f:%f" % [goal.x, goal.y])
		_next()

func _limit() -> float:
	var a: Array = route[i - 1]
	var b: Array = route[i]
	return Vector2(a[0], a[1]).distance_to(Vector2(b[0], b[1])) / 1.2 + 4.0

func _go() -> void:
	var e: Array = route[i]
	leg_t = 0.0
	game.cmd("walk:%f:%f" % [e[0], e[1]])

func _next() -> void:
	i += 1
	if i >= route.size():
		_finish()
		return
	_go()

func _marble_instances() -> int:
	var total := 0
	for n in game.find_children("*", "GeometryInstance3D", true, false):
		var gi := n as GeometryInstance3D
		var mats: Array = [gi.material_override]
		if gi is MeshInstance3D and (gi as MeshInstance3D).mesh:
			for k in (gi as MeshInstance3D).mesh.get_surface_count(): mats.append((gi as MeshInstance3D).get_surface_override_material(k))
		for m in mats:
			if m is ShaderMaterial and (m as ShaderMaterial).shader and (m as ShaderMaterial).shader.resource_path.get_file().begins_with("marble"):
				total += 1
				break
	return total

func _finish() -> void:
	var mc := _marble_instances()
	ok("marble instances <= 250", mc <= 250, "%d" % mc)
	var st: int = game.sfx.played.get("step", 0)
	ok("footsteps come from her real foot plants (HeroineRig.step)", st > 20, "%d steps" % st)
	for s in Map3.SPACES:
		if area != "all" and s[8] != area and not (s[0] == "A"): continue
		ok("space %s (%s) visited" % [s[0], s[2]], visited.has(s[0]))
	var worst := []
	for k in perf: worst.append([perf[k][2], k, perf[k][1] / maxf(perf[k][0], 1.0), _enter_worst.get(k, 0.0)])
	worst.sort_custom(func(a: Array, b: Array) -> bool: return a[0] > b[0])
	var top := ""
	for w in worst.slice(0, 8): top += "%s max %.1f avg %.2f enter %.1f; " % [w[1], w[0], w[2], w[3]]
	print("FLOW3 PERF frames>4ms %d  worst: %s" % [spikes.size(), top])
	for sk in spikes.slice(0, 60): print("FLOW3 SPIKE ", sk)
	print("FLOW3 marble %d, max dy/frame %.3f m at %s, %d legs, %.0f s walked" % [mc, max_dy, max_at, route.size() - 1, t])
	print("FLOW3 %s  area=%s checks=%d  failed=%d" % ["PASS" if errors == 0 else "FAIL", area, checks, errors])
	set_process(false)
	get_tree().quit(0 if errors == 0 else 1)
