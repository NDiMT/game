extends Node
## (Agent A, dev) the landmark dressing IN PLACE in the v2 world (W's Map2, built with EIDOLON_V2=1): every space shot from
## the real game camera standing in it; the recipes W has not switched on yet (PROPOSE) are built here on their proposed
## rects with the same kept-clear route, and their skips printed.
##   EIDOLON_V2=1 xvfb-run godot --path . --rendering-driver opengl3 --resolution 780x1688 res://dev_fx/dress_v2.tscn -- --shots=/abs/dir [--only=I5,A] [--low]
var game: Node
var shots := ""
var only: PackedStringArray = []
var i := -1
var t := 0.0
var _begun := false
var _moved := false
var _report: Array = []

func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shots="): shots = a.get_slice("=", 1)
		if a.begins_with("--only="): only = a.get_slice("=", 1).split(",")
	Map2.labels_on = false
	Game.autotest = true
	game = load("res://scenes/main.tscn").instantiate()
	add_child(game)

func _process(dt: float) -> void:
	t += dt
	if i == -1:
		if t > 2.0 and not _begun:
			_begun = true
			game.cmd("begin")
			if OS.get_cmdline_user_args().has("--low"): game.set_quality("low")
		if _begun and t > 3.0 and t < 3.5: game.cmd("skip")
		if _begun and t > 5.0 and t < 5.5: game.cmd("skip")
		if t > 7.0:
			_propose()
			_next()
		return
	if i >= Map2.SPACES.size():
		for r in _report: print(r)
		get_tree().quit(); return
	var s: Array = Map2.SPACES[i]
	if not _moved:
		_moved = true; t = 0.0
		var p := _stand(s[0])
		game.cmd("tp:%f:%f" % [p.x, p.y])
		return
	if t > 3.0:
		var nm := "v2d-%s" % s[0]
		if shots != "": get_viewport().get_texture().get_image().save_png("%s/%s.png" % [shots, nm])
		_report.append("%s %s: %d draw calls" % [s[0], s[2], Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME)])
		print("shot ", nm)
		_next()

func _next() -> void:
	i += 1; t = 0.0; _moved = false
	while i < Map2.SPACES.size() and only.size() > 0 and not only.has(str(Map2.SPACES[i][0])): i += 1

## where to stand in a space: its centre if it is walkable, else the walkable point nearest it
func _stand(id: String) -> Vector2:
	var lv: Level = game.level
	var r := Map2.space_rect(id)
	var c := r.get_center()
	if lv.on_ground(c): return c
	var best := c
	var bd := INF
	for gx in 21:
		for gz in 21:
			var q := r.position + r.size * Vector2(gx / 20.0, gz / 20.0)
			if lv.on_ground(q) and q.distance_to(c) < bd:
				bd = q.distance_to(c); best = q
	return best

func _propose() -> void:
	_report.append_array(V2Proposed.build(game.level))
