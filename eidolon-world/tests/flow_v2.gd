extends Node
## v2 rebuild FLOW test (headless): Chapter I's new world walked end to end with the real movement, in the script's
## order (Map2.ROUTE: the wake, Act 1, the three wings, Act 3). Every leg must be walkable straight (the auto-walk),
## every waypoint must land in the space the route names, no frame may pop the floor height by more than 0.4 m,
## and every space of Map2.SPACES must be visited. Prints FLOW PASS / FLOW FAIL.
## (block-out phase: doors and gates stand open; later phases close them and solve them on the way)

var game: Game
var i := 0
var leg_t := 0.0
var errors := 0
var checks := 0
var visited := {}
var order: Array = []
var last_y := NAN
var max_dy := 0.0
var started := false
var t := 0.0

func ok(label: String, pass_: bool, detail := "") -> void:
	checks += 1
	if not pass_: errors += 1
	if not pass_ or OS.get_cmdline_user_args().has("--verbose"): print("%s  %s %s" % ["PASS" if pass_ else "FAIL", label, detail])

func _ready() -> void:
	Game.autotest = true
	Map2.enabled = true
	game = load("res://scenes/main.tscn").instantiate()
	add_child(game)

func _space_here() -> String:
	var g := game.level.region_at(Vector2(game.player.position.x, game.player.position.z))
	return Map2.space_of_region(g.name) if g else ""

func _process(dt: float) -> void:
	t += dt
	if not started:
		if t < 0.5: return
		game.jump("waking_pool")
		# (the beats' doors and gaps open: this walks the world, the puzzles have their own tests)
		var cs: Dictionary = game.chapter.state
		cs["a1"] = {"plate": true, "glass": true, "slab": true, "lamp": true, "atrium": true, "gaze": true}
		if not ("lamp" in cs["inv"]["items"]): (cs["inv"]["items"] as Array).append("lamp")
		game.chapter.apply_state()
		for n in Map2.NO_FLOOR: game.level.set_enabled(Map2.ZP + n, true)
		var s: Array = Map2.ROUTE[0]
		game.cmd("tp:%f:%f:%f" % [Map2.O.x + s[0], Map2.O.z + s[1], PI * 0.5])
		started = true
		i = 1
		leg_t = 0.0
		_go()
		return
	var p := game.player.position
	if not is_nan(last_y): max_dy = maxf(max_dy, absf(p.y - last_y))
	if absf(p.y - last_y) > 0.4 and not is_nan(last_y): ok("no floor pop on leg %d" % i, false, "dy %.2f at %s" % [p.y - last_y, p - Map2.O])
	last_y = p.y
	var sp := _space_here()
	if sp != "" and not visited.has(sp):
		visited[sp] = true
		order.append(sp)
	leg_t += dt
	var e: Array = Map2.ROUTE[i]
	var goal := Vector2(Map2.O.x + e[0], Map2.O.z + e[1])
	var d := Vector2(p.x, p.z).distance_to(goal)
	if game.auto_target == Vector3.INF or d < 0.15:
		ok("leg %d -> %s (%.1f, %.1f)" % [i, e[2], e[0], e[1]], d < 0.6, "stopped %.2f m short at %s" % [d, p - Map2.O])
		var here := _space_here()
		ok("waypoint %d is in %s" % [i, e[2]], here == Map2.space_of_region(Map2.ZP + str(e[2])), "in '%s'" % here)
		if d >= 0.6: game.cmd("tp:%f:%f" % [goal.x, goal.y])         # (carry on from where the route says)
		_next()
	elif leg_t > _limit():
		ok("leg %d -> %s reached in time" % [i, e[2]], false, "%.1f m left at %s; in the way: %s" % [d, p - Map2.O, _blockers(Vector2(p.x, p.z))])
		game.cmd("tp:%f:%f" % [goal.x, goal.y])
		_next()

## what stands within a metre of her (obstacles, solid footprints), for a stuck leg
func _blockers(q: Vector2) -> String:
	var out := []
	for o in game.level.obstacles + game.level.solid_obs:
		var ob: Level.Obstacle = o
		if not ob.enabled: continue
		var dd := q.distance_to(ob.c) - ob.rad if ob.circle else q.distance_to(Vector2(clampf(q.x, ob.r.position.x, ob.r.end.x), clampf(q.y, ob.r.position.y, ob.r.end.y)))
		if dd < 1.0: out.append("%s %s" % [ob.name, (str(ob.c - Vector2(Map2.O.x, Map2.O.z)) + " r%.2f" % ob.rad) if ob.circle else str(Rect2(ob.r.position - Vector2(Map2.O.x, Map2.O.z), ob.r.size))])
	return ", ".join(out)

func _limit() -> float:
	var a: Array = Map2.ROUTE[i - 1]
	var b: Array = Map2.ROUTE[i]
	return Vector2(a[0], a[1]).distance_to(Vector2(b[0], b[1])) / 1.2 + 4.0

func _go() -> void:
	var e: Array = Map2.ROUTE[i]
	game.cmd("walk:%f:%f" % [Map2.O.x + e[0], Map2.O.z + e[1]])

func _next() -> void:
	i += 1
	leg_t = 0.0
	if i >= Map2.ROUTE.size():
		_finish()
		return
	_go()

## the marble's per-instance values live in one GL buffer: 4096 slots, 16 per instance on the web = 256 instances
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
	ok("the marble's per-instance buffer holds the world (<= 250 of its 256 instances on the web)", mc <= 250, "%d marble instances" % mc)
	print("FLOW marble instances %d / 256" % mc)
	for s in Map2.SPACES:
		ok("space %s (%s) visited" % [s[0], s[1]], visited.has(s[0]))
	print("FLOW order: " + " ".join(order))
	print("FLOW max height change per frame %.3f m, %d legs, %.0f s walked" % [max_dy, Map2.ROUTE.size() - 1, t])
	print("FLOW %s  checks=%d  failed=%d" % ["PASS" if errors == 0 else "FAIL", checks, errors])
	set_process(false)
	get_tree().quit(0 if errors == 0 else 1)
