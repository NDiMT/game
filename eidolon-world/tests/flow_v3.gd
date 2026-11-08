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

func _space_here() -> String:
	var g := game.level.region_at(Vector2(game.player.position.x, game.player.position.z))
	return Map3.key_of_region(g.name) if g else ""

func _process(dt: float) -> void:
	t += dt
	if not started:
		if t < 0.5: return
		for id in game.ch.pz: game.cmd("pz_solve:" + id)
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
	for s in Map3.SPACES:
		if area != "all" and s[8] != area and not (s[0] == "A"): continue
		ok("space %s (%s) visited" % [s[0], s[2]], visited.has(s[0]))
	print("FLOW3 marble %d, max dy/frame %.3f m at %s, %d legs, %.0f s walked" % [mc, max_dy, max_at, route.size() - 1, t])
	print("FLOW3 %s  area=%s checks=%d  failed=%d" % ["PASS" if errors == 0 else "FAIL", area, checks, errors])
	set_process(false)
	get_tree().quit(0 if errors == 0 else 1)
